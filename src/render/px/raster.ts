// Rasterizador de pixel art. Em vez de pintar cores direto, cada primitiva grava um MATERIAL e uma
// LUMINOSIDADE por pixel (calculada pela forma 3D aproximada: esfera, cilindro, plano). No final,
// toImage() converte para cores da rampa do material com dithering ordenado, contorno escuro,
// oclusão nas bordas entre peças e luz de recorte (rim light), sem anti-aliasing.
import { RAMP_COLS, RAMP_EMIS, C } from './palette';
import { hash2 } from './noise';

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => v / 16 - .47);
// direção da luz principal (frente, de cima)
const LX = .42, LY = -.6, LZ = .68;

export type PO = { lum?: number; tex?: number; flat?: boolean; rot?: number; grad?: number };

export class PB {
  w: number; h: number; ox: number; oy: number;
  mat: Uint16Array; lum: Float32Array; ord: Int32Array; n = 1;
  constructor(w: number, h: number, ox = 0, oy = 0) {
    this.w = w; this.h = h; this.ox = ox; this.oy = oy;
    this.mat = new Uint16Array(w * h); this.lum = new Float32Array(w * h); this.ord = new Int32Array(w * h);
  }
  set(x: number, y: number, m: number, l: number, ord: number) {
    const i = y * this.w + x; this.mat[i] = m; this.lum[i] = l; this.ord[i] = ord;
  }
  private tex(x: number, y: number, m: number, t?: number) { return t ? (hash2(x, y, m) - .5) * t : 0; }

