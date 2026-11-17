// Jogador: movimento, ataques, especiais de cada classe e pose de animação.
//
// Sensação de controle:
// - buffer de comandos (0,2 s): apertar um pouco antes do fim de uma ação ainda conta
// - coyote time (pular logo depois de sair da beirada) e pulo variável (soltar cedo = pulo baixo)
// - combo de 3 golpes leves, ataque forte carregável (segure K), ataque aéreo (J no ar), ataque em queda (K no ar)
// - rolar cancela a recuperação do ataque; atacar logo após rolar faz uma estocada
import { H } from '../core/canvas';
import { SFX, tone } from '../core/audio';
import { lerp, ease } from '../core/math';
import { held, hit, Act } from '../core/input';
import { G, addText, burst, part, shake, dust } from './state';
import { physics } from './physics';
import { dealToTargets, damageEnemy, playerHitbox, targets, die } from './combat';
import { interact } from './interact';

const BUFFER = .2;
const JUMP_V = -280;

export function newPlayer(d: any) {
  return { d, x: 0, y: 0, vx: 0, vy: 0, face: 1, onGround: true, wasGround: true, state: 'idle', t: 0, iframes: 0, flash: 0, st: 0, stDelay: 0, cafe: 0, dropT: 0, buffT: 0, critNext: false, atk: null, hitSet: new Set(), coyote: 0, buf: null, anim: 0, hpLag: 0, safeX: 0, safeY: 0, hp: 0, maxhp: 0, maxst: 0, dmgM: 1, cafeMax: 3, combo: 0, comboT: 0, jumpCut: false, fallV: 0, stFlash: 0 } as any;
}

export function applyStats(p: any) {
  const S = G.S;
  p.maxhp = p.d.hp + S.vida * 10; p.maxst = p.d.st + S.vigor * 10; p.dmgM = 1 + S.forca * .08; p.cafeMax = 3 + S.cafeBonus;
}

function noStamina(p: any) { if (p.st > 0) return false; p.stFlash = .4; tone(160, .08, 'square', .03); return true; }

// ---------------- personalidade das armas ----------------
// Cada arma tem sua sequência de golpes leves (combo) e seu golpe forte.
// from/up/to = ângulos do braço (preparação → topo → fim do golpe); spd = multiplicador de duração;
// lunge = avanço; lean = inclinação do corpo; extra = alcance extra; poise = quanto desequilibra o inimigo.
type Swing = { from: number; up: number; to: number; mult: number; extra: number; lunge: number; lean: number; spd?: number };
export const MOVESETS: Record<string, { chain: Swing[]; heavy: Swing; len: number; trail: string; poise: number; impact?: boolean }> = {
  sword: {
    len: 12.6, trail: '#dfe8ff', poise: 1,
    chain: [
      { from: -.9, up: -3.2, to: -.2, mult: 1, extra: 0, lunge: 25, lean: .1 },
      { from: -.9, up: -.1, to: -3.0, mult: 1.1, extra: 2, lunge: 30, lean: -.06 },
      { from: -1.0, up: -.7, to: -1.57, mult: 1.45, extra: 7, lunge: 95, lean: .18, spd: 1.15 },
    ],
    heavy: { from: -.9, up: -3.9, to: -.2, mult: 2.2, extra: 5, lunge: 40, lean: .16 },
  },
  daggers: {
    len: 7.4, trail: '#e8f0ff', poise: .7,
    chain: [
      { from: -1.2, up: -.9, to: -1.65, mult: .85, extra: 2, lunge: 45, lean: .12, spd: .8 },
      { from: -1.3, up: -1.0, to: -1.75, mult: .85, extra: 2, lunge: 45, lean: .12, spd: .8 },
      { from: -.6, up: -3.0, to: -.3, mult: 1, extra: 0, lunge: 30, lean: .05 },
      { from: -.3, up: -3.7, to: -.1, mult: 1.6, extra: 5, lunge: 110, lean: .22, spd: 1.2 },
    ],
    heavy: { from: -1.0, up: -.5, to: -1.6, mult: 2.4, extra: 10, lunge: 190, lean: .26 },
  },
  axe: {
    len: 10.5, trail: '#ffe0b0', poise: 1.7, impact: true,
    chain: [
      { from: -.9, up: -3.6, to: -.05, mult: 1.15, extra: 0, lunge: 20, lean: .16 },
      { from: -.3, up: -.15, to: -2.8, mult: 1.35, extra: 4, lunge: 35, lean: -.12, spd: 1.1 },
    ],
    heavy: { from: -.9, up: -4.1, to: 0, mult: 2.6, extra: 3, lunge: 30, lean: .22 },
  },
  great: {
    len: 15.8, trail: '#c8a0ff', poise: 1.5, impact: true,
    chain: [
      { from: -.9, up: -3.8, to: -.1, mult: 1.2, extra: 2, lunge: 25, lean: .18 },
      { from: -.2, up: -.1, to: -3.4, mult: 1.35, extra: 4, lunge: 30, lean: -.12, spd: 1.1 },
      { from: -.9, up: -3.9, to: -.05, mult: 1.6, extra: 3, lunge: 45, lean: .22, spd: 1.2 },
    ],
    heavy: { from: -.9, up: -4.2, to: 0, mult: 2.5, extra: 6, lunge: 35, lean: .24 },
  },
  staff: {
    len: 12, trail: '#ffc070', poise: .9,
    chain: [
      { from: -1.2, up: -1.0, to: -1.6, mult: .9, extra: 4, lunge: 35, lean: .1, spd: .9 },
      { from: -.9, up: -3.0, to: -.3, mult: 1.15, extra: 0, lunge: 25, lean: .1 },
    ],
    heavy: { from: -.9, up: -3.7, to: -.2, mult: 2.1, extra: 4, lunge: 30, lean: .14 },
  },
};
export const moveset = (d: any) => MOVESETS[d.weapon] || MOVESETS.sword;

