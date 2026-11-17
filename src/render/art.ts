// Cenários pré-renderizados em pixel art (960x540), gerados uma vez por fase com o mesmo motor dos sprites.
// Camadas: céu fixo, longe, meio, perto (parallax), chão (com plataformas, fogueiras, velas) e primeiro plano.
import { ctx, W, GY, SC } from '../core/canvas';
import { rng } from '../core/math';
import { PB } from './px/raster';
import { ramp, C } from './px/palette';
import { fbm, hash2 } from './px/noise';
import { G } from '../game/state';

const SW = W * SC, SH = 270 * SC, GYS = GY * SC; // 960, 540, 460
const GTOP = 200; // topo da camada de chão na tela (cabe as plataformas mais altas)

type Layer = { c: HTMLCanvasElement; p: number; y: number };
export type Art = { theme: string; sky: HTMLCanvasElement; layers: Layer[]; ground: HTMLCanvasElement; fore: Layer; candles: { x: number; y: number }[]; shrooms: { x: number; y: number }[] };

const T: Record<string, any> = {
  vila: {
    sky: ramp('v.sky', ['#05060c', '#090c16', '#0e1422', '#141d2f', '#1b283d', '#24344c', '#2f425b', '#3c526b']),
    cloud: ramp('v.cloud', ['#0b111d', '#131d2f', '#1c2a40', '#273851', '#344866', '#465d7c', '#5e7896']),
    moon: ramp('v.moon', ['#7e7c5e', '#a8a67e', '#cfcd9e', '#e8e6b8', '#f6f4d0', '#fffef0'], true),
    mist1: ramp('v.m1', ['#121c2a', '#182537', '#1f2f44', '#283a52', '#324661', '#3e5370']),
    mist2: ramp('v.m2', ['#0b121c', '#101a27', '#162233', '#1d2b40', '#26364e', '#30425c']),
    stone: ramp('v.st', ['#080b12', '#0e131d', '#151c29', '#1d2637', '#273246', '#334058', '#43526d']),
    tree: ramp('v.tr', ['#04050a', '#080b12', '#0d111b', '#131926', '#1b2333', '#252f42']),
    cob: ramp('v.cob', ['#0a0c13', '#11151f', '#191e2b', '#222939', '#2c3549', '#39445b', '#4b5871', '#61708c']),
    mortar: ramp('v.mor', ['#030406', '#07080d', '#0b0d14']),
    grass: ramp('v.gr', ['#06090b', '#0b1113', '#11191b', '#182224', '#202d2e']),
    dirt: ramp('v.dirt', ['#050608', '#0a0b10', '#0f1118', '#151822']),
    moonX: 610, moonY: 170, moonR: 80, cloudAmt: .56,
  },
  floresta: {
    sky: ramp('f.sky', ['#020504', '#050c09', '#08130f', '#0c1c16', '#11261e', '#173128', '#1f3d33', '#294a3f']),
    cloud: ramp('f.cloud', ['#08120e', '#0e1c16', '#152820', '#1d352b', '#284437', '#355546']),
    moon: ramp('f.moon', ['#6a7c64', '#8ea684', '#b4cca6', '#d4e6c6', '#ecf6e2', '#fbfff6'], true),
    mist1: ramp('f.m1', ['#0b1814', '#10211b', '#162b23', '#1d362d', '#264237', '#304f42']),
    mist2: ramp('f.m2', ['#07100c', '#0b1712', '#101f19', '#162820', '#1d3229', '#253d33']),
    bark: ramp('f.bark', ['#050806', '#0a0e0b', '#101611', '#172019', '#1f2a21', '#29362a', '#34432f']),
    moss: ramp('f.moss', ['#0a1408', '#11200c', '#1a3011', '#244217', '#30561d', '#3e6c24']),
    leaf: ramp('f.leaf', ['#020604', '#050c08', '#09140d', '#0e1d13', '#14281a']),
    tree: ramp('f.tr', ['#020403', '#050907', '#09100c', '#0e1712', '#141f18']),
    soil: ramp('f.soil', ['#050605', '#0a0c09', '#10140f', '#171d15', '#1f271c', '#283224']),
    grass: ramp('f.gr', ['#081008', '#0e1a0d', '#162713', '#20361a', '#2b4722', '#38592b']),
    stone: ramp('f.st', ['#0a0e10', '#111719', '#192124', '#222c30', '#2d393e', '#3a484e']),
    moonX: 680, moonY: 120, moonR: 44, cloudAmt: .64,
  },
};
const VOID = ramp('void', ['#000000', '#020203', '#050509', '#0a0b12']);

