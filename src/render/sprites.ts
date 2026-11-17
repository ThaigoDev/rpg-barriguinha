// Sprites em pixel art gerados pelo motor (render/px). Cada personagem é um "look" (cores e estilo
// vindos dos JSON) montado sobre um esqueleto: humanoide ou quadrúpede. Os quadros são cacheados por pose.
import { ctx } from '../core/canvas';
import { G } from '../game/state';
import { PB, PO } from './px/raster';
import { C, rampFrom } from './px/palette';
import { isTouch } from '../core/input';

// ---------- Rig: transforma coordenadas do esqueleto (unidades do mundo) em pixels do sprite ----------
class Rig {
  rot = 0; px = 0; py = 0; dy = 0;
  constructor(public pb: PB, public g: number) {}
  T(x: number, y: number): [number, number] {
    y += this.dy;
    if (this.rot) {
      const c = Math.cos(this.rot), s = Math.sin(this.rot), X = x - this.px, Y = y - this.py;
      x = this.px + X * c - Y * s; y = this.py + X * s + Y * c;
    }
    return [x * this.g, y * this.g];
  }
  ell(x: number, y: number, rx: number, ry: number, m: number, o: PO = {}) { const [a, b] = this.T(x, y); this.pb.ell(a, b, rx * this.g, ry * this.g, m, { ...o, rot: (o.rot || 0) + this.rot }); }
  cap(x1: number, y1: number, x2: number, y2: number, r1: number, r2: number, m: number, o: PO = {}) { const [a, b] = this.T(x1, y1), [c, d] = this.T(x2, y2); this.pb.cap(a, b, c, d, r1 * this.g, r2 * this.g, m, o); }
  poly(pts: number[][], m: number, o: PO = {}) { this.pb.poly(pts.map(p => this.T(p[0], p[1])), m, o); }
  seam(x1: number, y1: number, x2: number, y2: number, d: number) { const [a, b] = this.T(x1, y1), [c, e] = this.T(x2, y2); this.pb.seam(a, b, c, e, d); }
  line(x1: number, y1: number, x2: number, y2: number, m: number, l = 0) { const [a, b] = this.T(x1, y1), [c, d] = this.T(x2, y2); this.pb.line(a, b, c, d, m, l); }
  shade(x: number, y: number, rx: number, ry: number, d: number) { const [a, b] = this.T(x, y); this.pb.shadeEll(a, b, rx * this.g, ry * this.g, d); }
  dot(x: number, y: number, m: number, l: number, w: number, h: number) { const [a, b] = this.T(x, y); this.pb.dot(Math.round(a - w / 2), Math.round(b - h / 2), m, l, w, h); }
}

// ---------- Materiais por look (cacheados no próprio objeto) ----------
function mats(d: any) {
  if (d._m) return d._m;
  const m: any = {
    skin: rampFrom(d.skin || '#c09070', 6, { shift: .06, spread: .5 }), hair: rampFrom(d.hair || '#222222', 5, { spread: .5 }),
    outfit: rampFrom(d.outfit || '#333333', 6), outfitD: rampFrom(d.outfitD || '#222222', 5),
    pants: rampFrom(d.pants || '#2a2a2a', 5), boots: rampFrom(d.boots || '#1a1a1a', 5),
    cape: d.cape ? rampFrom(d.cape, 6) : 0, trim: d.trim ? rampFrom(d.trim, 5) : C.gold,
    shield: d.shield ? rampFrom(d.shield, 6) : 0,
    eye: d.eye ? rampFrom(d.eye, 4, { emissive: true }) : rampFrom('#120a0a', 3),
    chain: d.chain ? rampFrom(d.chain, 4) : 0, pendant: d.pendant ? rampFrom(d.pendant, 4) : 0,
    mouth: rampFrom('#3a1a16', 3), frame: rampFrom('#141414', 3), lens: rampFrom('#a8c8dc', 4),
  };
  Object.defineProperty(d, '_m', { value: m, enumerable: false });
  return m;
}

const dir = (a: number): [number, number] => [-Math.sin(a), Math.cos(a)];

