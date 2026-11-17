// Liga a rede (net/net.ts) ao jogo: o que acontece quando chegam mensagens.
import { SFX } from '../core/audio';
import { BOSSES } from '../data/content';
import { NET } from '../net/net';
import { G, addText, part } from './state';
import { store } from './save';
import { playerPose } from './player';
import { hurtPlayer, remoteHit } from './combat';
import { mkEnemy } from './enemies';
import { mkBoss } from './boss';
import { loadLevel, rebuildWorld, enterArea } from './level';

NET.hooks = {
  pose: () => { const o = playerPose(); delete o.seed; return o; },
  remoteHit,
  remoteParry: (eid: any) => {
    const e = typeof eid === 'number' ? G.enemies.find((x: any) => x.id === eid) : G.boss;
    if (e && e.state !== 'dead') { e.state = 'stun'; e.t = 0; e.vx = 0; e.hitDone = true; }
  },
  gotoLevel: (id: string, x?: number, y?: number) => {
    if (G.L?.id !== id || G.scene === 'select') { if (x != null && G.L) enterArea(id, x - 16, y); else loadLevel(id, 0); if (G.scene !== 'dead') G.scene = 'game'; }
    else if (x != null) NET.hooks.joinHost(x, y);
  },
  remoteHurt: (m: any) => {
    if (G.scene !== 'game' || !G.P) return;
    hurtPlayer(m.dmg, { x: m.sx, id: m.eid, proxy: true });
  },
  shareSouls: (m: any) => { G.S.souls += m.souls; addText(m.x, m.y - 10, '+' + m.souls + ' almas', '#9fd8ff'); },
  bossDead: () => {
    if (!G.LS || G.LS.bossDead) return;
    G.LS.bossDead = true; G.arenaOn = false; store(); SFX.victory();
    G.banner = { text: 'CHEFE AMASSADO', sub: 'Vitória da sala!', t: 0, dur: 4, color: '#ffd27a' }; G.victT = 0;
  },
  applyState,
  // convidado aparece do lado do anfitrião (e não na fogueira do próprio save, que pode estar longe)
  joinHost: (x: number, y: number) => {
    const P = G.P; if (!P || x == null) return;
    P.x = x - 16; P.y = y; P.vx = P.vy = 0; P.safeX = P.x; P.safeY = P.y; P.iframes = 1.5;
    G.cam = Math.max(0, Math.min(G.L.width - 480, P.x - 240));
    for (let i = 0; i < 16; i++) part({ x: P.x + (Math.random() - .5) * 12, y: P.y - Math.random() * 26, vx: 0, vy: -30, life: .8, c: '#9fd8ff' });
  },
  backToSolo: () => { rebuildWorld(); },
};

/** Convidado: aplica o estado do mundo vindo do anfitrião. */
function applyState(m: any) {
  if (!G.L || m.lv !== G.L.id) return;
  G.arenaOn = !!m.ar;
  // inimigos
  const byId = new Map<number, any>(G.enemies.map((e: any) => [e.id, e]));
  const next: any[] = [];
  for (const a of m.en) {
    const [id, type, x, y, face, state, t, hp, maxhp, fl, al, moving] = a;
    let e = byId.get(id);
    if (!e || e.type !== type) { e = mkEnemy(type, x, y); e.id = id; e.x = x; e.y = y; }
    e.tx = x; e.ty = y; e.face = face; if (e.state !== state) e.t = t; e.state = state; e.hp = hp; e.maxhp = maxhp; e.alpha = al; e.vx = moving ? face : 0;
    if (fl) e.flash = .1;
    if (Math.abs(e.x - x) > 60) { e.x = x; e.y = y; }
    next.push(e);
  }
  G.enemies = next;
  // chefe
  if (m.b) {
    let b = G.boss;
    if (!b) { b = G.boss = mkBoss(G.L.boss); b.x = m.b.x; b.y = m.b.y; }
    b.tx = m.b.x; b.ty = m.b.y; b.face = m.b.f; if (b.state !== m.b.s) b.t = m.b.t; b.state = m.b.s; b.hp = m.b.hp; b.phase = m.b.ph;
    b.move = m.b.mv; b.mv = m.b.mv ? BOSSES[G.L.boss].moves[m.b.mv] : null; b.wd = m.b.wd; b.rd = m.b.rd; b.alpha = m.b.al; b.onGround = !!m.b.og;
    if (m.b.fl) b.flash = .1;
    if (Math.abs(b.x - m.b.x) > 80) { b.x = m.b.x; b.y = m.b.y; }
  } else if (G.boss && G.boss.state !== 'dead') G.boss = null;
  // projéteis do anfitrião (só visual; o dano é decidido lá)
  G.projs = G.projs.filter((p: any) => !p.rep).concat(m.pr.map((a: any) => ({ rep: true, type: a[0], x: a[1], y: a[2], vx: a[3], vy: a[4], delay: a[5], owner: a[6], remoteFx: a[6] === 'p', w: 8, h: 6, life: .3 })));
}

/** Convidado: suaviza inimigos e chefe entre um pacote e outro. */
export function guestSmooth(dt: number) {
  const k = Math.min(1, dt * 12);
  for (const e of G.enemies) {
    if (e.tx != null) { e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k; }
    e.t += dt; e.flash = Math.max(0, e.flash - dt);
  }
  const b = G.boss;
  if (b) { if (b.tx != null) { b.x += (b.tx - b.x) * k; b.y += (b.ty - b.y) * k; } b.t += dt; b.flash = Math.max(0, b.flash - dt); }
  if (G.boss?.state === 'dead' && Math.random() < .5) part({ x: G.boss.x, y: G.boss.y - Math.random() * G.boss.h, vx: 0, vy: -40, life: 1, c: '#9fd8ff', g: -10 });
}