function fog(pb: PB, y0: number, y1: number, amt: number, base = 0) {
  const { w, h, mat, lum } = pb;
  for (let y = 0; y < h; y++) {
    const f = Math.max(0, Math.min(1, (y - y0) / (y1 - y0))) * amt + base;
    if (!f) continue;
    for (let x = 0; x < w; x++) { const i = y * w + x; if (mat[i]) lum[i] += f; }
  }
}

// ---------------- CÉU ----------------
function genSky(P: any, seed: number) {
  const pb = new PB(SW, SH);
  const { sky, cloud, moon, moonX: mx, moonY: my, moonR: mr, cloudAmt: thr } = P;
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    const d = Math.hypot(x - mx, y - my);
    if (d < mr) {
      let l = .7 - Math.pow(d / mr, 2) * .55;
      const n = fbm(x * .045, y * .045, seed + 3, 3);
      if (n < .42) l -= .5; else if (n < .47) l -= .25;
      pb.set(x, y, moon, l, 1);
    } else {
      let l = -1 + 1.6 * Math.pow(Math.min(1, y / 470), 1.15) + .95 * Math.exp(-(d - mr) / 95);
      if (y < 320 && hash2(x, y, seed) > .9982) l = 1.2;
      pb.set(x, y, sky, l, 1);
    }
    if (y < 360) {
      const band = 1 - Math.abs((y - 190) / 190);
      const n = fbm(x * .0042, y * .03, seed + 11, 5) * (.75 + band * .35);
      if (n > thr) {
        const n2 = fbm(x * .0042, (y - 3) * .03, seed + 11, 5) * (.75 + (1 - Math.abs((y - 193) / 190)) * .35);
        let l = (n - thr) * 4 - .6 + 1.0 * Math.exp(-d / 160);
        if (n2 < thr) l += .55;
        pb.set(x, y, cloud, l, 2);
      }
    }
  }
  return pb.toCanvas({ dither: 1 });
}

// ---------------- LONGE ----------------
function genFar(P: any, w: number, seed: number) {
  const pb = new PB(w, SH), r = rng(seed);
  for (let x = 0; x < w; x++) {
    const h = 250 + 70 * fbm(x * .0035, .5, seed, 4) - 30 * fbm(x * .012, 2.5, seed + 5, 3);
    for (let y = Math.max(0, Math.floor(h)); y < GYS + 20; y++) pb.set(x, y, P.mist1, -.55 + (y - h) / 220, 1);
  }
  let x = -10;
  while (x < w + 20) {
    const base = 335 + 30 * fbm(x * .006, 1, seed + 7, 3), th = 16 + r() * 44, tw = th * (.32 + r() * .12);
    const pts: number[][] = [[x, base + 4]];
    const steps = 5;
    for (let i = 1; i <= steps; i++) pts.push([x + tw / 2 * (i / steps) - (i % 2 ? 1.5 : -1), base - th * (i / steps)]);
    for (let i = steps - 1; i >= 1; i--) pts.push([x + tw - tw / 2 * (i / steps) + (i % 2 ? 1.5 : -1), base - th * (i / steps)]);
    pts.push([x + tw, base + 4]);
    pb.poly(pts, P.mist2, { flat: true, lum: -.5 });
    x += 4 + r() * 10;
  }
  for (let xx = 0; xx < w; xx++) { const base = 335 + 30 * fbm(xx * .006, 1, seed + 7, 3); for (let y = Math.floor(base); y < GYS + 20; y++) pb.set(xx, y, P.mist2, -.5, 1); }
  fog(pb, 260, GYS, 1.2);
  return pb.toCanvas({ rim: .15 });
}

