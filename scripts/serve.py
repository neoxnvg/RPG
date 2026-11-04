"""Static RPG host plus same-origin shared player presence (Python standard library)."""
import argparse
import fcntl
import functools
import http.server
import json
import math
import os
from pathlib import Path
import re
import signal
import threading
import time
import unicodedata
from urllib.parse import parse_qs, urlsplit

VERSION = 2
MAX_PLAYERS = 64
PLAYER_TTL = 20
ID_PATTERN = re.compile(r'[A-Za-z0-9_-]{16,80}\Z')
MAP_IDS = {'vespera', 'map-01', 'map-02'}
VARIANTS = {'seraph', 'eclipse', 'phoenix'}


def configuration():
    state = Path(os.environ.get('RPG_STATE_DIR', str(Path.home() / '.local/share/rpg'))).expanduser()
    config_path = state / 'server-config.json'
    config = json.loads(config_path.read_text()) if config_path.is_file() else {}
    if not isinstance(config, dict):
        raise ValueError('server-config.json must contain a JSON object')
    root = Path(os.environ.get('RPG_WEB_DIR', str(config.get('webDir', Path.home() / 'rpg-web')))).expanduser()
    bind = os.environ.get('RPG_BIND', config.get('bind', '127.0.0.1'))
    port = int(os.environ.get('RPG_PORT', config.get('port', 8002)))
    if not isinstance(bind, str) or not 1 <= port <= 65535:
        raise ValueError('Invalid RPG bind/port configuration')
    return state, root, bind, port


def process_identity(pid, script):
    """Match this account, exact Python script argument and Linux process start time."""
    try:
        proc = Path('/proc') / str(pid)
        if pid == os.getpid() or proc.stat().st_uid != os.getuid():
            return None
        args = [part.decode() for part in (proc / 'cmdline').read_bytes().split(b'\0') if part]
        if len(args) not in (2, 3) or not Path(args[0]).name.startswith('python'):
            return None
        if len(args) == 3 and args[1] != '-u':
            return None
        if Path(args[-1]).resolve() != script:
            return None
        return (proc / 'stat').read_text().rsplit(')', 1)[1].split()[19]
    except (OSError, ValueError, UnicodeError):
        return None


