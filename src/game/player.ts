// Jogador: movimento, ataques, especiais de cada classe e pose de animação.
import { H } from '../core/canvas';
import { SFX, tone } from '../core/audio';
import { lerp, ease } from '../core/math';
import { held, hit } from '../core/input';
import { G, addText, burst, part, shake, dust } from './state';
import { physics } from './physics';
import { dealToTargets, damageEnemy, playerHitbox, targets, die } from './combat';
import { interact } from './interact';

export function newPlayer(d: any) {
  return { d, x: 0, y: 0, vx: 0, vy: 0, face: 1, onGround: true, state: 'idle', t: 0, iframes: 0, flash: 0, st: 0, stDelay: 0, cafe: 0, dropT: 0, buffT: 0, critNext: false, atk: null, hitSet: new Set(), coyote: 0, jumpBuf: 0, anim: 0, hpLag: 0, safeX: 0, safeY: 0, hp: 0, maxhp: 0, maxst: 0, dmgM: 1, cafeMax: 3 } as any;
}

export function applyStats(p: any) {
  const S = G.S;
  p.maxhp = p.d.hp + S.vida * 10; p.maxst = p.d.st + S.vigor * 10; p.dmgM = 1 + S.forca * .08; p.cafeMax = 3 + S.cafeBonus;
}

function startAttack(kind: string) {
  const P = G.P;
  if (P.st <= 0) return;
  const L = P.d.light, h = kind === 'heavy';
  P.st -= h ? L.cost * 2 : L.cost; P.stDelay = .6; P.state = 'attack'; P.t = 0;
  P.atk = { heavy: h, dur: h ? L.dur * 1.75 : L.dur, a0: h ? L.a0 * 2.1 : L.a0, a1: h ? L.a1 * 1.9 : L.a1, range: L.range + (h ? 5 : 0), mult: h ? 2.2 : 1, whiff: P.d.id === 'vitao' && Math.random() < .07, shown: false };
  P.hitSet = new Set(); (h ? SFX.heavy : SFX.swing)();
}

const SPECIAL_COST: Record<string, number> = { parry: 12, dash: 28, slam: 40, block: 0, cast: 30, curse: 0 };
function startSpecial() {
  const P = G.P, sp = P.d.special, cost = SPECIAL_COST[sp];
  if (sp === 'block') { if (P.st > 0) { P.state = 'block'; P.t = 0; } return; }
  if (sp === 'curse' && P.hp < P.maxhp * .2) { addText(P.x, P.y - 36, 'VIDA BAIXA DEMAIS', '#c080ff'); return; }
  if (cost > 0 && P.st <= 0) return;
  P.st -= cost; P.stDelay = .6; P.t = 0; P.hitSet = new Set(); P.slammed = P.cast = P.cursed = false;
  P.state = sp;
  if (sp === 'dash') SFX.roll(); if (sp === 'parry') tone(900, .05, 'triangle', .04);
}

function roll(dir: number) {
  const P = G.P;
  P.state = 'roll'; P.t = 0; P.st -= 22; P.stDelay = .5; SFX.roll(); if (dir) P.face = dir;
}