// ---------------- MEIO: ruínas (vila) ----------------
function bricks(pb: PB, x0: number, y0: number, x1: number, y1: number) {
  let row = 0;
  for (let y = y0 + 6; y < y1; y += 7, row++) {
    pb.seam(x0, y, x1, y, -.35);
    for (let x = x0 + (row % 2 ? 6 : 0); x < x1; x += 13) pb.seam(x, y - 6, x, y - 1, -.25);
  }
}
function genRuins(P: any, w: number, seed: number) {
  const pb = new PB(w, SH), r = rng(seed), S = P.stone;
  let x = 10 + r() * 40;
  const win = (cx: number, cy: number, ww: number, hh: number, lit: boolean) => {
    const m = lit ? C.ember : VOID, l = lit ? .1 : -1;
    pb.poly([[cx - ww / 2, cy], [cx + ww / 2, cy], [cx + ww / 2, cy + hh], [cx - ww / 2, cy + hh]], m, { flat: true, lum: l });
    pb.ell(cx, cy, ww / 2, ww / 2, m, { flat: true, lum: l });
  };
  while (x < w) {
    const k = r();
    if (k < .4) { // torre
      const tw = 34 + r() * 44, th = 150 + r() * 170, top = GYS - th, broken = r() < .5;
      const pts: number[][] = [[x, GYS + 20], [x, top]];
      if (broken) for (let i = 1; i < 6; i++) pts.push([x + tw * i / 6, top + r() * 26 * (i % 2 ? 1 : .4)]);
      else for (let i = 0; i < 4; i++) { pts.push([x + tw * (i + .1) / 4, top - 6], [x + tw * (i + .5) / 4, top - 6], [x + tw * (i + .5) / 4, top], [x + tw * (i + 1) / 4, top]); }
      pts.push([x + tw, top], [x + tw, GYS + 20]);
      pb.poly(pts, S, { grad: .8, tex: .12 });
      bricks(pb, x, top, x + tw, GYS);
      if (!broken && r() < .6) pb.poly([[x - 4, top - 6], [x + tw / 2, top - 70 - r() * 50], [x + tw + 4, top - 6]], S, { grad: .9, tex: .1 });
      for (let wy = top + 24; wy < GYS - 50; wy += 46 + r() * 20) win(x + tw / 2, wy, 7 + r() * 4, 14, r() < .22);
      x += tw + 8 + r() * 50;
    } else if (k < .75) { // muro com arcos
      const ww = 110 + r() * 160, wh = 60 + r() * 80, top = GYS - wh;
      const pts: number[][] = [[x, GYS + 20], [x, top + r() * 10]];
      for (let i = 1; i < 8; i++) pts.push([x + ww * i / 8, top + (r() < .4 ? r() * 30 : 0)]);
      pts.push([x + ww, top + r() * 14], [x + ww, GYS + 20]);
      pb.poly(pts, S, { grad: .6, tex: .12 });
      bricks(pb, x, top, x + ww, GYS);
      const n = Math.max(1, Math.floor(ww / 46));
      for (let i = 0; i < n; i++) {
        const cx = x + ww * (i + .5) / n, aw = Math.min(30, ww / n - 10), ah = wh * .55;
        pb.poly([[cx - aw / 2, GYS - ah], [cx + aw / 2, GYS - ah], [cx + aw / 2, GYS + 20], [cx - aw / 2, GYS + 20]], 0);
        pb.ell(cx, GYS - ah, aw / 2, aw / 2, 0);
      }
      x += ww + 10 + r() * 40;
    } else { // igreja com torre pontuda
      const cw = 70 + r() * 40, ch = 110 + r() * 40, top = GYS - ch;
      pb.poly([[x, GYS + 20], [x, top], [x + cw / 2, top - 46], [x + cw, top], [x + cw, GYS + 20]], S, { grad: .7, tex: .12 });
      bricks(pb, x, top, x + cw, GYS);
      const sx = x + cw * .7, sw = 22, sh = 120 + r() * 80;
      pb.poly([[sx, top + 10], [sx, top - sh * .45], [sx + sw / 2, top - sh], [sx + sw, top - sh * .45], [sx + sw, top + 10]], S, { grad: .9, tex: .1 });
      win(x + cw / 2, top + 16, 16, 30, r() < .5);
      pb.ell(x + cw / 2, top - 8, 7, 7, VOID, { flat: true, lum: -1 });
      x += cw + 20 + r() * 50;
    }
  }
  fog(pb, 300, GYS, 1.15, -.05);
  return pb.toCanvas({ rim: .4, rimBack: .1, ao: .15 });
}

