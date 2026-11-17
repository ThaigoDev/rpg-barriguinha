# A Lenda dos Seis

Soulslike 2D em pixel art, jogado direto no navegador. Dark Souls com humor brasileiro, estrelando os seis amigos de Neversk.

## Jogar

- **Online:** GitHub Pages (publicado automaticamente a cada push na `main`).
- **Offline:** rode `npm run build` e abra `dist/index.html` direto no navegador. É um arquivo só, com tudo embutido.

| Tecla | Ação |
|---|---|
| A / D ou ← / → | Mover |
| W / ↑ / Espaço | Pular (↓ + pular desce da plataforma) |
| Shift | Rolar |
| J / K | Ataque leve / forte |
| L | Especial do personagem |
| Q | Café (cura) |
| E | Interagir (fogueira, NPC, mensagens, saída) |
| Esc | Pausa |

No celular aparecem botões na tela.

## Conteúdo

| Capítulo | Fase | Inimigos | Chefe |
|---|---|---|---|
| 1 | Vila dos Esquecidos | Morto-vivo, Cavaleiro Oco, Caramelo Amaldiçoado | O Guardião Sem Rosto |
| 2 | Floresta de Neversk (buracos!) | Lobo Sombrio (anda em bando), Arqueiro Esquecido, Lenhador Oco | Alefloki, o Caçador |

Fogueiras servem para descansar, subir de nível e **viajar** entre fases já liberadas. O progresso fica salvo no navegador, separado por personagem.

## Desenvolvimento

```bash
npm install
npm run dev        # servidor local com recarga automática
npm run build      # verifica os tipos e gera dist/index.html
```

### Estrutura

```
src/
  main.ts              loop principal, título e seleção
  core/                tela, input, áudio, matemática
  render/              sprites (pixel art por código), cenários, HUD e menus
  game/                jogador, inimigos, chefes, combate, física, fases, save
  data/                TODO o conteúdo, em JSON
    characters.json    os 6 jogáveis (visual, status, especial, frase)
    enemies.json       tipos de inimigo + visual (looks)
    bosses.json        chefes: golpes e regras de IA
    texts.json         frases de morte
    levels/*.json      cada fase: chão, buracos, plataformas, inimigos, fogueiras, NPC, chefe, final
    content.ts         registra as fases (LEVEL_ORDER)
```

### Criando conteúdo sem mexer no motor

- **Nova fala, piada ou mensagem no chão:** edite o JSON da fase (`npc.intro`, `npc.more`, `msgs`).
- **Novo inimigo:** adicione em `enemies.json` com `kind` = `melee`, `lunger` ou `ranged`, e um `look`.
- **Novo chefe:** adicione em `bosses.json` combinando golpes dos tipos `melee`, `leap`, `dash`, `throw`, `hop` e `rain`, e as regras em `ai` (distância mínima e máxima, peso, fase).
- **Nova fase:** crie `levels/<id>.json`, registre em `data/content.ts` e aponte o `exit.to` da fase anterior.
