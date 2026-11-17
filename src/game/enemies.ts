// IA genérica de inimigos, guiada pelos dados de src/data/enemies.json.
// kind: "melee" (anda e golpeia), "lunger" (bote, tipo cachorro/lobo), "ranged" (atira e mantém distância).
import { H } from '../core/canvas';
import { SFX } from '../core/audio';
import { lerp, ease } from '../core/math';
import { ENEMY_TYPES, LOOKS } from '../data/content';
import { G, addText, glint } from './state';
import { physics, edgeAhead, ov, ebox } from './physics';
import { hurtPlayer, pbox } from './combat';

export function mkEnemy(type: string, x: number, y?: number) {
  const T = ENEMY_TYPES[type];
  return { ...T, type, look: LOOKS[T.look], maxhp: T.hp, x, y: y ?? 230, home: x, vx: 0, vy: 0, face: -1, t: 0, state: 'idle', hitDone: false, flash: 0, alpha: 1, seed: x % 97 };
}

function alertPack(e: any) {
  for (const o of G.enemies) if (o !== e && o.type === e.type && o.state === 'idle' && Math.abs(o.x - e.x) < 160) { o.state = 'chase'; o.t = 0; }
}

export function updateEnemy(e: any, dt: number) {
  const P = G.P;
  e.t += dt; e.flash = Math.max(0, e.flash - dt);
  if (e.state === 'dead') { e.alpha = Math.max(0, 1 - e.t / .8); e.vx *= .9; physics(e, dt); return; }
  const dx = P.x - e.x, adx = Math.abs(dx), dy = Math.abs(P.y - e.y), alive = P.state !== 'dead';
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
        e.state = 'atk'; e.t = 0; e.hitDone = false;
        if (e.kind === 'lunger') { e.vx = e.face * 210; e.vy = -140; SFX.bark(); }
        else if (e.kind === 'ranged') { SFX.arrow(); G.projs.push({ type: 'arrow', owner: 'e', x: e.x + e.face * 8, y: e.y - 15, vx: e.face * 210, vy: 0, w: 8, h: 3, dmg: e.dmg, life: 2.2 }); }
        else SFX.swing();
      }
      break;
    case 'atk':
      if (e.kind === 'melee') e.vx = edgeAhead(e, e.face) ? 0 : e.face * 20;
      if (e.kind !== 'ranged' && !e.hitDone) {
        const box = e.kind === 'lunger' ? ebox(e) : { x: e.face > 0 ? e.x : e.x - e.range - 4, y: e.y - 26, w: e.range + 4, h: 26 };
        if (ov(box, pbox())) { e.hitDone = true; hurtPlayer(e.dmg, e); }
      }
      if (e.kind === 'lunger' && e.onGround && e.t > .15) e.vx *= .8;
      if (e.t >= e.atk && e.state === 'atk') { e.state = 'rec'; e.t = 0; }
      break;
    case 'rec': e.vx *= .85; if (e.t >= e.rec) { e.state = 'chase'; e.t = 0; } break;
    case 'hurt': e.vx *= Math.pow(.01, dt); if (edgeAhead(e, Math.sign(e.vx))) e.vx = 0; if (e.t > .3) { e.state = 'chase'; e.t = 0; } break;
    case 'stun': e.vx = 0; if (e.t > 1.3) { e.state = 'chase'; e.t = 0; } break;
  }
  for (const o of G.enemies) if (o !== e && o.state !== 'dead' && Math.abs(o.x - e.x) < 9 && Math.abs(o.y - e.y) < 10) e.x += (e.x < o.x ? -1 : 1) * 20 * dt;
  physics(e, dt, [12, G.L.arena[0] - 14]);
  if (e.y > H + 30) { e.state = 'dead'; e.t = 1; e.alpha = 0; } // caiu no buraco
}

export function enemyPose(e: any) {
  const o: any = { legA: 0, bob: 0, armA: -.9, flash: e.flash > 0, seed: e.seed };
  const ranged = e.kind === 'ranged';
  if (ranged) o.armA = -1.2;
  if (e.state === 'chase' || (e.state === 'idle' && e.vx)) { const ph = Math.sin(G.time * 9 + e.seed); o.legA = Math.round(ph * 1.5); o.bob = Math.abs(ph) > .7 ? 1 : 0; }
  else if (e.state === 'idle') o.bob = Math.sin(G.time * 2 + e.seed) > 0 ? 0 : 1;
  if (e.state === 'wind') o.armA = ranged ? lerp(-1.2, -1.57, e.t / .2) : lerp(-.9, -3.3, ease(e.t / e.wind));
  if (e.state === 'atk') o.armA = ranged ? -1.57 : lerp(-3.3, -.2, e.t / .12);
  if (e.state === 'rec') o.armA = ranged ? -1.4 : lerp(-.2, -.9, e.t / e.rec);
  if (e.state === 'hurt') { o.armA = -.4; o.bob = 1; }
  if (e.state === 'stun') { o.armA = -.2; o.bob = 1; }
  if (e.state === 'dead') o.deadP = Math.min(1, e.t * 3);
  return o;
}