def stop_owned(state):
    """Stop only our exact script under our UID; also supports the old no-PID server."""
    state.mkdir(parents=True, exist_ok=True)
    script = Path(__file__).resolve()
    with (state / 'server.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            return  # Nothing holds our server lock.
        except BlockingIOError:
            pass
    candidates = []
    record_path = state / 'server.pid.json'
    if record_path.is_file():
        try:
            record = json.loads(record_path.read_text())
            pid = int(record['pid'])
            start = process_identity(pid, script)
            if start and start == record['start'] and record['script'] == str(script):
                candidates.append((pid, start))
        except (OSError, ValueError, KeyError, TypeError):
            pass
    if not candidates:
        # Legacy versions did not write a PID record. Never use pkill or a port owner.
        for entry in Path('/proc').iterdir():
            if entry.name.isdigit():
                pid = int(entry.name)
                start = process_identity(pid, script)
                if start:
                    candidates.append((pid, start))
    if len(candidates) != 1:
        raise SystemExit('Cannot safely identify the RPG server holding its lock; inspect server.log and process arguments.')
    pid, start = candidates[0]
    fd = None
    try:
        if hasattr(os, 'pidfd_open') and hasattr(signal, 'pidfd_send_signal'):
            fd = os.pidfd_open(pid)
        if process_identity(pid, script) != start:
            return
        if fd is not None:
            signal.pidfd_send_signal(fd, signal.SIGTERM)
        else:
            os.kill(pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    finally:
        if fd is not None:
            os.close(fd)
    deadline = time.monotonic() + 8
    while time.monotonic() < deadline:
        with (state / 'server.lock').open('a') as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                return
            except BlockingIOError:
                time.sleep(.1)
    raise SystemExit('The owned RPG server did not stop; no other process was terminated.')


def validate_player(value):
    if not isinstance(value, dict) or not ID_PATTERN.fullmatch(str(value.get('id', ''))):
        raise ValueError('Invalid player id')
    if value.get('mapId') not in MAP_IDS or value.get('variant') not in VARIANTS:
        raise ValueError('Invalid map or character')
    position = value.get('position')
    if not isinstance(position, list) or len(position) != 3:
        raise ValueError('Invalid position')
    for number, low, high in zip(position, (-70, -5, -140), (70, 25, 140)):
        if isinstance(number, bool) or not isinstance(number, (int, float)) or not low <= number <= high or not math.isfinite(number):
            raise ValueError('Position outside the world')
    rotation = value.get('rotation')
    if isinstance(rotation, bool) or not isinstance(rotation, (int, float)) or not -100000 <= rotation <= 100000 or not math.isfinite(rotation):
        raise ValueError('Invalid rotation')
    name = value.get('name', 'Aventureiro')
    if not isinstance(name, str) or not 1 <= len(name.strip()) <= 24:
        raise ValueError('Name must contain 1 to 24 characters')
    name = ''.join(c for c in name.strip() if not unicodedata.category(c).startswith('C') and c not in '<>&')
    if not name:
        raise ValueError('Invalid name')
    return {'id': value['id'], 'mapId': value['mapId'], 'position': position,
            'rotation': math.remainder(rotation, math.tau), 'variant': value['variant'], 'name': name}


class Presence:
    def __init__(self):
        self.lock = threading.Lock()
        self.players = {}
        self.streams = 0

    def prune(self, now):
        for player_id in [key for key, player in self.players.items() if now - player['_seen'] > PLAYER_TTL]:
            del self.players[player_id]

    def update(self, player):
        now = time.monotonic()
        with self.lock:
            self.prune(now)
            existing = self.players.get(player['id'])
            if not existing and len(self.players) >= MAX_PLAYERS:
                return 503, 'The world is full'
            if existing and now - existing['_rateStart'] < 1 and existing['_rateCount'] >= 12:
                return 429, 'Updates are too frequent'
            reset_rate = not existing or now - existing['_rateStart'] >= 1
            player['_seen'] = now
            player['_rateStart'] = now if reset_rate else existing['_rateStart']
            player['_rateCount'] = 1 if reset_rate else existing['_rateCount'] + 1
            self.players[player['id']] = player
        return 200, 'ok'

    def snapshot(self, player_id):
        with self.lock:
            self.prune(time.monotonic())
            players = [{key: value for key, value in player.items() if not key.startswith('_')}
                       for player in self.players.values()]
        return {'selfId': player_id, 'players': players, 'serverTime': round(time.time() * 1000)}


class RPGServer(http.server.ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, address, handler):
        self.presence = Presence()
        super().__init__(address, handler)


class Handler(http.server.SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store' if self.path.startswith('/api/') else 'no-cache')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

    def log_message(self, format, *args):
        # Position updates run several times per second; retain errors and static logs.
        if self.path.startswith('/api/') and len(args) > 1 and str(args[1]) == '200':
            return
        super().log_message(format, *args)

    def json_reply(self, status, value):
        body = json.dumps(value, separators=(',', ':'), allow_nan=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)

    def same_origin(self):
        origin = self.headers.get('Origin')
        try:
            return not origin or urlsplit(origin).netloc == self.headers.get('Host')
        except ValueError:
            return False

    def do_GET(self):
        route = urlsplit(self.path)
        if route.path == '/api/status':
            self.json_reply(200, {'version': VERSION, 'mode': 'shared-presence',
                                  'players': len(self.server.presence.snapshot('')['players']), 'capacity': MAX_PLAYERS})
        elif route.path == '/api/events':
            if not self.same_origin():
                self.json_reply(403, {'error': 'Same-origin connection required'})
                return
            player_id = parse_qs(route.query).get('id', [''])[0]
            if not ID_PATTERN.fullmatch(player_id):
                self.json_reply(400, {'error': 'Invalid player id'})
                return
            with self.server.presence.lock:
                if self.server.presence.streams >= MAX_PLAYERS * 2:
                    self.json_reply(503, {'error': 'Too many connections'})
                    return
                self.server.presence.streams += 1
            try:
                self.send_response(200)
                self.send_header('Content-Type', 'text/event-stream; charset=utf-8')
                self.send_header('Connection', 'keep-alive')
                self.send_header('X-Accel-Buffering', 'no')
                self.end_headers()
                self.connection.settimeout(8)
                self.wfile.write(b'retry: 3000\n\n')
                while True:
                    body = json.dumps(self.server.presence.snapshot(player_id), separators=(',', ':'), allow_nan=False)
                    self.wfile.write(('event: state\ndata: ' + body + '\n\n').encode())
                    self.wfile.flush()
                    time.sleep(.25)
            except (BrokenPipeError, ConnectionResetError, TimeoutError, OSError):
                pass
            finally:
                with self.server.presence.lock:
                    self.server.presence.streams -= 1
                self.close_connection = True
        elif route.path.startswith('/api/'):
            self.json_reply(404, {'error': 'Unknown API endpoint'})
        else:
            super().do_GET()

    def do_POST(self):
        self.close_connection = True
        if urlsplit(self.path).path != '/api/player':
            self.json_reply(404, {'error': 'Unknown API endpoint'})
            return
        if not self.same_origin():
            self.json_reply(403, {'error': 'Same-origin connection required'})
            return
        if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
            self.json_reply(415, {'error': 'Expected application/json'})
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 2048:
                self.json_reply(413, {'error': 'Request too large or empty'})
                return
            self.connection.settimeout(5)
            value = json.loads(self.rfile.read(length))
            player = validate_player(value)
        except (ValueError, TypeError, TimeoutError, OSError):
            self.json_reply(400, {'error': 'Invalid player update'})
            return
        status, message = self.server.presence.update(player)
        self.json_reply(status, {'ok': status == 200, 'error': message if status != 200 else None})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stop-owned', action='store_true', help='Stop only this account\'s exact RPG server process')
    args = parser.parse_args()
    state, root, bind, port = configuration()
    state.mkdir(parents=True, exist_ok=True)
    if args.stop_owned:
        stop_owned(state)
        return
    lock = (state / 'server.lock').open('a')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        return
    if not (root / 'index.html').is_file():
        raise SystemExit('Missing RPG index.html: check RPG_WEB_DIR')
    handler = functools.partial(Handler, directory=str(root))
    server = RPGServer((bind, port), handler)
    start = Path('/proc/self/stat').read_text().rsplit(')', 1)[1].split()[19]
    record = {'pid': os.getpid(), 'start': start, 'script': str(Path(__file__).resolve()), 'bind': bind, 'port': server.server_port}
    (state / 'server.pid.json').write_text(json.dumps(record))
    print(f'RPG listening on {bind}:{server.server_port}; shared presence API v{VERSION}', flush=True)
    try:
        server.serve_forever()
    finally:
        server.server_close()
        lock.close()


if __name__ == '__main__':
    main()
