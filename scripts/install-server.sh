#!/usr/bin/env bash
set -euo pipefail
for command in git python3 crontab flock timeout; do
  command -v "$command" >/dev/null || { echo "Missing command: $command. Ask the server administrator to install it."; exit 1; }
done
repo="${RPG_WEB_DIR:-$HOME/rpg-web}"
state="${RPG_STATE_DIR:-$HOME/.local/share/rpg}"
mkdir -p "$state"
[ "$(git -C "$repo" branch --show-current)" = web ] || { echo 'Expected ~/rpg-web on branch web'; exit 1; }
[ -z "$(git -C "$repo" status --porcelain)" ] || { echo 'Local changes in ~/rpg-web; preserve them before installation.'; exit 1; }
git -C "$repo" fetch origin main
for file in serve.py refresh-server.sh; do
  git -C "$repo" show "FETCH_HEAD:scripts/$file" > "$state/$file.new"
  mv "$state/$file.new" "$state/$file"
done
chmod 700 "$state/refresh-server.sh"
python3 -m py_compile "$state/serve.py"
cronfile="$(mktemp)"
trap 'rm -f "$cronfile"' EXIT
(crontab -l 2>/dev/null || true) | sed '/# RPG-MANAGED$/d' > "$cronfile"
printf '* * * * * /bin/bash "$HOME/.local/share/rpg/refresh-server.sh" >> "$HOME/.local/share/rpg/cron.log" 2>&1 # RPG-MANAGED\n' >> "$cronfile"
printf '@reboot /bin/bash "$HOME/.local/share/rpg/refresh-server.sh" >> "$HOME/.local/share/rpg/cron.log" 2>&1 # RPG-MANAGED\n' >> "$cronfile"
crontab "$cronfile"
bash "$state/refresh-server.sh"
sleep 2
python3 - <<'PY'
import urllib.request
with urllib.request.urlopen('http://127.0.0.1:8002', timeout=5) as r:
    assert r.status == 200
    assert b'AETHER' in r.read()
print('RPG OK: HTTP 200 on 127.0.0.1:8002. Cron configured; check again after logout/reboot.')
PY