function startAttack(kind: 'light' | 'heavy' | 'air' | 'thrust') {
  const p = G.P;
  if (noStamina(p)) return false;
  const L = p.d.light, h = kind === 'heavy', MS = moveset(p.d);
  let combo = 0;
  if (kind === 'light') { combo = p.comboT > 0 ? (p.combo + 1) % MS.chain.length : 0; p.combo = combo; p.comboT = 0; }
  const sw: Swing = h ? MS.heavy : kind === 'thrust' ? MS.chain[MS.chain.length - 1] : kind === 'air' ? MS.chain[0] : MS.chain[combo];
  const k = sw.spd || 1, last = !h && combo === MS.chain.length - 1;
  p.st -= h ? L.cost * 2 : L.cost * (kind === 'air' ? .8 : 1) * (last ? 1.2 : 1); p.stDelay = .6; p.state = 'attack'; p.t = 0;
  const dirIn = (held('right') ? 1 : 0) - (held('left') ? 1 : 0); if (dirIn) p.face = dirIn; // virar no começo do golpe
  p.atk = {
    kind, heavy: h, combo, sw, charge: 0, last, MS,
    dur: h ? L.dur * 1.75 : L.dur * k,
    a0: h ? L.a0 * 2.1 : L.a0 * k, a1: h ? L.a1 * 1.9 : L.a1 * k,
    range: L.range + sw.extra, mult: sw.mult,
    whiff: p.d.id === 'vitao' && Math.random() < .07, shown: false,
  };
  p.hitSet = new Set(); p.prevArm = null; (h || MS.impact ? SFX.heavy : SFX.swing)();
  return true;
}

const SPECIAL_COST: Record<string, number> = { parry: 12, dash: 28, slam: 40, block: 0, cast: 30, curse: 0 };
function startSpecial() {
  const P = G.P, sp = P.d.special, cost = SPECIAL_COST[sp];
  if (sp === 'block') { if (!noStamina(P)) { P.state = 'block'; P.t = 0; } return; }
  if (sp === 'curse' && P.hp < P.maxhp * .2) { addText(P.x, P.y - 36, 'VIDA BAIXA DEMAIS', '#c080ff'); return; }
  if (cost > 0 && noStamina(P)) return;
  P.st -= cost; P.stDelay = .6; P.t = 0; P.hitSet = new Set(); P.slammed = P.cast = P.cursed = false;
  P.state = sp;
  if (sp === 'dash') SFX.roll(); if (sp === 'parry') tone(900, .05, 'triangle', .04);
}