// ---------- Armas (desenhadas a partir da mão, ao longo do antebraço) ----------
function weapon(R: Rig, type: string, hx: number, hy: number, th: number, d: any, o: any) {
  const [ux, uy] = dir(th), vx = Math.cos(th), vy = Math.sin(th);
  const W = (t: number, s: number) => [hx + ux * t + vx * s, hy + uy * t + vy * s];
  const cap = (a: number[], b: number[], r1: number, r2: number, m: number, oo: PO = {}) => R.cap(a[0], a[1], b[0], b[1], r1, r2, m, oo);
  switch (type) {
    case 'sword': case 'rusty': {
      const bm = d.blade === 'ember' ? C.ember : type === 'rusty' ? C.rust : C.blade;
      R.ell(W(-1.8, 0)[0], W(-1.8, 0)[1], .6, .6, C.gold);
      cap(W(-1.5, 0), W(.9, 0), .42, .42, C.leather);
      cap(W(1.1, -1.9), W(1.1, 1.9), .5, .45, type === 'rusty' ? C.rust : C.gold);
      const tip = type === 'rusty' ? 11.2 : 12.6;
      R.poly([W(1.5, -.62), W(1.5, .62), W(tip - 1.2, .48), W(tip, 0), W(tip - 1.2, -.48)], bm, { grad: .3 });
      const a = W(2, -.4), b = W(tip - 1.3, -.32); R.seam(a[0], a[1], b[0], b[1], .5);
      const c = W(2, .1), e = W(tip - 2, .05); R.seam(c[0], c[1], e[0], e[1], -.35);
      break;
    }
    case 'daggers':
      cap(W(-1, 0), W(.8, 0), .4, .4, C.leather); cap(W(1, -1.2), W(1, 1.2), .38, .38, C.gold);
      R.poly([W(1.3, -.45), W(1.3, .45), W(6.4, .32), W(7.4, 0), W(6.4, -.32)], C.blade, { grad: .3 });
      { const a = W(1.6, -.3), b = W(6.6, -.2); R.seam(a[0], a[1], b[0], b[1], .5); }
      break;
    case 'axe':
      cap(W(-2.2, 0), W(10.5, 0), .45, .42, C.wood, { tex: .3 });
      R.poly([W(7, -.35), W(5.8, -3.4), W(7.6, -4.6), W(10.4, -4.4), W(10.7, -.35)], C.steel, { grad: .5 });
      { const a = W(6.2, -4.0), b = W(10.3, -4.3); R.seam(a[0], a[1], b[0], b[1], .6); }
      R.poly([W(8, .35), W(9.3, 1.9), W(9.9, .35)], C.steel);
      break;
    case 'staff':
      cap(W(-3.2, 0), W(11, .2), .5, .42, C.wood, { tex: .4 });
      cap(W(10.6, -1.1), W(12.8, -1.2), .3, .2, C.wood); cap(W(10.6, 1.1), W(12.8, 1.2), .3, .2, C.wood);
      { const p = W(12.2, 0); R.ell(p[0], p[1], 1.35, 1.35, C.ember); }
      cap(W(9.6, -.6), W(9.6, .6), .45, .45, C.gold);
      break;
    case 'great':
      cap(W(-2.4, 0), W(1, 0), .45, .45, C.leather); cap(W(1.2, -2.5), W(1.2, 2.5), .55, .5, C.dsteel);
      R.poly([W(1.6, -1.05), W(1.6, 1.05), W(14.2, .8), W(15.8, 0), W(14.2, -.8)], C.dsteel, { grad: .4 });
      cap(W(2, -.88), W(14.2, -.66), .28, .22, C.purple);
      { const a = W(2.4, .2), b = W(13.4, .15); R.seam(a[0], a[1], b[0], b[1], -.3); }
      break;
    case 'club':
      cap(W(-1, 0), W(8.4, 0), .55, 1.45, C.wood, { tex: .45 });
      for (const [t, s] of [[6, 1.1], [7.4, -.9], [8.3, .5]]) { const p = W(t, s); R.dot(p[0], p[1], C.steel, .6, 2, 2); }
      break;
    case 'hammer':
      cap(W(-2.4, 0), W(13, 0), .55, .55, C.wood, { tex: .3 });
      R.poly([W(12, -3.8), W(12, 3.8), W(16.4, 3.8), W(16.4, -3.8)], C.dsteel, { grad: .5, tex: .15 });
      { const a = W(12.4, -3.6), b = W(16, -3.6); R.seam(a[0], a[1], b[0], b[1], .5); }
      { const a = W(13, -2.4), b = W(14.6, -.6), c = W(13.6, 1.6), e = W(15.4, 2.6); R.line(a[0], a[1], b[0], b[1], C.ember, .6); R.line(b[0], b[1], c[0], c[1], C.ember, .5); R.line(c[0], c[1], e[0], e[1], C.ember, .4); }
      break;
    case 'fork':
      cap(W(-3, 0), W(12, 0), .45, .45, C.wood, { tex: .3 });
      cap(W(11.6, -1.8), W(11.6, 1.8), .35, .35, C.rust);
      for (const sy of [-1.6, 0, 1.6]) cap(W(11.6, sy), W(15, sy), .3, .2, C.rust);
      break;
    case 'spear':
      cap(W(-4, 0), W(15, 0), .5, .5, C.dsteel, { tex: .15 });
      R.poly([W(14.6, -1.1), W(14.6, 1.1), W(19.4, 0)], C.blade, { grad: .3 });
      { const a = W(15, -.6), b = W(19, 0); R.line(a[0], a[1], b[0], b[1], C.cyanE, .5); }
      cap(W(14.2, -1.6), W(14.2, 1.6), .4, .4, C.cyanE);
      break;
    case 'bow': {
      let prev: number[] | null = null;
      for (let k = -5; k <= 5; k++) { const s = k * .78, t = 1.9 - .075 * s * s, p = W(t, s); if (prev) cap(prev, p, .38, .38, C.wood); prev = p; }
      const a = W(.05, -3.9), b = W(.05, 3.9); R.line(a[0], a[1], b[0], b[1], rampFrom('#cfc6b0', 3), .3);
      if (o.nock) { cap(W(-1.2, 0), W(6.2, 0), .22, .22, C.wood); const p = W(6.4, 0); R.ell(p[0], p[1], .5, .4, C.steel); }
      break;
    }
    case 'cup': { const p = W(1, 0); R.ell(p[0], p[1], .95, 1.15, rampFrom('#e8e0d0', 4)); R.ell(p[0], p[1] - .8, .7, .3, rampFrom('#4a2810', 3), { flat: true }); break; }
  }
}

