#!/usr/bin/env bash
set -eu
export PATH=/usr/local/bin:/usr/bin:/bin
state="${RPG_STATE_DIR:-$HOME/.local/share/rpg}"
repo="${RPG_WEB_DIR:-$HOME/rpg-web}"
mkdir -p "$state"
exec 9>"$state/refresh.lock"
flock -n 9 || exit 0
# A temporary network failure must not prevent the existing game from starting.
if [ -z "$(git -C "$repo" status --porcelain)" ]; then
  if GIT_TERMINAL_PROMPT=0 timeout 45 git -C "$repo" fetch origin web; then
    git -C "$repo" merge --ff-only origin/web || echo 'Update refused: inspect local branch history.'
  else
    echo 'Fetch failed; retaining installed version. Check Git access.'
  fi
else
  echo 'Update refused: local checkout contains changes.'
fi
# The Python process holds its own lock; repeated calls never start a second server.
nohup python3 -u "$state/serve.py" 9>&- </dev/null >>"$state/server.log" 2>&1 &
