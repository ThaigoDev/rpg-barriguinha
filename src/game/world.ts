// Atualização e desenho da cena de jogo (mundo, entidades, efeitos, UI por cima).
import { ctx, R, W, H, GY, SC, txt } from '../core/canvas';
import { SFX } from '../core/audio';
import { clamp } from '../core/math';
import { hit } from '../core/input';
import { LOOKS } from '../data/content';
import { G, addText, part } from './state';
import { store } from './save';
import { applyStats, updatePlayer, playerPose } from './player';
import { updateEnemy, enemyPose } from './enemies';
import { updateBoss, bossPose } from './boss';
import { updateProjs, drawProjs } from './projectiles';
import { findNear, pauseMenu, updateMenu } from './interact';
import { respawnAll, loadLevel } from './level';
import { getArt, drawArtBack, drawArtFront, drawLights } from '../render/art';
import { drawCharAt, drawDog } from '../render/sprites';
import { drawHUD, drawBanner, drawDialog, drawMenu, drawDeath, drawVictory } from '../render/ui';
import { CHARS } from '../data/content';
import { NET, netTick, isGuest, online } from '../net/net';
import { guestSmooth } from './coop';

export function updateWorld(rdt: number) {
  const P = G.P, S = G.S, L = G.L, LS = G.LS;
  if (G.scene === 'game') {
    if (G.menu) { updateMenu(); return; }
    if (G.dialog) { if (hit('confirm')) { G.dialog.i++; SFX.blip(); if (G.dialog.i >= G.dialog.lines.length) G.dialog = null; } return; }
    if (hit('back')) { pauseMenu(); return; }
  }
  if (G.scene === 'victory') {
    if (hit('confirm')) { if (L.exit && L.exit.to && !isGuest()) { loadLevel(L.exit.to, 0); G.scene = 'game'; } else G.scene = 'game'; return; }
    if (hit('back')) { G.scene = 'game'; return; }
  }
  let dt = rdt; if (G.hitstop > 0) { G.hitstop -= rdt; dt = 0; }
  G.near = G.scene === 'game' ? findNear() : null;
  updatePlayer(dt);
  netTick(rdt);
  if (isGuest()) guestSmooth(dt);
  else {
    for (const e of G.enemies) updateEnemy(e, dt);
    G.enemies = G.enemies.filter((e: any) => !(e.state === 'dead' && e.t > .9));
    if (G.boss) { updateBoss(G.boss, dt); if (G.boss.state === 'dead' && G.boss.t > 2.4) G.boss = null; }
  }
  if (G.netMsg) { G.netMsg.t -= rdt; if (G.netMsg.t <= 0) G.netMsg = null; }
  updateProjs(dt);
  for (const p of G.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.life -= dt; }
  G.parts = G.parts.filter((p: any) => p.life > 0);
  for (const t of G.texts) { t.y -= 18 * dt; t.life -= dt * .9; }
  G.texts = G.texts.filter((t: any) => t.life > 0);
  L.fires.forEach((f: any, i: number) => {
    if (LS.lit[i] && Math.abs(f.x - G.cam - W / 2) < W && Math.random() < .3)
      part({ x: f.x + (Math.random() - .5) * 8, y: GY - 8, vx: (Math.random() - .5) * 10, vy: -20 - Math.random() * 25, life: 1.2, c: Math.random() < .5 ? '#ffb040' : '#ff7020', g: -5 });
  });
  if (P.buffT > 0 && Math.random() < .5) part({ x: P.x + (Math.random() - .5) * 12, y: P.y - Math.random() * 24, vx: 0, vy: -25, life: .6, c: '#a060ff' });
  if (G.scene === 'game' && P.state !== 'dead') {
    for (const it of G.items) if (!it.got && Math.abs(P.x - it.x) < 10 && Math.abs(P.y - it.y) < 20) {
      it.got = true; LS.taken[it.id] = true; SFX.souls();
      if (it.type === 'souls') { S.souls += it.v; addText(it.x, it.y - 20, '+' + it.v + ' almas', '#9fd8ff'); }
      else { S.cafeBonus++; applyStats(P); P.cafe++; G.banner = { text: 'CAFÉ EXTRA!', sub: 'Frasco de café +1. Coado na hora.', t: 0, dur: 3, color: '#e0b070' }; }
      store();
    }
    G.items = G.items.filter((i: any) => !i.got);
    const st = LS.stain;
    if (st && Math.abs(P.x - st.x) < 12 && Math.abs(P.y - st.y) < 24) { S.souls += st.souls; addText(P.x, P.y - 36, '+' + st.souls + ' almas recuperadas', '#9fd8ff'); SFX.souls(); LS.stain = null; store(); }
  }
  const tx = G.arenaOn ? clamp(P.x - W / 2, L.arena[0] - 20, L.arena[1] + 20 - W) : clamp(P.x - W / 2 + P.face * 30, 0, L.width - W);
  G.cam += (tx - G.cam) * Math.min(1, rdt * 5);
  if (G.shakeT > 0) { G.shakeT -= rdt; if (G.shakeT <= 0) G.shakeM = 0; }
  if (G.banner) { G.banner.t += rdt; if (G.banner.t > G.banner.dur) G.banner = null; }
  if (G.hintT > 0) G.hintT -= rdt;
  if (G.hurtFlash > 0) G.hurtFlash = Math.max(0, G.hurtFlash - rdt);
  if (G.victT >= 0) { G.victT += rdt; if (G.victT > 4.5 && G.scene === 'game') { G.scene = 'victory'; G.victT = -1; } }
  if (G.scene === 'dead') { G.deathT += rdt; if (G.deathT > 2 && (hit('confirm') || hit('light'))) { respawnAll(); G.scene = 'game'; } }
}

