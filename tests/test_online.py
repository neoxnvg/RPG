"""Run with: python3 -m unittest discover -s tests -p 'test_online.py' -v"""
import http.client
import importlib.util
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/serve.py'
spec = importlib.util.spec_from_file_location('rpg_server', SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def player(player_id='test-player-00000001', **values):
    return {'id': player_id, 'mapId': 'map-01', 'position': [1, 0, 108],
            'rotation': .5, 'variant': 'seraph', 'name': 'Guardião', **values}


class ValidationTests(unittest.TestCase):
    def test_bounds_types_and_numeric_edge_cases(self):
        for values in ({'position': [1, 0, float('nan')]}, {'position': [71, 0, 0]},
                       {'position': [10 ** 1000, 0, 0]}, {'position': [False, 0, 0]},
                       {'rotation': float('inf')}, {'mapId': 'map-50'}, {'variant': 'unknown'}):
            with self.subTest(values=str(values)[:70]), self.assertRaises(ValueError):
                module.validate_player(player(**values))
        clean = module.validate_player(player(name='  <Guardião>\x00  '))
        self.assertEqual(clean['name'], 'Guardião')

    def test_capacity_rate_and_stale_cleanup(self):
        presence = module.Presence()
        for index in range(module.MAX_PLAYERS):
            self.assertEqual(presence.update(module.validate_player(player(f'test-player-{index:08d}')))[0], 200)
        self.assertEqual(presence.update(module.validate_player(player('test-player-over-capacity')))[0], 503)
        for _ in range(11):
            self.assertEqual(presence.update(module.validate_player(player('test-player-00000000')))[0], 200)
        self.assertEqual(presence.update(module.validate_player(player('test-player-00000000')))[0], 429)
        for value in presence.players.values():
            value['_seen'] -= module.PLAYER_TTL + 1
        self.assertEqual(presence.snapshot('self')['players'], [])
        self.assertEqual(presence.update(module.validate_player(player('test-player-after-cleanup')))[0], 200)


class TransportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.folder = tempfile.TemporaryDirectory(prefix='rpg-online-test-')
        base = Path(cls.folder.name)
        cls.state = base / 'state'
        cls.state.mkdir()
        root = base / 'web'
        root.mkdir()
        (root / 'index.html').write_text('<title>AETHER test</title>')
        shutil.copyfile(SCRIPT, cls.state / 'serve.py')
        with socket.socket() as probe:
            probe.bind(('127.0.0.1', 0))
            cls.port = probe.getsockname()[1]
        cls.env = dict(os.environ, RPG_STATE_DIR=str(cls.state), RPG_WEB_DIR=str(root), RPG_PORT=str(cls.port), RPG_BIND='127.0.0.1')
        cls.log = (base / 'server.log').open('w+')
        cls.process = subprocess.Popen(['python3', '-u', str(cls.state / 'serve.py')], env=cls.env, stdout=cls.log, stderr=cls.log)
        cls.base = f'http://127.0.0.1:{cls.port}'
        for _ in range(50):
            try:
                with urlopen(cls.base + '/api/status', timeout=1) as response:
                    if json.load(response)['version'] == 2:
                        return
            except OSError:
                time.sleep(.05)
        cls.log.seek(0)
        raise RuntimeError(cls.log.read())

    @classmethod
    def tearDownClass(cls):
        cls.process.terminate()
        cls.process.wait(timeout=5)
        cls.log.close()
        cls.folder.cleanup()

    def post(self, data, headers=None):
        request = Request(self.base + '/api/player', data=json.dumps(data).encode(),
                          headers={'Content-Type': 'application/json', **(headers or {})}, method='POST')
        with urlopen(request, timeout=3) as response:
            return json.load(response)

    def read_snapshot(self, response, condition=lambda value: True):
        for _ in range(80):
            line = response.readline().decode()
            if line.startswith('data: '):
                state = json.loads(line[6:])
                if condition(state):
                    return state
        self.fail('Expected SSE state did not arrive')

    def test_01_two_clients_exchange_real_sse_positions_and_maps(self):
        alice = player('alice-player-00000001')
        bob = player('bob-player-0000000002', mapId='vespera', position=[0, 0, 8], variant='eclipse', name='Mago')
        self.assertTrue(self.post(alice)['ok'])
        self.assertTrue(self.post(bob)['ok'])
        first = http.client.HTTPConnection('127.0.0.1', self.port, timeout=5)
        second = http.client.HTTPConnection('127.0.0.1', self.port, timeout=5)
        try:
            first.request('GET', '/api/events?id=' + alice['id'])
            second.request('GET', '/api/events?id=' + bob['id'])
            stream_a, stream_b = first.getresponse(), second.getresponse()
            self.assertEqual(stream_a.getheader('Content-Type'), 'text/event-stream; charset=utf-8')
            self.assertEqual(stream_a.getheader('X-Accel-Buffering'), 'no')
            state_a, state_b = self.read_snapshot(stream_a), self.read_snapshot(stream_b)
            self.assertEqual(state_a['selfId'], alice['id'])
            self.assertEqual(state_b['selfId'], bob['id'])
            self.assertEqual({p['mapId'] for p in state_a['players']}, {'vespera', 'map-01'})
            alice['position'] = [6, 0, 95]
            self.post(alice)
            moved = self.read_snapshot(stream_b, lambda state: any(p['id'] == alice['id'] and p['position'][0] == 6 for p in state['players']))
            self.assertEqual(next(p for p in moved['players'] if p['id'] == alice['id'])['position'], [6, 0, 95])
        finally:
            first.close()
            second.close()

    def test_02_static_health_validation_and_origin(self):
        with urlopen(self.base + '/') as response:
            self.assertIn(b'AETHER', response.read())
        with urlopen(self.base + '/api/status') as response:
            self.assertEqual(json.load(response)['mode'], 'shared-presence')
        with self.assertRaises(HTTPError) as rejected:
            self.post(player(position=[1000, 0, 0]))
        self.assertEqual(rejected.exception.code, 400)
        with self.assertRaises(HTTPError) as rejected:
            self.post(player(), {'Origin': 'https://unrelated.example'})
        self.assertEqual(rejected.exception.code, 403)
        with self.assertRaises(HTTPError) as rejected:
            self.post(player(name='x' * 3000))
        self.assertEqual(rejected.exception.code, 413)

    def test_03_duplicate_server_lock_and_safe_stop(self):
        duplicate = subprocess.run(['python3', '-u', str(self.state / 'serve.py')], env=self.env, timeout=5, capture_output=True)
        self.assertEqual(duplicate.returncode, 0)
        self.assertIsNone(self.process.poll())
        # Another Python service (the Shot case) must remain running.
        unrelated = subprocess.Popen(['python3', '-c', 'import time; time.sleep(30)'])
        try:
            stopped = subprocess.run(['python3', str(self.state / 'serve.py'), '--stop-owned'], env=self.env, timeout=10, capture_output=True)
            self.assertEqual(stopped.returncode, 0, stopped.stderr.decode())
            self.process.wait(timeout=5)
            self.assertIsNone(unrelated.poll())
        finally:
            unrelated.terminate()
            unrelated.wait(timeout=5)


class InstallerTests(unittest.TestCase):
    def test_reinstall_restarts_legacy_rpg_and_preserves_shot_cron(self):
        with tempfile.TemporaryDirectory(prefix='rpg-install-test-') as folder:
            base = Path(folder)
            source, checkout, state, fakebin = [base / name for name in ('source', 'rpg-web', 'state', 'bin')]
            source.mkdir()
            state.mkdir()
            fakebin.mkdir()
            (source / 'scripts').mkdir()
            for name in ('serve.py', 'refresh-server.sh', 'install-server.sh'):
                shutil.copyfile(SCRIPT.parent / name, source / 'scripts' / name)
            def git(*args):
                subprocess.run(['git', '-C', str(source), *args], check=True, capture_output=True)
            git('init', '--initial-branch=main')
            git('config', 'user.name', 'RPG Integration Test')
            git('config', 'user.email', 'test@example.invalid')
            git('add', '.')
            git('commit', '-m', 'server helpers')
            git('checkout', '--orphan', 'web')
            git('rm', '-rf', '.')
            (source / 'index.html').write_text('<title>AETHER fixture</title>')
            git('add', '.')
            git('commit', '-m', 'static game')
            subprocess.run(['git', 'clone', '--branch', 'web', str(source), str(checkout)], check=True, capture_output=True)
            cron = base / 'crontab'
            cron.write_text('* * * * * echo Shot # SHOT-MANAGED\n* * * * * old-rpg # RPG-MANAGED\n')
            fake_crontab = fakebin / 'crontab'
            fake_crontab.write_text('#!/bin/sh\nif [ "$1" = "-l" ]; then cat "$TEST_CRONFILE"; else cat "$1" > "$TEST_CRONFILE"; fi\n')
            fake_crontab.chmod(0o700)
            with socket.socket() as probe:
                probe.bind(('127.0.0.1', 0))
                port = probe.getsockname()[1]
            env = dict(os.environ, PATH=str(fakebin) + ':' + os.environ['PATH'], TEST_CRONFILE=str(cron),
                       RPG_STATE_DIR=str(state), RPG_WEB_DIR=str(checkout), RPG_PORT=str(port), RPG_BIND='127.0.0.1')
            # A legacy process at the identical owned path has no PID metadata.
            (state / 'serve.py').write_text("import fcntl, os, time\nfrom pathlib import Path\nlock = (Path(os.environ['RPG_STATE_DIR']) / 'server.lock').open('a')\nfcntl.flock(lock, fcntl.LOCK_EX)\nprint('locked', flush=True)\ntime.sleep(30)\n")
            legacy = subprocess.Popen(['python3', '-u', str(state / 'serve.py')], env=env, stdout=subprocess.PIPE)
            unrelated = subprocess.Popen(['python3', '-c', 'import time; time.sleep(30)'])
            try:
                self.assertEqual(legacy.stdout.readline(), b'locked\n')
                result = subprocess.run(['bash', str(SCRIPT.parent / 'install-server.sh')], env=env,
                                        capture_output=True, text=True, timeout=30)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertIn('RPG OK', result.stdout)
                legacy.wait(timeout=5)
                self.assertIsNone(unrelated.poll())
                installed_cron = cron.read_text()
                self.assertIn('# SHOT-MANAGED', installed_cron)
                self.assertEqual(installed_cron.count('# RPG-MANAGED'), 2)
                self.assertNotIn('old-rpg', installed_cron)
                self.assertEqual(json.loads((state / 'server-config.json').read_text())['port'], port)
                with urlopen(f'http://127.0.0.1:{port}/api/status') as response:
                    self.assertEqual(json.load(response)['version'], 2)
            finally:
                subprocess.run(['python3', str(state / 'serve.py'), '--stop-owned'], env=env, timeout=10, capture_output=True)
                if legacy.poll() is None:
                    legacy.terminate()
                legacy.wait(timeout=5)
                legacy.stdout.close()
                unrelated.terminate()
                unrelated.wait(timeout=5)


if __name__ == '__main__':
    unittest.main()