// ---------------- árvores mortas ----------------
function branch(pb: PB, x: number, y: number, a: number, len: number, rad: number, depth: number, m: number, r: () => number) {
  const x2 = x + Math.sin(a) * len, y2 = y - Math.cos(a) * len;
  pb.cap(x, y, x2, y2, rad, rad * .68, m, { tex: .3 });
  if (depth <= 0 || len < 6) return;
  const n = 2 + (r() < .4 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const na = a + (i - (n - 1) / 2) * (.5 + r() * .4) + (r() - .5) * .3;
    branch(pb, x2, y2, na, len * (.6 + r() * .2), rad * .66, depth - 1, m, r);
  }
}
function genNearVila(P: any, w: number, seed: number) {
  const pb = new PB(w, SH), r = rng(seed);
  let x = 40 + r() * 100;
  while (x < w) {
    if (r() < .65) {
      const h = 90 + r() * 90, lean = (r() - .5) * .3;
      branch(pb, x, GYS + 20, lean, h * .55, 8 + r() * 4, 5, P.tree, r);
      pb.poly([[x - 16, GYS + 20], [x - 4, GYS - 6], [x + 6, GYS - 6], [x + 18, GYS + 20]], P.tree, { tex: .2 });
    } else {
      const cw = 14 + r() * 8, ch = 40 + r() * 70;
      pb.poly([[x, GYS + 20], [x, GYS - ch], [x + cw * .3, GYS - ch - 6 * r()], [x + cw, GYS - ch + 8 * r()], [x + cw, GYS + 20]], P.stone, { grad: .8, tex: .15 });
      for (let yy = GYS - ch + 10; yy < GYS; yy += 12) pb.seam(x, yy, x + cw, yy, -.4);
      pb.poly([[x - 4, GYS - 8], [x + cw + 4, GYS - 8], [x + cw + 4, GYS + 20], [x - 4, GYS + 20]], P.stone, { grad: .6 });
    }
    x += 150 + r() * 240;
  }
  fog(pb, 380, GYS, .5, -.35);
  return pb.toCanvas({ rim: .5, rimBack: .15 });
}

// ---------------- FLORESTA: troncos gigantes ----------------
function genTrunks(P: any, w: number, seed: number, near: boolean) {
  const pb = new PB(w, SH), r = rng(seed);
  let x = 20 + r() * 60;
  while (x < w) {
    const tw = near ? 12 + r() * 14 : 26 + r() * 40, m = near ? P.tree : P.bark;
    pb.cap(x, -20, x + (r() - .5) * 10, GYS + 10, tw * .42, tw * .55, m, { tex: .15 });
    if (!near) {
      for (let y = 0; y < GYS; y += 1) {
        for (let xx = Math.floor(x - tw * .6); xx < x + tw * .6; xx++) {
          if (xx < 0 || xx >= w) continue;
          const i = y * w + xx;
          if (pb.mat[i] !== m) continue;
          const s = fbm(xx * .35, y * .025, seed, 3);
          pb.lum[i] += (s - .5) * .9;
          if (fbm(xx * .08, y * .05, seed + 9, 3) > .6 && xx < x) pb.mat[i] = P.moss;
        }
      }
      pb.poly([[x - tw * 1.1, GYS + 10], [x - tw * .4, GYS - 26], [x + tw * .4, GYS - 26], [x + tw * 1.2, GYS + 10]], m, { tex: .2 });
      if (r() < .6) { const by = 80 + r() * 160; pb.cap(x, by, x + (r() < .5 ? -1 : 1) * (40 + r() * 40), by - 30 - r() * 30, 5, 2, m, { tex: .2 }); }
    } else if (r() < .7) {
      // cipós pendurados
      const vx = x + (r() - .5) * 40; let py = 0;
      for (let i = 0; i < 8; i++) { const ny = py + 14 + r() * 10, nx = vx + Math.sin(i) * 3; pb.cap(vx + Math.sin(i - 1) * 3, py, nx, ny, 1.2, 1, P.moss, { lum: -.4 }); if (r() < .5) pb.ell(nx + 2, ny, 3, 1.5, P.leaf, { rot: .6 }); py = ny; }
    }
    x += near ? 120 + r() * 220 : 60 + r() * 120;
  }
  // copa
  for (let i = 0; i < w / 18; i++) { const cx = r() * w, cy = -10 + r() * (near ? 40 : 70); pb.ell(cx, cy, 30 + r() * 40, 14 + r() * 20, P.leaf, { tex: .3 }); }
  if (near) for (let x2 = 0; x2 < w; x2 += 6 + r() * 30) { // samambaias
    for (let k = 0; k < 6; k++) { const a = -1.2 + k * .48; pb.cap(x2, GYS + 6, x2 + Math.sin(a) * 18, GYS + 6 - Math.cos(a) * 14, 1.6, .6, P.grass, { lum: -.5 }); }
  }
  fog(pb, 260, GYS, near ? .4 : 1.0, near ? -.3 : -.1);
  return pb.toCanvas({ rim: near ? .25 : .35, rimBack: .1, ao: .12 });
}