// ---------- Esqueleto humanoide ----------
function humanoid(R: Rig, d: any, o: any, M: any) {
  const b = o.bob || 0, armored = !!d.armor, g = R.g;
  let aF: number, kF: number, aB: number, kB: number;
  if (o.sit) { aF = 1.5; kF = 1.55; aB = 1.3; kB = 1.75; }
  else if (o.fall) { aF = .3; kF = .5; aB = -.35; kB = .3; }
  else if (o.air || o.roll != null) { aF = .95; kF = 1.7; aB = .25; kB = 1.4; }
  else if (o.amp) { const s = Math.sin(o.ph); aF = s * .62; aB = -s * .62; kF = .12 + Math.max(0, Math.cos(o.ph)) * 1.0; kB = .12 + Math.max(0, -Math.cos(o.ph)) * 1.0; }
  else if (o.legA) { aF = .17 * o.legA + .06; aB = -.17 * o.legA - .06; kF = .16 + .1 * Math.abs(o.legA); kB = .22; }
  else { aF = .1; aB = -.1; kF = .14; kB = .14; }
  if (b > 0) { kF += b * .38; kB += b * .38; aF += b * .1; }
  const hipY = -11.6, TL = 5.8, SL = 5.8;
  const leg = (hx: number, a: number, k: number) => { const kx = hx + Math.sin(a) * TL, ky = hipY + Math.cos(a) * TL; return { hx, kx, ky, fx: kx + Math.sin(a - k) * SL, fy: ky + Math.cos(a - k) * SL }; };
  const LF = leg(1.2, aF, kF), LB = leg(-1.2, aB, kB);
  if (!o.air && o.roll == null) R.dy = -(Math.max(LF.fy, LB.fy) + .7);
  if (o.sit) R.dy += .6;

  const S = hipY - 9.2, hx = .7, hy = S - 3.4;
  const shinMat = armored ? C.dsteel : M.boots;

  // capa (atrás de tudo)
  if (M.cape) {
    const sw = o.sway || 0, w = o.wave || 0;
    R.poly([[.8, S - .2], [-2.8, S], [-4.4 - sw * 2, S + 8], [-5.8 - sw * 4, -3.2 + Math.sin(w) * .6], [-4.6 - sw * 3.4, -.8 + Math.sin(w + 1) * .7],
      [-3.6 - sw * 3, -2.6 + Math.cos(w) * .6], [-2.4 - sw * 2.6, -.4], [-1.4 - sw * 2, -2.2], [-.4, -1.6 + Math.sin(w + 2) * .4], [.2, S + 9]], M.cape, { lum: -.12, tex: .14 });
    R.seam(-1.4, S + 1, -3.4 - sw * 3, -2.4, -.4); R.seam(-2.5, S + 1.5, -5 - sw * 3.6, -2.4, -.32); R.seam(-.6, S + 2, -1.2 - sw * 2, -2.4, -.3);
  }
  // segunda mão no cabo (armas de duas mãos): braço de trás resolvido por IK até o cabo
  let grip: number[] | null = null;
  if (o.grip && d.weapon !== 'none' && o.roll == null && !o.deadP) {
    const th = o.armA ?? -.9, [ex, ey] = dir(th + .3), [fx, fy] = dir(th);
    const hx0 = .9 + ex * 4 + fx * 3.6, hy0 = S + .6 + ey * 4 + fy * 3.6;
    const gx = hx0 - fx * 1.7, gy = hy0 - fy * 1.7, bx = -1.0, by = S + .8;
    let dx = gx - bx, dy = gy - by; const D0 = Math.hypot(dx, dy) || 1, D = Math.min(7.3, Math.max(1.2, D0));
    dx /= D0; dy /= D0;
    const L1 = 4, L2 = 3.6, ca = Math.max(-1, Math.min(1, (L1 * L1 + D * D - L2 * L2) / (2 * L1 * D))), A = Math.acos(ca);
    const base = Math.atan2(dy, dx), e1 = [bx + Math.cos(base + A) * L1, by + Math.sin(base + A) * L1], e2 = [bx + Math.cos(base - A) * L1, by + Math.sin(base - A) * L1];
    const el = e1[1] > e2[1] ? e1 : e2, hd = [bx + dx * D, by + dy * D];
    R.cap(bx, by, el[0], el[1], 1.3, 1.1, M.outfitD, { lum: -.3 });
    R.cap(el[0], el[1], hd[0], hd[1], 1.1, 1.0, armored ? C.dsteel : M.outfitD, { lum: -.3 });
    grip = hd;
  }
  // braço de trás
  if (!grip) {
    const th = o.armB ?? (.25 + (o.amp ? Math.sin(o.ph) * .55 : 0));
    const sx = -1.0, sy = S + .8, [ex, ey] = dir(th + .2), el = [sx + ex * 4, sy + ey * 4], [fx, fy] = dir(th), hd = [el[0] + fx * 3.6, el[1] + fy * 3.6];
    R.cap(sx, sy, el[0], el[1], 1.3, 1.1, M.outfitD, { lum: -.3 });
    R.cap(el[0], el[1], hd[0], hd[1], 1.1, 1.0, armored ? C.dsteel : M.outfitD, { lum: -.3 });
    R.ell(hd[0], hd[1], 1.0, 1.0, armored ? C.leather : M.skin, { lum: -.35 });
  }
  // pernas
  const drawLeg = (L: any, dark: number) => {
    R.cap(L.hx, hipY, L.kx, L.ky, 1.8, 1.45, M.pants, { lum: dark, tex: .08 });
    R.cap(L.kx, L.ky, L.fx, L.fy, 1.45, 1.25, shinMat, { lum: dark });
    R.ell(L.fx + .9, L.fy - .25, 2.05, 1.0, M.boots, { lum: dark - .05 });
    if (armored) R.ell(L.kx + .3, L.ky, 1.35, 1.2, C.dsteel, { lum: dark + .1 });
  };
  drawLeg(LB, -.3); drawLeg(LF, 0);
  // saia de manto
  if (d.robe) {
    R.poly([[-3.2, hipY - .8], [3.0, hipY - .8], [4.4, -1.4], [1.5, -.9], [-1.5, -1.1], [-4.6, -1.6]], M.outfit, { tex: .1 });
    R.seam(-.4, hipY, -1.2, -1.4, -.35); R.seam(1.6, hipY, 2.4, -1.4, -.3);
    if (d.trim) R.cap(-4.4, -1.6, 4.3, -1.4, .35, .35, M.trim);
  }
  // tronco
  R.poly([[-3.5, S - .3], [3.1, S - .5], [4.0, S + 3.0], [3.0, hipY + .2], [-2.9, hipY + .2], [-3.9, S + 3.4]], M.outfit, { tex: .08 });
  if (!armored) { R.seam(.6, S + 1.5, .9, hipY - 1.8, -.3); R.seam(-2.2, S + 2.5, -1.8, hipY - 1.8, -.25); }
  if (armored) {
    for (const yy of [S + 2.4, S + 4.6, S + 6.6]) { R.seam(-3.3, yy, 3.6, yy - .2, -.5); R.seam(-3.3, yy - .9, 3.6, yy - 1.1, .28); }
    R.poly([[-2.9, hipY - .3], [-.4, hipY - .3], [-.8, hipY + 2.6], [-2.6, hipY + 2.2]], C.dsteel);
    R.poly([[.2, hipY - .3], [2.8, hipY - .3], [2.6, hipY + 2.2], [.6, hipY + 2.6]], C.dsteel);
  }
  if (d.trim) R.cap(2.6, S + .2, 2.3, hipY - .6, .42, .42, M.trim);
  R.poly([[-3.0, hipY - 1.6], [3.0, hipY - 1.6], [3.0, hipY - .2], [-3.0, hipY - .2]], C.leather, { lum: -.1 });
  R.dot(2.2, hipY - .9, C.gold, .5, Math.max(1, Math.round(g)), Math.max(1, Math.round(g)));
  R.ell(.2, S + .6, 2.8, 1.8, armored ? C.dsteel : M.outfitD, { lum: armored ? .15 : 0 });
  if (armored) R.seam(-2.2, S + 1.2, 2.6, S + 1.0, -.4);
  if (M.chain) R.cap(-1.4, S + .4, 2.0, S + 1.7, .24, .24, M.chain);
  if (M.pendant) { R.cap(-1.4, S + .4, 1.9, S + 1.6, .22, .22, M.pendant); R.cap(1.9, S + 1.6, 2.1, S + 4.0, .2, .2, M.pendant); R.ell(2.1, S + 4.5, .55, .8, M.pendant); }

  // cabeça
  R.cap(.5, S - 1.2, .7, S + .4, 1.0, 1.15, M.skin, { lum: -.35 });
  head(R, d, o, M, hx, hy);

  // escudo (lado de fora) quando não está bloqueando
  if (M.shield && !o.block) {
    R.poly([[-1.8, S + 1.6], [2.8, S + 1.8], [2.8, S + 7.6], [.5, S + 10.6], [-1.8, S + 7.6]], M.shield, { tex: .1 });
    R.cap(.5, S + 2, .5, S + 9.8, .32, .32, M.trim); R.cap(-1.5, S + 4.6, 2.5, S + 4.6, .32, .32, M.trim);
  }
  // braço da frente + arma
  if (d.weapon !== 'none') {
    const th = o.armA ?? -.9, sx = .9, sy = S + .6;
    const [ex, ey] = dir(th + .3), el = [sx + ex * 4, sy + ey * 4], [fx, fy] = dir(th), hd = [el[0] + fx * 3.6, el[1] + fy * 3.6];
    R.cap(sx, sy, el[0], el[1], 1.35, 1.15, M.outfit);
    R.cap(el[0], el[1], hd[0], hd[1], 1.15, 1.0, armored ? C.dsteel : M.outfit);
    if (armored) R.ell(sx + .1, sy - .2, 1.9, 1.6, C.dsteel, { lum: .1 });
    if (d.bracelet) R.ell(el[0] + fx * 2.6, el[1] + fy * 2.6, 1.05, 1.05, C.silver);
    weapon(R, o.cup ? 'cup' : d.weapon, hd[0], hd[1], th, d, o);
    R.ell(hd[0], hd[1], 1.05, 1.05, armored ? C.leather : M.skin);
    if (grip) R.ell(grip[0], grip[1], 1.0, 1.0, armored ? C.leather : M.skin, { lum: -.15 });
  } else {
    R.cap(.9, S + .6, 1.6, S + 6, 1.3, 1.1, M.outfit); R.ell(1.8, S + 6.6, 1.0, 1.0, M.skin);
  }
  if (M.shield && o.block) {
    R.poly([[3.0, S - 2], [7.6, S - 1.4], [7.6, S + 6], [5.3, S + 10.4], [3.0, S + 6]], M.shield, { tex: .1 });
    R.cap(5.3, S - 1.2, 5.3, S + 9.6, .38, .38, M.trim); R.cap(3.3, S + 2.4, 7.3, S + 2.4, .38, .38, M.trim);
  }
}

