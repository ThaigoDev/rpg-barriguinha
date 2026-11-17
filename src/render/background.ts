// Cenários com parallax. Cada tema define céu, camadas de fundo, chão e plataformas.
import { ctx, R, W, H, GY } from '../core/canvas';
import { rng } from '../core/math';
import { G, part } from '../game/state';

const STARS = (() => { const r = rng(7), a: any[] = []; for (let i = 0; i < 70; i++) a.push({ x: r() * W, y: r() * 130, s: r() < .15 ? 2 : 1, p: r() * 6 }); return a; })();
const HOUSES = (() => { const r = rng(42), a: any[] = []; let x = -40; while (x < 2400) { const w = 30 + r() * 50; a.push({ x, w, h: 30 + r() * 45, broken: r() < .5, win: [r() < .4, r() < .3] }); x += w + 10 + r() * 40; } return a; })();
const TREES = (() => { const r = rng(99), a: any[] = []; let x = 0; while (x < 4000) { a.push({ x, h: 40 + r() * 50 }); x += 60 + r() * 140; } return a; })();
const FTREES = (() => { const r = rng(17), a: any[] = []; let x = -20; while (x < 4000) { a.push({ x, w: 10 + r() * 14, c: r() }); x += 30 + r() * 60; } return a; })();
const FIREFLIES = (() => { const r = rng(3), a: any[] = []; for (let i = 0; i < 40; i++) a.push({ x: r() * 900, y: 60 + r() * 160, p: r() * 10, sp: .5 + r() }); return a; })();

const grads: Record<string, CanvasGradient> = {};
function sky(theme: string) {
  if (!grads[theme]) {
    const g = ctx.createLinearGradient(0, 0, 0, GY);
    if (theme === 'floresta') { g.addColorStop(0, '#040807'); g.addColorStop(.6, '#0c1d19'); g.addColorStop(1, '#1d3a2e'); }
    else { g.addColorStop(0, '#08070f'); g.addColorStop(.6, '#221a3a'); g.addColorStop(1, '#4a2d3c'); }
    grads[theme] = g;
  }
  return grads[theme];
}
function mount(x: number) { return 42 + 18 * Math.sin(x * .011) + 10 * Math.sin(x * .037 + 1) + 5 * Math.sin(x * .09 + 2); }

