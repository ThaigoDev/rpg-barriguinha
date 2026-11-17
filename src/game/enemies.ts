// IA genérica de inimigos, guiada pelos dados de src/data/enemies.json.
// kind: "melee" (anda e golpeia), "lunger" (bote, tipo cachorro/lobo), "ranged" (atira e mantém distância).
import { H } from '../core/canvas';
import { SFX } from '../core/audio';
import { lerp, ease } from '../core/math';
import { ENEMY_TYPES, LOOKS } from '../data/content';
import { G, addText, glint } from './state';
import { physics, edgeAhead, ebox } from './physics';
import { nearestTarget, hitPlayers } from './players';

export function mkEnemy(type: string, x: number, y?: number) {
  const T = ENEMY_TYPES[type];
  const e: any = { ...T, type, look: LOOKS[T.look], maxhp: T.hp, x, y: y ?? 230, home: x, vx: 0, vy: 0, face: -1, t: 0, state: 'idle', hitDone: false, flash: 0, alpha: 1, seed: x % 97 };
  if (T.kind === 'flyer') { e.fly = true; e.y = (y ?? 230) - (T.hover ?? 30); e.homeY = e.y; }
  if (T.kind === 'nest') { e.spawnT = 1; }
  return e;
}

// ---------- voadores (maribondos): pairam, cercam e dão um bote ----------
function updateFlyer(e: any, dt: number) {
  const T = nearestTarget(e.x, e.y);
  const tx = T ? T.x : e.home, ty = T ? T.y - 16 : e.homeY, dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1;
  switch (e.state) {
    case 'idle':
      e.vx = (e.home + Math.sin(G.time * 1.3 + e.seed) * 16 - e.x) * 2; e.vy = (e.homeY + Math.sin(G.time * 2.3 + e.seed) * 6 - e.y) * 2;
      if (T && d < e.aggro) { e.state = 'chase'; e.t = 0; }
      break;
    case 'chase': {
      if (!T || d > e.aggro * 1.8) { e.state = 'idle'; break; }
      const wob = Math.sin(G.time * 9 + e.seed) * 30;
      e.vx = dx / d * e.spd + Math.cos(G.time * 7 + e.seed) * 25; e.vy = dy / d * e.spd + wob * .5;
      e.face = Math.sign(dx) || e.face;
      if (d < 36 && e.t > .5) { e.state = 'wind'; e.t = 0; e.ax = tx; e.ay = ty; glint(e.x, e.y - 4); }
      break;
    }
    case 'wind': e.vx = Math.sin(G.time * 60) * 30; e.vy = -10; if (e.t > e.wind) { e.state = 'atk'; e.t = 0; e.hitSet = new Set(); const a = Math.atan2(e.ay - e.y, e.ax - e.x); e.vx = Math.cos(a) * 210; e.vy = Math.sin(a) * 210; SFX.throw(); } break;
    case 'atk': hitPlayers({ x: e.x - 3, y: e.y - 5, w: 6, h: 6 }, e.dmg, e, e.hitSet); if (e.t > e.atk) { e.state = 'rec'; e.t = 0; } break;
    case 'rec': e.vx *= .9; e.vy = -40; if (e.t > e.rec) { e.state = 'chase'; e.t = 0; } break;
    case 'hurt': e.vx *= .9; e.vy *= .9; if (e.t > .25) { e.state = 'chase'; e.t = 0; } break;
    case 'stun': e.vx = 0; e.vy = 20; if (e.t > 1) { e.state = 'chase'; e.t = 0; } break;
  }
  e.x += e.vx * dt; e.y += e.vy * dt;
  e.x = Math.max(8, Math.min(G.L.width - 8, e.x)); e.y = Math.max(20, Math.min(G.L.height - 10, e.y));
}

// ---------- ninho: parado, solta maribondos enquanto alguém estiver perto ----------
function updateNest(e: any, dt: number) {
  e.vx = 0;
  if (e.state === 'hurt' || e.state === 'stun') { if (e.t > .2) { e.state = 'idle'; e.t = 0; } }
  const T = nearestTarget(e.x, e.y);
  e.spawnT -= dt;
  const kids = G.enemies.filter((o: any) => o.parent === e && o.state !== 'dead').length;
  if (T && Math.abs(T.x - e.x) < 240 && e.spawnT <= 0 && kids < (e.max || 4)) {
    e.spawnT = e.every || 3;
    const k = mkEnemy(e.spawns, e.x, e.y); k.y = e.y - e.h / 2; k.homeY = k.y - 10; k.parent = e; k.id = (G.eid = (G.eid || 1000) + 1); k.state = 'chase'; k.souls = 3;
    G.enemies.push(k); SFX.throw();
  }
}

