#!/usr/bin/env bash
# Run on the prepared server after gh auth login. No secrets are printed.
set -euo pipefail
[[ $(id -un) == rpg ]] || { echo 'Execute como rpg no servidor.'; exit 1; }
key="$HOME/.ssh/aether_actions"
hosts="$HOME/.ssh/aether_known_hosts"
[[ -s $key && -s $hosts && -d /var/www/aether/releases ]] || { echo 'Execute setup-ubuntu.sh primeiro.'; exit 1; }
# Infer the current SSH port rather than overwriting it with an assumption.
read -r _ _ _ ssh_port <<< "${SSH_CONNECTION:-}"
[[ ${ssh_port:-} =~ ^[0-9]+$ ]] || { echo 'Execute dentro da sessão SSH do servidor para identificar a porta.'; exit 1; }
if [[ $ssh_port != 22 ]]; then
  known_hosts=$(mktemp)
  trap 'rm -f "$known_hosts"' EXIT
  read -r _ host_kind host_blob < "$hosts"
  printf '[45.79.9.248]:%s %s %s\n' "$ssh_port" "$host_kind" "$host_blob" > "$known_hosts"
else
  known_hosts=$hosts
fi
repo=neoxnvg/RPG
# gh prompts for authentication through its normal secure login flow if needed.
gh api "repos/$repo" --jq '.permissions.admin' | grep -qx true || { echo 'Use gh auth login com uma conta administradora do repositório.'; exit 1; }
gh secret set RPG_SSH_KEY --repo "$repo" < "$key"
gh secret set RPG_SSH_KNOWN_HOSTS --repo "$repo" < "$known_hosts"
gh variable set RPG_DEPLOY_HOST --repo "$repo" --body 45.79.9.248
gh variable set RPG_DEPLOY_USER --repo "$repo" --body rpg
gh variable set RPG_DEPLOY_PORT --repo "$repo" --body "$ssh_port"
gh variable set RPG_DEPLOY_PATH --repo "$repo" --body /var/www/aether
gh variable set RPG_DEPLOY_ENABLED --repo "$repo" --body true
gh workflow run ci.yml --repo "$repo" --ref main
echo 'Deploy solicitado. Consulte https://github.com/neoxnvg/RPG/actions'
echo 'Após a publicação bem-sucedida, teste http://45.79.9.248:8080'