function head(R0: Rig, d: any, o: any, M: any, hx: number, hy: number) {
  const K = .82, X = (x: number) => hx + (x - hx) * K, Y = (y: number) => hy + (y - hy) * K;
  const R = {
    ell: (x: number, y: number, rx: number, ry: number, m: number, oo: PO = {}) => R0.ell(X(x), Y(y), rx * K, ry * K, m, oo),
    cap: (x1: number, y1: number, x2: number, y2: number, r1: number, r2: number, m: number, oo: PO = {}) => R0.cap(X(x1), Y(y1), X(x2), Y(y2), r1 * K, r2 * K, m, oo),
    poly: (pts: number[][], m: number, oo: PO = {}) => R0.poly(pts.map(p => [X(p[0]), Y(p[1])]), m, oo),
    seam: (x1: number, y1: number, x2: number, y2: number, dd: number) => R0.seam(X(x1), Y(y1), X(x2), Y(y2), dd),
    line: (x1: number, y1: number, x2: number, y2: number, m: number, l = 0) => R0.line(X(x1), Y(y1), X(x2), Y(y2), m, l),
    shade: (x: number, y: number, rx: number, ry: number, dd: number) => R0.shade(X(x), Y(y), rx * K, ry * K, dd),
    dot: (x: number, y: number, m: number, l: number, w: number, h: number) => R0.dot(X(x), Y(y), m, l, w, h),
  };
  const g = R0.g, H = M.hair;
  const eyeM = o.eye ? rampFrom(o.eye, 4, { emissive: true }) : M.eye, eyeL = (o.eye || d.eye) ? .6 : -1;
  const ew = Math.max(1, Math.round(g * .9)), eh = Math.max(1, Math.round(g * .55));
  const hs = d.hs;
  if (hs === 'mask') {
    R.ell(hx - .6, hy - .4, 4.5, 4.7, H, { tex: .12 });
    R.ell(hx + 1.6, hy + .3, 2.6, 3.5, C.bone);
    R.seam(hx + 2.2, hy - 2.4, hx + 1.8, hy + 1.4, -.5);
    R.poly([[hx - 3.8, hy - 2], [hx - 1.6, hy - 5], [hx + 2.6, hy - 4.8], [hx + 4.6, hy - 2.6], [hx + 3.4, hy - 2.2], [hx + .8, hy - 3.2], [hx - 1.4, hy - .6]], H, { tex: .1 });
    R.shade(hx + 1.6, hy - 1.4, 2.4, 1.2, -.45);
    return;
  }
  if (hs === 'helm') {
    R.ell(hx, hy - .2, 4.0, 4.3, rampFrom(d.hair, 6), { tex: .06 });
    R.cap(hx - 3, hy - 4.2, hx + 2.4, hy - 4.6, .7, .5, rampFrom(d.hair, 6), { lum: .2 });
    R.cap(hx + .6, hy - .3, hx + 4.1, hy - .3, .38, .38, C.dark);
    R.seam(hx + 1.2, hy + 1.2, hx + 3.6, hy + 2.6, -.4); R.seam(hx - 3.6, hy + 1.6, hx + 3.6, hy + 1.6, -.25);
    if (d.eye) R.dot(hx + 2.8, hy - .3, eyeM, .7, ew, Math.max(1, eh));
    return;
  }
  // cabelo de trás
  switch (hs) {
    case 'wavy': R.ell(hx - 1.9, hy - .4, 2.8, 3.8, H, { tex: .35 }); R.ell(hx - 3.2, hy + 1.6, 1.4, 1.8, H, { tex: .3 }); break;
    case 'straight': case 'shadow': R.ell(hx - 1.8, hy + .2, 2.2, 3.2, H, { tex: .3 }); break;
    case 'shortcurly': R.ell(hx - 1.7, hy - .6, 2.0, 2.6, H, { tex: .45 }); break;
    case 'bigcurly': R.ell(hx - 2.4, hy - .8, 2.9, 3.5, H, { tex: .5 }); break;
    case 'bun': R.ell(hx - 1.7, hy - .3, 2.2, 3.0, H, { tex: .3 }); break;
    case 'hood': R.ell(hx - .7, hy - .2, 4.2, 4.4, M.cape, { tex: .12 }); break;
    case 'bald': if (d.hair && parseInt(d.hair.slice(1, 3), 16) > 120) R.ell(hx - 1.7, hy + .2, 1.4, 1.8, H, { tex: .3 }); break;
    case 'hat': R.ell(hx - 1.6, hy, 1.8, 2.6, H, { tex: .3 }); break;
  }
  // rosto
  R.ell(hx, hy, 3.4, 3.8, M.skin, { tex: .05 });
  R.ell(hx + 1.1, hy + 2.0, 2.4, 1.7, M.skin);
  R.poly([[hx + 2.9, hy - 1.0], [hx + 4.1, hy + .7], [hx + 2.9, hy + 1.0]], M.skin, { lum: .1 });
  R.ell(hx - 1.0, hy + .2, .8, 1.15, M.skin, { lum: -.3 });
  R.seam(hx + 1.9, hy + 2.0, hx + 3.0, hy + 2.0, -.7);
  // barba
  switch (d.beard) {
    case 'full':
      R.poly([[hx - 1.3, hy + .2], [hx - .5, hy + 2.7], [hx + 1.2, hy + 4.0], [hx + 3.4, hy + 3.5], [hx + 3.9, hy + 1.9], [hx + 2.9, hy + 1.5], [hx + 1.6, hy + 2.2], [hx + .4, hy + .8]], H, { tex: .4 });
      R.cap(hx + 2.0, hy + 1.3, hx + 3.8, hy + 1.4, .45, .4, H, { tex: .3 });
      R.line((hx + 2.3) , hy + 2.1, hx + 3.1, hy + 2.1, M.mouth, -.5);
      break;
    case 'mustache': R.cap(hx + 2.1, hy + 1.25, hx + 3.7, hy + 1.35, .36, .3, H); break;
    case 'goatee': R.cap(hx + 2.1, hy + 1.25, hx + 3.7, hy + 1.35, .36, .3, H); R.ell(hx + 2.5, hy + 3.3, 1.1, .9, H, { tex: .3 }); break;
    case 'stubble': R.shade(hx + 1.6, hy + 2.4, 2.4, 1.5, -.32); break;
  }
  // olho e sobrancelha
  R.dot(hx + 2.0, hy - .5, eyeM, eyeL, ew, eh);
  if (hs !== 'hood') R.cap(hx + 1.0, hy - 1.75, hx + 3.2, hy - 1.55, .32, .3, H);
  if (d.glasses) { R.cap(hx + .5, hy - .55, hx + 3.9, hy - .55, .28, .28, M.frame); R.ell(hx + 2.6, hy - .35, .95, .75, M.lens, { flat: true, lum: .3 }); R.dot(hx + 2.3, hy - .4, eyeM, eyeL, ew, eh); }
  // cabelo de cima
  switch (hs) {
    case 'wavy':
      R.ell(hx - .4, hy - 2.9, 4.3, 2.7, H, { tex: .35 }); R.ell(hx + 1.6, hy - 3.6, 2.4, 1.6, H, { tex: .3 });
      R.ell(hx - 2.9, hy - 3.2, 1.8, 1.6, H, { tex: .3 }); R.ell(hx - .4, hy - 5.0, 2.2, 1.3, H, { tex: .3 }); R.ell(hx + 2.4, hy - 4.6, 1.4, 1.0, H, { tex: .3 });
      R.poly([[hx + 1.2, hy - 3.4], [hx + 4.2, hy - 2.4], [hx + 3.8, hy - .9], [hx + 2.8, hy - 1.9], [hx + 2.2, hy - 1.2]], H);
      R.seam(hx - 2.6, hy - 4.2, hx + 1.4, hy - 5.4, .45); R.seam(hx - 3.4, hy - 2.4, hx - .4, hy - 4.0, .35);
      break;
    case 'straight': case 'shadow':
      R.ell(hx - .1, hy - 2.5, 3.9, 2.0, H, { tex: .25 });
      R.poly([[hx - 1, hy - 3.6], [hx + 3.6, hy - 2.7], [hx + 4.2, hy - 1.4], [hx + 2.2, hy - 2.0], [hx + .5, hy - 1.8]], H);
      if (hs === 'shadow') { R.shade(hx - 1.6, hy + .4, 2.8, 4.4, -.85); R.shade(hx + .6, hy + .4, 1.2, 4, -.3); }
      break;
    case 'shortcurly':
      R.ell(hx, hy - 2.6, 3.7, 1.8, H, { tex: .5 });
      for (let i = 0; i < 6; i++) { const a = -2.7 + i * .48; R.ell(hx + Math.cos(a) * 3.5, hy - 1.3 + Math.sin(a) * 2.9, .95, .95, H, { tex: .4 }); }
      break;
    case 'bigcurly':
      R.ell(hx - .3, hy - 3.2, 4.8, 3.0, H, { tex: .5 });
      for (let i = 0; i < 9; i++) { const a = -3.0 + i * .4; R.ell(hx - .3 + Math.cos(a) * 4.9, hy - 2.4 + Math.sin(a) * 3.5, 1.25, 1.2, H, { tex: .45 }); }
      break;
    case 'bun':
      R.ell(hx, hy - 2.5, 3.8, 1.9, H, { tex: .25 }); R.ell(hx - 3.6, hy - 3.0, 1.8, 1.7, H, { tex: .3 });
      break;
    case 'hood':
      R.poly([[hx - 4.1, hy - .8], [hx - 2.1, hy - 4.7], [hx + 2.3, hy - 4.5], [hx + 4.4, hy - 2.1], [hx + 3.8, hy - .5], [hx + 1.4, hy - 2.4], [hx - .9, hy + .2]], M.cape, { tex: .12 });
      R.shade(hx + 1.6, hy + .2, 2.6, 3.0, -.55);
      R.dot(hx + 2.0, hy - .5, eyeM, eyeL, ew, eh);
      break;
    case 'bald': R.shade(hx - .4, hy - 2.6, 3, 1.2, .2); break;
    case 'hat': {
      const hm = rampFrom(d.hatColor || '#b89a5a', 5);
      R.ell(hx, hy - 2.8, 3.6, 2.2, hm, { tex: .35 });
      R.ell(hx + .3, hy - 1.9, 6.4, 1.0, hm, { tex: .35 });
      R.cap(hx - 3.4, hy - 2.4, hx + 3.6, hy - 2.4, .35, .35, rampFrom('#5a2a1a', 3));
      break;
    }
  }
}

