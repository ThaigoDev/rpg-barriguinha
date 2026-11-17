// HUD, banners, diálogos, menus e telas (título, seleção, morte, vitória).
import { ctx, R, W, H, GY, SC, txt, wrap, panel, bar } from '../core/canvas';
import { lerp, ease } from '../core/math';
import { CHARS, LEVELS } from '../data/content';
import { isTouch } from '../core/input';
import { G, part } from '../game/state';
import { charSave } from '../game/save';
import { levelCost } from '../game/interact';
import { drawCharAt } from './sprites';
import { getArt, drawArtBack, drawArtFront, drawLights } from './art';

// cenário da tela de título/seleção
export const TITLE_L = { id: 'title', theme: 'vila', width: 1600, gaps: [], plats: [], fires: [{ x: 800 }] };
const titleCam = () => 560 + Math.sin(G.time * .12) * 24;
export function drawTitleBG() {
  const art = getArt(TITLE_L), cam = titleCam();
  drawArtBack(art, cam);
  ctx.save(); ctx.setTransform(SC, 0, 0, SC, Math.round(-cam * SC), 0);
  drawLights(art, TITLE_L.fires, [true]);
  if (G.scene === 'title') drawCharAt(CHARS[0], 760, GY, 1, { bob: Math.sin(G.time * 3) > 0 ? 0 : 1, armA: -.9, seed: 1 });
  ctx.restore();
  drawArtFront(art, cam);
}

export function drawHUD() {
  const P = G.P, S = G.S, boss = G.boss;
  txt(P.d.short + '  NV ' + S.lv, 8, 6, 8, '#e8dcc0');
  bar(8, 17, Math.round(50 + P.maxhp * .7), 5, P.hp, P.maxhp, '#a01822', P.hpLag);
  bar(8, 25, Math.round(40 + P.maxst * .6), 3, Math.max(0, P.st), P.maxst, P.stFlash > 0 && Math.floor(G.time * 20) % 2 ? '#d0d040' : '#2e8a3a');
  R('#e8e0d0', 9, 33, 6, 6); R('#5a3418', 10, 33, 4, 1); R('#e8e0d0', 15, 34, 2, 3);
  txt('x' + P.cafe, 20, 33, 8, P.cafe ? '#e8dcc0' : '#7a6a5a');
  if (P.buffT > 0) txt('MALDIÇÃO ' + Math.ceil(P.buffT) + 's', 8, 45, 8, '#c080ff');
  if (P.critNext) txt('PRÓXIMO: CRÍTICO', 8, P.buffT > 0 ? 56 : 45, 8, '#ffe080');
  R('rgba(0,0,0,.6)', W - 96, 6, 88, 18); R('#5a4a30', W - 96, 23, 88, 1);
  txt('ALMAS', W - 84, 11, 8, '#7a8a9a'); txt(String(S.souls), W - 14, 11, 8, '#e8dcc0', 'right'); R('#9fd8ff', W - 90, 13, 3, 3);
  if (boss && G.arenaOn && boss.state !== 'dead') { txt(boss.name, W / 2 - 150, H - 34, 8, '#e8dcc0'); bar(W / 2 - 150, H - 22, 300, 5, boss.hp, boss.maxhp, '#8a1420'); }
  if (G.hintT > 0 && !G.arenaOn) { ctx.globalAlpha = Math.min(1, G.hintT); if (isTouch) { txt('ATQ = combo  ·  segure FORTE = carregar  ·  ROLA desvia', W / 2, 62, 8, '#c8b898', 'center'); txt('No ar: ATQ corta, FORTE cai golpeando', W / 2, 74, 8, '#a89878', 'center'); }
    else { txt('J leve (combo)  K forte (segure)  L especial  SHIFT rola', W / 2, 62, 8, '#c8b898', 'center'); txt('No ar: J corte aéreo, K ataque em queda  ·  Q café  E usa', W / 2, 74, 8, '#a89878', 'center'); } ctx.globalAlpha = 1; }
}