// ---------- investida (boi bravo): pisa no chão, dispara em linha reta e cansa ----------
function updateCharger(e: any, dt: number) {
  const T = nearestTarget(e.x, e.y), dx = T ? T.x - e.x : 0, adx = Math.abs(dx), dy = T ? Math.abs(T.y - e.y) : 1e9;
  switch (e.state) {
    case 'idle': e.vx = 0; if (T && adx < e.aggro && dy < 40) { e.state = 'wind'; e.t = 0; e.face = Math.sign(dx) || e.face; SFX.howl(); addText(e.x, e.y - e.h - 6, 'MUUUU', '#d8c8b0'); glint(e.x + e.face * 10, e.y - 12); } break;
    case 'chase': e.face = Math.sign(dx) || e.face; e.vx = edgeAhead(e, e.face) ? 0 : e.face * e.spd; if (!T || adx > e.aggro * 1.6) { e.state = 'idle'; break; } if (e.t > .8 && adx < e.aggro && dy < 40) { e.state = 'wind'; e.t = 0; glint(e.x + e.face * 10, e.y - 12); } break;
    case 'wind': e.vx = 0; e.face = Math.sign(dx) || e.face; if (Math.random() < .3) G.parts.push({ x: e.x - e.face * 8, y: e.y, vx: -e.face * 30, vy: -20, life: .4, max: .4, c: '#8a6a4a', g: 100, s: 2 }); if (e.t > e.wind) { e.state = 'atk'; e.t = 0; e.hitSet = new Set(); e.lastX = e.x; } break;
    case 'atk': {
      const ox = e.x;
      e.vx = edgeAhead(e, e.face) ? 0 : e.face * e.charge;
      hitPlayers({ x: e.x - e.w / 2, y: e.y - e.h, w: e.w, h: e.h }, e.dmg, e, e.hitSet);
      if (Math.random() < .5) G.parts.push({ x: e.x - e.face * 8, y: e.y, vx: -e.face * 40, vy: -30, life: .4, max: .4, c: '#8a6a4a', g: 100, s: 2 });
      const passed = T ? (T.x - e.x) * e.face < -70 : true;
      if (e.t > e.atk || e.vx === 0 || passed || (e.t > .1 && Math.abs(e.x - ox) < .01)) { e.state = 'rec'; e.t = 0; e.vx = 0; }
      break;
    }
    case 'rec': e.vx *= .85; if (e.t > e.rec) { e.state = 'chase'; e.t = 0; } break;
    case 'hurt': e.vx *= .9; if (e.t > .3) { e.state = 'chase'; e.t = 0; } break;
    case 'stun': e.vx = 0; if (e.t > 1.4) { e.state = 'chase'; e.t = 0; } break;
  }
  physics(e, dt, [12, (G.L.arena?.[0] ?? G.L.width) - 14]);
}

function alertPack(e: any) {
  for (const o of G.enemies) if (o !== e && o.type === e.type && o.state === 'idle' && Math.abs(o.x - e.x) < 160) { o.state = 'chase'; o.t = 0; }
}

