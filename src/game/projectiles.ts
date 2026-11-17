// Projéteis: bola de fogo (jogador), onda de choque, flecha, adaga arremessada e adaga caindo do céu.
import { GY, R } from '../core/canvas';
import { G, part, burst } from './state';
import { ov, ebox } from './physics';
import { targets, damageEnemy, hurtPlayer, pbox } from './combat';

export function updateProjs(dt: number) {
  for (const p of G.projs) {
    p.life -= dt;
    if (p.type === 'fall') {
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.y += 420 * dt;
      if (ov({ x: p.x - 2, y: p.y, w: 4, h: 10 }, pbox())) { hurtPlayer(p.dmg, null); p.life = 0; }
      if (p.y >= GY - 10) { p.life = 0; burst(p.x, GY - 2, '#c8c8d0', 5, 60); }
      continue;
    }
    p.x += p.vx * dt; p.y += (p.vy || 0) * dt;
    if (p.owner === 'p') {
      part({ x: p.x, y: p.y + (Math.random() - .5) * 4, vx: -p.vx * .1, vy: -10, life: .3, c: Math.random() < .5 ? '#ffb030' : '#ff6020' });
      for (const e of targets()) if (ov({ x: p.x - 4, y: p.y - 3, w: 8, h: 6 }, ebox(e))) { damageEnemy(e, 2.6, { heavy: true }); p.life = 0; burst(p.x, p.y, '#ffa030', 12, 100); break; }
    } else {
      if (p.type === 'shock' && Math.random() < .7) part({ x: p.x, y: GY - Math.random() * 12, vx: 0, vy: -30, life: .35, c: '#d8c8ff' });
      const box = p.type === 'shock' ? { x: p.x - 5, y: p.y, w: 10, h: 12 } : { x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h };
      if (ov(box, pbox())) { hurtPlayer(p.dmg, null); p.life = 0; }
      if (p.type !== 'shock' && p.y > GY) p.life = 0;
    }
    if (p.x < 0 || p.x > G.L.width) p.life = 0;
  }
  G.projs = G.projs.filter((p: any) => p.life > 0);
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
        if (p.delay > 0) { if (Math.floor(G.time * 12) % 2) R('#ff3030', x - 5, GY - 1, 10, 1); R('rgba(255,60,60,.12)', x - 2, 0, 4, GY); }
        else { R('#d0d4dc', x - 1, y, 2, 8); R('#a01822', x - 2, y - 2, 4, 2); }
        break;
    }
  }
}
