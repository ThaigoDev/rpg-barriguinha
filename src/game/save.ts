// Progresso salvo no navegador (localStorage), separado por personagem e por fase.
const KEY = 'lenda6v2';
export let save: any = {};
try { save = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { save = {}; }

export function store() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* sem storage */ } }

export function charSave(id: string) {
  save.c = save.c || {};
  if (!save.c[id]) save.c[id] = { vida: 0, vigor: 0, forca: 0, souls: 0, lv: 1, level: 'vila', cafeBonus: 0, levels: {} };
  return save.c[id];
}

export function levelSave(S: any, id: string) {
  if (!S.levels[id]) S.levels[id] = { fire: 0, lit: [true], taken: {}, bossDead: false, stain: null };
  return S.levels[id];
}