export function drawBanner() {
  const b = G.banner; if (!b) return;
  const a = b.t < .4 ? b.t / .4 : b.t > b.dur - .6 ? Math.max(0, (b.dur - b.t) / .6) : 1;
  ctx.globalAlpha = a;
  R('rgba(0,0,0,.55)', 0, 92, W, 50); R('rgba(200,170,110,.35)', 60, 92, W - 120, 1); R('rgba(200,170,110,.35)', 60, 141, W - 120, 1);
  txt(b.text, W / 2, 102, 16, b.color || '#e8dcc0', 'center'); if (b.sub) txt(b.sub, W / 2, 125, 8, '#b8a888', 'center');
  ctx.globalAlpha = 1;
}

export function drawDialog() {
  const d = G.dialog;
  panel(16, 190, W - 32, 70); txt(d.who, 26, 198, 8, '#e0b070');
  wrap(d.lines[d.i], W - 60).forEach((l, i) => txt(l, 26, 214 + i * 12, 8, '#e8dcc0'));
  if (Math.floor(G.time * 3) % 2) txt('▼', W - 32, 248, 8, '#e0b070');
}

export function drawMenu() {
  const m = G.menu, S = G.S;
  const w = m.level ? 300 : m.pause ? 350 : 230, h = m.level ? 150 : m.pause ? 150 : 30 + m.opts.length * 16 + 10, x = (W - w) / 2, y = m.level ? 60 : 70;
  panel(x, y, w, h); txt(m.title, W / 2, y + 10, 8, '#e0b070', 'center');
  let oy = y + 30;
  if (m.level) {
    txt('Nível ' + S.lv + '   Almas ' + S.souls, x + 14, oy, 8, '#e8dcc0');
    txt('Custo: ' + levelCost() + ' almas', x + 14, oy + 12, 8, S.souls >= levelCost() ? '#9fd8ff' : '#c06050'); oy += 32;
  }
  m._rects = m.opts.map((_: any, i: number) => ({ x: x + 6, y: oy + i * 16 - 4, w: w - 12, h: 16, i }));
  m.opts.forEach((o: any, i: number) => txt((i === m.idx ? '▶ ' : '  ') + o.label, x + 14, oy + i * 16, 8, i === m.idx ? '#ffe0a0' : '#a89878'));
  if (m.level && m.msg) txt(m.msg, W / 2, y + h - 16, 8, '#ffd27a', 'center');
  if (m.pause && !isTouch) ['A/D mover  ESPAÇO pular (segure = mais alto)', 'SHIFT rolar  J combo  K forte (segure)', 'No ar: J corte  K ataque em queda', 'L especial  Q café  E interagir'].forEach((l, i) => txt(l, x + 10, y + 76 + i * 12, 8, '#8a7a5a'));
}

export function drawDeath() {
  const a = Math.min(1, G.deathT / 1.2);
  ctx.globalAlpha = a * .7; R('#000', 0, 0, W, H); ctx.globalAlpha = a; R('rgba(0,0,0,.7)', 0, 100, W, 64);
  txt('VOCÊ MORREU', W / 2, 112, 24, '#a01822', 'center'); txt(G.deathMsg, W / 2, 144, 8, '#b8a888', 'center');
  if (G.deathT > 2 && Math.floor(G.time * 2) % 2) txt(isTouch ? 'Toque para voltar à fogueira' : 'ENTER para voltar à fogueira', W / 2, 180, 8, '#e8dcc0', 'center');
  ctx.globalAlpha = 1;
}

export function drawVictory() {
  const o = G.L.outro;
  ctx.globalAlpha = .75; R('#000', 0, 0, W, H); ctx.globalAlpha = 1; panel(40, 44, W - 80, 184);
  txt(o.title, W / 2, 58, 16, '#ffd27a', 'center');
  wrap(o.text, W - 110).forEach((l, i) => txt(l, 56, 86 + i * 12, 8, '#e8dcc0'));
  txt(o.next, W / 2, 190, 8, '#9fd8ff', 'center');
  const go = G.L.exit && G.L.exit.to;
  if (Math.floor(G.time * 2) % 2) txt(isTouch ? (go ? 'Toque: seguir viagem   ☰: ficar aqui' : 'Toque para continuar') : (go ? 'ENTER seguir viagem   ESC ficar aqui' : 'ENTER para continuar'), W / 2, 206, 8, '#a89878', 'center');
}

