// Ponto único de acesso ao conteúdo do jogo. Para criar uma fase nova:
// 1) crie src/data/levels/<id>.json  2) importe aqui e coloque em LEVELS (e numa região em REGIONS)
// 3) ligue com as áreas vizinhas por "links" (bordas) ou "doors" (portas).
import chars from './characters.json';
import enemies from './enemies.json';
import bosses from './bosses.json';
import texts from './texts.json';
import vila from './levels/vila.json';
import floresta from './levels/floresta.json';
import pasto from './levels/pasto.json';
import trilha from './levels/trilha.json';
import arvore from './levels/arvore.json';
import pedra from './levels/pedra.json';
import topo from './levels/topo.json';
import represa from './levels/represa.json';

export const CHARS: any[] = chars as any[];
export const ENEMY_TYPES: Record<string, any> = enemies.types;
export const LOOKS: Record<string, any> = enemies.looks;
export const BOSSES: Record<string, any> = bosses;
export const TEXTS: any = texts;
export const LEVELS: Record<string, any> = { vila, floresta, pasto, trilha, arvore, pedra, topo, represa };
export const LEVEL_ORDER = Object.keys(LEVELS);
/** Regiões do mapa do mundo. */
export const REGIONS = [
  { name: 'Vila dos Esquecidos', areas: ['vila'] },
  { name: 'Floresta de Neversk', areas: ['floresta'] },
  { name: 'Serra da Cerrinha', areas: ['pasto', 'trilha', 'arvore', 'pedra', 'topo', 'represa'] },
];
