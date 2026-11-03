"""Loopback-only static server with a process-lifetime lock; no root needed."""
import fcntl
import functools
import http.server
import os
from pathlib import Path

state = Path(os.environ.get('RPG_STATE_DIR', str(Path.home() / '.local' / 'share' / 'rpg')))
state.mkdir(parents=True, exist_ok=True)
lock = (state / 'server.lock').open('a')
try:
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
except BlockingIOError:
    raise SystemExit(0)

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

root = Path(os.environ.get('RPG_WEB_DIR', str(Path.home() / 'rpg-web')))
if not (root / 'index.html').is_file():
    raise SystemExit('Missing ~/rpg-web/index.html')
server = http.server.ThreadingHTTPServer(
    ('127.0.0.1', int(os.environ.get('RPG_PORT', '8002'))), functools.partial(Handler, directory=str(root)))
print(f'RPG listening on 127.0.0.1:{server.server_port}', flush=True)
server.serve_forever()