// ---------------- CHÃO ----------------
function genGround(P: any, L: any, theme: string, seed: number) {
  const gw = Math.ceil(L.width * SC), gh = SH - GTOP, yS = GYS - GTOP;
  const pb = new PB(gw, gh), r = rng(seed);
  const inGap = (sx: number) => L.gaps.some((g: number[]) => sx > g[0] * SC && sx < g[1] * SC);
  const cw = 20, ch = 12;
  for (let x = 0; x < gw; x++) {
    if (inGap(x)) { for (let y = yS; y < gh; y++) pb.set(x, y, VOID, -.2 - (y - yS) / 60, 1); continue; }
    for (let y = yS; y < gh; y++) {
      const depth = y - yS;
      if (theme === 'vila' && depth < 46) {
        const row = Math.floor(y / ch), off = row % 2 ? cw / 2 : 0, col = Math.floor((x + off) / cw);
        let d1 = 1e9, d2 = 1e9, sx = 0, sy = 0, cid = 0;
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
          const rr = row + j, oo = rr % 2 ? cw / 2 : 0, cc = Math.floor((x + off) / cw) + i + (rr % 2 !== row % 2 ? 0 : 0);
          const px = cc * cw - oo + cw / 2 + (hash2(cc, rr, 7) - .5) * 7, py = rr * ch + ch / 2 + (hash2(cc, rr, 8) - .5) * 4;
          const d = Math.hypot((x - px) * .9, (y - py) * 1.35);
          if (d < d1) { d2 = d1; d1 = d; sx = px; sy = py; cid = cc * 131 + rr; } else if (d < d2) d2 = d;
        }
        void col;
        if (d2 - d1 < 2.3) {
          if (fbm(x * .05, y * .09, seed + 40, 2) > .74) pb.set(x, y, C.ember, -.3 + hash2(x, y, 1) * .6, 1);
          else pb.set(x, y, P.mortar, -.3, 1);
        } else {
          const v = (y - sy) / ch, u = (x - sx) / cw;
          const l = .55 - v * 1.4 + u * .25 + (hash2(cid, 1, seed) - .5) * .5 + (hash2(x, y, 3) - .5) * .18 - depth * .022;
          pb.set(x, y, P.cob, l, 1);
        }
      } else {
        const m = theme === 'vila' ? P.dirt : (depth < 7 ? P.grass : P.soil);
        let l = .3 - depth * .02 + (fbm(x * .08, y * .08, seed, 3) - .5) * .8;
        if (theme === 'floresta' && depth < 7) l = .5 - depth * .12 + (hash2(x, y, 4) - .5) * .5;
        pb.set(x, y, m, l, 1);
      }
    }
  }
  // pedras e raízes na floresta
  if (theme === 'floresta') {
    for (let x = 0; x < gw; x += 30 + r() * 80) { if (inGap(x)) continue; pb.ell(x, yS + 14 + r() * 40, 6 + r() * 8, 3 + r() * 4, P.stone, { tex: .2 }); }
    for (let x = 0; x < gw; x += 60 + r() * 140) { if (inGap(x) || inGap(x + 40)) continue; const y0 = yS + 2; pb.cap(x, y0 - 2, x + 30 + r() * 30, y0 + 10 + r() * 10, 3, 1.2, C.wood, { lum: -.3, tex: .3 }); }
  }
  // grama/ervas na borda
  for (let x = 0; x < gw; x += 2) {
    if (inGap(x)) continue;
    if (hash2(x, 9, seed) < (theme === 'floresta' ? .75 : .45)) {
      const h = 2 + hash2(x, 10, seed) * (theme === 'floresta' ? 12 : 9), lean = (hash2(x, 11, seed) - .5) * 5;
      pb.line(x, yS + 1, x + lean, yS - h, P.grass, -.2 + hash2(x, 12, seed) * .8);
    }
  }
  // bordas dos buracos quebradas
  for (const g of L.gaps) for (const ex of [g[0] * SC, g[1] * SC]) for (let k = 0; k < 5; k++) pb.ell(ex + (r() - .5) * 8, yS + 4 + k * 8, 3 + r() * 3, 2 + r() * 2, theme === 'vila' ? P.cob : P.stone, { lum: -.4 - k * .1 });
  // plataformas
  for (const p of L.plats) {
    const x0 = p.x * SC, x1 = (p.x + p.w) * SC, y0 = p.y * SC - GTOP;
    if (theme === 'vila') {
      for (const sx of [x0 + 6, x1 - 14]) { pb.poly([[sx, y0 + 8], [sx + 8, y0 + 8], [sx + 9, yS + 4], [sx - 1, yS + 4]], P.cob, { grad: .7, tex: .15 }); for (let yy = y0 + 18; yy < yS; yy += 10) pb.seam(sx, yy, sx + 8, yy, -.45); }
      pb.poly([[x0 - 2, y0], [x1 + 2, y0], [x1, y0 + 9], [x0, y0 + 9]], P.cob, { grad: .5, tex: .15 });
      for (let xx = x0 + 14; xx < x1; xx += 16 + r() * 8) pb.seam(xx, y0 + 1, xx - 1, y0 + 8, -.5);
      pb.seam(x0, y0 + 1, x1, y0 + 1, .5);
    } else {
      for (const sx of [x0 + 5, x1 - 9]) pb.cap(sx, y0 + 8, sx + (r() - .5) * 6, yS + 6, 3, 4, C.wood, { lum: -.3, tex: .3 });
      pb.cap(x0, y0 + 5, x1, y0 + 5, 5.5, 5.5, C.wood, { tex: .35 });
      pb.ell(x0, y0 + 5, 4, 5, C.wood, { lum: .3 });
      for (let xx = x0; xx < x1; xx += 3) if (hash2(xx, 5, seed) < .8) pb.line(xx, y0 + 1, xx + (hash2(xx, 6, seed) - .5) * 2, y0 - 2 - hash2(xx, 7, seed) * 5, P.grass, .2);
      pb.cap(x0 + 2, y0 + .5, x1 - 2, y0 + .5, 1.6, 1.6, P.moss, { lum: .1, tex: .4 });
    }
  }
  // fogueiras: cinzas, lenha, pedras e a espada fincada
  for (const f of L.fires) {
    const fx = f.x * SC;
    for (let k = 0; k < 7; k++) { const a = Math.PI * (k / 6); pb.ell(fx - Math.cos(a) * 16, yS - 1 - Math.sin(a) * 2, 3.5, 2.6, theme === 'vila' ? P.cob : P.stone, { lum: .1 }); }
    pb.ell(fx, yS - 2, 14, 4, rampAsh(), { tex: .4 });
    pb.cap(fx - 12, yS - 3, fx + 10, yS - 8, 2.4, 2, C.wood, { tex: .3 }); pb.cap(fx + 12, yS - 3, fx - 9, yS - 9, 2.4, 2, C.wood, { tex: .3 });
    pb.ell(fx - 3, yS - 7, 4, 2.4, C.ember, { lum: -.2 });
    pb.poly([[fx - 1.6, yS - 6], [fx + 1.6, yS - 6], [fx + 1.4, yS - 46], [fx, yS - 50], [fx - 1.4, yS - 46]], C.blade, { grad: .3 });
    pb.seam(fx - .8, yS - 8, fx - .8, yS - 46, .5);
    pb.cap(fx - 6, yS - 49, fx + 6, yS - 49, 1.3, 1.3, C.gold); pb.cap(fx, yS - 50, fx, yS - 58, 1.1, 1.1, C.leather); pb.ell(fx, yS - 59.5, 1.6, 1.6, C.gold);
  }
  // velas (vila) e cogumelos que brilham (floresta)
  const candles: { x: number; y: number }[] = [], shrooms: { x: number; y: number }[] = [];
  const nearFire = (sx: number) => L.fires.some((f: any) => Math.abs(sx - f.x * SC) < 60);
  if (theme === 'vila') {
    for (let x = 80; x < gw; x += 140 + r() * 260) {
      if (inGap(x) || inGap(x + 20) || nearFire(x)) continue;
      const n = 1 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        const cx = x + k * (6 + r() * 4), h = 7 + r() * 12, cw2 = 2 + r() * 1.2;
        pb.cap(cx, yS - 1, cx, yS - h, cw2, cw2 * .9, C.wax, { tex: .1 });
        pb.ell(cx + 1, yS - 1, cw2 + 2, 1.5, C.wax, { lum: -.2 });
        candles.push({ x: cx / SC, y: (yS - h + GTOP) / SC });
      }
      if (r() < .5) { const sx = x - 16; pb.ell(sx, yS - 4, 4.5, 4, C.bone, { tex: .1 }); pb.dot(sx + 1, yS - 5, VOID, -1, 2, 2); pb.dot(sx + 4, yS - 5, VOID, -1, 1, 2); pb.ell(sx + 2, yS - 1, 3, 1.4, C.bone, { lum: -.2 }); }
    }
  } else {
    for (let x = 40; x < gw; x += 50 + r() * 150) {
      if (inGap(x) || nearFire(x)) continue;
      const n = 1 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        const cx = x + k * 5, h = 4 + r() * 6;
        pb.cap(cx, yS, cx, yS - h, 1, 1, C.bone, { lum: -.2 });
        pb.ell(cx, yS - h, 3.4, 2, C.cyanE, { lum: -.1 });
        shrooms.push({ x: cx / SC, y: (yS - h + GTOP) / SC });
      }
    }
  }
  return { c: pb.toCanvas({ rim: .3, rimBack: .08, ao: .2 }), candles, shrooms };
}
let ash = 0;
function rampAsh() { return ash || (ash = ramp('ash', ['#0c0c0e', '#18181c', '#26262b', '#36363c', '#4a4a50'])); }