/** Rastro do golpe: um arco do ângulo anterior do braço até o atual. */
function trail(p: any, a: any) {
  const th = playerPose().armA as number;
  if (p.prevArm != null && Math.abs(th - p.prevArm) > .02 && Math.abs(th - p.prevArm) < 3) {
    const r = 6.6 + a.MS.len * .92;
    const c = p.d.blade === 'ember' ? '#ffb04a' : a.MS.trail;
    G.trails.push({ x: p.x + p.face * .9, y: p.y - 20.4, r, a0: p.prevArm, a1: th, face: p.face, life: .14, max: .14, c, w: a.heavy ? 3 : 2 });
  }
  p.prevArm = th;
}

function roll(dir: number) {
  const P = G.P;
  if (noStamina(P)) return;
  P.state = 'roll'; P.t = 0; P.st -= 22; P.stDelay = .5; SFX.roll(); if (dir) P.face = dir;
  dust(P.x - P.face * 4, P.y, 4, 10, '#4a4a55');
}

export function updatePlayer(dt: number) {
  const p = G.P;
  p.t += dt; p.iframes = Math.max(0, p.iframes - dt); p.flash = Math.max(0, p.flash - dt); p.dropT = Math.max(0, p.dropT - dt);
  p.buffT = Math.max(0, p.buffT - dt); p.comboT = Math.max(0, p.comboT - dt); p.stFlash = Math.max(0, p.stFlash - dt);
  p.hpLag = p.hpLag > p.hp ? Math.max(p.hp, p.hpLag - 60 * dt) : p.hp;
  const busy = ['attack', 'roll', 'dash', 'slam', 'cast', 'parry', 'plunge'].includes(p.state);
  if (p.stDelay > 0) p.stDelay -= dt;
  else if (!busy) p.st = Math.min(p.maxst, p.st + (p.state === 'block' ? 18 : p.state === 'drink' ? 30 : p.d.id === 'alefloki' ? 62 : 50) * dt);
  if (p.state === 'dead') { p.vx *= .9; physics(p, dt); return; }

  // buffer de comandos
  for (const a of ['roll', 'light', 'heavy', 'special', 'heal', 'jump', 'interact'] as Act[]) if (hit(a)) p.buf = { a, t: G.time };
  const want = (a: string) => p.buf && p.buf.a === a && G.time - p.buf.t <= BUFFER;
  const take = () => { p.buf = null; };

  const dir = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
  p.coyote = p.onGround ? .1 : p.coyote - dt;
  // pulo variável
  if (p.vy < -60 && !held('jump') && !p.jumpCut && p.state === 'air') { p.vy *= .45; p.jumpCut = true; }

  const free = p.state === 'idle' || p.state === 'run' || p.state === 'air';
  if (free) {
    p.vx = dir * p.d.spd * (p.buffT > 0 ? 1.1 : 1); if (dir) p.face = dir; if (dir && p.onGround) p.anim += dt;
    if (want('jump') && p.coyote > 0) {
      take();
      if (held('down') && p.plat) { p.dropT = .25; p.y += 1; }
      else { p.vy = JUMP_V; p.jumpCut = false; dust(p.x, p.y, 4, 8, '#4a4a55'); }
      p.coyote = 0;
    }
    else if (want('roll') && p.onGround) { take(); roll(dir); }
    else if (want('light')) { take(); startAttack(p.onGround ? 'light' : 'air'); }
    else if (want('heavy')) { take(); if (p.onGround) startAttack('heavy'); else if (!noStamina(p)) { p.state = 'plunge'; p.t = 0; p.st -= 20; p.stDelay = .6; p.hitSet = new Set(); SFX.heavy(); } }
    else if (want('special')) { take(); startSpecial(); }
    else if (want('heal') && p.onGround) { take(); if (p.cafe > 0) { p.state = 'drink'; p.t = 0; p.drank = false; } else addText(p.x, p.y - 36, 'Acabou o café...', '#c8b090'); }
    else if (want('interact') && G.near) { take(); p.interactT = .35; interact(G.near); }
    if (p.state === 'idle' || p.state === 'run' || p.state === 'air') p.state = p.onGround ? (dir ? 'run' : 'idle') : 'air';
  } else switch (p.state) {
    case 'roll':
      p.vx = p.face * (p.t < .32 ? 180 : 90);
      if (p.t > .3 && want('light')) { take(); startAttack('thrust'); break; }
      if (p.t > .4) p.state = 'idle';
      break;
    case 'attack': {
      const a = p.atk;
      // ataque forte carregável: segurar K pausa no alto do golpe
      if (a.heavy && p.t >= a.a0 * .92 && a.charge < .55 && held('heavy') && p.st > 0) {
        p.t = a.a0 * .92; a.charge += dt; p.st -= 12 * dt;
        if (Math.random() < .5) part({ x: p.x + p.face * 4 + (Math.random() - .5) * 10, y: p.y - 30 - Math.random() * 10, vx: 0, vy: -20, life: .3, c: '#ffd27a' });
        if (a.charge >= .55) { addText(p.x, p.y - 40, 'CARREGADO!', '#ffd27a'); tone(700, .1, 'triangle', .05); }
      }
      if (a.kind !== 'air') {
        if (p.onGround) p.vx = (p.t >= a.a0 - .05 && p.t < a.a1) ? p.face * a.sw.lunge : 0;
      } else p.vx = dir * p.d.spd * .7;
      if (p.t >= a.a0 && p.t <= a.a1) {
        if (a.whiff) { if (!a.shown) { a.shown = true; addText(p.x, p.y - 38, 'ERROU FEIO, ERROU RUDE', '#c080ff'); } }
        else {
          dealToTargets(playerHitbox(a.range), a.mult * (1 + a.charge * 1.6), { set: p.hitSet, heavy: a.heavy || a.last || a.MS.poise > 1.4, impact: a.MS.impact });
          trail(p, a);
        }
      }
      if (p.t > a.a1) {
        if (want('roll') && p.onGround) { take(); roll(dir); break; }
        if (p.t > a.a1 + .03 && want('light') && a.kind !== 'heavy') { take(); p.comboT = .5; startAttack(p.onGround ? 'light' : 'air'); break; }
      }
      if (p.t >= a.dur || (a.kind === 'air' && p.onGround && p.t > a.a1)) {
        p.state = 'idle'; if (a.kind === 'light') p.comboT = .35;
      }
      break;
    }
    case 'plunge':
      p.vx = p.face * 20; p.vy = Math.max(p.vy, p.t < .12 ? -40 : 460);
      dealToTargets(playerHitbox(10), 1.6, { set: p.hitSet, heavy: true });
      if (p.onGround && p.t > .1) {
        SFX.slam(); shake(.3, 4); dust(p.x, p.y, 16, 60);
        for (const e of targets()) if (Math.abs(e.x - p.x) < 34 && Math.abs(e.y - p.y) < 26 && !p.hitSet.has(e)) damageEnemy(e, 2.6, { heavy: true });
        p.state = 'recover'; p.t = 0; p.vx = 0; // pequena recuperação ao aterrissar
      }
      break;
    case 'drink':
      p.vx = dir * p.d.spd * .3; if (dir) p.face = dir;
      if (p.t >= .75 && !p.drank) {
        p.drank = true; p.cafe--; const hl = Math.round(p.maxhp * .45); p.hp = Math.min(p.maxhp, p.hp + hl);
        addText(p.x, p.y - 36, '+' + hl + ' café', '#9fe08a'); SFX.heal();
        for (let i = 0; i < 8; i++) part({ x: p.x + (Math.random() - .5) * 10, y: p.y - 10, vx: 0, vy: -30 - Math.random() * 20, life: .8, c: '#9fe08a' });
      }
      if (p.t > 1) p.state = 'idle';
      break;
    case 'hurt': p.vx *= Math.pow(.02, dt); if (p.t > (p.stagger ? .55 : .32)) { p.state = 'idle'; p.stagger = false; } break;
    case 'recover': p.vx = 0; if (p.t > .25) p.state = 'idle'; break;
    case 'block': p.vx = dir * p.d.spd * .35; if (!held('special') || p.st <= 0) p.state = 'idle'; break;
    case 'parry': p.vx = 0; if (p.t > .5) p.state = 'idle'; break;
    case 'dash':
      p.vx = p.face * 300; dealToTargets(playerHitbox(16), 1.4, { set: p.hitSet });
      if (Math.random() < .6) part({ x: p.x, y: p.y - 10 - Math.random() * 12, vx: -p.face * 40, vy: 0, life: .3, c: '#8fb8ff' });
      if (p.t > .22) { p.state = 'idle'; p.vx = p.face * 60; }
      break;
    case 'slam':
      p.vx = 0; if (!p.onGround) p.vy = Math.max(p.vy, 380);
      if (p.t >= .38 && !p.slammed && p.onGround) {
        p.slammed = true; SFX.slam(); shake(.35, 5);
        for (const e of targets()) if (Math.abs(e.x - p.x) < 62 && Math.abs(e.y - p.y) < 30) damageEnemy(e, 2, { heavy: true });
        dust(p.x, p.y, 20, 100);
      }
      if ((p.slammed && p.t > .8) || p.t > 1.6) p.state = 'idle';
      break;
    case 'cast':
      p.vx = 0;
      if (p.t >= .22 && !p.cast) { p.cast = true; G.projs.push({ x: p.x + p.face * 10, y: p.y - 16, vx: p.face * 230, vy: 0, w: 8, h: 6, owner: 'p', life: 1.6, type: 'fire' }); SFX.fire(); }
      if (p.t > .5) p.state = 'idle';
      break;
    case 'curse':
      p.vx = 0;
      if (p.t >= .25 && !p.cursed) {
        p.cursed = true; const c = Math.round(p.maxhp * .15); p.hp = Math.max(1, p.hp - c); p.buffT = 8;
        addText(p.x, p.y - 38, 'MALDIÇÃO ANTIGA!', '#c080ff'); SFX.curse(); burst(p.x, p.y - 14, '#a060ff', 16, 100, 0);
      }
      if (p.t > .55) p.state = 'idle';
      break;
  }
  const L = G.L;
  const bounds = G.arenaOn && p.x > L.arena[0] ? [L.arena[0] + 8, L.arena[1] - 8] : null;
  p.fallV = p.vy;
  physics(p, dt, bounds);
  if (p.onGround && !p.wasGround && p.fallV > 200) { dust(p.x, p.y, 6, 12, '#4a4a55'); p.landT = p.fallV > 380 ? .2 : .12; }
  p.landT = Math.max(0, (p.landT || 0) - dt); p.interactT = Math.max(0, (p.interactT || 0) - dt); p.blockHitT = Math.max(0, (p.blockHitT || 0) - dt);
  p.wasGround = p.onGround;
  if (p.onGround) { p.safeX = p.x; p.safeY = p.y; }
  if (p.y > G.L.height + 30) die(true);
}

