// Elementos do mundo desenhados ao vivo (portas, portões, elevadores, água) e o mapa do mundo.
import { ctx, R, W, H, txt, panel } from '../core/canvas';
import { G } from '../game/state';
import { LEVELS, REGIONS } from '../data/content';
import { prepLevel } from '../game/physics';
import { HF } from './ui';

/** Coordenadas do mundo (chamado dentro do transform da câmera). */
export function drawWorldBits() {
  const L = G.L, S = G.S, t = G.time;
  // água (represa): superfície animada com reflexos do sol
  for (const w of L.water) {
    const bottom = L.height + 40;
    ctx.fillStyle = 'rgba(20,40,62,.88)'; ctx.fillRect(w.x0, w.y, w.x1 - w.x0, bottom - w.y);
    const g = ctx.createLinearGradient(0, w.y, 0, w.y + 40); g.addColorStop(0, 'rgba(255,170,90,.28)'); g.addColorStop(1, 'rgba(255,170,90,0)');
    ctx.fillStyle = g; ctx.fillRect(w.x0, w.y, w.x1 - w.x0, 40);
    for (let x = w.x0; x < w.x1; x += 3) {
      const yy = w.y + Math.sin(x * .09 + t * 2) * .6;
      R(Math.sin(x * .3 + t * 3) > .6 ? '#ffd6a0' : '#5a7a9a', x, yy, 2, .5);
    }
    for (let i = 0; i < 26; i++) { // brilhos
      const gx = w.x0 + ((i * 97.3 + t * 6) % (w.x1 - w.x0)), gyy = w.y + 2 + (i * 7) % 26;
      if (Math.sin(t * 4 + i) > .5) R(i % 3 ? '#ffe6c0' : '#ffffff', gx, gyy, 1.5, .5);
    }
  }
  // portões (fechados até abrir pelo lado certo)
  for (const g of L.gates) {
    if (S.opened[L.id + ':' + g.id]) { R('#2a2c34', g.x - 5, g.top - 4, 10, 3); continue; }
    R('#1a1c22', g.x - 6, g.top - 3, 12, 3);
    for (let i = -2; i <= 2; i++) { R('#3a3e48', g.x + i * 2.2 - .5, g.top, 1.2, g.y - g.top); R('#6a707e', g.x + i * 2.2 - .5, g.top, .5, g.y - g.top); }
    R('#3a3e48', g.x - 6, g.top + (g.y - g.top) * .45, 12, 1.5);
  }
  // portas para outras áreas
  for (const d of L.doors) {
    const locked = d.lock && !S.opened[d.lock];
    R('#2a1e14', d.x - 8, d.y - 26, 16, 26); R('#4a3220', d.x - 7, d.y - 25, 14, 25);
    for (let i = -6; i < 7; i += 3) R('#3a2616', d.x + i, d.y - 25, .6, 25);
    R(locked ? '#8a8a96' : '#c89a40', d.x + 4, d.y - 13, 1.5, 1.5);
    if (!locked) { ctx.globalAlpha = .25 + .15 * Math.sin(t * 2); R('#ffe0a0', d.x - 7, d.y - 25, 14, 25); ctx.globalAlpha = 1; }
  }
  // elevadores (cesto de madeira com cordas)
  for (const l of G.lifts || []) {
    R('#6a5a44', l.x + 2, l.yTop - 60, .6, l.y - l.yTop + 60); R('#6a5a44', l.x + l.w - 2.6, l.yTop - 60, .6, l.y - l.yTop + 60);
    R('#3a2616', l.x, l.y, l.w, 3); R('#5a3e26', l.x, l.y, l.w, 1); R('#2a1a10', l.x + 2, l.y + 3, l.w - 4, 1.5);
    R('#2a1a10', l.x + l.w / 2 - 3, l.yTop - 64, 6, 4);
  }
}

/** Mapa do mundo: regiões e áreas visitadas, com as ligações entre elas. */
export function drawMap() {
  const S = G.S;
  ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fillRect(0, 0, W, H);
  panel(20, 14, W - 40, H - 28);
  txt('MAPA DE NEVERSK', W / 2, 22, 8, '#e0b070', 'center');
  const cell = 52, ox = 44, oy = 54;
  const pos = (id: string) => { const m = LEVELS[id].map || [0, 0]; return [ox + m[0] * cell, oy + m[1] * cell * .72]; };
  const known = (id: string) => S.visited?.[id];
  const edges: [string, string][] = [];
  for (const id in LEVELS) {
    const L = prepLevel(LEVELS[id]);
    for (const k of L.links) edges.push([id, k.to]);
    for (const d of L.doors) edges.push([id, d.to]);
    if (L.exit?.to) edges.push([id, L.exit.to]);
  }
  ctx.strokeStyle = 'rgba(200,170,110,.5)'; ctx.lineWidth = 1;
  for (const [a, b] of edges) {
    if (!LEVELS[b] || (!known(a) && !known(b))) continue;
    const [x1, y1] = pos(a), [x2, y2] = pos(b);
    ctx.setLineDash(known(a) && known(b) ? [] : [2, 2]); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  ctx.setLineDash([]);
  for (const id in LEVELS) {
    const [x, y] = pos(id), here = G.L.id === id, vis = known(id);
    const adj = edges.some(([a, b]) => (a === id && known(b)) || (b === id && known(a)));
    if (!vis && !adj) continue;
    const w = 44, h = 14;
    R(here ? (Math.floor(G.time * 3) % 2 ? '#7a5a2a' : '#5a3e1a') : vis ? '#2a2018' : '#141010', x - w / 2, y - h / 2, w, h);
    R(vis ? '#a08a5a' : '#4a3e2e', x - w / 2, y - h / 2, w, 1); R(vis ? '#a08a5a' : '#4a3e2e', x - w / 2, y + h / 2 - 1, w, 1);
    const L = LEVELS[id];
    txt(vis ? (L.short || L.name).slice(0, 11) : '???', x, y - 3, HF - 1, vis ? (here ? '#ffe0a0' : '#d8ccb0') : '#6a5a4a', 'center');
    if (vis && S.levels[id]?.lit?.some((l: boolean) => l)) R('#ff9a3a', x + w / 2 - 4, y - h / 2 + 2, 2, 2);
  }
  // legenda das regiões
  let ly = H - 40;
  for (const r of REGIONS) { if (r.areas.some((a: string) => known(a))) { txt('· ' + r.name, 34, ly, HF - 1, '#8a7a5a'); ly += 8; } }
  txt('ESC / toque para fechar', W - 34, H - 26, HF - 1, '#6a5a4a', 'right');
}
