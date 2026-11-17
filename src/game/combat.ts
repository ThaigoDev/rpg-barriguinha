// Dano entre jogador e inimigos: hitboxes, parry, bloqueio, morte.
import { SFX } from '../core/audio';
import { pick } from '../core/math';
import { TEXTS } from '../data/content';
import { G, addText, burst, part, shake } from './state';
import { ov, ebox } from './physics';
import { store } from './save';
import { bossDefeated } from './boss';

export const pbox = () => {
  const P = G.P;
  return P.state === 'roll' ? { x: P.x - 5, y: P.y - 14, w: 10, h: 14 } : { x: P.x - 5, y: P.y - 24, w: 10, h: 24 };
};
export function playerHitbox(r: number) { const P = G.P; return { x: P.face > 0 ? P.x + 2 : P.x - 2 - r, y: P.y - 28, w: r, h: 28 }; }

export function targets() {
  const a = G.enemies.filter((e: any) => e.state !== 'dead');
  const b = G.boss;
  if (b && b.state !== 'idle' && b.state !== 'dead') a.push(b);
  return a;
}

export function dealToTargets(box: any, mult: number, o: any) {
  for (const e of targets()) {
    if (o.set && o.set.has(e)) continue;
    if (ov(box, ebox(e))) { if (o.set) o.set.add(e); damageEnemy(e, mult, o); }
  }
}

export function damageEnemy(e: any, mult: number, o: any) {
  const P = G.P;
  let dmg = P.d.dmg * P.dmgM * mult, tag: string | null = null;
  if (P.d.id === 'vitao') { dmg *= 1 + (1 - P.hp / P.maxhp); if (Math.random() < .2) { dmg *= 2.2; tag = 'CRÍTICO!'; } }
  if (P.buffT > 0) dmg *= 1.6;
  if (P.critNext) { dmg *= 3; P.critNext = false; tag = 'RIPOSTE!'; }
  if (e.armored && !o.heavy && Math.sign(P.x - e.x) === e.face && e.state !== 'stun') { dmg *= .35; tag = tag || 'BLOQUEOU'; SFX.block(); }
  dmg = Math.max(1, Math.round(dmg));
  e.hp -= dmg; e.flash = .12;
  addText(e.x, e.y - e.h - 6, String(dmg), tag ? '#ffd84a' : '#ffffff');
  if (tag) addText(e.x, e.y - e.h - 16, tag, '#ffb040');
  SFX.hit(); burst(e.x, e.y - e.h / 2, '#b01020', 7);
  G.hitstop = Math.max(G.hitstop, o.heavy ? .08 : .045);
  if (e.isBoss) {
    e.poise += dmg * (o.heavy ? 1.5 : 1);
    if (e.poise >= e.B.poise && e.state !== 'atk') { e.poise = 0; e.state = 'stun'; e.t = 0; addText(e.x, e.y - e.h - 14, 'ATORDOADO', '#ffd84a'); }
  } else if (!e.armored || o.heavy) {
    if (e.state !== 'dead') { e.state = 'hurt'; e.t = 0; e.vx = Math.sign(e.x - P.x) * (o.heavy ? 130 : 70); }
  }
  if (e.hp <= 0) killEnemy(e);
}

export function killEnemy(e: any) {
  e.state = 'dead'; e.t = 0; e.hp = 0;
  G.S.souls += e.souls;
  addText(e.x, e.y - e.h - 26, '+' + e.souls + ' almas', '#9fd8ff'); SFX.souls();
  for (let i = 0; i < 10; i++) part({ x: e.x, y: e.y - e.h / 2, vx: (Math.random() - .5) * 60, vy: -40 - Math.random() * 60, life: 1, c: '#9fd8ff', g: -20 });
  if (e.isBoss) bossDefeated();
}

export function hurtPlayer(dmg: number, src: any) {
  const P = G.P;
  if (P.state === 'dead' || P.iframes > 0) return;
  if ((P.state === 'roll' && P.t < .32) || P.state === 'dash') return;
  if (P.state === 'parry' && P.t < .24 && src) {
    src.state = 'stun'; src.t = 0; src.vx = 0; src.hitDone = true; P.critNext = true;
    SFX.parry(); addText(P.x, P.y - 36, 'PARRY!', '#ffe080'); G.hitstop = .14; burst(P.x + P.face * 8, P.y - 16, '#ffe080', 12, 120); P.iframes = .3;
    return;
  }
  if (P.state === 'block' && (!src || Math.sign(src.x - P.x) === P.face)) {
    P.st -= dmg * 1.1; P.stDelay = .8; SFX.block(); burst(P.x + P.face * 7, P.y - 14, '#ffd84a', 8, 90);
    if (P.st < 0) { P.st = 0; P.state = 'hurt'; P.t = 0; P.vx = -P.face * 90; addText(P.x, P.y - 36, 'GUARDA QUEBRADA', '#ff8060'); P.iframes = .4; return; }
    dmg *= .12; P.vx = -P.face * 60; P.iframes = .2; if (dmg < 1) return;
  }
  P.hp -= Math.round(dmg); P.flash = .15; SFX.hurt(); shake(.2, 3); burst(P.x, P.y - 14, '#a01020', 8);
  if (P.hp <= 0) { die(false); return; }
  if (P.state !== 'block') { P.state = 'hurt'; P.t = 0; P.vx = (src ? Math.sign(P.x - src.x) || -P.face : -P.face) * 110; P.vy = -90; }
  P.iframes = .55;
}

export function die(fell: boolean) {
  const P = G.P, S = G.S, LS = G.LS;
  P.hp = 0; P.state = 'dead'; P.t = 0; SFX.die();
  LS.stain = S.souls > 0 ? { x: fell ? P.safeX : P.x, y: fell ? P.safeY : P.y, souls: S.souls } : null;
  // as almas antigas de outra fase também se perdem
  for (const k in S.levels) if (S.levels[k] !== LS) S.levels[k].stain = null;
  S.souls = 0; store();
  G.scene = 'dead'; G.deathT = 0; G.deathMsg = pick(fell ? TEXTS.fall : TEXTS.death); G.menu = null; G.dialog = null;
}