// ---------- Esqueleto quadrúpede (caramelo, lobo) ----------
function quad(R: Rig, pal: any, o: any) {
  const body = rampFrom(pal.body, 6), dark = rampFrom(pal.dark, 5), light = rampFrom(pal.light, 5), ear = rampFrom(pal.ear, 4);
  const eye = rampFrom(pal.eye, 4, { emissive: true });
  const cr = o.crouch ? 1.6 : 0, ph = o.ph || 0, amp = o.amp || 0;
  const by = -7.4 + cr;
  const legs: [number, number, number, boolean][] = [[-5, ph + Math.PI, -.3, true], [4.4, ph, -.3, true], [-5.6, ph, 0, false], [3.8, ph + Math.PI, 0, false]];
  const drawLeg = (x: number, p: number, dk: number, back: boolean) => {
    const sw = Math.sin(p) * .55 * amp + (o.lunge ? (back ? -.6 : .7) : 0), top = [x, by + 1.5];
    const knee = [x + Math.sin(sw) * 3, top[1] + Math.cos(sw) * 3], kk = back ? sw - .6 : sw + .15;
    const foot = [knee[0] + Math.sin(kk) * 3.4, knee[1] + Math.cos(kk) * 3.4];
    R.cap(top[0], top[1], knee[0], knee[1], 1.3, .9, body, { lum: dk });
    R.cap(knee[0], knee[1], foot[0], foot[1], .85, .7, dark, { lum: dk });
    R.ell(foot[0] + .5, foot[1] - .2, 1.0, .6, dark, { lum: dk });
  };
  for (const l of legs) if (l[3] === true) drawLeg(l[0], l[1], -.35, l[0] < 0);
  // cauda
  const wag = Math.sin(G.time * 16) * .5 * (o.dead ? 0 : 1);
  R.cap(-7.6, by - 1.4, -10, by - 3.4 + wag, 1.1, .7, body, { tex: .3 }); R.cap(-10, by - 3.4 + wag, -11.4, by - 2.4 + wag * 1.5, .7, .45, dark);
  // corpo
  R.ell(-1.2, by, 7.2, 3.6, body, { tex: .28 });
  R.ell(3.6, by - .5, 3.5, 4.0, body, { tex: .25 });
  R.seam(-6.5, by - 3, 3.5, by - 4.2, -.35);
  R.ell(.5, by + 2.2, 4.8, 1.1, light, { lum: -.1 });
  if (pal.mane) for (let i = 0; i < 5; i++) R.poly([[1 + i * 1.2, by - 3.4], [1.8 + i * 1.2, by - 6 + (i % 2)], [2.4 + i * 1.2, by - 3.2]], dark);
  for (const l of legs) if (l[3] === false) drawLeg(l[0], l[1], 0, l[0] < 0);
  // cabeça
  const howl = o.howl, hx = howl ? 6.6 : 7.4, hy = (howl ? -15 : -11.6) + cr, tilt = howl ? -.9 : 0;
  R.cap(4.2, by - 1.6, hx - .5, hy + .6, 2.4, 2.0, body, { tex: .2 });
  R.ell(hx, hy, 2.8, 2.4, body, { tex: .2 });
  const c = Math.cos(tilt), s = Math.sin(tilt), P = (x: number, y: number) => [hx + x * c - y * s, hy + x * s + y * c];
  R.poly([P(1.2, -1.0), P(5.0, .1), P(4.9, 1.3), P(1.0, 1.7)], body);
  R.ell(P(4.9, .3)[0], P(4.9, .3)[1], .55, .5, rampFrom('#141010', 3));
  if (o.bite) R.poly([P(1.6, 1.4), P(4.6, 1.4), P(4.2, 2.4), P(1.6, 2.2)], rampFrom('#3a0a0a', 3)), R.line(P(2, 1.5)[0], P(2, 1.5)[1], P(4.4, 1.5)[0], P(4.4, 1.5)[1], rampFrom('#f0f0f0', 3), .5);
  if (pal.horns) { R.cap(P(-.4, -1.6)[0], P(-.4, -1.6)[1], P(.6, -4.2)[0], P(.6, -4.2)[1], .7, .35, C.bone); R.cap(P(.6, -4.2)[0], P(.6, -4.2)[1], P(2.2, -5.0)[0], P(2.2, -5.0)[1], .35, .2, C.bone); }
  R.poly([P(-1.4, -1.5), P(-.6, -4.6), P(.9, -1.8)], ear, { lum: -.1 });
  R.dot(P(1.4, -.6)[0], P(1.4, -.6)[1], eye, .7, Math.max(1, Math.round(R.g * .8)), Math.max(1, Math.round(R.g * .5)));
}

