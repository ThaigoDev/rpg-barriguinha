// Física do mundo: gravidade, relevo (chão em degraus de alturas diferentes), buracos, plataformas,
// portões fechados e elevadores.
//
// Cada fase descreve o chão como trechos [x0, x1, y] (o topo do chão entre x0 e x1 está na altura y).
// Onde não há trecho é buraco. Fases antigas sem "ground" ganham chão plano na altura GY menos os buracos.
import { GY } from '../core/canvas';
import { G } from './state';

export const GRAV = 900;
const STEP = 6.5; // degrau que dá pra subir andando

/** Prepara os dados derivados de uma fase (uma vez). */
export function prepLevel(L: any) {
  if (L._prep) return L;
  L._prep = true;
  L.height = L.height || 270;
  if (!L.ground) {
    const gaps = (L.gaps || []).slice().sort((a: number[], b: number[]) => a[0] - b[0]);
    const seg: number[][] = []; let x = -100;
    for (const g of gaps) { seg.push([x, g[0], GY]); x = g[1]; }
    seg.push([x, L.width + 100, GY]);
    L.ground = seg;
  }
  L._ground = L.ground.map((s: number[]) => [s[0], s[1], s[2]]).sort((a: number[], b: number[]) => a[0] - b[0]);
  L.npcs = L.npcs || (L.npc ? [L.npc] : []);
  for (const k of ['links', 'doors', 'gates', 'lifts', 'water', 'plats', 'gaps', 'msgs', 'items', 'fires', 'spawns']) L[k] = L[k] || [];
  const gyL = (x: number) => groundAtL(L, x) ?? GY;
  for (const o of [...L.fires, ...L.msgs, ...L.npcs, ...L.doors]) if (o.y == null) o.y = gyL(o.x);
  if (L.exit && L.exit.y == null) L.exit.y = gyL(L.exit.x);
  for (const g of L.gates) { if (g.y == null) g.y = gyL(g.x); if (g.top == null) g.top = g.y - 40; }
  for (const it of L.items) if (it.y == null) it.y = gyL(it.x);
  return L;
}

export function groundAtL(L: any, x: number): number | null {
  for (const s of L._ground) if (x >= s[0] && x < s[1]) return s[2];
  return null;
}
export const groundAt = (x: number) => groundAtL(G.L, x);
/** Altura do chão em x (ou o fundo da fase, se for buraco). */
export const gy = (x: number) => groundAt(x) ?? (G.L.height + 60);
export const solidAt = (x: number) => groundAt(x) != null;

function gateBlocks(ox: number, nx: number, y: number) {
  for (const g of G.L.gates) {
    if (G.S?.opened?.[G.L.id + ':' + g.id]) continue;
    if ((ox < g.x) !== (nx < g.x) && y > g.top) return true;
  }
  return false;
}

export function physics(e: any, dt: number, bounds?: number[]) {
  const wasG = e.onGround;
  if (!e.fly) { e.vy += GRAV * dt; if (e.vy > 520) e.vy = 520; }
  const oy = e.y, ox = e.x;
  let ref = oy; // altura de referência para pousar (muda se subimos um degrau neste quadro)
  // horizontal: paredes do relevo e portões
  e.x += e.vx * dt;
  const g = groundAt(e.x);
  if (g != null && e.y > g + .5) {
    if (wasG && e.y - g <= STEP) { e.y = g; ref = g; } // sobe o degrau sem "piscar" no ar
    // ajuda na beirada: no pulo, se os pés passaram raspando abaixo da quina, sobe nela em vez de bater
    else if (e.assist && !wasG && e.vy > -160 && e.y - g <= 9) { e.y = g; ref = g; e.vy = Math.max(0, e.vy); }
    else e.x = ox;
  }
  if (gateBlocks(ox, e.x, e.y)) e.x = ox;
  { const gc = groundAt(e.x); if (gc != null && e.y > gc + .5 && oy > gc + .5) { e.y = gc; e.vy = 0; ref = gc; } } // preso dentro do terreno (teleporte): sobe
  // vertical
  e.y += e.vy * dt; e.onGround = false; e.plat = null;
  const g2 = groundAt(e.x);
  if (g2 != null && e.y >= g2 && ref <= g2 + .5) { e.y = g2; e.vy = 0; e.onGround = true; }
  else if (g2 != null && wasG && e.vy >= 0 && g2 > e.y && g2 - e.y <= STEP && !(e.dropT > 0) && !(e.plat0)) { e.y = g2; e.vy = 0; e.onGround = true; } // desce degrau sem pular
  if (!e.onGround && e.vy >= 0 && !(e.dropT > 0)) {
    for (const p of G.L.plats.concat(G.lifts || [])) {
      if (e.x > p.x - 2 && e.x < p.x + p.w + 2 && ref <= p.y + .5 && e.y >= p.y) { e.y = p.y; e.vy = 0; e.onGround = true; e.plat = p; break; }
    }
  }
  // continua em cima da plataforma ao andar devagar sobre ela (sem tremer entre "no ar" e "no chão")
  if (!e.onGround && wasG && e.vy >= 0 && !(e.dropT > 0)) {
    for (const p of G.L.plats.concat(G.lifts || [])) {
      if (e.x > p.x - 2 && e.x < p.x + p.w + 2 && Math.abs(oy - p.y) < .6 && e.y - p.y <= STEP) { e.y = p.y; e.vy = 0; e.onGround = true; e.plat = p; break; }
    }
  }
  const lo = bounds ? bounds[0] : 12, hi = bounds ? bounds[1] : G.L.width - 12;
  if (e.x < lo) { e.x = lo; if (e.vx < 0 && e.assist) e.vx = 0; } if (e.x > hi) { e.x = hi; if (e.vx > 0 && e.assist) e.vx = 0; }
}

/** Inimigos não andam para dentro de buracos, nem caem de degraus altos ou plataformas. */
export function edgeAhead(e: any, dir: number, look = 8) {
  if (!e.onGround || !dir) return false;
  const nx = e.x + dir * look;
  if (e.plat) return nx < e.plat.x || nx > e.plat.x + e.plat.w;
  const g = groundAt(nx);
  return g == null || Math.abs(g - e.y) > STEP || gateBlocks(e.x, nx, e.y);
}

export const ov = (a: any, b: any) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export const ebox = (e: any) => ({ x: e.x - e.w / 2, y: e.y - e.h, w: e.w, h: e.h });
