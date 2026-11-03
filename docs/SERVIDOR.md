# Integração do RPG no mesmo modelo do Shot

Acesso correto confirmado pelo fluxo existente: `ssh -p 22122 nelson@45.79.9.248`. As suposições anteriores `rpg` e porta `22` estavam erradas. O RPG usa agora **Codex → main → GitHub Actions → web → servidor**, sem conexão SSH do Codex ou do GitHub Actions ao servidor.

O Shot permanece em 8001. O RPG usa **8002**, com diretórios, locks e entradas cron exclusivos. Python serve apenas em `127.0.0.1`; não é necessário Nginx, sudo, chave SSH nos secrets do GitHub ou abertura pública de 8002. Não execute as instruções antigas de Nginx/deploy SSH. Os antigos scripts foram removidos. Caso já tenham sido executados, seus efeitos no servidor não são removidos automaticamente por esta alteração.

## Instalação, dentro da sessão SSH

Primeiro confirme que a porta 8002 não está sendo usada por outro aplicativo: `ss -ltn | grep ':8002'`. Se aparecer algum serviço desconhecido, pare e escolha outra porta antes da instalação.

Depois da publicação inicial da branch `web`:

```bash
git clone --branch web --single-branch https://github.com/neoxnvg/RPG.git ~/rpg-web
cd ~/rpg-web
git fetch origin main
git show FETCH_HEAD:scripts/install-server.sh > /tmp/install-rpg-server.sh
bash /tmp/install-rpg-server.sh
```

Se `~/rpg-web` já existir, não apague nem sobrescreva: confira o remote, a branch e possíveis alterações locais primeiro. Para reexecutar a instalação em um checkout correto e limpo, use as últimas três linhas a partir de `cd ~/rpg-web`. Repositórios privados exigem o acesso Git já configurado no servidor, como no Shot; não inclua tokens no endereço Git ou no chat.

Pré-requisitos: `git`, `python3`, `crontab`, `flock` e `timeout`, como no Shot. O instalador preserva as entradas cron do Shot e adiciona somente entradas com `# RPG-MANAGED`. Instala helpers em `~/.local/share/rpg`, valida Python e uma requisição HTTP, e inicia o servidor. Cron verifica atualizações a cada minuto e o inicia após reboot. Os helpers são atualizados quando o instalador é executado novamente.

## Abrir o jogo no Windows

Em outra janela do Git Bash/PowerShell:

```bash
ssh -p 22122 -N -o ExitOnForwardFailure=yes -L 8002:127.0.0.1:8002 nelson@45.79.9.248
```

Mantenha essa janela aberta e acesse **http://localhost:8002**. O túnel do Shot em 8001 pode continuar aberto em paralelo.

## Como as mudanças chegam ao servidor

1. Codex altera e valida o código; as mudanças precisam ser commitadas e enviadas para `main`.
2. `.github/workflows/publish-web.yml` instala pelo lockfile, compila e publica `dist/` em `web`. A configuração Actions precisa permitir que o workflow grave conteúdo no repositório. Não há secrets SSH.
3. O cron executa `refresh-server.sh` uma vez por minuto, busca `web` e atualiza apenas por fast-forward e se a cópia local estiver limpa. Uma falha de rede preserva a versão instalada.
4. O servidor estático lê os arquivos atualizados. Atualize a página no navegador após a execução Actions e o próximo minuto do cron.

A publicação da árvore estática segue o mesmo modelo do Shot; não há troca atômica de todos os arquivos durante o fast-forward. Recarregue a página caso coincida com o instante da atualização.

## Diagnóstico

No servidor:

```bash
crontab -l
tail -n 40 ~/.local/share/rpg/cron.log
tail -n 40 ~/.local/share/rpg/server.log
curl -I http://127.0.0.1:8002/
```

O servidor usa um lock de processo para não iniciar instâncias duplicadas. As verificações locais deste ambiente não comprovam que o cron remoto esteja instalado: o usuário precisa executar o instalador e confirmar `RPG OK` no SSH. Depois, valide pelo túnel. O Codex não recebeu senha ou chave privada do servidor.