// ---------- Cache de quadros e desenho ----------
const cache = new Map<string, { c: HTMLCanvasElement; ox: number; oy: number }>();
const ids = new WeakMap<object, number>(); let idN = 1;
const lid = (d: object) => { let i = ids.get(d); if (!i) { i = idN++; ids.set(d, i); } return i; };
function getFrame(key: string, g: number, build: (R: Rig) => void, flash: boolean) {
  let f = cache.get(key);
  if (f) { cache.delete(key); cache.set(key, f); return f; }
  const size = Math.ceil(66 * g / 2) * 2, ox = size / 2, oy = Math.round(size * .78);
  const pb = new PB(size, size, ox, oy), R = new Rig(pb, g);
  build(R);
  f = { c: pb.toCanvas({ outline: true, rim: .32, rimBack: .16, ao: .26, flash }), ox, oy };
  cache.set(key, f);
  if (cache.size > (isTouch ? 320 : 900)) cache.delete(cache.keys().next().value!);
  return f;
}
function blit(f: { c: HTMLCanvasElement; ox: number; oy: number }, x: number, y: number, face: number, al: number, shadowW: number, kx = 1, ky = 1, glow?: string | null) {
  const m = ctx.getTransform(), sx = m.a * x + m.c * y + m.e, sy = m.b * x + m.d * y + m.f;
  ctx.save();
  if (shadowW) { ctx.setTransform(1, 0, 0, 1, Math.round(sx), Math.round(sy)); ctx.globalAlpha *= al; ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(0, 0, shadowW * kx, Math.max(2, shadowW * .18), 0, 0, 7); ctx.fill(); ctx.globalAlpha /= al || 1; }
  // escala de "squash & stretch" a partir dos pés
  ctx.setTransform((face < 0 ? -1 : 1) * kx, 0, 0, ky, Math.round(sx), Math.round(sy)); ctx.globalAlpha *= al;
  ctx.drawImage(f.c, -f.ox, -f.oy);
  if (glow) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= .35 + .25 * Math.sin(G.time * 30); ctx.drawImage(f.c, -f.ox, -f.oy); }
  ctx.restore();
}
const q = (v: number | undefined, s: number) => (v == null ? '' : Math.round(v / s));
let lastKey = '';