export function drawTitle() {
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(0, 0, W, H);
  txt('A LENDA', W / 2, 40, 24, '#e8dcc0', 'center'); txt('DOS SEIS', W / 2, 72, 24, '#e8dcc0', 'center');
  txt('um soulslike de Neversk', W / 2, 106, 8, '#b8a888', 'center');
  txt('Capítulo 1: Vila dos Esquecidos  ·  Capítulo 2: Floresta', W / 2, 120, 8, '#8a7a5a', 'center');
  if (Math.floor(G.time * 2) % 2) txt(isTouch ? 'Toque para começar' : 'Aperte ENTER', W / 2, 150, 8, '#ffe0a0', 'center');
}

export function drawSelect() {
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H);
  txt('ESCOLHA SEU GUERREIRO', W / 2, 8, 8, '#e0b070', 'center');
  for (let i = 0; i < CHARS.length; i++) {
    const x = 14 + i * 76, y = 22, sel = i === G.selIdx, c = sel ? '#e0b070' : '#4a3e2e';
    R(sel ? 'rgba(90,60,30,.6)' : 'rgba(20,16,26,.8)', x, y, 72, 72); R(c, x, y, 72, 1); R(c, x, y + 71, 72, 1); R(c, x, y, 1, 72); R(c, x + 71, y, 1, 72);
    drawCharAt(CHARS[i], x + 36, y + 62, 1, { bob: sel && Math.sin(G.time * 4) > 0 ? 1 : 0, armA: sel ? -.9 + Math.sin(G.time * 3) * .1 : -.9, seed: i, noShadow: true }, 2);
    txt(CHARS[i].short, x + 36, y + 63, 8, sel ? '#ffe0a0' : '#a89878', 'center');
  }
  const d = CHARS[G.selIdx], cs = charSave(d.id);
  panel(10, 100, W - 20, 160);
  const pose: any = { bob: Math.sin(G.time * 3) > 0 ? 0 : 1, armA: -.9, seed: 1, noShadow: true };
  if (Math.floor(G.time / 1.6) % 2 === 0) {
    const tt = (G.time % 1.6) / 1.6;
    pose.armA = tt < .3 ? lerp(-.9, -3.3, ease(tt / .3)) : tt < .45 ? lerp(-3.3, -.2, (tt - .3) / .15) : lerp(-.2, -.9, (tt - .45) / .55);
  }
  R('rgba(0,0,0,.35)', 22, 112, 92, 140); drawCharAt(d, 68, 236, 1, pose, 3.4);
  const X = 126;
  txt(d.name, X, 110, 8, '#ffe0a0'); txt(d.title + ' · ' + d.cls, X, 122, 8, '#b8a888');
  const stat = (lb: string, v: number, mx: number, y: number) => { txt(lb, X, y, 8, '#8a7a5a'); R('#2a2018', X + 66, y + 1, 120, 5); R('#c09050', X + 66, y + 1, Math.round(120 * Math.min(1, v / mx)), 5); };
  stat('VIDA', d.hp, 140, 138); stat('VIGOR', d.st, 115, 148); stat('DANO', d.dmg / d.light.dur, 40, 158); stat('AGIL.', d.spd, 110, 168);
  txt(d.sp, X, 182, 8, '#c080ff');
  wrap(d.spDesc, W - X - 24).forEach((l, i) => txt(l, X, 194 + i * 11, 8, '#d8ccb0'));
  wrap('"' + d.tag + '"', W - X - 24).forEach((l, i) => txt(l, X, 228 + i * 11, 8, '#8a7a5a'));
  if (cs.lv > 1 || cs.souls > 0 || cs.level !== 'vila') txt('NV ' + cs.lv + ' · ' + (LEVELS[cs.level]?.chapter.replace('Capítulo', 'CAP.') || ''), W - 20, 110, 8, '#9fd8ff', 'right');
  txt(isTouch ? 'Toque para escolher · toque de novo para jogar' : '←/→ escolher   ENTER jogar', W / 2, 262, 8, Math.floor(G.time * 2) % 2 ? '#e0b070' : '#a08060', 'center');
}