let vig: CanvasGradient | null = null;

export function renderWorld() {
  const P = G.P, L = G.L, LS = G.LS, cam = G.cam, boss = G.boss, art = getArt(L);
  const sx = G.shakeT > 0 ? (Math.random() - .5) * G.shakeM * 2 : 0, sy = G.shakeT > 0 ? (Math.random() - .5) * G.shakeM * 2 : 0;
  drawArtBack(art, cam, Math.round(sx * SC), Math.round(sy * SC));
  ctx.save(); ctx.setTransform(SC, 0, 0, SC, Math.round((-cam + sx) * SC), Math.round(sy * SC));
  drawLights(art, L.fires, LS.lit);
  for (const m of L.msgs) {
    const a = .55 + .35 * Math.sin(G.time * 2 + m.x); ctx.globalAlpha = a;
    R('#e08a2a', m.x - 6, GY - .5, 12, .5); R('#ffb050', m.x - 3.5, GY - 1, 7, .5); R('#ffd890', m.x - 1, GY - 1.5, 2, .5); ctx.globalAlpha = 1;
  }
  for (const it of G.items) {
    const y = it.y - 7 + Math.round(Math.sin(G.time * 3 + it.x) * 4) / 2, gl = ctx.createRadialGradient(it.x, y, .5, it.x, y, 10);
    gl.addColorStop(0, it.type === 'cafe' ? 'rgba(255,200,120,.6)' : 'rgba(170,220,255,.6)'); gl.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gl; ctx.fillRect(it.x - 10, y - 10, 20, 20);
    R(it.type === 'cafe' ? '#ffe0a0' : '#e8f6ff', it.x - 1, y - 1, 2, 2); R('#ffffff', it.x - .5, y - .5, 1, 1);
  }
  if (LS.stain) {
    const s = LS.stain; ctx.globalAlpha = .6 + .3 * Math.sin(G.time * 4); R('#8a0a14', s.x - 7, s.y - .5, 14, .5); R('#c01020', s.x - 4, s.y - 1, 8, .5); ctx.globalAlpha = 1;
    if (Math.random() < .2) part({ x: s.x + (Math.random() - .5) * 10, y: s.y - 2, vx: 0, vy: -15, life: .8, c: '#d02030' });
  }
  if (L.npc) drawCharAt(LOOKS[L.npc.look], L.npc.x, GY, -1, { bob: Math.sin(G.time * 1.2) > 0 ? 1 : 2, armA: .2, seed: 9 });
  if (L.exit && LS.bossDead) { const a = .3 + .2 * Math.sin(G.time * 2); ctx.globalAlpha = a; R(L.exit.to ? '#ffe0a0' : '#8a8aa0', L.exit.x - 8, GY - 40, 16, 40); ctx.globalAlpha = 1; }
  if (boss && boss.state !== 'dead') {
    for (const gx of G.arenaOn ? L.arena : [L.arena[0]]) for (let i = 0; i < 8; i++) { ctx.globalAlpha = .08 + .06 * Math.sin(G.time * 2 + i); R('#e8e8ff', gx - 6 + Math.sin(G.time * 1.5 + i) * 3, GY - 100 + i * 13, 12, 16); }
    ctx.globalAlpha = 1;
  }
  for (const e of G.enemies) {
    if (e.kind === 'lunger') drawDog(e, e.look); else drawCharAt(e.look, e.x, e.y, e.face, enemyPose(e), 1, e.alpha);
    if (e.hp < e.maxhp && e.state !== 'dead') { R('#000', e.x - 9, e.y - e.h - 9, 18, 2); R('#a01822', e.x - 8.5, e.y - e.h - 8.5, 17 * e.hp / e.maxhp, 1); }
  }
  if (boss) drawCharAt(boss.def, boss.x, boss.y, boss.face, bossPose(boss), boss.B.scale, boss.alpha);
  for (const r of NET.remotes.values()) {
    const d = CHARS.find(c => c.id === r.c); if (!d) continue;
    drawCharAt(d, r.x, r.y, r.f || 1, { ...(r.o || {}), seed: 5 }, 1, r.s === 'dead' ? .5 : 1);
    txt(d.short, Math.round(r.x), Math.round(r.y) - 40, 8, '#9fd8ff', 'center');
    if (r.mh) { R('#000', r.x - 10, r.y - 31, 20, 2); R('#3aa0e0', r.x - 9.5, r.y - 30.5, 19 * Math.max(0, r.hp) / r.mh, 1); }
  }
  drawCharAt(P.d, P.x, P.y, P.face, playerPose());
  if (online()) txt(P.d.short, Math.round(P.x), Math.round(P.y) - 40, 8, '#ffe0a0', 'center');
  if (P.critNext && Math.floor(G.time * 8) % 2) R('#ffe080', P.x - .5, P.y - 34, 1, 1);
  drawProjs();
  for (const p of G.parts) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    const x = Math.round(p.x * SC) / SC, y = Math.round(p.y * SC) / SC;
    if (p.glint) { const k = (1 - p.life / p.max) * 5 + 1.5; R('#ffffff', x - k, y - .25, k * 2, .5); R('#ffffff', x - .25, y - k, .5, k * 2); R('#ffe6a0', x - .75, y - .75, 1.5, 1.5); }
    else R(p.c, x, y, p.s / SC, p.s / SC);
  }
  ctx.globalAlpha = 1;
  for (const t of G.texts) { ctx.globalAlpha = Math.min(1, t.life * 2); txt(t.s, Math.round(t.x), Math.round(t.y), 8, t.c, 'center'); }
  ctx.globalAlpha = 1;
  const n = G.near;
  if (n && G.scene === 'game' && !G.menu && !G.dialog) txt('[E] ' + n.label, Math.round(n.x), GY - 50, 8, '#ffe0a0', 'center');
  ctx.restore();
  drawArtFront(art, cam, Math.round(sx * SC), Math.round(sy * SC));
  if (!vig) { vig = ctx.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * .95); vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,.6)'); }
  ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
  if (G.hurtFlash > 0) {
    const rg = ctx.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H * .9);
    rg.addColorStop(0, 'rgba(150,0,10,0)'); rg.addColorStop(1, `rgba(150,0,10,${G.hurtFlash * 1.6})`);
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  }
  drawHUD(); drawBanner();
  if (G.dialog) drawDialog();
  if (G.menu) drawMenu();
  if (G.scene === 'dead') drawDeath();
  if (G.scene === 'victory') drawVictory();
}