function genFore(P: any, w: number, seed: number, theme: string) {
  const h = 120, pb = new PB(w, h), r = rng(seed);
  for (let x = 0; x < w; x += 220 + r() * 420) {
    if (theme === 'floresta') { for (let k = 0; k < 9; k++) { const a = -1.3 + k * .32; pb.cap(x, h + 4, x + Math.sin(a) * (40 + r() * 20), h + 4 - Math.cos(a) * (36 + r() * 30), 4, 1, P.tree, { lum: -.6 }); } }
    else { pb.ell(x, h, 30 + r() * 30, 18 + r() * 14, P.tree, { lum: -.6, tex: .2 }); for (let k = 0; k < 6; k++) pb.line(x - 20 + k * 8, h - 10, x - 24 + k * 9, h - 30 - r() * 20, P.tree, -.4); }
  }
  return pb.toCanvas({ rim: .15 });
}

// ---------------- montagem ----------------
const artCache = new Map<string, Art>();
export function getArt(L: any): Art {
  const key = L.id + ':' + L.width;
  let a = artCache.get(key);
  if (a) return a;
  const P = T[L.theme] || T.vila, seed = L.theme === 'floresta' ? 71 : 23;
  const lw = (p: number) => Math.ceil(((L.width - W) * p + W) * SC) + 4;
  const ground = genGround(P, L, L.theme, seed);
  const layers: Layer[] = L.theme === 'floresta'
    ? [{ c: genFar(P, lw(.08), seed), p: .08, y: 0 }, { c: genTrunks(P, lw(.3), seed + 1, false), p: .3, y: 0 }, { c: genTrunks(P, lw(.62), seed + 2, true), p: .62, y: 0 }]
    : [{ c: genFar(P, lw(.08), seed), p: .08, y: 0 }, { c: genRuins(P, lw(.3), seed + 1), p: .3, y: 0 }, { c: genNearVila(P, lw(.62), seed + 2), p: .62, y: 0 }];
  a = { theme: L.theme, sky: genSky(P, seed), layers, ground: ground.c, candles: ground.candles, shrooms: ground.shrooms, fore: { c: genFore(P, lw(1.3), seed + 5, L.theme), p: 1.3, y: SH - 120 } };
  artCache.set(key, a);
  return a;
}

