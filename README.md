# Aether — O último guardião

RPG de fantasia em 3D para navegador, com Three.js e Vite. Primeira versão jogável: exploração em terceira pessoa, cinco fragmentos, sentinelas, combate, cura, Oráculo, portal e progresso salvo no navegador.

## Executar

Node.js 22.12+ (validado com 24). `npm ci` e `npm run dev`. `npm run build` gera `dist/`; `npm run preview` serve a compilação.

Clique/toque no chão: caminhar até o ponto marcado; WASD/setas: movimento alternativo; Shift: correr; arrastar cenário: girar câmera horizontal/vertical; rolar roda: zoom; arrastar com botão do meio: deslocar câmera; R: recentralizar; botão direito no inimigo: ataque direcionado de energia (alcance de 35 unidades), com impacto e número de dano; Espaço: ataque; Q: cura (15s de recarga); E: interação; Esc: pausa. Em dispositivos móveis, toque no cenário para caminhar; use os botões de ação. Fale com o Oráculo, reúna cinco cristais e interaja com o portal. Cristais e conclusão são salvos em localStorage. Limpe `aether-save` para recomeçar.

## Modelo importado

`public/models/RobotExpressive.glb`: Robot Expressive, por Quaternius (CC0), distribuído nos exemplos oficiais do Three.js: https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/RobotExpressive . O personagem tem animações de caminhada, corrida, repouso e ataque. O cenário é geometria 3D criada no projeto. Se o arquivo não estiver disponível, um personagem geométrico local permite continuar a jogar. Esta é uma primeira versão, sem a promessa de qualidade AAA ou de um jogo completo.

## GitHub e servidor

GitHub Actions publica a compilação na branch `web`; o servidor Ubuntu busca atualizações pelo cron a cada minuto, como no Shot. Acesso: `ssh -p 22122 rpg@45.79.9.248`. O RPG usa a porta 8002 e o Shot continua em 8001. Consulte [Configuração do servidor](docs/SERVIDOR.md) para instalação sem sudo e abertura do túnel SSH. Não são necessários secrets SSH no GitHub.

## Cidade principal — Vespera

Cidade 3D procedural inspirada na referência fornecida: muralhas, portão, catedral, guilda, arquivo dos magos, mercado, estalagem, forja, jardins, praça e portal. A arquitetura é gerada em `src/city.js`, com texturas de pedra e telhas criadas localmente; não exige arquivos externos de cenário. Os prédios ainda não têm interiores acessíveis.

Os primeiros NPCs são Capitã Lyra (missão inicial), Mira (mercadora/provisões de teste), Brann (ferreiro/diálogo), Irmã Elara (cura) e Mestre Oren (instruções de combate). Clique no nome do NPC para se aproximar e conversar; E interage com o NPC mais próximo. O comércio e a fabricação ainda não possuem sistemas de inventário ou economia. O Oráculo permanece próximo à catedral.

A cidade é uma zona segura. Bonecos no pátio de treino recebem ataques do botão direito e se restauram após cinco segundos. Clique para caminhar; a navegação contorna os prédios. `M` ou o botão CIDADE mostra a vista geral; `R` retorna a câmera ao personagem. A rotação e o zoom continuam disponíveis.

`npm test` verifica a navegação, incluindo contorno de obstáculos e rejeição de interiores. A compilação e os testes de navegador também foram executados durante a implementação. As atualizações seguem o fluxo GitHub → branch web → cron do servidor. O usuário de acesso é `rpg`, na porta `22122`.
