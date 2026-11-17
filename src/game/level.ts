// Carregar áreas, entrar por bordas/portas, (re)nascer na fogueira e trocar de personagem.
import { W, H } from '../core/canvas';
import { clamp } from '../core/math';
import { CHARS, LEVELS } from '../data/content';
import { G, part } from './state';
import { charSave, levelSave, save, store } from './save';
import { newPlayer, applyStats } from './player';
import { mkEnemy } from './enemies';
import { mkBoss } from './boss';
import { prepLevel, gy, groundAt } from './physics';
import { NET, isGuest, isHost, broadcast } from '../net/net';
import { setSpecialIcon } from '../render/icons';

export function startGame(ci: number) {
  save.sel = ci; store();
  const d = CHARS[ci];
  G.S = charSave(d.id);
  G.S.opened = G.S.opened || {}; G.S.visited = G.S.visited || {}; G.S.lifts = G.S.lifts || {};
  G.P = newPlayer(d);
  setSpecialIcon(d.special);
  G.hintT = save.hinted ? 0 : 8; save.hinted = true;
  const rest = G.S.rest;
  if (rest && LEVELS[rest.lv]) loadLevel(rest.lv, rest.fire);
  else loadLevel(G.S.level in LEVELS ? G.S.level : 'vila');
  G.scene = 'game';
}

function setLevel(id: string) {
  G.L = prepLevel(LEVELS[id]); G.S.level = id; G.LS = levelSave(G.S, id);
  while (G.LS.lit.length < G.L.fires.length) G.LS.lit.push(false);
  G.S.visited[id] = true;
  G.lifts = G.L.lifts.map((l: any) => ({ ...l, y: G.S.lifts[id + ':' + l.id] === 'bot' ? l.yBot : (l.start === 'bot' ? l.yBot : l.yTop), moving: 0, t: 0 }));
  G.menu = null; G.dialog = null; G.victT = -1;
}

/** Carrega uma área e nasce na fogueira (cura, enche o café, reinicia os inimigos). */
export function loadLevel(id: string, fire?: number) {
  setLevel(id);
  if (fire != null) G.LS.fire = fire;
  store();
  respawnAll();
  G.banner = { text: G.L.name, sub: G.L.chapter, t: 0, dur: 3.5 };
  if (isHost()) broadcast({ t: 'lv', id, x: Math.round(G.P.x), y: Math.round(G.P.y) });
}

/** Entra numa área pela borda ou por uma porta, sem curar (como andar de uma sala pra outra). */
export function enterArea(id: string, x: number, y?: number) {
  const first = !G.S.visited[id];
  setLevel(id); store();
  const P = G.P;
  P.x = clamp(x, 14, G.L.width - 14);
  P.y = y ?? gy(P.x); P.vx = 0; P.vy = 0; P.state = 'idle'; P.t = 0; P.iframes = .8;
  if (groundAt(P.x) == null && y == null) P.y = G.L.height - 40;
  P.safeX = P.x; P.safeY = P.y;
  if (isGuest()) G.projs = G.projs.filter((p: any) => p.rep); else rebuildWorld();
  G.items = G.L.items.filter((it: any) => !G.LS.taken[it.id]).map((it: any) => ({ ...it }));
  G.texts = [];
  snapCamera();
  if (first) G.banner = { text: G.L.name, sub: G.L.chapter, t: 0, dur: 3.2 };
  if (isHost()) broadcast({ t: 'lv', id, x: Math.round(P.x), y: Math.round(P.y) });
}

/** Volta para a última fogueira em que descansou (pode ser em outra área). */
export function respawnAtRest() {
  const r = G.S.rest;
  if (!isGuest() && r && LEVELS[r.lv] && r.lv !== G.L.id) { loadLevel(r.lv, r.fire); G.banner = null; return; }
  if (r && r.lv === G.L.id) G.LS.fire = r.fire;
  respawnAll();
}