function drawLayer(l: Layer, cam: number, ox: number, oy: number) {
  const off = Math.round(cam * SC * l.p - ox), sx = Math.max(0, off), dx = sx - off;
  const w = Math.min(SW - dx, l.c.width - sx);
  if (w > 0) ctx.drawImage(l.c, sx, 0, w, l.c.height, dx, l.y + oy, w, l.c.height);
}

/** Céu, camadas de fundo e chão. Desenhado em pixels de tela. */
export function drawArtBack(a: Art, cam: number, ox = 0, oy = 0) {
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(a.sky, 0, 0);
  for (const l of a.layers) drawLayer(l, cam, ox, oy);
  if (a.theme === 'floresta') { // raios de luz
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(120,180,140,.05)';
    for (let i = 0; i < 5; i++) { const x = ((i * 300 - cam * SC * .4) % 1500 + 1500) % 1500 - 300; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 50, 0); ctx.lineTo(x + 230, GYS); ctx.lineTo(x + 140, GYS); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over';
  }
  drawLayer({ c: a.ground, p: 1, y: GTOP }, cam, ox, oy);
  ctx.restore();
}

/** Primeiro plano (na frente dos personagens), névoa e partículas de ambiente. */
export function drawArtFront(a: Art, cam: number, ox = 0, oy = 0) {
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
  // névoa rasteira
  for (let i = 0; i < 6; i++) {
    const fx = ((i * 263 + G.time * (10 + i * 5) - cam * SC * .9) % (SW + 400) + SW + 400) % (SW + 400) - 200;
    ctx.fillStyle = a.theme === 'floresta' ? 'rgba(140,200,170,.045)' : 'rgba(150,170,210,.045)';
    ctx.beginPath(); ctx.ellipse(fx, GYS - 14 + (i % 3) * 18, 150, 18, 0, 0, 7); ctx.fill();
  }
  // brasas no ar (vila) / vagalumes (floresta)
  for (let i = 0; i < 26; i++) {
    const seed = i * 97.3, sp = .5 + (i % 5) * .2;
    let x = ((hash2(i, 1, 9) * 2400 - cam * SC * (.6 + (i % 3) * .2) + Math.sin(G.time * sp + seed) * 20) % 1400 + 1400) % 1400 - 200;
    let y = a.theme === 'floresta' ? 140 + hash2(i, 2, 9) * 300 + Math.cos(G.time * sp * 1.3 + seed) * 14 : SH - ((G.time * (18 + (i % 7) * 6) + hash2(i, 3, 9) * SH) % SH);
    const blink = .5 + .5 * Math.sin(G.time * 3 + seed);
    ctx.globalAlpha = a.theme === 'floresta' ? blink : .5 + .5 * blink;
    ctx.fillStyle = a.theme === 'floresta' ? '#d8ff8a' : (i % 3 ? '#ff9a3a' : '#ffd27a');
    ctx.fillRect(Math.round(x), Math.round(y), i % 4 ? 1 : 2, i % 4 ? 1 : 2);
  }
  ctx.globalAlpha = 1;
  drawLayer(a.fore, cam, ox, oy);
  ctx.restore();
}

