// Projéteis: bola de fogo (jogador), onda de choque, flecha, adaga arremessada e adaga caindo do céu.
import { R, ctx } from '../core/canvas';
import { SFX } from '../core/audio';
import { gy } from './physics';
import { G, part, burst, shake } from './state';
import { ov, ebox } from './physics';
import { targets, damageEnemy } from './combat';
import { hitPlayers } from './players';
import { isGuest } from '../net/net';

export function updateProjs(dt: number) {
  for (const p of G.projs) {
    p.life -= dt;
    if (p.rep) { if (p.type === 'fall' && p.delay > 0) p.delay -= dt; else { p.x += p.vx * dt; p.y += (p.type === 'fall' ? 420 : (p.vy || 0)) * dt; } continue; } // cópia vinda do anfitrião: só visual
    if (p.type === 'fall') {
      if (p.delay > 0) { p.delay -= dt; continue; }
      if (p.style === 'bolt') { // raio: cai na hora em toda a coluna
        const g = gy(p.x);
        hitPlayers({ x: p.x - 6, y: g - 90, w: 12, h: 90 }, p.dmg, null);
        G.bolts = G.bolts || []; G.bolts.push({ x: p.x, y0: g - 280, y1: g, life: .22, seed: Math.random() * 99 });
        SFX.slam(); shake(.15, 3); burst(p.x, g - 2, '#bff4ff', 10, 120); p.life = 0; continue;
      }
      p.y += 420 * dt;
      if (hitPlayers({ x: p.x - 2, y: p.y, w: 4, h: 10 }, p.dmg, null)) p.life = 0;
      if (p.y >= gy(p.x) - 10) { p.life = 0; burst(p.x, gy(p.x) - 2, '#c8c8d0', 5, 60); }
      continue;
    }
    p.x += p.vx * dt; p.y += (p.vy || 0) * dt;
    if (p.owner === 'p') {
      if (p.remoteFx) { if (Math.random() < .5) G.parts.push({ x: p.x, y: p.y, vx: 0, vy: -10, life: .3, max: .3, c: '#ffb030', g: 0, s: 1 }); continue; }
      part({ x: p.x, y: p.y + (Math.random() - .5) * 4, vx: -p.vx * .1, vy: -10, life: .3, c: Math.random() < .5 ? '#ffb030' : '#ff6020' });
      for (const e of targets()) if (ov({ x: p.x - 4, y: p.y - 3, w: 8, h: 6 }, ebox(e))) { damageEnemy(e, 2.6, { heavy: true }); p.life = 0; burst(p.x, p.y, '#ffa030', 12, 100); break; }
    } else {
      if (p.type === 'shock' && Math.random() < .7) part({ x: p.x, y: gy(p.x) - Math.random() * 12, vx: 0, vy: -30, life: .35, c: '#d8c8ff' });
      const box = p.type === 'shock' ? { x: p.x - 5, y: p.y, w: 10, h: 12 } : { x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h };
      if (hitPlayers(box, p.dmg, null)) p.life = 0;
      if (p.type !== 'shock' && p.y > gy(p.x)) p.life = 0;
    }
    if (p.x < 0 || p.x > G.L.width) p.life = 0;
  }
  G.projs = G.projs.filter((p: any) => p.life > 0);
  void isGuest;
}

export function drawBolts(dt: number) {
  for (const b of G.bolts || []) {
    b.life -= dt;
    const k = Math.max(0, b.life / .22);
    let x = b.x, y = b.y0; const r = (n: number) => Math.sin(b.seed * 13.1 + n * 7.7);
    ctx.globalAlpha = k; ctx.strokeStyle = '#bff4ff'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x, y);
    for (let i = 1; i <= 12; i++) { x = b.x + r(i) * 7; y = b.y0 + (b.y1 - b.y0) * i / 12; ctx.lineTo(x, y); }
    ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = .8; ctx.stroke();
    ctx.globalAlpha = k * .25; ctx.fillStyle = '#bff4ff'; ctx.fillRect(b.x - 30, b.y0, 60, b.y1 - b.y0);
  }
  ctx.globalAlpha = 1;
  G.bolts = (G.bolts || []).filter((b: any) => b.life > 0);
}

export function drawProjs() {
  for (const p of G.projs) {
    const x = Math.round(p.x), y = Math.round(p.y), d = p.vx >= 0 ? 1 : -1;
    switch (p.type) {
      case 'fire': R('#ff6020', x - 4, y - 3, 8, 6); R('#ffb030', x - 3, y - 2, 6, 4); R('#fff0b0', x - 1, y - 1, 3, 2); break;
      case 'shock': R('#b8a8ff', x - 4, y, 8, 12); R('#ffffff', x - 2, y + 3, 4, 9); break;
      case 'arrow': R('#8a6a42', x - 4, y, 8, 1); R('#d8d8d8', x + d * 4, y - 1, 1, 3); R('#c8c0a0', x - d * 4 - (d < 0 ? 1 : 0), y - 1, 1, 3); break;
      case 'dagger': R('#d0d4dc', x - 3, y - 1, 6, 2); R('#a01822', x - d * 4 - (d < 0 ? 1 : 0), y - 1, 2, 2); break;
      case 'fall':
        if (p.delay > 0) { const bolt = p.style === 'bolt'; if (Math.floor(G.time * 12) % 2) R(bolt ? '#8ae8ff' : '#ff3030', x - 5, gy(x) - 1, 10, 1); R(bolt ? 'rgba(120,220,255,.14)' : 'rgba(255,60,60,.12)', x - 2, gy(x) - 260, 4, 260); }
        else { R('#d0d4dc', x - 1, y, 2, 8); R('#a01822', x - 2, y - 2, 4, 2); }
        break;
    }
  }
}
