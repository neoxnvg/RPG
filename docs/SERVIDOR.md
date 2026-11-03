# Publicação automática: Codex → GitHub → servidor

Destino informado: `rpg@45.79.9.248`. Porta 22 e diretório `/var/www/aether` são padrões propostos, ainda não confirmados. Ubuntu e acesso SSH foram confirmados pelo usuário. O servidor web existente ainda não foi inspecionado. O pipeline pressupõe servidor Linux com SSH, rsync e GNU coreutils.

O workflow compila cada envio e pull request. Em `main`, depois de uma compilação bem-sucedida, publica quando a variável `RPG_DEPLOY_ENABLED` for `true`. Codex realiza alterações quando recebe tarefas; o deploy acontece após o commit ser enviado ao GitHub. O pipeline não transforma Codex em um processo que cria alterações sozinho.

## Preparação no servidor

Acesse o servidor com sua credencial existente. Confirme o sistema e a porta SSH. O usuário `rpg` precisa poder escrever em `/var/www/aether`. Crie essa pasta como `rpg` (`mkdir -p /var/www/aether/releases`). Instale `rsync` se necessário, usando o gerenciador do sistema. Não substitua configurações de sites existentes.

Configure o servidor web para servir `/var/www/aether/current`. Em Nginx, um novo virtual host pode usar `root /var/www/aether/current;` e `location / { try_files $uri $uri/ =404; }`. Isso é um exemplo, não uma configuração aplicada: o domínio, permissões de leitura/travessia e possíveis sites já existentes devem ser verificados antes. Confirme também se deseja HTTPS e qual domínio apontará para este IP.

## Credenciais do deploy

Em uma máquina confiável, gere uma chave Ed25519 dedicada ao deploy. Adicione somente a chave **pública** a `~rpg/.ssh/authorized_keys` do servidor, com permissões 700 no diretório `.ssh` e 600 no arquivo. Use uma chave exclusiva para automação, sem reutilizar sua chave pessoal. Mantenha a privada fora do repositório e do chat.

No repositório GitHub, abra Settings → Secrets and variables → Actions. Cadastre os secrets:

- `RPG_SSH_KEY`: chave privada dedicada correspondente à pública autorizada no servidor.
- `RPG_SSH_KNOWN_HOSTS`: entrada de host SSH validada para `45.79.9.248` (ou `[45.79.9.248]:PORTA` para uma porta diferente de 22). Verifique a impressão digital com o console do provedor/administrador. A saída de `ssh-keyscan` sozinha não comprova a identidade do servidor.

Cadastre as variables, se os padrões forem diferentes:

- `RPG_DEPLOY_HOST`: `45.79.9.248`.
- `RPG_DEPLOY_USER`: `rpg`.
- `RPG_DEPLOY_PORT`: `22`.
- `RPG_DEPLOY_PATH`: `/var/www/aether` (diretório exclusivo deste jogo, sem barra final).

Depois de preparar as credenciais, o diretório e o site, adicione `RPG_DEPLOY_ENABLED` com valor `true`. Execute o workflow em Actions → Validar e compilar RPG → Run workflow, selecionando `main`. Publicações seguintes acontecem em cada push para `main`. Restrições do environment `production`, se configuradas no GitHub, também se aplicam.

## Validação e recuperação

O deploy envia `dist/` para `releases/<commit>` e só depois troca o link `current`. Versões anteriores permanecem para recuperação. A atualização do link pressupõe que `current` seja um link simbólico ou ainda não exista: não substitua uma pasta de site existente por esse fluxo.

Verifique a execução no GitHub Actions e faça uma requisição ao endereço público do jogo e a `models/RobotExpressive.glb`. Abra o jogo no navegador para confirmar os controles e o personagem. A transferência SSH não comprova que DNS, firewall, HTTPS ou servidor web estejam corretos.

Para voltar uma versão, um administrador pode repontar `current` para uma das pastas já presentes em `releases/`, após confirmar o commit desejado. Não há limpeza automática dessas versões.

## Estado atual

Código e automação preparados. Acesso SSH, fingerprint do servidor, instalação remota, servidor web e publicação pública **ainda não foram validados**. Este ambiente Codex não possui chave SSH nem rota TCP liberada para o servidor. O deploy via GitHub Actions usa seus próprios runners e os secrets cadastrados no GitHub.


## Configuração assistida no Ubuntu

No servidor, como `rpg`, use uma cópia atual deste repositório e execute `bash scripts/setup-ubuntu.sh`. É necessário sudo. O script instala Nginx/rsync/GitHub CLI, prepara `/var/www/aether` e um site separado na porta 8080. Se essa porta já estiver ocupada ou o arquivo de configuração existente for diferente, ele interrompe em vez de substituir o serviço. Ele não substitui o site padrão. Sem domínio informado, este acesso inicial usa HTTP pelo IP; HTTPS deve ser configurado quando um domínio estiver disponível.

O script cria uma chave dedicada em `~/.ssh/aether_actions`, autoriza sua pública e grava a chave pública de host obtida do próprio servidor. A chave privada não é exibida. Não envie esses arquivos pelo chat. Se existir firewall do provedor, libere entrada TCP 8080. Se UFW estiver ativo, o script adiciona somente a regra da porta 8080.

Autentique sua conta administradora com `gh auth login --hostname github.com --git-protocol https --web --scopes repo,workflow` e execute `bash scripts/connect-github.sh` dentro da sessão SSH. O segundo script cadastra os secrets diretamente pela CLI, detecta a porta SSH da sessão, configura as variáveis e solicita o primeiro deploy. A execução precisa conseguir administrar os secrets/variáveis/Actions do repositório. Chaves e autenticação são necessárias no servidor, não neste chat.

Os scripts tiveram sintaxe validada, mas não foram executados no servidor de produção por este ambiente. Antes de afirmar que o site está publicado, confirme a execução no Actions e a resposta pública de `http://45.79.9.248:8080` e de `/models/RobotExpressive.glb`.