function moon(cx: number, col: string, glow: string) {
  const mx = Math.round(370 - cx * .02);
  const g = ctx.createRadialGradient(mx, 52, 4, mx, 52, 60); g.addColorStop(0, glow); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(mx - 60, 0, 120, 120);
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(mx, 52, 14, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(mx - 6, 46, 4, 3); ctx.fillRect(mx + 3, 55, 3, 3);
}

function bgVila(cx: number) {
  for (const s of STARS) { ctx.globalAlpha = .4 + .4 * Math.sin(G.time * 1.5 + s.p); R('#d8d0f0', Math.round(s.x), Math.round(s.y), s.s, s.s); }
  ctx.globalAlpha = 1;
  moon(cx, '#efe2cc', 'rgba(240,220,200,.35)');
  for (let sx = 0; sx < W; sx += 3) { const h = mount(sx + cx * .15); R('#1d1830', sx, GY - 50 - h, 3, h + 60); }
  for (let sx = 0; sx < W; sx += 3) { const h = mount((sx + cx * .25) * 1.7 + 500) * .6; R('#171327', sx, GY - 28 - h, 3, h + 40); }
  const o = cx * .4;
  for (const hs of HOUSES) {
    const x = Math.round(hs.x - o); if (x > W || x + hs.w < 0) continue; const y = GY - hs.h;
    R('#120f1c', x, y, hs.w, hs.h);
    const rh = Math.round(hs.w * .45);
    for (let i = 0; i < rh; i++) { const ww = hs.w - i * 2; if (ww <= 0) break; if (hs.broken && i > rh * .5 && i % 3 === 0) continue; R('#120f1c', x + i, y - i, ww, 1); }
    if (hs.win[0]) { const a = .5 + .5 * Math.sin(G.time * 3 + hs.x); R(`rgba(210,130,50,${.35 + .25 * a})`, x + 6, y + 10, 4, 5); }
    if (hs.win[1]) R('rgba(210,130,50,.3)', x + hs.w - 12, y + 16, 4, 5);
  }
  const o2 = cx * .7;
  for (const t of TREES) {
    const x = Math.round(t.x - o2); if (x < -40 || x > W + 40) continue;
    R('#0c0a12', x, GY - t.h, 4, t.h); R('#0c0a12', x - 10, GY - t.h * .7, 10, 2); R('#0c0a12', x - 12, GY - t.h * .7 - 6, 2, 6);
    R('#0c0a12', x + 4, GY - t.h * .55, 12, 2); R('#0c0a12', x + 15, GY - t.h * .55 - 8, 2, 8); R('#0c0a12', x - 4, GY - t.h, 12, 2);
  }
}

function bgFloresta(cx: number) {
  moon(cx, '#cfe0c8', 'rgba(190,230,200,.25)');
  // árvores distantes (copas cônicas)
  for (let sx = -20; sx < W + 20; sx += 2) {
    const wx = sx + cx * .15, k = Math.floor(wx / 26), lx = wx - k * 26, hk = 50 + ((k * 37) % 40);
    const cone = Math.max(0, hk - Math.abs(lx - 13) * 4);
    R('#0f2420', sx, GY - 40 - cone, 2, cone + 60);
  }
  // raios de luz
  ctx.fillStyle = 'rgba(190,240,210,.045)';
  for (let i = 0; i < 4; i++) {
    const x = ((i * 170 - cx * .3) % (W + 200) + W + 200) % (W + 200) - 100;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 30, 0); ctx.lineTo(x + 110, GY); ctx.lineTo(x + 60, GY); ctx.fill();
  }
  // troncos do meio
  const o = cx * .4;
  for (const t of FTREES) {
    const x = Math.round(t.x - o); if (x < -40 || x > W + 40) continue;
    R('#0b1915', x, 0, Math.round(t.w), GY);
    R('#0e201b', x + 2, 0, 2, GY);
    if (t.c < .5) { R('#0b1915', x - 12, 80 + t.c * 60, 14, 3); R('#0b1915', x + t.w, 110 + t.c * 40, 16, 3); }
  }
  // vagalumes
  for (const f of FIREFLIES) {
    const x = ((f.x - cx * .5 + Math.sin(G.time * f.sp + f.p) * 12) % 900 + 900) % 900 - 200;
    if (x < 0 || x > W) continue;
    const y = f.y + Math.cos(G.time * f.sp * 1.3 + f.p) * 8, a = .5 + .5 * Math.sin(G.time * 3 + f.p * 3);
    ctx.globalAlpha = a; R('#d8ff8a', Math.round(x), Math.round(y), 1, 1); ctx.globalAlpha = a * .3; R('#d8ff8a', Math.round(x) - 1, Math.round(y) - 1, 3, 3);
  }
  ctx.globalAlpha = 1;
  // troncos próximos
  const o2 = cx * .7;
  for (const t of TREES) {
    const x = Math.round(t.x * 1.3 - o2); if (x < -40 || x > W + 40) continue;
    R('#06100d', x, 0, 9, GY); R('#06100d', x - 14, 60 + t.h * .4, 16, 3); R('#06100d', x + 9, 40 + t.h * .6, 18, 3);
  }
  // copa no topo
  for (let sx = 0; sx < W; sx += 2) {
    const wx = sx + cx * .5; const h = 14 + 8 * Math.sin(wx * .05) + 5 * Math.sin(wx * .13 + 2) + 3 * Math.sin(wx * .31);
    R('#040a08', sx, 0, 2, Math.round(h));
  }
}

export function drawBG(theme: string, cx: number) {
  ctx.fillStyle = sky(theme); ctx.fillRect(0, 0, W, H);
  if (theme === 'floresta') bgFloresta(cx); else bgVila(cx);
}

const GROUND: Record<string, any> = {
  vila: { base: '#17120e', top: ['#3d342a', '#362e25'], top2: '#2a231b', hl: '#4a4030', stone: '#221c16', grass: '#3a3f28' },
  floresta: { base: '#0c110c', top: ['#2c3e22', '#26361d'], top2: '#1a2414', hl: '#3e5a2c', stone: '#141c10', grass: '#4a6a30' },
};