export function playerPose() {
  const p = G.P, s = p.state;
  const o: any = { legA: 0, bob: 0, armA: -.9, flash: p.flash > 0 || (p.iframes > 0 && s === 'hurt' && Math.floor(G.time * 20) % 2 === 0), seed: 1, sway: Math.min(1, Math.abs(p.vx) / 120) };
  if (p.buffT > 0) o.eye = '#d080ff';
  const sitting = (m: any) => m && (m.fire || (m.parent && m.parent.fire));
  if (s === 'run') { o.amp = 1; o.ph = p.anim * 12; o.bob = Math.cos(p.anim * 24) > .3 ? 1 : 0; o.armA = -.9 + Math.sin(p.anim * 12) * .15; o.lean = .07; }
  else if (s === 'idle') {
    if (sitting(G.menu)) { o.sit = true; o.armA = .5; o.armB = .6; }
    else { o.bob = Math.sin(G.time * 2.4) > .2 ? 1 : 0; o.armA = -.9 + Math.sin(G.time * 2.4) * .05; }
  }
  else if (s === 'air') { o.air = true; if (p.vy > 60) { o.fall = true; o.armA = -2.1; o.armB = -2.4; } else o.armA = -1.5; }
  else if (s === 'roll') o.roll = p.t / .4 * Math.PI * 2;
  else if (s === 'attack') {
    const a = p.atk, w = a.sw, lean = w.lean || 0;
    const up = a.heavy ? w.up : w.up;
    o.armA = p.t < a.a0 ? lerp(w.from, up, ease(p.t / a.a0)) : p.t < a.a1 ? lerp(up, w.to, ease((p.t - a.a0) / (a.a1 - a.a0))) : lerp(w.to, -.9, (p.t - a.a1) / (a.dur - a.a1));
    // corpo: recua na preparação, avança no golpe, volta na recuperação
    o.lean = p.t < a.a0 ? -lean * .4 * (p.t / a.a0) : p.t < a.a1 ? lerp(-lean * .4, lean, (p.t - a.a0) / (a.a1 - a.a0)) : lerp(lean, 0, (p.t - a.a1) / (a.dur - a.a1));
    o.legA = p.t > a.a0 ? (Math.abs(w.lunge) > 60 ? 2 : 1) : 0;
    o.bob = p.t > a.a0 && p.t < a.a1 + .08 && (a.heavy || a.MS.impact) ? 1 : 0;
    o.armB = p.t < a.a0 ? .9 : -.2;
    if (a.kind === 'air') { o.air = true; o.lean = 0; }
  }
  else if (s === 'plunge') { o.air = true; o.armA = p.t < .12 ? lerp(-.9, -3.4, p.t / .12) : 0; o.lean = .2; }
  else if (s === 'drink') { o.armA = p.t < .6 ? lerp(-.6, -2.6, p.t / .4) : -2.6; o.cup = true; o.lean = p.t > .5 && p.t < .9 ? -.12 : 0; if (p.vx) { o.amp = 1; o.ph = p.anim * 12; p.anim += 1 / 120; } }
  else if (s === 'hurt') { o.armA = p.stagger ? .2 : -.3; o.armB = .9; o.bob = p.stagger ? 2 : 1; o.lean = p.stagger ? -.28 : -.14; }
  else if (s === 'recover') { o.armA = -.15; o.bob = 2; o.lean = .15; }
  else if (s === 'block') { o.block = true; o.armA = -1.2; o.bob = 1; o.lean = p.blockHitT > 0 ? -.16 : .04; }
  else if (s === 'parry') { o.armA = p.t < .24 ? -2.3 : -1.2; o.lean = p.t < .24 ? -.08 : 0; }
  else if (s === 'dash') { o.armA = -1.6; o.legA = 2; o.lean = .25; }
  else if (s === 'slam') { o.armA = p.slammed ? -.1 : lerp(-.9, -3.7, p.t / .38); o.lean = p.slammed ? .25 : -.1; o.bob = p.slammed ? 2 : 0; }
  else if (s === 'cast') { o.armA = p.t < .22 ? lerp(-.9, -2.2, p.t / .22) : -1.5; o.lean = p.t < .22 ? -.08 : .12; }
  else if (s === 'curse') { o.armA = -2.9; o.armB = -2.6; o.lean = -.1; }
  else if (s === 'dead') {
    // morte em dois tempos: cai de joelhos, depois tomba
    if (p.t < .45) { o.bob = 3; o.lean = .3 * (p.t / .45); o.armA = .3; o.armB = .4; }
    else o.deadP = Math.min(1, (p.t - .45) * 3);
  }
  if (p.landT > 0 && (s === 'idle' || s === 'run')) { o.bob = 2; o.lean = .1; }
  if (p.interactT > 0 && s === 'idle') { o.armA = -1.3; o.bob = 1; o.lean = .1; }
  return o;
}
