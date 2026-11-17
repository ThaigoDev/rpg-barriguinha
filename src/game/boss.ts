// Motor genérico de chefes. Cada chefe é descrito em src/data/bosses.json com golpes ("moves")
// e regras de IA ("ai"). Tipos de golpe: melee, leap, dash, throw, hop, rain.
import { GY } from '../core/canvas';
import { SFX } from '../core/audio';
import { clamp, lerp, ease, weighted } from '../core/math';
import { BOSSES, CHARS } from '../data/content';
import { G, addText, part, shake, dust } from './state';
import { physics, ov } from './physics';
import { hurtPlayer, pbox } from './combat';
import { store } from './save';

export function mkBoss(id: string) {
  const B = BOSSES[id], L = G.L;
  let def = B.look;
  let name = B.name;
  if (B.fromChar) {
    const c = CHARS.find(c => c.id === B.fromChar);
    def = { ...c, ...B.override };
    if (G.P.d.id === B.fromChar) name = B.mirrorName;
  }
  return { isBoss: true, id, B, def, name, x: L.bossX, y: GY, vx: 0, vy: 0, face: -1, hp: B.hp, maxhp: B.hp, w: B.w, h: B.h, state: 'idle', t: 0, flash: 0, alpha: 1, poise: 0, phase: 1, move: null, mv: null, hitDone: false, souls: B.souls, combo: 0, wd: .5, rd: .5, next: null };
}

function shockwave(b: any, dirs: number[]) {
  for (const s of dirs) G.projs.push({ type: 'shock', owner: 'e', x: b.x + s * b.w, y: GY - 12, vx: s * 170, vy: 0, w: 10, h: 12, dmg: 18, life: 2.4 });
}

function choose(b: any, id: string) {
  const P = G.P, m = b.B.moves[id], sp = b.phase === 2 ? b.B.p2speed : 1;
  b.state = 'wind'; b.t = 0; b.move = id; b.mv = m; b.face = Math.sign(P.x - b.x) || b.face; b.wd = m.wind / sp; b.hitDone = false;
}

function startMove(b: any) {
  const P = G.P, m = b.mv;
  b.state = 'atk'; b.t = 0; b.hitDone = false;
  switch (m.type) {
    case 'melee':
      SFX.heavy();
      if (m.impact) { SFX.slam(); shake(.4, 6); dust(b.x + b.face * 30, GY, 16, 30); if (b.phase === 2 && m.shockP2) shockwave(b, [b.face]); }
      break;
    case 'leap': b.vy = m.vy; b.vx = clamp((P.x - b.x) / .73, -260, 260); break;
    case 'dash': SFX.roll(); b.dashDir = b.face; break;
    case 'throw': {
      SFX.throw();
      for (let i = 0; i < m.count; i++) {
        const vy = (i - (m.count - 1) / 2) * m.spread;
        G.projs.push({ type: 'dagger', owner: 'e', x: b.x + b.face * 12, y: b.y - b.h * .6, vx: b.face * m.speed, vy, w: 6, h: 3, dmg: m.dmg, life: 2.5 });
      }
      break;
    }
    case 'hop': b.vy = m.vy; b.vx = -(Math.sign(P.x - b.x) || b.face) * m.vx; SFX.roll(); break;
    case 'rain':
      SFX.throw(); addText(b.x, b.y - b.h - 10, 'CHUVA DE ADAGAS', '#ff6060');
      for (let i = 0; i < m.count; i++) {
        const x = P.x + (i - (m.count - 1) / 2) * m.gap + (Math.random() - .5) * 12;
        G.projs.push({ type: 'fall', owner: 'e', x, y: -12, vx: 0, vy: 0, w: 4, h: 10, dmg: m.dmg, delay: m.delay + i * .06, life: m.delay + 2 });
      }
      break;
  }
}

function runMove(b: any, dt: number) {
  const P = G.P, m = b.mv, sp = b.phase === 2 ? b.B.p2speed : 1;
  const strike = (box: any, dmg: number) => { if (!b.hitDone && ov(box, pbox())) { b.hitDone = true; hurtPlayer(dmg, b); } };
  const rec = () => { b.state = 'rec'; b.t = 0; b.rd = m.rec / sp; };
  switch (m.type) {
    case 'melee': {
      b.vx = (b.t >= m.a0 && b.t <= m.a1) ? b.face * (m.lunge || 0) : 0;
      if (b.t >= m.a0 && b.t <= m.a1) { const [ox, oy, w, h] = m.box; strike({ x: b.face > 0 ? b.x + ox : b.x - ox - w, y: b.y + oy, w, h }, m.dmg); }
      if (b.t >= m.dur) {
        const chance = m.combo ? m.combo[b.phase - 1] : 0;
        if (!b.combo && Math.random() < chance) { b.combo = 1; b.face = Math.sign(P.x - b.x) || b.face; b.state = 'wind'; b.t = b.wd * .4; return; }
        b.combo = 0; rec();
      }
      break;
    }
    case 'leap':
      if (b.onGround && b.t > .12) {
        b.vx = 0; SFX.slam(); shake(.45, 7);
        if (Math.abs(P.x - b.x) < m.radius && P.y > b.y - 34) hurtPlayer(m.dmg, b);
        dust(b.x, GY, 20, 80);
        if (b.phase === 2 && m.shockP2) shockwave(b, [-1, 1]);
        rec();
      }
      break;
    case 'dash':
      b.vx = b.dashDir * m.speed * sp;
      strike({ x: b.x - b.w / 2, y: b.y - b.h, w: b.w, h: b.h }, m.dmg);
      if (Math.random() < .8) part({ x: b.x, y: b.y - Math.random() * b.h, vx: -b.dashDir * 30, vy: 0, life: .35, c: '#a01822' });
      if (b.t > m.maxT || (P.x - b.x) * b.dashDir < -80 || b.x <= G.L.arena[0] + 22 || b.x >= G.L.arena[1] - 22) { b.vx = 0; rec(); }
      break;
    case 'throw': case 'rain': if (b.t >= .2) rec(); break;
    case 'hop':
      if (b.onGround && b.t > .1) { b.vx = 0; rec(); if (m.then) b.next = m.then; }
      break;
  }
}

