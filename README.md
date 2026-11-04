# Aether — Ascensão de Vespera

RPG isométrico 3D para navegador, desenvolvido em Three.js. A versão atual contém uma cidade explorável, missão com recompensa, arena, saque, inventário, equipamentos com atributos, poções finitas, comércio, aprimoramento e progresso local. A arquitetura e os personagens são originais e gerados no projeto. É uma experiência single-player; não possui contas ou servidor multiplayer.

## Executar e validar

Node.js 22.12+ (validado com 24):

```bash
npm ci
npm test
npm run build
npm run dev
```

`npm run preview` serve a compilação. `python3 scripts/export-html.py` após o build gera `dist/Aether-jogar.html`, uma versão independente para download.

## Controles

| Ação | Controle |
| --- | --- |
| Andar até o destino | Clique/toque no chão |
| Aproximar e atacar continuamente | Clique no inimigo |
| Lançar magia no alvo | Botão direito; segure para repetir |
| Nova / Fênix / Arcano | 1 / 2 / 3: seleciona e lança |
| Poção de vida / mana | Q / T |
| Inventário / personagem / mapa | I / H / M |
| Interagir / guia de controles | E / F1 ou botão ? |
| Zoom / girar em passos / restaurar câmera | Roda / C / R |
| Fechar janela ou pausar | Esc |
| Movimento alternativo / correr | WASD, setas / Shift |

O jogo usa câmera ortográfica isométrica. Arrastar gira somente a inspeção H. M abre/fecha a vista da cidade; escolher um destino no mapa volta ao acompanhamento do jogador. As janelas de inventário e personagem pausam o combate. A interface oferece botões clicáveis para as ações principais. Clicar no minimapa marca um destino; o botão da missão guia até a entrada da arena.

## Ciclo de jogo

1. Converse com Capitã Lyra na praça. Ela pede a derrota de três simulacros.
2. Abra I. Equipe a Lâmina da Aurora, o peitoral e o anel da mochila se desejar; os atributos mudam imediatamente.
3. Vá à arena a sudeste, junto à forja. Os adversários perseguem e atacam apenas nessa área. Uma vitória concede 25 EXP e 10 Zen; cada 100 EXP aumenta o nível e o ataque. Há itens no chão: clique no nome para se aproximar e recolher, ou passe perto.
4. Volte a Lyra após três vitórias para receber Cetro do Eclipse, 100 EXP e 75 Zen. A recompensa do contrato só é entregue uma vez e exige espaço na mochila.
5. Compre poções com Mira, venda itens pela mochila e visite Brann para acessar o aprimoramento.

Ao morrer, o jogador retorna à praça com o progresso preservado. Adversários reaparecem após oito segundos. Irmã Elara restaura a vida, Mestre Oren explica o treino e o Oráculo mantém a missão opcional dos cinco fragmentos e do portal.

## Inventário e equipamentos

Mochila de 8 × 6 com itens de tamanhos diferentes; seis espaços de equipamento: arma, elmo, armadura, asas, botas e anel. Selecione um item para equipar, retirar, usar, vender ou aprimorar. Arrastar para um espaço de equipamento compatível também equipa; arrastar para células vazias organiza a mochila. Trocas sem espaço suficiente são recusadas e preservam os itens.

Armas e anéis aumentam o dano; armadura, elmo, botas e asas dão defesa; botas também afetam a velocidade. Arma, asas, elmo e a aparência do peitoral acompanham o equipamento visualmente. As três aparências H são opções cosméticas: os atributos vêm dos itens equipados.

Aprimorar custa uma Joia da Evolução e `30 × (nível atual + 1)` Zen; limite +9. O aprimoramento é garantido nesta versão. Vendas removem uma unidade do item da mochila; equipamentos vestidos precisam ser retirados antes de vender. Poções não são infinitas: vida restaura 45, mana 40, com recarga de três segundos nos atalhos. Mira vende por 10 e 12 Zen, respectivamente.

## Magias e atributos

Nova Celestial: 25 mana, recarga 5s, dano base 18 em raio de 12. Queda da Fênix: 40 mana, 8s, dano base 25 em raio de 5 no alvo. Corrente Arcana: 35 mana, 7s, dano base 20 em até três alvos. O alvo selecionado tem prioridade; alcance de seleção 35. Mana regenera 6 por segundo. O ataque dos equipamentos e o nível acrescentam dano. A defesa reduz o dano recebido, mantendo mínimo de 1.

## Visual e cidade

Vespera contém muralhas, praça com fonte e mosaico, catedral, guilda, arquivo dos magos, mercado, estalagem, forja, jardins, portal e arena. Os prédios possuem colisão e são contornados pela navegação; os interiores ainda não são acessíveis. Moradores circulam, a fonte tem água animada e o portal tem vórtice. Bloom moderado realça magia e cristais; o mapa de sombras estático e as sombras de contato reduzem custo de renderização. Os materiais usam texturas locais e iluminação de ambiente.

Os heróis têm armadura em camadas, armas, asas articuladas e animações procedurais. Os ícones do inventário são SVGs locais em `src/item-art.js`. Não há assets comerciais de MU Online. O antigo RobotExpressive não é usado pelo jogador; o arquivo CC0 permanece em `public/models` para compatibilidade com o instalador existente, com créditos no mesmo diretório.

## Progresso e publicação

O progresso é salvo neste navegador: `aether-save` (missões, EXP e Zen), `aether-inventory-v1` (mochila/equipamentos) e `aether-hero` (aparência). Não há sincronização entre computadores. Limpar essas chaves reinicia o progresso; não é necessário para receber atualizações.

GitHub Actions valida e compila `main` e publica em `web`. O cron do servidor busca `web` a cada minuto. Acesso: `ssh -p 22122 rpg@45.79.9.248`; porta do RPG 8002, Shot 8001. Consulte [Servidor](docs/SERVIDOR.md). Nenhuma credencial SSH do servidor é necessária no GitHub.

Os testes cobrem navegação, câmera, personagens, mana/recarga/dano e transações de inventário. As mudanças também são verificadas no Chromium com equipamento, persistência, poções e combate antes de publicação.