/** Desenha um humanoide com os pés em (x, y) do sistema de coordenadas atual. */
export function drawCharAt(d: any, x: number, y: number, face: number, o: any, sc = 1, al = 1) {
  const g = sc * ctx.getTransform().a;
  const wave = Math.floor(G.time * 5 + (o.seed || 0)) % 4;
  const key = ['h', lid(d), g.toFixed(2), q(o.armA, .13), q(o.armB, .2), o.legA | 0, o.amp ? Math.round(((o.ph % 6.2832) + 6.2832) % 6.2832 / 6.2832 * 8) % 8 : 'n', o.bob | 0,
    o.roll != null ? Math.round(o.roll / (Math.PI / 6)) % 12 : '', q(o.deadP, .2), q(o.lean, .05), o.sit ? 1 : 0, o.fall ? 1 : 0, o.block ? 1 : 0, o.cup ? 1 : 0, o.eye || '', o.air ? 1 : 0, o.flash ? 1 : 0, wave, q(o.sway, .34), o.nock ? 1 : 0, o.grip ? 1 : 0].join('|');
  lastKey = key;
  const f = getFrame(key, g, R => {
    const oo = { ...o, wave: wave * Math.PI / 2, sway: ((q(o.sway, .34) as any) * .34) || 0 };
    if (o.roll != null) { R.rot = Math.round(o.roll / (Math.PI / 6)) * (Math.PI / 6); R.px = 0; R.py = -6; R.dy = 3; oo.armA = -2.4; }
    if (o.deadP) { R.rot = -Math.PI / 2 * ((q(o.deadP, .2) as any) * .2); R.px = 0; R.py = 0; }
    else if (o.lean && o.roll == null) { R.rot = (q(o.lean, .05) as any) * .05; R.px = 0; R.py = -2; }
    humanoid(R, d, oo, mats(d));
  }, !!o.flash);
  blit(f, x + (o.shk || 0), y, face, al, o.noShadow ? 0 : 6 * g, o.sx || 1, o.sy || 1, o.glow);
}