export function updateBoss(b: any, dt: number) {
  const P = G.P, L = G.L, B = b.B;
  b.t += dt; b.flash = Math.max(0, b.flash - dt);
  const sp = b.phase === 2 ? B.p2speed : 1, dx = P.x - b.x, adx = Math.abs(dx);
  if (b.state === 'dead') {
    b.alpha = Math.max(0, 1 - b.t / 2.2);
    if (Math.random() < .5) part({ x: b.x + (Math.random() - .5) * b.w, y: b.y - Math.random() * b.h, vx: 0, vy: -40, life: 1, c: '#9fd8ff', g: -10 });
    return;
  }
  if (b.state === 'idle') {
    if (P.x > L.arena[0] + 18 && P.state !== 'dead') {
      G.arenaOn = true; b.state = 'intro'; b.t = 0; SFX.boss();
      G.banner = { text: b.name, sub: L.name, t: 0, dur: 2.8 };
    }
    physics(b, dt); return;
  }
  if (b.phase === 1 && b.hp < b.maxhp * .5 && b.state !== 'atk') {
    b.phase = 2; b.state = 'roar'; b.t = 0; SFX.boss(); shake(1, 4);
    addText(b.x, b.y - b.h - 18, B.phase2[0], '#ff6060'); addText(b.x, b.y - b.h - 6, B.phase2[1], '#c8b090');
  }
  switch (b.state) {
    case 'intro': b.vx = 0; if (b.t > 1.6) { b.state = 'walk'; b.t = 0; } break;
    case 'roar': b.vx = 0; if (b.t > 1.2) { b.state = 'walk'; b.t = 0; } break;
    case 'walk': {
      b.face = Math.sign(dx) || b.face;
      b.vx = P.state === 'dead' ? 0 : b.face * B.walk * sp;
      if (b.t > .35 && P.state !== 'dead') {
        const ok = (a: any) => (a.phase || 1) <= b.phase && adx >= (a.min || 0) && adx <= (a.max ?? 1e9);
        const opts: any[] = B.ai.filter(ok);
        if (opts.length) choose(b, weighted(opts).move);
        else if (b.t > 2.2) choose(b, B.fallback[Math.floor(Math.random() * B.fallback.length)]);
      }
      break;
    }
    case 'wind':
      b.vx = 0;
      if (b.mv.type === 'dash' || b.mv.type === 'throw') b.face = Math.sign(dx) || b.face;
      if (b.t >= b.wd) startMove(b);
      break;
    case 'atk': runMove(b, dt); break;
    case 'rec':
      b.vx = 0;
      if (b.t >= b.rd) { if (b.next && P.state !== 'dead') { const n = b.next; b.next = null; choose(b, n); } else { b.state = 'walk'; b.t = 0; } }
      break;
    case 'stun': b.vx = 0; if (b.t > 1.4) { b.state = 'walk'; b.t = 0; } break;
  }
  physics(b, dt, [L.arena[0] + 20, L.arena[1] - 20]);
}

export function bossPose(b: any) {
  const o: any = { legA: 0, bob: 0, armA: -.9, flash: b.flash > 0, seed: 3, noShadow: true };
  const m = b.mv, raise = -3.6;
  if (b.state === 'walk') { const ph = Math.sin(G.time * (b.B.walk / 6)); o.legA = Math.round(ph * 1.5); o.bob = Math.abs(ph) > .7 ? 1 : 0; }
  else if (b.state === 'wind') {
    if (m.type === 'dash') { o.armA = -1.8; o.bob = 2; }
    else if (m.type === 'throw') o.armA = lerp(-.9, -2.6, ease(b.t / b.wd));
    else o.armA = lerp(-.9, m.type === 'leap' ? -3.0 : raise, ease(b.t / b.wd));
  }
  else if (b.state === 'atk') {
    if (m.type === 'melee') o.armA = lerp(raise, -.1, b.t / .12);
    else if (m.type === 'leap') o.armA = b.onGround ? -.1 : -3.2;
    else if (m.type === 'dash') { o.armA = -1.4; o.legA = 2; }
    else if (m.type === 'throw') o.armA = lerp(-2.6, -1.0, b.t / .1);
    else if (m.type === 'hop') o.roll = -b.t * 14;
    else if (m.type === 'rain') o.armA = -3.0;
  }
  else if (b.state === 'rec') o.armA = lerp(-.1, -.9, b.t / b.rd);
  else if (b.state === 'stun') { o.armA = -.1; o.bob = 1; }
  else if (b.state === 'roar') { o.armA = -2.6; o.bob = Math.floor(G.time * 20) % 2; }
  else if (b.state === 'idle' || b.state === 'intro') o.bob = Math.sin(G.time * 1.5) > 0 ? 0 : 1;
  else if (b.state === 'dead') o.deadP = Math.min(1, b.t * 1.5);
  return o;
}

export function bossDefeated() {
  G.LS.bossDead = true; G.arenaOn = false; store(); SFX.victory(); shake(.6, 6);
  G.banner = { text: 'CHEFE AMASSADO', sub: '+' + G.boss.souls + ' almas', t: 0, dur: 4, color: '#ffd27a' };
  G.victT = 0;
}