export function respawnAll() {
  const P = G.P, L = G.L, LS = G.LS;
  const f = L.fires[LS.fire] || L.fires[0];
  P.x = f.x + 22; P.y = gy(P.x); P.vx = P.vy = 0; P.state = 'idle'; P.t = 0; P.face = 1;
  applyStats(P); P.hp = P.maxhp; P.hpLag = P.hp; P.st = P.maxst; P.cafe = P.cafeMax; P.buffT = 0; P.iframes = 1; P.critNext = false;
  P.safeX = P.x; P.safeY = P.y;
  if (isGuest()) { // convidado renasce perto do anfitrião
    const h = NET.remotes.get('host');
    if (h && h.s !== 'dead' && h.tx != null) { P.x = h.tx - 16; P.y = h.ty; P.safeX = P.x; P.safeY = P.y; }
  }
  if (isGuest()) { G.projs = G.projs.filter((p: any) => p.rep); } // convidado: o mundo vem do anfitrião
  else rebuildWorld();
  G.texts = [];
  G.items = L.items.filter((it: any) => !LS.taken[it.id]).map((it: any) => ({ ...it }));
  snapCamera();
}

/** Posição horizontal da câmera centrada em x, presa à fase (e à arena do chefe, se ela couber na tela). */
export function camTarget(x: number) {
  const L = G.L, maxX = Math.max(0, L.width - W);
  if (G.arenaOn && L.arena) {
    const a0 = L.arena[0] - 20, a1 = L.arena[1] + 20;
    const c = a1 - a0 <= W ? (a0 + a1) / 2 - W / 2 : clamp(x - W / 2, a0, a1 - W);
    return clamp(c, 0, maxX);
  }
  return clamp(x - W / 2, 0, maxX);
}

export function snapCamera() {
  const P = G.P, L = G.L;
  G.cam = camTarget(P.x);
  G.camY = clamp(P.y - 175, 0, L.height - H);
}

/** Recria inimigos e chefe da fase sem mover o jogador. */
export function rebuildWorld() {
  const L = G.L, LS = G.LS;
  G.enemies = L.spawns.map((s: any[], i: number) => { const e = mkEnemy(s[0], s[1], s[2] ?? gy(s[1])); e.id = i; return e; });
  G.boss = LS.bossDead || !L.boss ? null : mkBoss(L.boss);
  G.arenaOn = false; G.projs = [];
}

/** Bordas da área: andar até o fim leva para a área vizinha. */
export function checkLinks() {
  const P = G.P, L = G.L;
  if (P.state === 'dead' || G.fade) return;
  const side = P.x <= 12.5 && P.vx < 0 ? 'left' : P.x >= L.width - 12.5 && P.vx > 0 ? 'right' : null;
  if (!side) return;
  const lk = L.links.find((k: any) => k.side === side && (k.yMin == null || P.y >= k.yMin) && (k.yMax == null || P.y <= k.yMax));
  if (!lk) return;
  if (isGuest()) { if (!G.netMsg) G.netMsg = { text: 'Só o anfitrião muda de área. Chama ele!', t: 2 }; return; }
  goTo(lk.to, lk.toX ?? (side === 'left' ? 99999 : 20), lk.toY, lk.msg);
}

/** Transição com escurecimento. */
export function goTo(to: string, x: number, y?: number, msg?: string) {
  G.fade = { t: 0, to, x, y, msg, done: false };
}
export function updateFade(dt: number) {
  const f = G.fade; if (!f) return;
  f.t += dt;
  if (!f.done && f.t >= .25) {
    f.done = true;
    const L = LEVELS[f.to];
    enterArea(f.to, f.x > 9000 ? prepLevel(L).width - 20 : f.x, f.y);
    if (f.msg) G.dialog = { who: '...', lines: [f.msg], i: 0 };
    for (let i = 0; i < 10; i++) part({ x: G.P.x + (Math.random() - .5) * 10, y: G.P.y - Math.random() * 20, vx: 0, vy: -20, life: .6, c: '#cfd8e8' });
  }
  if (f.t >= .55) G.fade = null;
}
void NET;
