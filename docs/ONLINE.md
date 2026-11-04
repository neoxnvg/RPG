# Presença online e publicação pública

O servidor Python agora mantém jogadores conectados na memória e distribui suas posições por SSE. Quem abre a mesma instalação vê os outros personagens no mesmo mapa. O cliente envia posição, rotação, nome e classe no máximo cinco vezes por segundo, mantém heartbeat quando parado e tenta reconectar após uma queda. Personagens sem heartbeat desaparecem em até 20 segundos. Há limite de 64 personagens ativos e 128 conexões SSE.

Esta versão compartilha **presença e movimento**. Mobs, dano, combos, inventário e progressão continuam no navegador de cada jogador; não há contas, persistência central ou combate sincronizado. O servidor valida nomes, mapas implementados, coordenadas e frequência dos pedidos, mas ainda não é um servidor autoritativo de MMO. Reiniciar o processo limpa as presenças; os clientes voltam a se registrar automaticamente.

## Atualizar o servidor já instalado

As mudanças de frontend seguem `main → GitHub Actions → web → cron`, como antes. O cron antigo atualiza somente os arquivos do jogo: **é preciso executar o instalador novamente uma vez para instalar a API online**.

Depois que a atualização estiver em `main`, entre pelo seu computador:

```bash
ssh -p 22122 rpg@45.79.9.248
```

Dentro da sessão SSH:

```bash
cd ~/rpg-web
git fetch origin main &&
git show FETCH_HEAD:scripts/install-server.sh > /tmp/install-rpg-server.sh &&
bash /tmp/install-rpg-server.sh
curl --fail http://127.0.0.1:8002/api/status
```

O resultado esperado inclui `RPG OK` e `"mode":"shared-presence"`. O instalador atualiza os helpers e reinicia somente o servidor Python do RPG. Para identificá-lo, confere o usuário, o caminho exato do script e o início do processo; versões antigas sem arquivo de PID usam o mesmo caminho exato. Não utiliza `pkill`, não encerra quem estiver usando uma porta desconhecida e preserva o Shot e suas entradas cron.

O servidor continua escutando em `127.0.0.1:8002` por padrão. Isso funciona pelo túnel SSH existente, mas **não torna o jogo acessível publicamente**. Cada computador precisa do próprio túnel enquanto não houver um proxy público:

```bash
ssh -p 22122 -N -o ExitOnForwardFailure=yes -L 8002:127.0.0.1:8002 rpg@45.79.9.248
```

Abra `http://localhost:8002` em duas abas ou dois navegadores. Cada página recebe uma identidade temporária própria. Entre no mesmo mapa: os dois personagens devem aparecer. O indicador do jogo só mostra conexão online depois que SSE e POST foram aceitos pela API.

## Domínio e hospedagem pública

A configuração recomendada mantém Python em loopback e publica o jogo pelo proxy da hospedagem com HTTPS. O domínio precisa apontar para o servidor, o painel precisa encaminhá-lo para `http://127.0.0.1:8002` e a rota SSE precisa manter o streaming sem buffering. Não configure cache para `/api/`.

Exemplo de configuração Nginx para revisar com o administrador da hospedagem, substituindo `jogo.exemplo.com` pelo domínio escolhido. Integre as diretivas ao site correto no painel; não substitua a configuração de outros sites. O certificado HTTPS deve ser emitido pelo painel ou por seu fluxo habitual.

```nginx
server {
    listen 80;
    server_name jogo.exemplo.com;

    location /api/ {
        proxy_pass http://127.0.0.1:8002;
        proxy_http_version 1.1;
        proxy_set_header Host $http_host;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 60s;
    }

    location / {
        proxy_pass http://127.0.0.1:8002;
        proxy_set_header Host $http_host;
    }
}
```

Depois da configuração real, verifique pelo domínio:

```bash
curl --fail https://jogo.exemplo.com/api/status
curl -N --max-time 3 'https://jogo.exemplo.com/api/events?id=probe-player-00000001'
```

A segunda chamada deve mostrar eventos `state` continuamente e encerrar por timeout após três segundos. Uma página HTML nessa rota significa que o domínio está entregando só o frontend e precisa encaminhar também `/api/` ao Python.

A configuração de domínio, certificado, firewall e proxy não foi aplicada neste ambiente. Os testes automatizados verificam o transporte por loopback; não comprovam que a hospedagem pública esteja configurada.

## Configuração persistente

`RPG_STATE_DIR` e `RPG_WEB_DIR` continuam disponíveis; o instalador grava seus caminhos nas entradas cron do RPG. `RPG_BIND` e `RPG_PORT` substituem os valores padrão. Quando fornecidos ao instalador, os valores são salvos para sobreviver ao cron e a reinicializações.

Também é possível criar `~/.local/share/rpg/server-config.json` com:

```json
{"bind":"127.0.0.1","port":8002}
```

Após alterar o arquivo, execute o instalador para validar e reiniciar o RPG com a nova configuração. Use um endereço de interface pública somente se essa exposição tiver sido configurada conscientemente na hospedagem; o padrão permanece loopback. A porta 8001 pertence ao Shot.

## Desenvolvimento e testes

O Vite sozinho entrega o jogo, mas não implementa a API Python. Para verificar presença online localmente, compile e sirva o resultado com os helpers:

```bash
npm run build
RPG_WEB_DIR="$PWD/dist" RPG_STATE_DIR="/tmp/rpg-online-dev" python3 scripts/serve.py
```

Em outro terminal:

```bash
python3 -m unittest discover -s tests -p 'test_online.py' -v
```

A suíte conecta dois clientes SSE reais, atualiza posição e mapa via POST, verifica limites, dados inválidos, expiração, exclusão de instância duplicada e encerramento seguro que preserva outro processo Python. O módulo frontend é `src/online.js`; `createOnlineSession({onState,onStatus})` expõe `update({mapId,position,rotation,variant,name})` e `close()`. `onState` recebe `{selfId,players,serverTime}` e `onStatus` recebe `connecting`, `online` ou `offline`.
