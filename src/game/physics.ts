// Gravidade, chão com buracos e plataformas atravessáveis por baixo.
import { GY } from '../core/canvas';
import { clamp } from '../core/math';
import { G } from './state';

export const GRAV = 900;

export function gapAt(x: number) { for (const g of G.L.gaps) if (x > g[0] && x < g[1]) return g; return null; }
export const solidAt = (x: number) => !gapAt(x);

export function physics(e: any, dt: number, bounds?: number[]) {
  e.vy += GRAV * dt; if (e.vy > 520) e.vy = 520;
  const oy = e.y, ox = e.x;
  e.x += e.vx * dt; e.y += e.vy * dt;
  e.onGround = false; e.plat = null;
  // dentro de um buraco: as paredes do buraco seguram
  if (oy > GY + .5 && e.y > GY + .5 && solidAt(e.x)) {
    let g = gapAt(ox);
    if (!g) { let best = 1e9; for (const gg of G.L.gaps) { const d = Math.min(Math.abs(gg[0] - e.x), Math.abs(gg[1] - e.x)); if (d < best) { best = d; g = gg; } } }
    if (g) e.x = clamp(e.x, g[0] + 1, g[1] - 1);
  }
  if (e.y >= GY && oy <= GY + .5 && solidAt(e.x)) { e.y = GY; e.vy = 0; e.onGround = true; }
  else if (e.vy >= 0 && !(e.dropT > 0)) {
    for (const p of G.L.plats) {
      if (e.x > p.x - 2 && e.x < p.x + p.w + 2 && oy <= p.y + .5 && e.y >= p.y) { e.y = p.y; e.vy = 0; e.onGround = true; e.plat = p; break; }
    }
  }
  const lo = bounds ? bounds[0] : 12, hi = bounds ? bounds[1] : G.L.width - 12;
  if (e.x < lo) e.x = lo; if (e.x > hi) e.x = hi;
}

/** Inimigos não andam para dentro de buracos nem caem da plataforma. */
export function edgeAhead(e: any, dir: number) {
  if (!e.onGround || !dir) return false;
  const nx = e.x + dir * 8;
  if (e.plat) return nx < e.plat.x || nx > e.plat.x + e.plat.w;
  return !solidAt(nx);
}

export const ov = (a: any, b: any) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export const ebox = (e: any) => ({ x: e.x - e.w / 2, y: e.y - e.h, w: e.w, h: e.h });