export function updateEnemy(e: any, dt: number) {
  e.t += dt; e.flash = Math.max(0, e.flash - dt);
  if (e.state === 'dead') {
    e.alpha = Math.max(0, 1 - e.t / .8); e.vx *= .9;
    if (e.fly || e.kind === 'nest') { e.vy = (e.vy || 0) + 300 * dt; e.y = Math.min(G.L.height, e.y + e.vy * dt); } else physics(e, dt);
    return;
  }
  if (e.kind === 'flyer') { updateFlyer(e, dt); return; }
  if (e.kind === 'nest') { updateNest(e, dt); return; }
  if (e.kind === 'charger') { updateCharger(e, dt); return; }
  const T = nearestTarget(e.x, e.y), alive = !!T, dx = T ? T.x - e.x : 0, adx = T ? Math.abs(dx) : 1e9, dy = T ? Math.abs(T.y - e.y) : 1e9;
  const move = (dir: number, spd: number) => { e.vx = edgeAhead(e, dir) ? 0 : dir * spd; };

  switch (e.state) {
    case 'idle':
      if (Math.abs(e.x - e.home) > 4) { const d = Math.sign(e.home - e.x); move(d, e.spd * .5); e.face = d; } else e.vx = 0;
      if (alive && adx < e.aggro && dy < 60) {
        e.face = Math.sign(dx) || e.face; e.t = 0;
        if (e.howl) { e.state = 'howl'; SFX.howl(); addText(e.x, e.y - 22, 'AUUUU', '#c8c8d8'); alertPack(e); }
        else { e.state = 'chase'; if (e.kind === 'lunger') SFX.bark(); }
      }
      break;
    case 'howl': e.vx = 0; if (e.t > .6) { e.state = 'chase'; e.t = 0; } break;
    case 'chase':
      e.face = Math.sign(dx) || e.face;
      if (!alive || adx > e.aggro * 1.7) { e.state = 'idle'; break; }
      if (e.kind === 'ranged') {
        if (adx < e.keep) move(-e.face, e.spd); // recua
        else if (adx > e.range) move(e.face, e.spd);
        else e.vx = 0;
        if (adx <= e.range && adx > 24 && dy < 60 && e.t > .4) { e.state = 'wind'; e.t = 0; e.vx = 0; glint(e.x + e.face * 8, e.y - 16); }
        else if (adx <= 24 && e.t > .6) { e.state = 'wind'; e.t = 0; e.vx = 0; glint(e.x + e.face * 8, e.y - 16); } // encurralado: atira mesmo assim
      } else if (adx <= e.range && dy < 30) { e.state = 'wind'; e.t = 0; e.vx = 0; glint(e.x + e.face * (e.kind === 'lunger' ? 10 : 4), e.y - (e.kind === 'lunger' ? 12 : 30)); }
      else move(e.face, e.spd);
      break;
    case 'wind':
      e.vx = 0;
      if (e.kind === 'ranged') e.face = Math.sign(dx) || e.face;
      if (e.t >= e.wind) {
        e.state = 'atk'; e.t = 0; e.hitDone = false; e.hitSet = new Set();
        if (e.kind === 'lunger') { e.vx = e.face * 210; e.vy = -140; SFX.bark(); }
        else if (e.kind === 'ranged') { SFX.arrow(); G.projs.push({ type: 'arrow', owner: 'e', x: e.x + e.face * 8, y: e.y - 15, vx: e.face * 210, vy: 0, w: 8, h: 3, dmg: e.dmg, life: 2.2 }); }
        else SFX.swing();
      }
      break;
    case 'atk':
      if (e.kind === 'melee') e.vx = edgeAhead(e, e.face) ? 0 : e.face * 20;
      if (e.kind !== 'ranged' && !e.hitDone) {
        const box = e.kind === 'lunger' ? ebox(e) : { x: e.face > 0 ? e.x : e.x - e.range - 4, y: e.y - 26, w: e.range + 4, h: 26 };
        if (hitPlayers(box, e.dmg, e, e.hitSet) && e.kind === 'lunger') e.hitDone = true;
      }
      if (e.kind === 'lunger' && e.onGround && e.t > .15) e.vx *= .8;
      if (e.t >= e.atk && e.state === 'atk') { e.state = 'rec'; e.t = 0; }
      break;
    case 'rec': e.vx *= .85; if (e.t >= e.rec) { e.state = 'chase'; e.t = 0; } break;
    case 'hurt': e.vx *= Math.pow(.01, dt); if (edgeAhead(e, Math.sign(e.vx))) e.vx = 0; if (e.t > .3) { e.state = 'chase'; e.t = 0; } break;
    case 'stun': e.vx = 0; if (e.t > 1.3) { e.state = 'chase'; e.t = 0; } break;
  }
  for (const o of G.enemies) if (o !== e && o.state !== 'dead' && Math.abs(o.x - e.x) < 9 && Math.abs(o.y - e.y) < 10) e.x += (e.x < o.x ? -1 : 1) * 20 * dt;
  physics(e, dt, [12, (G.L.arena?.[0] ?? G.L.width) - 14]);
  if (e.y > G.L.height + 30) { e.state = 'dead'; e.t = 1; e.alpha = 0; } // caiu no buraco
}

/** Ao levar golpe: achata, empurra um pixel para trás e recua o tronco. */
export function hitSquash(e: any, o: any, amt = 1) {
  if (!(e.hitT > 0)) return;
  const k = Math.min(1, e.hitT / .13) * amt;
  o.sx = 1 + .1 * k; o.sy = 1 - .09 * k; o.shk = (e.hitDir || 1) * k * 1.2;
  o.lean = (o.lean || 0) - .12 * k;
}

export function enemyPose(e: any) {
  const o: any = { legA: 0, bob: 0, armA: -.9, flash: e.flash > 0, seed: e.seed };
  const ranged = e.kind === 'ranged';
  if (ranged) o.armA = -1.2;
  if (e.state === 'chase' || (e.state === 'idle' && e.vx)) { const ph = Math.sin(G.time * 9 + e.seed); o.legA = Math.round(ph * 1.5); o.bob = Math.abs(ph) > .7 ? 1 : 0; }
  else if (e.state === 'idle') o.bob = Math.sin(G.time * 2 + e.seed) > 0 ? 0 : 1;
  if (e.state === 'wind') o.armA = ranged ? lerp(-1.2, -1.57, e.t / .2) : lerp(-.9, -3.3, ease(e.t / e.wind));
  if (e.state === 'atk') { o.armA = ranged ? -1.57 : lerp(-3.3, -.2, e.t / .12); o.lean = ranged ? -.05 : .14; o.legA = 1; }
  if (e.state === 'wind' && !ranged) o.lean = -.08;
  if (e.state === 'rec') o.armA = ranged ? -1.4 : lerp(-.2, -.9, e.t / e.rec);
  if (e.state === 'hurt') { o.armA = -.4; o.bob = 1; o.lean = -.18; }
  if (e.state === 'stun') { o.armA = -.2; o.bob = 1; }
  if (e.state === 'dead') o.deadP = Math.min(1, e.t * 3);
  hitSquash(e, o);
  return o;
}
