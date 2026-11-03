#!/usr/bin/env bash
# Run on the target Ubuntu server as rpg. Requires sudo.
set -euo pipefail
[[ $(id -un) == rpg ]] || { echo 'Entre como rpg para executar este script.'; exit 1; }
. /etc/os-release
[[ ${ID:-} == ubuntu ]] || { echo 'Este script exige Ubuntu.'; exit 1; }
site=/etc/nginx/sites-available/aether-rpg
if [[ ! -e $site ]] && ss -H -ltn 'sport = :8080' | read -r _; then
  echo 'A porta 8080 já está ocupada. Nenhuma alteração foi aplicada.'; exit 1
fi
if ! command -v nginx >/dev/null && ss -H -ltn '( sport = :80 or sport = :443 )' | read -r _; then
  echo 'Há outro serviço web ativo nas portas 80/443. Revise a hospedagem antes de instalar Nginx.'; exit 1
fi
sudo -v
sudo apt-get update
sudo apt-get install -y nginx rsync gh curl
sudo install -d -o rpg -g rpg -m 755 /var/www/aether /var/www/aether/releases
config=$(mktemp)
trap 'rm -f "$config"' EXIT
cat > "$config" <<'NGINX'
# Managed by Aether RPG setup; other sites remain unchanged.
server {
    listen 8080;
    server_name _;
    root /var/www/aether/current;
    index index.html;
    location / { try_files $uri $uri/ =404; }
    location ~ /\. { deny all; }
}
NGINX
if sudo test -e "$site"; then
  sudo cmp -s "$config" "$site" || { echo 'Já existe uma configuração Aether diferente. Revise antes de continuar.'; exit 1; }
else
  sudo install -m 644 "$config" "$site"
fi
if [[ -e /etc/nginx/sites-enabled/aether-rpg || -L /etc/nginx/sites-enabled/aether-rpg ]]; then
  [[ $(readlink -f /etc/nginx/sites-enabled/aether-rpg) == "$site" ]] || { echo 'Link de configuração existente incompatível.'; exit 1; }
else
  sudo ln -s "$site" /etc/nginx/sites-enabled/aether-rpg
fi
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
if command -v ufw >/dev/null && sudo ufw status | head -n 1 | grep -q '^Status: active'; then
  sudo ufw allow 8080/tcp comment 'Aether RPG'
fi
umask 077
mkdir -p "$HOME/.ssh"
key="$HOME/.ssh/aether_actions"
if [[ ! -e $key && ! -e $key.pub ]]; then
  ssh-keygen -q -t ed25519 -N '' -C 'aether-github-actions' -f "$key"
fi
[[ -s $key && -s $key.pub ]] || { echo 'Par de chaves incompleto. Revise ~/.ssh/aether_actions.'; exit 1; }
# Confirm both files refer to the same key without printing private material.
public=$(ssh-keygen -y -f "$key")
read -r kind blob _ < "$key.pub"
[[ $public == "$kind $blob" ]] || { echo 'As chaves privada e pública não correspondem.'; exit 1; }
touch "$HOME/.ssh/authorized_keys"
if ! grep -qF -- "$kind $blob" "$HOME/.ssh/authorized_keys"; then
  printf 'restrict %s %s aether-github-actions\n' "$kind" "$blob" >> "$HOME/.ssh/authorized_keys"
fi
chmod 700 "$HOME/.ssh"
chmod 600 "$key" "$HOME/.ssh/authorized_keys"
# Public host key from this server, not an unauthenticated network scan.
read -r host_kind host_blob _ < /etc/ssh/ssh_host_ed25519_key.pub
printf '45.79.9.248 %s %s\n' "$host_kind" "$host_blob" > "$HOME/.ssh/aether_known_hosts"
code=$(curl --silent --output /dev/null --write-out '%{http_code}' http://127.0.0.1:8080/)
[[ $code == 200 || $code == 404 ]] || { echo "Resposta Nginx inesperada: $code"; exit 1; }
echo 'Ubuntu preparado. Antes do primeiro deploy, HTTP 404 é esperado.'
echo 'A chave privada foi mantida no servidor e não foi exibida.'
echo 'Próximo passo: bash scripts/connect-github.sh'
echo 'Libere TCP 8080 também no firewall do provedor, se existir.'
