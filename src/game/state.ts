// Estado global da partida. Um único objeto mutável compartilhado pelos módulos.
export const G: any = {
  scene: 'title', // title | select | game | dead | victory
  selIdx: 0, time: 0, titleCam: 0,
  P: null,        // jogador
  S: null,        // save do personagem
  L: null,        // dados da fase atual (JSON)
  LS: null,       // save da fase atual
  enemies: [], boss: null, projs: [], parts: [], texts: [], items: [], trails: [], slashes: [],
  cam: 0, shakeT: 0, shakeM: 0, hitstop: 0, kickX: 0, kickY: 0,
  menu: null, dialog: null, banner: null, arenaOn: false,
  deathT: 0, deathMsg: '', victT: -1, hintT: 0, near: null, npcTalked: {}, hurtFlash: 0,
};

export function shake(t: number, m: number) { G.shakeT = Math.max(G.shakeT, t); G.shakeM = Math.max(G.shakeM, m); }
/** Empurrão curto da câmera na direção do golpe (dá peso sem tremer a tela toda). */
export function kick(dx: number, dy = 0) { G.kickX += dx; G.kickY += dy; G.kickX = Math.max(-6, Math.min(6, G.kickX)); G.kickY = Math.max(-5, Math.min(5, G.kickY)); }
/** Corte desenhado por cima do alvo no momento do acerto. */
export function slash(x: number, y: number, ang: number, len: number, c = '#ffffff', w = 2) { G.slashes.push({ x, y, ang, len, c, w, life: .16, max: .16 }); }
export function addText(x: number, y: number, s: string, c = '#fff') { G.texts.push({ x, y, s, c, life: 1 }); }
export function part(p: any) { G.parts.push({ g: 0, s: 1, ...p, max: p.life }); }
export function burst(x: number, y: number, c: string, n = 6, sp = 80, g = 200) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = sp * (.3 + Math.random());
    part({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: .4 + Math.random() * .4, c, g, s: Math.random() < .3 ? 2 : 1 });
  }
}
export function glint(x: number, y: number) {
  G.parts.push({ x, y, vx: 0, vy: 0, life: .35, max: .35, c: '#ffffff', g: 0, s: 1, glint: true });
}
export function dust(x: number, y: number, n: number, spread: number, c = '#7a6a55') {
  for (let i = 0; i < n; i++) part({ x: x + (Math.random() - .5) * spread, y, vx: (Math.random() - .5) * 80, vy: -50 - Math.random() * 90, life: .7, c, g: 300, s: 2 });
}
