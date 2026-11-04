#!/usr/bin/env bash
set -euo pipefail
for command in git python3 crontab flock timeout; do
  command -v "$command" >/dev/null || { echo "Missing command: $command. Ask the server administrator to install it."; exit 1; }
done
repo="${RPG_WEB_DIR:-$HOME/rpg-web}"
state="${RPG_STATE_DIR:-$HOME/.local/share/rpg}"
export RPG_WEB_DIR="$repo" RPG_STATE_DIR="$state"
mkdir -p "$state"
[ "$(git -C "$repo" branch --show-current)" = web ] || { echo 'Expected RPG_WEB_DIR on branch web'; exit 1; }
[ -z "$(git -C "$repo" status --porcelain)" ] || { echo 'Local changes in RPG_WEB_DIR; preserve them before installation.'; exit 1; }
exec 8>"$state/refresh.lock"
flock -w 60 8 || { echo 'Another RPG refresh is still running; retry the installer.'; exit 1; }
git -C "$repo" fetch origin main
for file in serve.py refresh-server.sh; do
  git -C "$repo" show "FETCH_HEAD:scripts/$file" > "$state/$file.new"
done
python3 -m py_compile "$state/serve.py.new"
bash -n "$state/refresh-server.sh.new"
for file in serve.py refresh-server.sh; do
  mv "$state/$file.new" "$state/$file"
done
chmod 700 "$state/refresh-server.sh"
# Cron does not inherit the install shell: persist explicit bind/port overrides.
python3 - "$state" <<'PYCONFIG'
import json
import os
from pathlib import Path
import sys
path = Path(sys.argv[1]) / 'server-config.json'
config = json.loads(path.read_text()) if path.exists() else {}
if not isinstance(config, dict):
    raise SystemExit('server-config.json must contain a JSON object')
changed = False
for environment, key in [('RPG_BIND', 'bind'), ('RPG_PORT', 'port')]:
    if environment in os.environ:
        config[key] = int(os.environ[environment]) if key == 'port' else os.environ[environment]
        changed = True
if changed:
    temporary = path.with_suffix('.json.new')
    temporary.write_text(json.dumps(config))
    temporary.replace(path)
PYCONFIG
# Matches the same UID, exact script path and process start time. Also handles legacy RPG.
python3 "$state/serve.py" --stop-owned
cronfile="$(mktemp)"
trap 'rm -f "$cronfile"' EXIT
# Quote the configured paths once; retain all entries owned by other games/users.
python3 - "$state" "$repo" "$cronfile" <<'PY'
import os
import shlex
import subprocess
import sys
state, repo, destination = sys.argv[1:]
if any('\n' in path or '%' in path for path in (state, repo)):
    raise SystemExit('Cron paths cannot contain newline or percent characters')
previous = subprocess.run(['crontab', '-l'], capture_output=True, text=True)
lines = [line for line in previous.stdout.splitlines() if not line.endswith('# RPG-MANAGED')]
q = shlex.quote
command = f'RPG_STATE_DIR={q(state)} RPG_WEB_DIR={q(repo)} /bin/bash {q(os.path.join(state, "refresh-server.sh"))} >> {q(os.path.join(state, "cron.log"))} 2>&1 # RPG-MANAGED'
lines += ['* * * * * ' + command, '@reboot ' + command]
with open(destination, 'w') as output:
    output.write('\n'.join(lines) + '\n')
PY
crontab "$cronfile"
exec 8>&-
bash "$state/refresh-server.sh"
python3 - "$state" <<'PY'
import json
from pathlib import Path
import sys
import time
import urllib.request
state = Path(sys.argv[1])
last_error = None
for attempt in range(25):
    try:
        record = json.loads((state / 'server.pid.json').read_text())
        bind = record['bind']
        host = '127.0.0.1' if bind in ('0.0.0.0', '127.0.0.1') else bind
        with urllib.request.urlopen(f'http://{host}:{record["port"]}/api/status', timeout=2) as response:
            status = json.load(response)
            assert status['version'] >= 2 and status['mode'] == 'shared-presence'
        print(f'RPG OK: HTTP 200 on {host}:{record["port"]}; shared presence API v{status["version"]}. Cron configured.')
        break
    except Exception as error:
        last_error = error
        time.sleep(.2)
else:
    raise SystemExit(f'RPG health check failed: {last_error}; inspect {state / "server.log"}')
PY
