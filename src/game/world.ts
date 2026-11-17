// Atualização e desenho da cena de jogo (mundo, entidades, efeitos, UI por cima).
import { ctx, R, W, H, SC, txt, screenVer } from '../core/canvas';
import { SFX } from '../core/audio';
import { clamp } from '../core/math';
import { hit } from '../core/input';
import { LOOKS } from '../data/content';
import { G, addText, part } from './state';
import { store } from './save';
import { applyStats, updatePlayer, playerPose } from './player';
import { updateEnemy, enemyPose } from './enemies';
import { updateBoss, bossPose } from './boss';
import { updateProjs, drawProjs, drawBolts } from './projectiles';
import { findNear, pauseMenu, updateMenu, updateLifts } from './interact';
import { respawnAtRest, loadLevel, checkLinks, updateFade, camTarget } from './level';
import { gy } from './physics';
import { die } from './combat';
import { drawMap, drawWorldBits } from '../render/world_ui';
import { getArt, drawArtBack, drawArtFront, drawLights } from '../render/art';
import { drawCharAt, drawGhost, drawDog, drawWasp, drawNest } from '../render/sprites';
import { drawHUD, drawBanner, drawDialog, drawMenu, drawDeath, drawVictory } from '../render/ui';
import { CHARS } from '../data/content';
import { isTouch } from '../core/input';
import { HF } from '../render/ui';
import { NET, netTick, isGuest, online } from '../net/net';
import { guestSmooth } from './coop';