/** Chamas e brilhos animados (fogueiras, velas, cogumelos). Coordenadas de mundo no transform atual. */
export function drawLights(a: Art, fires: any[], lit: boolean[]) {
  const m = ctx.getTransform();
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  const S = (x: number, y: number) => [Math.round(m.a * x + m.e), Math.round(m.d * y + m.f)];
  ctx.globalCompositeOperation = 'lighter';
  fires.forEach((f, i) => {
    if (!lit[i]) return;
    const [x, y] = S(f.x, GY);
    const gl = ctx.createRadialGradient(x, y - 16, 4, x, y - 16, 150);
    gl.addColorStop(0, 'rgba(255,130,40,.42)'); gl.addColorStop(.4, 'rgba(255,90,20,.14)'); gl.addColorStop(1, 'rgba(255,80,20,0)');
    ctx.fillStyle = gl; ctx.fillRect(x - 150, y - 166, 300, 200);
  });
  for (const c of a.candles) {
    const [x, y] = S(c.x, c.y), fl = .8 + .2 * Math.sin(G.time * 13 + c.x);
    const gl = ctx.createRadialGradient(x, y - 3, 1, x, y - 3, 26 * fl);
    gl.addColorStop(0, 'rgba(255,160,60,.35)'); gl.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = gl; ctx.fillRect(x - 28, y - 30, 56, 56);
  }
  for (const s of a.shrooms) {
    const [x, y] = S(s.x, s.y), fl = .7 + .3 * Math.sin(G.time * 2 + s.x);
    const gl = ctx.createRadialGradient(x, y, 1, x, y, 16 * fl);
    gl.addColorStop(0, 'rgba(80,230,210,.3)'); gl.addColorStop(1, 'rgba(60,200,190,0)');
    ctx.fillStyle = gl; ctx.fillRect(x - 18, y - 18, 36, 36);
  }
  ctx.globalCompositeOperation = 'source-over';
  // chamas em pixel
  const FL = ['#7a2208', '#bf4410', '#ec7420', '#ffab46', '#ffe4a0'];
  fires.forEach((f, i) => {
    const [x, y] = S(f.x, GY);
    if (!lit[i]) { if (Math.random() < .1) { ctx.fillStyle = '#3a3a40'; ctx.fillRect(x + Math.round((Math.random() - .5) * 6), y - 12 - Math.round(Math.random() * 20), 1, 1); } return; }
    for (let k = -7; k <= 7; k++) {
      const h = Math.max(2, 22 - Math.abs(k) * 2.4 + Math.sin(G.time * 11 + k * 1.9) * 5 + Math.sin(G.time * 7.3 + k) * 3);
      for (let j = 0; j < h; j++) {
        const t = j / h, ci = Math.min(4, Math.floor((1 - t) * 3.2 + (Math.abs(k) < 3 ? 1.4 : 0) - (j > h - 3 ? 1 : 0)));
        if (t > .7 && (j + k + Math.floor(G.time * 20)) % 3 === 0) continue;
        ctx.fillStyle = FL[Math.max(0, ci)]; ctx.fillRect(x + k * 2 + Math.round(Math.sin(G.time * 9 + j * .5) * t * 2), y - 6 - j * 2, 2, 2);
      }
    }
  });
  for (const c of a.candles) {
    const [x, y] = S(c.x, c.y), fl = Math.sin(G.time * 13 + c.x) > 0 ? 1 : 0;
    ctx.fillStyle = '#ffab46'; ctx.fillRect(x - 1, y - 4 - fl, 2, 3 + fl); ctx.fillStyle = '#fff2c0'; ctx.fillRect(x, y - 2, 1, 2);
  }
  ctx.restore();
}