export function updatePlayer(dt: number) {
  const p = G.P;
  p.t += dt; p.iframes = Math.max(0, p.iframes - dt); p.flash = Math.max(0, p.flash - dt); p.dropT = Math.max(0, p.dropT - dt); p.buffT = Math.max(0, p.buffT - dt);
  p.hpLag = p.hpLag > p.hp ? Math.max(p.hp, p.hpLag - 60 * dt) : p.hp;
  const busy = ['attack', 'roll', 'dash', 'slam', 'cast', 'parry'].includes(p.state);
  if (p.stDelay > 0) p.stDelay -= dt;
  else if (!busy) p.st = Math.min(p.maxst, p.st + (p.state === 'block' ? 18 : p.d.id === 'alefloki' ? 60 : 48) * dt);
  if (p.state === 'dead') { p.vx *= .9; physics(p, dt); return; }

  const dir = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
  p.coyote = p.onGround ? .1 : p.coyote - dt;
  p.jumpBuf = hit('jump') ? .12 : p.jumpBuf - dt;

  if (p.state === 'idle' || p.state === 'run' || p.state === 'air') {
    p.vx = dir * p.d.spd * (p.buffT > 0 ? 1.1 : 1); if (dir) p.face = dir; if (dir && p.onGround) p.anim += dt;
    if (p.jumpBuf > 0 && p.coyote > 0) {
      if (held('down') && p.plat) { p.dropT = .25; p.y += 1; } else p.vy = -275;
      p.jumpBuf = 0; p.coyote = 0;
    }
    if (hit('roll') && p.st > 0) roll(dir);
    else if (hit('light')) startAttack('light');
    else if (hit('heavy')) startAttack('heavy');
    else if (hit('special')) startSpecial();
    else if (hit('heal') && p.onGround) { if (p.cafe > 0) { p.state = 'drink'; p.t = 0; p.drank = false; } else addText(p.x, p.y - 36, 'Acabou o café...', '#c8b090'); }
    else if (hit('interact') && G.near) interact(G.near);
    if (p.state === 'idle' || p.state === 'run' || p.state === 'air') p.state = p.onGround ? (dir ? 'run' : 'idle') : 'air';
  } else switch (p.state) {
    case 'roll': p.vx = p.face * 175; if (p.t > .4) p.state = 'idle'; break;
    case 'attack': {
      const a = p.atk;
      if (p.onGround) p.vx = (p.t >= a.a0 - .05 && p.t < a.a1) ? p.face * (a.heavy ? 40 : 25) : 0;
      if (p.t >= a.a0 && p.t <= a.a1) {
        if (a.whiff) { if (!a.shown) { a.shown = true; addText(p.x, p.y - 38, 'ERROU FEIO, ERROU RUDE', '#c080ff'); } }
        else dealToTargets(playerHitbox(a.range), a.mult, { set: p.hitSet, heavy: a.heavy });
      }
      if (p.t > a.a1) {
        if (hit('roll') && p.st > 0) { roll(dir); break; }
        if (p.t > a.a1 + .04 && hit('light')) { if (dir) p.face = dir; startAttack('light'); break; }
      }
      if (p.t >= a.dur) p.state = 'idle';
      break;
    }
    case 'drink':
      p.vx = 0;
      if (p.t >= .75 && !p.drank) {
        p.drank = true; p.cafe--; const hl = Math.round(p.maxhp * .45); p.hp = Math.min(p.maxhp, p.hp + hl);
        addText(p.x, p.y - 36, '+' + hl + ' café', '#9fe08a'); SFX.heal();
        for (let i = 0; i < 8; i++) part({ x: p.x + (Math.random() - .5) * 10, y: p.y - 10, vx: 0, vy: -30 - Math.random() * 20, life: .8, c: '#9fe08a' });
      }
      if (p.t > 1) p.state = 'idle';
      break;
    case 'hurt': p.vx *= Math.pow(.02, dt); if (p.t > .32) p.state = 'idle'; break;
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
  const bounds = G.arenaOn ? [L.arena[0] + 8, L.arena[1] - 8] : null;
  physics(p, dt, bounds);
  if (p.onGround) { p.safeX = p.x; p.safeY = p.y; }
  if (p.y > H + 30) die(true);
}

export function playerPose() {
  const p = G.P, s = p.state;
  const o: any = { legA: 0, bob: 0, armA: -.9, flash: p.flash > 0 || (p.iframes > 0 && s === 'hurt' && Math.floor(G.time * 20) % 2 === 0), seed: 1 };
  if (p.buffT > 0) o.eye = '#d080ff';
  if (s === 'run') { const ph = Math.sin(p.anim * 14); o.legA = Math.round(ph * 2); o.bob = Math.abs(ph) > .7 ? -1 : 0; o.armA = -.9 + ph * .15; }
  else if (s === 'idle') o.bob = Math.sin(G.time * 3) > 0 ? 0 : 1;
  else if (s === 'air') { o.legA = 1; o.armA = -1.5; }
  else if (s === 'roll') o.roll = p.t / .4 * Math.PI * 2;
  else if (s === 'attack') {
    const a = p.atk, up = a.heavy ? -3.9 : -3.2;
    o.armA = p.t < a.a0 ? lerp(-.9, up, ease(p.t / a.a0)) : p.t < a.a1 ? lerp(up, -.2, ease((p.t - a.a0) / (a.a1 - a.a0))) : lerp(-.2, -.9, (p.t - a.a1) / (a.dur - a.a1));
    o.legA = p.t > a.a0 ? 1 : 0;
  }
  else if (s === 'drink') { o.armA = p.t < .6 ? lerp(-.6, -2.6, p.t / .4) : -2.6; o.cup = true; }
  else if (s === 'hurt') { o.armA = -.3; o.bob = 1; }
  else if (s === 'block') { o.block = true; o.armA = -1.2; }
  else if (s === 'parry') o.armA = p.t < .24 ? -2.3 : -1.2;
  else if (s === 'dash') { o.armA = -1.6; o.legA = 2; }
  else if (s === 'slam') o.armA = p.slammed ? -.1 : lerp(-.9, -3.7, p.t / .38);
  else if (s === 'cast') o.armA = p.t < .22 ? lerp(-.9, -2.2, p.t / .22) : -1.5;
  else if (s === 'curse') o.armA = -2.9;
  else if (s === 'dead') o.deadP = Math.min(1, p.t * 3);
  return o;
}
