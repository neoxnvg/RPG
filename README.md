# Aether — O último guardião

RPG de fantasia em 3D para navegador, com Three.js e Vite. Primeira versão jogável: exploração em terceira pessoa, cinco fragmentos, sentinelas, combate, cura, Oráculo, portal e progresso salvo no navegador.

## Executar

Node.js 22.12+ (validado com 24). `npm ci` e `npm run dev`. `npm run build` gera `dist/`; `npm run preview` serve a compilação.

Clique/toque no chão: caminhar até o ponto marcado; WASD/setas: movimento alternativo; Shift: correr; câmera isométrica estável durante o jogo; C: girar em passos de 45 graus; roda: zoom limitado; R: restaurar visão clássica; arrastar gira apenas a inspeção do herói; botão direito no inimigo: ataque direcionado de energia (alcance de 35 unidades), com impacto e número de dano; Espaço: ataque; Q: cura (15s de recarga); E: interação; Esc: pausa. Em dispositivos móveis, toque no cenário para caminhar; use os botões de ação. Fale com o Oráculo, reúna cinco cristais e interaja com o portal. Cristais e conclusão são salvos em localStorage. Limpe `aether-save` para recomeçar.

## Personagens e magias

O jogador usa personagens 3D originais gerados em `src/character.js`, com armadura em camadas, elmo, ombreiras, manoplas, grevas, arma e quatro asas articuladas com penas geométricas e veios luminosos. H ou o botão HERÓI abre a inspeção e permite escolher Arconte da Aurora, Feiticeiro do Eclipse ou Cavaleiro da Fênix. A escolha é salva localmente. Caminhada, ataque e asas são animados proceduralmente. São versões iniciais para teste, sem sistema de raridade aleatória ou progressão de evolução implementado.

Asas de evolução IV são aparências equipadas para testar. As três opções compartilham os atributos de combate atuais. Não há inventário de equipamentos ainda.

Magias: **1 Nova Celestial** (25 mana, 5s, 18 dano em raio de 12); **2 Queda da Fênix** (40 mana, 8s, 25 dano em raio de 5 no alvo próximo); **3 Corrente Arcana** (35 mana, 7s, 20 dano em até três alvos próximos). Alcance de seleção de alvo: 35 unidades. Mana regenera 6 por segundo. Q restaura vida e agora tem efeito visual próprio. Botão direito continua atacando o boneco selecionado. Os NPCs da cidade não podem ser atacados.

O robô RobotExpressive foi retirado do personagem ativo. O arquivo CC0 de Quaternius permanece em `public/models/` por compatibilidade com as verificações do instalador existente; seus créditos estão no mesmo diretório.

## GitHub e servidor

GitHub Actions publica a compilação na branch `web`; o servidor Ubuntu busca atualizações pelo cron a cada minuto, como no Shot. Acesso: `ssh -p 22122 rpg@45.79.9.248`. O RPG usa a porta 8002 e o Shot continua em 8001. Consulte [Configuração do servidor](docs/SERVIDOR.md) para instalação sem sudo e abertura do túnel SSH. Não são necessários secrets SSH no GitHub.

## Cidade principal — Vespera

Cidade 3D procedural inspirada na referência fornecida: muralhas, portão, catedral, guilda, arquivo dos magos, mercado, estalagem, forja, jardins, praça e portal. A arquitetura é gerada em `src/city.js`, com texturas de pedra e telhas criadas localmente; não exige arquivos externos de cenário. Os prédios ainda não têm interiores acessíveis.

Os primeiros NPCs são Capitã Lyra (missão inicial), Mira (mercadora/provisões de teste), Brann (ferreiro/diálogo), Irmã Elara (cura) e Mestre Oren (instruções de combate). Clique no nome do NPC para se aproximar e conversar; E interage com o NPC mais próximo. O comércio e a fabricação ainda não possuem sistemas de inventário ou economia. O Oráculo permanece próximo à catedral.

A cidade é segura fora da arena (pátio a sudeste). Dentro dela, simulacros perseguem e atacam o jogador. Segure o botão direito no adversário para repetir ataques; há seleção visível e barra de vida. Uma vitória concede 25 EXP e 10 Zen, salvos localmente. Cada 100 EXP aumenta o nível e restaura a vida. Os adversários reaparecem após oito segundos. Ao chegar a zero de vida, o jogador é resgatado para a praça, mantendo o progresso. Clique para caminhar; a navegação contorna os prédios. `M` ou o botão CIDADE mostra a vista geral; `R` retorna a câmera ao personagem. A rotação e o zoom continuam disponíveis.

`npm test` verifica a navegação, incluindo contorno de obstáculos e rejeição de interiores. A compilação e os testes de navegador também foram executados durante a implementação. As atualizações seguem o fluxo GitHub → branch web → cron do servidor. O usuário de acesso é `rpg`, na porta `22122`.


## Revisão da experiência de jogo

A câmera de jogo é ortográfica/isométrica, com escala constante, sem órbita acidental no clique e sem atraso no acompanhamento. A inspeção H mantém uma câmera separada em perspectiva. O nascimento acontece na praça central. As armaduras receberam proporções mais alongadas e iluminação de ambiente para leitura dos materiais; as partes articuladas foram agrupadas por material para reduzir chamadas de desenho.

Vespera agora tem fonte com gotas animadas, tochas com luz variável, portal com vórtice e seis moradores circulando. A HUD mostra orbes de vida/mana, alvo selecionado, recargas, EXP e Zen. Essas são implementações autorais em Three.js; não há assets, servidor multiplayer ou conteúdo comercial de MU Online neste repositório.