export function updateWorld(rdt: number) {
  const P = G.P, S = G.S, L = G.L, LS = G.LS;
  updateFade(rdt);
  if (G.scene === 'game') {
    if (G.menu || G.map) { if (!G.menu && G.map) { if (hit('back') || hit('confirm')) G.map = false; } else updateMenu(); return; }
    if (G.dialog) { if (hit('confirm')) { G.dialog.i++; SFX.blip(); if (G.dialog.i >= G.dialog.lines.length) G.dialog = null; } return; }
    if (hit('back')) { pauseMenu(); return; }
  }
  if (G.scene === 'victory') {
    if (hit('confirm')) { if (L.exit && L.exit.to && !isGuest()) { loadLevel(L.exit.to, 0); G.scene = 'game'; } else G.scene = 'game'; return; }
    if (hit('back')) { G.scene = 'game'; return; }
  }
  let dt = rdt; if (G.hitstop > 0) { G.hitstop -= rdt; dt = 0; }
  G.near = G.scene === 'game' ? findNear() : null;
  if (!G.fade) updatePlayer(dt);
  updateLifts(dt);
  checkLinks();
  // água funda: afoga
  if (P.state !== 'dead' && G.scene === 'game') for (const w of L.water) if (P.x > w.x0 && P.x < w.x1 && P.y > w.y + 10) { G.drowned = true; die(true); break; }
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
  for (const t of G.trails) t.life -= rdt;
  for (const t of G.slashes) t.life -= dt; G.slashes = G.slashes.filter((t: any) => t.life > 0);
  for (const e of G.enemies) if (e.hitT > 0) e.hitT -= dt; if (G.boss && G.boss.hitT > 0) G.boss.hitT -= dt;
  { const k = Math.pow(.0005, rdt); G.kickX *= k; G.kickY *= k; }
  G.trails = G.trails.filter((t: any) => t.life > 0);
  for (const t of G.texts) { t.y -= 18 * dt; t.life -= dt * .9; }
  G.texts = G.texts.filter((t: any) => t.life > 0);
  L.fires.forEach((f: any, i: number) => {
    if (LS.lit[i] && Math.abs(f.x - G.cam - W / 2) < W && Math.random() < .3)
      part({ x: f.x + (Math.random() - .5) * 8, y: f.y - 8, vx: (Math.random() - .5) * 10, vy: -20 - Math.random() * 25, life: 1.2, c: Math.random() < .5 ? '#ffb040' : '#ff7020', g: -5 });
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
  const tx = camTarget(P.x + (G.arenaOn ? 0 : P.face * 30));
  G.cam += (tx - G.cam) * Math.min(1, rdt * 5);
  const ty = clamp(P.y - 175, 0, L.height - H);
  G.camY = (G.camY ?? ty) + (ty - (G.camY ?? ty)) * Math.min(1, rdt * 4);
  if (G.shakeT > 0) { G.shakeT -= rdt; if (G.shakeT <= 0) G.shakeM = 0; }
  if (G.banner) { G.banner.t += rdt; if (G.banner.t > G.banner.dur) G.banner = null; }
  if (G.hintT > 0) G.hintT -= rdt;
  if (G.hurtFlash > 0) G.hurtFlash = Math.max(0, G.hurtFlash - rdt);
  if (G.victT >= 0) { G.victT += rdt; if (G.victT > 4.5 && G.scene === 'game') { G.scene = 'victory'; G.victT = -1; } }
  if (G.scene === 'dead') { G.deathT += rdt; if (G.deathT > 2 && (hit('confirm') || hit('light'))) { G.drowned = false; respawnAtRest(); G.scene = 'game'; } }
}

let vig: CanvasGradient | null = null, vigVer = -1;

export function renderWorld() {
  const P = G.P, L = G.L, LS = G.LS, cam = G.cam, camY = G.camY || 0, boss = G.boss, art = getArt(L);
  const sx = (G.shakeT > 0 ? (Math.random() - .5) * G.shakeM * 2 : 0) + G.kickX, sy = (G.shakeT > 0 ? (Math.random() - .5) * G.shakeM * 2 : 0) + G.kickY;
  drawArtBack(art, cam, camY, Math.round(sx * SC), Math.round(sy * SC));
  ctx.save(); ctx.setTransform(SC, 0, 0, SC, Math.round((-cam + sx) * SC), Math.round((-camY + sy) * SC));
  drawLights(art, L.fires, LS.lit);
  drawWorldBits();
  for (const m of L.msgs) {
    const a = .55 + .35 * Math.sin(G.time * 2 + m.x); ctx.globalAlpha = a;
    R('#e08a2a', m.x - 6, m.y - .5, 12, .5); R('#ffb050', m.x - 3.5, m.y - 1, 7, .5); R('#ffd890', m.x - 1, m.y - 1.5, 2, .5); ctx.globalAlpha = 1;
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
  for (const npc of L.npcs) drawCharAt(LOOKS[npc.look], npc.x, npc.y, npc.face || -1, { bob: Math.sin(G.time * 1.2 + npc.x) > 0 ? 1 : 2, armA: .2, seed: 9 });
  if (L.exit && LS.bossDead) { const a = .3 + .2 * Math.sin(G.time * 2); ctx.globalAlpha = a; R(L.exit.to ? '#ffe0a0' : '#8a8aa0', L.exit.x - 8, L.exit.y - 40, 16, 40); ctx.globalAlpha = 1; }
  if (boss && boss.state !== 'dead') {
    for (const gx of G.arenaOn ? L.arena : [L.arena[0]]) for (let i = 0; i < 8; i++) { ctx.globalAlpha = .08 + .06 * Math.sin(G.time * 2 + i); R('#e8e8ff', gx - 6 + Math.sin(G.time * 1.5 + i) * 3, gy(gx) - 100 + i * 13, 12, 16); }
    ctx.globalAlpha = 1;
  }
  for (const e of G.enemies) {
    if (e.kind === 'lunger' || e.kind === 'charger') drawDog(e, e.look);
    else if (e.kind === 'flyer') drawWasp(e);
    else if (e.kind === 'nest') drawNest(e);
    else drawCharAt(e.look, e.x, e.y, e.face, enemyPose(e), e.scale || 1, e.alpha);
    if (e.hp < e.maxhp && e.state !== 'dead') { R('#000', e.x - 9, e.y - e.h - 9, 18, 2); R('#a01822', e.x - 8.5, e.y - e.h - 8.5, 17 * e.hp / e.maxhp, 1); }
  }
  if (boss) drawCharAt(boss.def, boss.x, boss.y, boss.face, bossPose(boss), boss.B.scale, boss.alpha);
  for (const r of NET.remotes.values()) {
    const d = CHARS.find(c => c.id === r.c) || CHARS[0];
    drawCharAt(d, r.x, r.y, r.f || 1, { ...(r.o || {}), seed: 5 }, 1, r.s === 'dead' ? .5 : 1);
    ctx.globalAlpha = .85; txt(d.short, Math.round(r.x), Math.round(r.y) - 38, HF - 1, '#9fd8ff', 'center'); ctx.globalAlpha = 1;
    if (r.mh) { R('#000', r.x - 8, r.y - 32, 16, 1.5); R('#3aa0e0', r.x - 8, r.y - 32, 16 * Math.max(0, r.hp) / r.mh, 1); }
  }
  for (const g of P.ghosts) drawGhost(P.d, g.x, g.y, g.face, g.o, g.c, .45 * g.life / g.max);
  drawCharAt(P.d, P.x, P.y, P.face, playerPose());
  if (P.critNext && Math.floor(G.time * 8) % 2) R('#ffe080', P.x - .5, P.y - 34, 1, 1);
  // rastros dos golpes: meia-lua cheia que afina e some (smear), com fio branco na borda
  for (const t of G.trails) {
    const k = t.life / t.max, toPhi = (th: number) => t.face > 0 ? th + Math.PI / 2 : Math.PI - (th + Math.PI / 2);
    const a0 = toPhi(t.a0), a1 = toPhi(t.a1);
    let d = a1 - a0; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    const th = (t.w + 1.6) * k, ro = t.r + .8, ri = Math.max(2, t.r - th * 1.6);
    ctx.globalAlpha = .38 * k; ctx.fillStyle = t.c;
    ctx.beginPath(); ctx.arc(t.x, t.y, ro, a0, a0 + d, d < 0); ctx.arc(t.x, t.y, ri, a0 + d, a0, d >= 0); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = .55 * k; ctx.strokeStyle = t.c; ctx.lineWidth = t.w * k + .5; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, a0, a0 + d, d < 0); ctx.stroke();
    ctx.globalAlpha = .95 * k; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = .6;
    ctx.beginPath(); ctx.arc(t.x, t.y, ro, a0, a0 + d, d < 0); ctx.stroke();
  }
  // cortes de impacto
  for (const c of G.slashes) {
    const k = c.life / c.max, grow = 1 - k * k, L = c.len * (.4 + .6 * grow), dx = Math.cos(c.ang) * L / 2, dy = Math.sin(c.ang) * L / 2;
    ctx.globalAlpha = k; ctx.strokeStyle = c.c; ctx.lineCap = 'round';
    ctx.lineWidth = c.w * k + .3; ctx.beginPath(); ctx.moveTo(c.x - dx, c.y - dy); ctx.lineTo(c.x + dx, c.y + dy); ctx.stroke();
    ctx.lineWidth = .5; ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(c.x - dx * 1.15, c.y - dy * 1.15); ctx.lineTo(c.x + dx * 1.15, c.y + dy * 1.15); ctx.stroke();
  }
  ctx.lineCap = 'butt';
  ctx.globalAlpha = 1;
  drawProjs();
  drawBolts(1 / 60);
  for (const p of G.parts) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    const x = Math.round(p.x * SC) / SC, y = Math.round(p.y * SC) / SC;
    if (p.glint) { const k = (1 - p.life / p.max) * 5 + 1.5; R('#ffffff', x - k, y - .25, k * 2, .5); R('#ffffff', x - .25, y - k, .5, k * 2); R('#ffe6a0', x - .75, y - .75, 1.5, 1.5); }
    else R(p.c, x, y, p.s / SC, p.s / SC);
  }
  ctx.globalAlpha = 1;
  for (const t of G.texts) { ctx.globalAlpha = Math.min(1, t.life * 2); txt(t.s, Math.round(t.x), Math.round(t.y), /^\d+$/.test(t.s) ? HF + 1 : HF, t.c, 'center'); }
  ctx.globalAlpha = 1;
  const n = G.near;
  if (n && G.scene === 'game' && !G.menu && !G.dialog) { ctx.globalAlpha = .75 + .25 * Math.sin(G.time * 4); txt((isTouch ? '' : 'E  ') + n.label, Math.round(n.x), Math.round((n.y ?? P.y)) - 46, HF, '#ffe0a0', 'center'); ctx.globalAlpha = 1; }
  ctx.restore();
  drawArtFront(art, cam, camY, Math.round(sx * SC), Math.round(sy * SC));
  // setas na borda para companheiros fora da tela
  for (const r of NET.remotes.values()) {
    const rx = r.x - cam; if (rx > 6 && rx < W - 6) continue;
    const left = rx <= 6, ax = left ? 10 : W - 10, ay = Math.max(40, Math.min(H - 40, r.y - camY - 14));
    const d = CHARS.find(c => c.id === r.c) || CHARS[0], dist = Math.round(Math.abs(r.x - P.x) / 10);
    ctx.globalAlpha = .85;
    for (let k = 0; k < 4; k++) R('#9fd8ff', left ? ax + k : ax - k, ay - 3 + k * .5 + (k === 3 ? 0 : 0), 1, 6 - k * 1.5);
    txt(d.short + ' ' + dist + 'm', left ? ax + 6 : ax - 6, ay - 2, HF - 1, '#9fd8ff', left ? 'left' : 'right');
    ctx.globalAlpha = 1;
  }
  if (!vig || vigVer !== screenVer) { vigVer = screenVer; vig = ctx.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, Math.hypot(W, H) * .55); vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,.6)'); }
  ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
  if (G.hurtFlash > 0) {
    const rg = ctx.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H * .9);
    rg.addColorStop(0, 'rgba(150,0,10,0)'); rg.addColorStop(1, `rgba(150,0,10,${G.hurtFlash * 1.6})`);
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  }
  drawHUD(); drawBanner();
  if (G.netDebug && online()) {
    const age = NET.lastRx ? Math.round((performance.now() - NET.lastRx) / 100) / 10 : -1;
    const lines = ['REDE: ' + NET.role + '  sala ' + NET.code, (NET.brokerUrl || '').replace('wss://', ''), 'eu ' + NET.myId + '  env ' + NET.tx + '  rec ' + NET.rx + '  ult ' + age + 's'];
    for (const r of NET.remotes.values()) lines.push((r.c || '?') + ' x' + Math.round(r.x) + ' ' + r.s);
    R('rgba(0,0,0,.7)', W - 170, 30, 164, 6 + lines.length * 8);
    lines.forEach((l, i) => txt(l, W - 166, 33 + i * 8, 5, '#9fd8ff'));
  }
  if (G.dialog) drawDialog();
  if (G.menu && !G.map) drawMenu();
  if (G.map) drawMap();
  if (G.fade) { const f = G.fade, a = f.t < .25 ? f.t / .25 : Math.max(0, 1 - (f.t - .25) / .3); ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(0, 0, W, H); }
  if (G.scene === 'dead') drawDeath();
  if (G.scene === 'victory') drawVictory();
}
