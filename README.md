# Aether — O último guardião

RPG de fantasia em 3D para navegador, com Three.js e Vite. Primeira versão jogável: exploração em terceira pessoa, cinco fragmentos, sentinelas, combate, cura, Oráculo, portal e progresso salvo no navegador.

## Executar

Node.js 22.12+ (validado com 24). `npm ci` e `npm run dev`. `npm run build` gera `dist/`; `npm run preview` serve a compilação.

Clique/toque no chão: caminhar até o ponto marcado; WASD/setas: movimento alternativo; Shift: correr; arrastar cenário: girar câmera horizontal/vertical; rolar roda: zoom; arrastar com botão do meio: deslocar câmera; R: recentralizar; botão direito no inimigo: ataque direcionado de energia (alcance de 35 unidades), com impacto e número de dano; Espaço: ataque; Q: cura (15s de recarga); E: interação; Esc: pausa. Em dispositivos móveis, toque no cenário para caminhar; use os botões de ação. Fale com o Oráculo, reúna cinco cristais e interaja com o portal. Cristais e conclusão são salvos em localStorage. Limpe `aether-save` para recomeçar.

## Modelo importado

`public/models/RobotExpressive.glb`: Robot Expressive, por Quaternius (CC0), distribuído nos exemplos oficiais do Three.js: https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/RobotExpressive . O personagem tem animações de caminhada, corrida, repouso e ataque. O cenário é geometria 3D criada no projeto. Se o arquivo não estiver disponível, um personagem geométrico local permite continuar a jogar. Esta é uma primeira versão, sem a promessa de qualidade AAA ou de um jogo completo.