/** Silhueta colorida de um quadro (imagem fantasma de rolamentos e investidas). */
const tintC = document.createElement('canvas'), tintX = tintC.getContext('2d')!;
export function drawGhost(d: any, x: number, y: number, face: number, o: any, c: string, al: number) {
  const g = ctx.getTransform().a;
  const before = cache.size;
  drawCharAt(d, -9999, -9999, face, { ...o, noShadow: true }, 1, 0); // garante o quadro no cache (alpha 0)
  void before;
  const key = lastKey; const f = cache.get(key); if (!f) return;
  if (tintC.width < f.c.width || tintC.height < f.c.height) { tintC.width = f.c.width; tintC.height = f.c.height; }
  tintX.clearRect(0, 0, tintC.width, tintC.height); tintX.globalCompositeOperation = 'source-over'; tintX.drawImage(f.c, 0, 0);
  tintX.globalCompositeOperation = 'source-in'; tintX.fillStyle = c; tintX.fillRect(0, 0, f.c.width, f.c.height);
  const m = ctx.getTransform(), sx = m.a * x + m.e, sy = m.d * y + m.f;
  ctx.save(); ctx.setTransform(face < 0 ? -1 : 1, 0, 0, 1, Math.round(sx), Math.round(sy)); ctx.globalAlpha = al; ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(tintC, 0, 0, f.c.width, f.c.height, -f.ox, -f.oy, f.c.width, f.c.height); ctx.restore();
  void g;
}

/** Quadrúpedes. pal = paleta do look (enemies.json). */
export function drawDog(e: any, pal: any) {
  const g = ctx.getTransform().a * (pal.scale || 1);
  const o: any = { amp: 0, ph: 0 };
  if (e.state === 'chase' || (e.state === 'idle' && e.vx)) { o.amp = 1; o.ph = G.time * (e.state === 'chase' ? 16 : 8) + e.seed; }
  if (e.state === 'wind') { o.crouch = 1; o.bite = 1; }
  if (e.state === 'atk') { o.lunge = 1; o.bite = 1; }
  if (e.state === 'howl') o.howl = 1;
  if (e.state === 'dead') o.dead = 1;
  const ph8 = o.amp ? Math.round(((o.ph % 6.2832) + 6.2832) % 6.2832 / 6.2832 * 8) % 8 : 0;
  const wag = Math.floor(G.time * 8) % 3;
  const flash = e.flash > 0;
  const key = ['q', lid(pal), g.toFixed(2), ph8, o.amp, o.crouch | 0, o.lunge | 0, o.howl | 0, o.bite | 0, o.dead | 0, wag, flash ? 1 : 0].join('|');
  const f = getFrame(key, g, R => {
    o.ph = ph8 * Math.PI / 4;
    if (o.lunge) { R.rot = -.22; R.px = 0; R.py = -6; }
    if (o.dead) { R.rot = -.5; R.px = 0; R.py = -3; R.dy = 2; }
    quad(R, pal, o);
  }, flash);
  const hk = e.hitT > 0 ? Math.min(1, e.hitT / .13) : 0;
  blit(f, e.x + (hk ? (e.hitDir || 1) * hk : 0), e.y, e.face, e.alpha, 8 * g, 1 + .1 * hk, 1 - .1 * hk);
}

/** Maribondo: pequeno, desenhado direto (asas batendo, listras). */
export function drawWasp(e: any) {
  const m = ctx.getTransform(), x = Math.round(m.a * e.x + m.e), y = Math.round(m.d * e.y + m.f), f = e.face || 1;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = e.alpha;
  const P = (dx: number, dy: number, w: number, h: number, c: string) => { ctx.fillStyle = e.flash > 0 ? '#fff' : c; ctx.fillRect(x + (f > 0 ? dx : -dx - w), y + dy, w, h); };
  const flap = Math.floor(G.time * 30 + e.seed) % 2;
  ctx.globalAlpha = e.alpha * .6; P(-3, flap ? -7 : -5, 5, flap ? 3 : 2, '#e8f4ff'); P(-1, flap ? -8 : -6, 4, flap ? 3 : 2, '#cfe4ff'); ctx.globalAlpha = e.alpha;
  P(-6, -3, 7, 5, '#0c0a06'); P(-5, -2, 5, 3, '#d8a020'); P(-3, -2, 1, 3, '#1a1208'); P(-6, -1, 1, 1, '#1a1208');
  P(1, -3, 4, 4, '#0c0a06'); P(2, -2, 2, 2, '#3a2a10'); P(3, -2, 1, 1, '#ff3020');
  P(-8, 0, 2, 1, '#0c0a06');
  if (e.state === 'wind' || e.state === 'atk') P(-9, 1, 2, 1, '#f0f0f0');
  ctx.restore();
}

/** Ninho de maribondo. */
export function drawNest(e: any) {
  const m = ctx.getTransform(), x = Math.round(m.a * e.x + m.e), y = Math.round(m.d * e.y + m.f);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = e.alpha;
  const fl = e.flash > 0;
  ctx.fillStyle = '#0a0806'; ctx.beginPath(); ctx.ellipse(x, y - 14, 15, 17, 0, 0, 7); ctx.fill();
  ctx.fillStyle = fl ? '#fff' : '#8a7e6a'; ctx.beginPath(); ctx.ellipse(x, y - 14, 13, 15, 0, 0, 7); ctx.fill();
  for (let i = 0; i < 7; i++) { ctx.fillStyle = fl ? '#fff' : (i % 2 ? '#6a604e' : '#a89a80'); ctx.fillRect(x - 12, y - 26 + i * 4, 24, 1); }
  ctx.fillStyle = '#0a0806'; ctx.fillRect(x - 2, y - 4, 4, 3); ctx.fillRect(x - 1, y - 32, 2, 4);
  ctx.restore();
}
