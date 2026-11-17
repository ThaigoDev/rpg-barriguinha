// Carregar fase, (re)nascer na fogueira e trocar de personagem.
import { W, GY } from '../core/canvas';
import { clamp } from '../core/math';
import { CHARS, LEVELS } from '../data/content';
import { G } from './state';
import { charSave, levelSave, save, store } from './save';
import { newPlayer, applyStats } from './player';
import { mkEnemy } from './enemies';
import { mkBoss } from './boss';
import { NET, isGuest, isHost, broadcast } from '../net/net';
import { setSpecialIcon } from '../render/icons';

export function startGame(ci: number) {
  save.sel = ci; store();
  const d = CHARS[ci];
  G.S = charSave(d.id);
  G.P = newPlayer(d);
  setSpecialIcon(d.special);
  G.hintT = save.hinted ? 0 : 8; save.hinted = true;
  loadLevel(G.S.level in LEVELS ? G.S.level : 'vila');
  G.scene = 'game';
}

export function loadLevel(id: string, fire?: number) {
  G.L = LEVELS[id]; G.S.level = id; G.LS = levelSave(G.S, id);
  while (G.LS.lit.length < G.L.fires.length) G.LS.lit.push(false);
  if (fire != null) G.LS.fire = fire;
  store();
  G.menu = null; G.dialog = null; G.victT = -1;
  respawnAll();
  G.banner = { text: G.L.name, sub: G.L.chapter, t: 0, dur: 3.5 };
  if (isHost()) broadcast({ t: 'lv', id });
}

export function respawnAll() {
  const P = G.P, L = G.L, LS = G.LS;
  const f = L.fires[LS.fire] || L.fires[0];
  P.x = f.x + 22; P.y = GY; P.vx = P.vy = 0; P.state = 'idle'; P.t = 0; P.face = 1;
  applyStats(P); P.hp = P.maxhp; P.hpLag = P.hp; P.st = P.maxst; P.cafe = P.cafeMax; P.buffT = 0; P.iframes = 1; P.critNext = false;
  P.safeX = P.x; P.safeY = P.y;
  if (isGuest()) { G.projs = G.projs.filter((p: any) => p.rep); } // convidado: o mundo vem do anfitrião
  else rebuildWorld();
  G.texts = [];
  G.items = L.items.filter((it: any) => !LS.taken[it.id]).map((it: any) => ({ ...it }));
  G.cam = clamp(P.x - W / 2, 0, L.width - W);
}

/** Recria inimigos e chefe da fase sem mover o jogador. */
export function rebuildWorld() {
  const L = G.L, LS = G.LS;
  G.enemies = L.spawns.map((s: any[], i: number) => { const e = mkEnemy(s[0], s[1], s[2]); e.id = i; return e; });
  G.boss = LS.bossDead ? null : mkBoss(L.boss);
  G.arenaOn = false; G.projs = [];
}
void NET;
