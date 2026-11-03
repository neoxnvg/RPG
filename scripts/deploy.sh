#!/usr/bin/env bash
# Linux target with SSH, rsync and GNU coreutils. No root access required.
set -euo pipefail
: "${DEPLOY_HOST:?Missing DEPLOY_HOST}"
: "${DEPLOY_USER:?Missing DEPLOY_USER}"
: "${DEPLOY_PATH:?Missing DEPLOY_PATH}"
: "${DEPLOY_KEY_FILE:?Missing DEPLOY_KEY_FILE}"
: "${DEPLOY_KNOWN_HOSTS_FILE:?Missing DEPLOY_KNOWN_HOSTS_FILE}"
: "${DEPLOY_SHA:?Missing DEPLOY_SHA}"
DEPLOY_PORT=${DEPLOY_PORT:-22}
[[ $DEPLOY_HOST =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*$ ]] || exit 2
[[ $DEPLOY_USER =~ ^[a-z_][a-z0-9_-]*$ ]] || exit 2
[[ $DEPLOY_PORT =~ ^[0-9]+$ ]] && ((10#$DEPLOY_PORT >= 1 && 10#$DEPLOY_PORT <= 65535)) || exit 2
[[ $DEPLOY_PATH =~ ^/[a-zA-Z0-9_./-]+$ && $DEPLOY_PATH != *..* && $DEPLOY_PATH != / && $DEPLOY_PATH != */ ]] || exit 2
[[ $DEPLOY_SHA =~ ^[a-f0-9]{40,64}$ ]] || exit 2
[[ -f dist/index.html && -f dist/models/RobotExpressive.glb ]] || { echo 'Production build is missing'; exit 2; }
[[ -s $DEPLOY_KEY_FILE && -s $DEPLOY_KNOWN_HOSTS_FILE ]] || exit 2
ssh_options=(-i "$DEPLOY_KEY_FILE" -p "$DEPLOY_PORT" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$DEPLOY_KNOWN_HOSTS_FILE" -o ConnectTimeout=15)
remote="$DEPLOY_USER@$DEPLOY_HOST"
release="$DEPLOY_PATH/releases/$DEPLOY_SHA"
ssh "${ssh_options[@]}" "$remote" "mkdir -p '$release'"
printf -v transport '%q ' ssh "${ssh_options[@]}"
rsync -az -e "$transport" dist/ "$remote:$release/"
# Publish only after the complete release has arrived; retain previous releases.
ssh "${ssh_options[@]}" "$remote" "test -s '$release/index.html' && test -s '$release/models/RobotExpressive.glb' && ln -sfn '$release' '$DEPLOY_PATH/.next-$DEPLOY_SHA' && mv -Tf '$DEPLOY_PATH/.next-$DEPLOY_SHA' '$DEPLOY_PATH/current'"
echo 'Release uploaded and current symlink updated.'
