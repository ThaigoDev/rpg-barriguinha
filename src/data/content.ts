// Ponto único de acesso ao conteúdo do jogo. Para criar uma fase nova:
// 1) crie src/data/levels/<id>.json  2) importe aqui  3) adicione em LEVEL_ORDER.
import chars from './characters.json';
import enemies from './enemies.json';
import bosses from './bosses.json';
import texts from './texts.json';
import vila from './levels/vila.json';
import floresta from './levels/floresta.json';

export const CHARS: any[] = chars as any[];
export const ENEMY_TYPES: Record<string, any> = enemies.types;
export const LOOKS: Record<string, any> = enemies.looks;
export const BOSSES: Record<string, any> = bosses;
export const TEXTS: any = texts;
export const LEVELS: Record<string, any> = { vila, floresta };
export const LEVEL_ORDER = ['vila', 'floresta'];