  ell(cx: number, cy: number, rx: number, ry: number, m: number, o: PO = {}) {
    if (rx <= 0 || ry <= 0) return;
    const rot = o.rot || 0, c = Math.cos(rot), s = Math.sin(rot), R = Math.max(rx, ry) + 1;
    const x0 = Math.max(0, Math.floor(cx + this.ox - R)), x1 = Math.min(this.w - 1, Math.ceil(cx + this.ox + R));
    const y0 = Math.max(0, Math.floor(cy + this.oy - R)), y1 = Math.min(this.h - 1, Math.ceil(cy + this.oy + R));
    const ord = this.n++, bias = o.lum || 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + .5 - this.ox - cx, py = y + .5 - this.oy - cy;
      const u = px * c + py * s, v = -px * s + py * c, nu = u / rx, nv = v / ry, d = nu * nu + nv * nv;
      if (d > 1) continue;
      let l = 0;
      if (!o.flat) { const nz = Math.sqrt(1 - d), nx = nu * c - nv * s, ny = nu * s + nv * c; l = (nx * LX + ny * LY + nz * LZ) * 1.3 - .3; }
      this.set(x, y, m, l + bias + this.tex(x, y, m, o.tex), ord);
    }
  }

  /** Cápsula afunilada (membros, cabos, galhos). Sombreamento cilíndrico. */
  cap(x1: number, y1: number, x2: number, y2: number, r1: number, r2: number, m: number, o: PO = {}) {
    const R = Math.max(r1, r2) + 1;
    const X0 = Math.max(0, Math.floor(Math.min(x1, x2) + this.ox - R)), X1 = Math.min(this.w - 1, Math.ceil(Math.max(x1, x2) + this.ox + R));
    const Y0 = Math.max(0, Math.floor(Math.min(y1, y2) + this.oy - R)), Y1 = Math.min(this.h - 1, Math.ceil(Math.max(y1, y2) + this.oy + R));
    const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy || 1e-6, ord = this.n++, bias = o.lum || 0;
    for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
      const px = x + .5 - this.ox, py = y + .5 - this.oy;
      let t = ((px - x1) * dx + (py - y1) * dy) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = x1 + dx * t, qy = y1 + dy * t, r = r1 + (r2 - r1) * t, ex = px - qx, ey = py - qy, d2 = ex * ex + ey * ey;
      if (d2 > r * r) continue;
      let l = 0;
      if (!o.flat) { const nx = ex / r, ny = ey / r, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)); l = (nx * LX + ny * LY + nz * LZ) * 1.3 - .3; }
      this.set(x, y, m, l + bias + this.tex(x, y, m, o.tex), ord);
    }
  }

  /** Polígono (scanline). Sombreamento em gradiente pela direção da luz. */
  poly(pts: number[][], m: number, o: PO = {}) {
    let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9, cx = 0, cy = 0;
    for (const p of pts) { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]); cx += p[0]; cy += p[1]; }
    cx /= pts.length; cy /= pts.length;
    const hw = Math.max(1, (maxx - minx) / 2), hh = Math.max(1, (maxy - miny) / 2);
    const Y0 = Math.max(0, Math.floor(miny + this.oy)), Y1 = Math.min(this.h - 1, Math.ceil(maxy + this.oy));
    const ord = this.n++, bias = o.lum || 0, gr = o.grad ?? .6, n = pts.length, xs: number[] = [];
    for (let y = Y0; y <= Y1; y++) {
      const yc = y + .5 - this.oy; xs.length = 0;
      for (let i = 0; i < n; i++) {
        const a = pts[i], b = pts[(i + 1) % n];
        if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(0, Math.ceil(xs[k] + this.ox - .5)), xb = Math.min(this.w - 1, Math.floor(xs[k + 1] + this.ox - .5));
        for (let x = xa; x <= xb; x++) {
          let l = 0;
          if (!o.flat) { const nx = (x + .5 - this.ox - cx) / hw * gr, ny = (yc - cy) / hh * gr; l = (nx * LX + ny * LY + .75 * LZ) * 1.3 - .3; }
          this.set(x, y, m, l + bias + this.tex(x, y, m, o.tex), ord);
        }
      }
    }
  }

  /** Linha fina de pixels com material próprio. */
  line(x1: number, y1: number, x2: number, y2: number, m: number, lum = 0) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)))), ord = this.n++;
    for (let i = 0; i <= steps; i++) {
      const x = Math.floor(x1 + (x2 - x1) * i / steps + this.ox), y = Math.floor(y1 + (y2 - y1) * i / steps + this.oy);
      if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.set(x, y, m, lum, ord);
    }
  }

  /** Altera a luz de pixels já pintados ao longo de uma linha (vincos, placas de armadura, brilho de fio). */
  seam(x1: number, y1: number, x2: number, y2: number, d: number) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1))));
    for (let i = 0; i <= steps; i++) {
      const x = Math.floor(x1 + (x2 - x1) * i / steps + this.ox), y = Math.floor(y1 + (y2 - y1) * i / steps + this.oy);
      if (x >= 0 && y >= 0 && x < this.w && y < this.h) { const j = y * this.w + x; if (this.mat[j]) this.lum[j] += d; }
    }
  }

  /** Escurece/clareia uma área elíptica já pintada (sombra no rosto, brilho). */
  shadeEll(cx: number, cy: number, rx: number, ry: number, d: number) {
    const x0 = Math.max(0, Math.floor(cx + this.ox - rx)), x1 = Math.min(this.w - 1, Math.ceil(cx + this.ox + rx));
    const y0 = Math.max(0, Math.floor(cy + this.oy - ry)), y1 = Math.min(this.h - 1, Math.ceil(cy + this.oy + ry));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const u = (x + .5 - this.ox - cx) / rx, v = (y + .5 - this.oy - cy) / ry;
      if (u * u + v * v <= 1) { const j = y * this.w + x; if (this.mat[j]) this.lum[j] += d; }
    }
  }

  dot(x: number, y: number, m: number, l = 0, w = 1, h = 1) {
    const ord = this.n++;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const X = Math.floor(x + this.ox) + i, Y = Math.floor(y + this.oy) + j;
      if (X >= 0 && Y >= 0 && X < this.w && Y < this.h) this.set(X, Y, m, l, ord);
    }
  }

  toImage(o: { outline?: boolean; rim?: number; rimBack?: number; ao?: number; flash?: boolean; dither?: number } = {}): ImageData {
    const { w, h, mat, lum, ord } = this;
    const img = new ImageData(w, h), out = new Uint32Array(img.data.buffer);
    const rim = o.rim ?? 0, rimB = o.rimBack ?? rim * .55, ao = o.ao ?? 0, dith = o.dither ?? 1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, m = mat[i];
      if (!m) {
        if (o.outline && ((x > 0 && mat[i - 1]) || (x < w - 1 && mat[i + 1]) || (y > 0 && mat[i - w]) || (y < h - 1 && mat[i + w]))) out[i] = C.outline;
        continue;
      }
      if (o.flash) { out[i] = (x + y) % 5 ? C.white : 0xffd8e4f0; continue; }
      const cols = RAMP_COLS[m], n = cols.length;
      let v = lum[i] * .5 + .5;
      if (ao) {
        const oi = ord[i];
        if ((x > 0 && mat[i - 1] && ord[i - 1] > oi) || (x < w - 1 && mat[i + 1] && ord[i + 1] > oi) || (y > 0 && mat[i - w] && ord[i - w] > oi) || (y < h - 1 && mat[i + w] && ord[i + w] > oi)) v -= ao;
      }
      if (rim) {
        if (y === 0 || !mat[i - w]) v += rim;
        if (x === 0 || !mat[i - 1]) v += rimB;
      }
      if (RAMP_EMIS[m]) v = .45 + v * .55;
      let k = Math.floor(v * n + BAYER[((y & 3) << 2) | (x & 3)] * dith);
      k = k < 0 ? 0 : k >= n ? n - 1 : k;
      out[i] = cols[k];
    }
    return img;
  }

  toCanvas(o: Parameters<PB['toImage']>[0] = {}) {
    const c = document.createElement('canvas'); c.width = this.w; c.height = this.h;
    c.getContext('2d')!.putImageData(this.toImage(o), 0, 0);
    return c;
  }
}
