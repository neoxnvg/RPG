# Publicação automática: Codex → GitHub → servidor

Destino informado: `rpg@45.79.9.248`. Porta 22 e diretório `/home/rpg/apps/aether` são padrões propostos, ainda não confirmados. O sistema operacional e o servidor web também precisam ser confirmados. O pipeline pressupõe servidor Linux com SSH, rsync e GNU coreutils.

O workflow compila cada envio e pull request. Em `main`, depois de uma compilação bem-sucedida, publica quando a variável `RPG_DEPLOY_ENABLED` for `true`. Codex realiza alterações quando recebe tarefas; o deploy acontece após o commit ser enviado ao GitHub. O pipeline não transforma Codex em um processo que cria alterações sozinho.

## Preparação no servidor

Acesse o servidor com sua credencial existente. Confirme o sistema e a porta SSH. O usuário `rpg` precisa poder escrever em `/home/rpg/apps/aether`. Crie essa pasta como `rpg` (`mkdir -p /home/rpg/apps/aether/releases`). Instale `rsync` se necessário, usando o gerenciador do sistema. Não substitua configurações de sites existentes.

Configure o servidor web para servir `/home/rpg/apps/aether/current`. Em Nginx, um novo virtual host pode usar `root /home/rpg/apps/aether/current;` e `location / { try_files $uri $uri/ =404; }`. Isso é um exemplo, não uma configuração aplicada: o domínio, permissões de leitura/travessia e possíveis sites já existentes devem ser verificados antes. Confirme também se deseja HTTPS e qual domínio apontará para este IP.

## Credenciais do deploy

Em uma máquina confiável, gere uma chave Ed25519 dedicada ao deploy. Adicione somente a chave **pública** a `~rpg/.ssh/authorized_keys` do servidor, com permissões 700 no diretório `.ssh` e 600 no arquivo. Use uma chave exclusiva para automação, sem reutilizar sua chave pessoal. Mantenha a privada fora do repositório e do chat.

No repositório GitHub, abra Settings → Secrets and variables → Actions. Cadastre os secrets:

- `RPG_SSH_KEY`: chave privada dedicada correspondente à pública autorizada no servidor.
- `RPG_SSH_KNOWN_HOSTS`: entrada de host SSH validada para `45.79.9.248` (ou `[45.79.9.248]:PORTA` para uma porta diferente de 22). Verifique a impressão digital com o console do provedor/administrador. A saída de `ssh-keyscan` sozinha não comprova a identidade do servidor.

Cadastre as variables, se os padrões forem diferentes:

- `RPG_DEPLOY_HOST`: `45.79.9.248`.
- `RPG_DEPLOY_USER`: `rpg`.
- `RPG_DEPLOY_PORT`: `22`.
- `RPG_DEPLOY_PATH`: `/home/rpg/apps/aether` (diretório exclusivo deste jogo, sem barra final).

Depois de preparar as credenciais, o diretório e o site, adicione `RPG_DEPLOY_ENABLED` com valor `true`. Execute o workflow em Actions → Validar e compilar RPG → Run workflow, selecionando `main`. Publicações seguintes acontecem em cada push para `main`. Restrições do environment `production`, se configuradas no GitHub, também se aplicam.

## Validação e recuperação

O deploy envia `dist/` para `releases/<commit>` e só depois troca o link `current`. Versões anteriores permanecem para recuperação. A atualização do link pressupõe que `current` seja um link simbólico ou ainda não exista: não substitua uma pasta de site existente por esse fluxo.

Verifique a execução no GitHub Actions e faça uma requisição ao endereço público do jogo e a `models/RobotExpressive.glb`. Abra o jogo no navegador para confirmar os controles e o personagem. A transferência SSH não comprova que DNS, firewall, HTTPS ou servidor web estejam corretos.

Para voltar uma versão, um administrador pode repontar `current` para uma das pastas já presentes em `releases/`, após confirmar o commit desejado. Não há limpeza automática dessas versões.

## Estado atual

Código e automação preparados. Acesso SSH, fingerprint do servidor, instalação remota, servidor web e publicação pública **ainda não foram validados**. Este ambiente Codex não possui chave SSH nem rota TCP liberada para o servidor. O deploy via GitHub Actions usa seus próprios runners e os secrets cadastrados no GitHub.