/** Chão (com buracos) e plataformas, em coordenadas do mundo. */
export function drawGround(L: any, cam: number) {
  const g = GROUND[L.theme] || GROUND.vila, x0 = Math.floor(cam / 16) * 16 - 16;
  R(g.base, x0, GY, W + 48, H - GY);
  for (let x = x0; x < cam + W + 16; x += 16) {
    const r = rng(x * 13 + 7);
    R(r() < .5 ? g.top[0] : g.top[1], x, GY, 16, 3); R(g.top2, x, GY + 3, 16, 2); R(g.hl, x + 2, GY, 6, 1);
    for (let i = 0; i < 3; i++) R(g.stone, x + Math.floor(r() * 14), GY + 8 + Math.floor(r() * 28), 3, 2);
    if (r() < .4) { R(g.grass, x + 5, GY - 2, 1, 2); R(g.grass, x + 7, GY - 3, 1, 3); R(g.grass, x + 9, GY - 2, 1, 2); }
    if (L.theme === 'vila' && r() < .08) { R('#6a6658', x + 4, GY - 12, 6, 12); R('#5a5648', x + 3, GY - 13, 8, 2); }
    if (L.theme === 'floresta' && r() < .12) { // cogumelos que brilham
      const a = .6 + .4 * Math.sin(G.time * 2 + x);
      ctx.globalAlpha = a; R('#5ae0d0', x + 10, GY - 4, 4, 2); ctx.globalAlpha = 1; R('#c8e8e0', x + 11, GY - 2, 2, 2);
    }
    if (L.theme === 'floresta' && r() < .2) { R('#1a120a', x + 2, GY + 2, 10, 2); R('#1a120a', x + 10, GY + 4, 2, 6); } // raízes
  }
  // buracos
  for (const [a, b] of L.gaps) {
    if (b < cam - 10 || a > cam + W + 10) continue;
    R('#000', a, GY, b - a, H - GY);
    const grd = ctx.createLinearGradient(0, GY, 0, H); grd.addColorStop(0, 'rgba(30,20,20,.8)'); grd.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = grd; ctx.fillRect(a, GY, b - a, H - GY);
    R(g.top2, a - 1, GY, 1, 12); R(g.top2, b, GY, 1, 12);
  }
  for (const p of L.plats) {
    if (p.x > cam + W || p.x + p.w < cam) continue;
    if (L.theme === 'floresta') {
      R('#4a3424', p.x, p.y, p.w, 5); R('#2e2016', p.x, p.y + 5, p.w, 2); R('#3a6a2a', p.x, p.y - 1, p.w, 2);
      for (let i = 4; i < p.w; i += 9) R('#3a2818', p.x + i, p.y + 2, 4, 1);
      R('#2e2016', p.x + 3, p.y + 7, 2, 6); R('#2e2016', p.x + p.w - 6, p.y + 7, 2, 8);
    } else {
      R('#4a3f30', p.x, p.y, p.w, 3); R('#2f281e', p.x, p.y + 3, p.w, 3); R('#5a4c38', p.x, p.y, p.w, 1);
      R('#241e16', p.x + 4, p.y + 6, 3, GY - p.y - 6); R('#241e16', p.x + p.w - 7, p.y + 6, 3, GY - p.y - 6);
    }
  }
}

export function drawFire(x: number, lit: boolean) {
  R('#2a2420', x - 9, GY - 3, 18, 3); R('#4a3420', x - 8, GY - 5, 16, 2); R('#3a2818', x - 6, GY - 7, 4, 2); R('#3a2818', x + 2, GY - 7, 4, 2);
  if (lit) {
    const gl = ctx.createRadialGradient(x, GY - 10, 2, x, GY - 10, 70);
    gl.addColorStop(0, 'rgba(255,150,60,.35)'); gl.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = gl; ctx.fillRect(x - 70, GY - 80, 140, 90);
    for (let i = -3; i <= 3; i++) { const h = 6 + Math.abs(Math.sin(G.time * 9 + i * 1.7)) * 9 - Math.abs(i) * 1.5; R(i % 2 ? '#ff7020' : '#ffa030', x + i * 2 - 1, GY - 6 - h, 2, h); }
    R('#ffe080', x - 1, GY - 12, 2, 5);
  } else if (Math.random() < .05) part({ x, y: GY - 8, vx: 0, vy: -12, life: 1.5, c: '#555' });
  R('#8a8f98', x - 1, GY - 26, 2, 18); R('#6b4a2a', x - 3, GY - 28, 6, 2); R('#6b4a2a', x - 1, GY - 31, 2, 3);
}
