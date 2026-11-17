// A Lenda dos Seis: ponto de entrada. Loop principal e cenas de título/seleção.
import { ctx, resize, SC } from './core/canvas';
import { SFX } from './core/audio';
import { hit, pressed, clearPressed, initInput, isTouch, goFullscreen } from './core/input';
import { CHARS } from './data/content';
import { G } from './game/state';
import { save } from './game/save';
import { startGame, loadLevel } from './game/level';
import { killEnemy } from './game/combat';
import { updateWorld, renderWorld } from './game/world';
import { drawTitle, drawSelect, drawTitleBG } from './render/ui';

G.selIdx = save.sel || 0;
addEventListener('resize', resize); resize();

initInput((gx, gy) => {
  if (G.scene === 'title' && isTouch) goFullscreen();
  if (G.menu) { // tocar numa opção do menu escolhe ela
    const r = (G.menu._rects || []).find((r: any) => gx >= r.x && gx <= r.x + r.w && gy >= r.y && gy <= r.y + r.h);
    if (r) { G.menu.idx = r.i; pressed.Enter = true; }
    return;
  }
  if (G.scene === 'select') {
    if (gy >= 22 && gy <= 94) {
      const i = Math.floor((gx - 14) / 76);
      if (i >= 0 && i < CHARS.length) { if (i === G.selIdx) pressed.Enter = true; else { G.selIdx = i; SFX.blip(); } }
    } else if (gy > 94) pressed.Enter = true;
    return;
  }
  if (G.scene !== 'game' || G.dialog) pressed.Enter = true;
}, () => G.scene === 'game' && !G.menu && !G.dialog);

const portrait = matchMedia('(orientation:portrait) and (pointer:coarse)');
const btnE = document.getElementById('btnE');

function update(rdt: number) {
  if (G.scene === 'title') { G.titleCam += rdt * 18; if (hit('confirm')) { SFX.blip(); G.scene = 'select'; } return; }
  if (G.scene === 'select') {
    const n = CHARS.length;
    if (hit('left')) { G.selIdx = (G.selIdx + n - 1) % n; SFX.blip(); }
    if (hit('right')) { G.selIdx = (G.selIdx + 1) % n; SFX.blip(); }
    if (hit('confirm')) { SFX.blip(); startGame(G.selIdx); }
    if (hit('back')) G.scene = 'title';
    return;
  }
  updateWorld(rdt);
}

function render() {
  ctx.setTransform(SC, 0, 0, SC, 0, 0); ctx.imageSmoothingEnabled = false;
  if (G.scene === 'title') { drawTitleBG(); drawTitle(); return; }
  if (G.scene === 'select') { drawTitleBG(); drawSelect(); return; }
  renderWorld();
}

let last = performance.now();
function frame(now: number) {
  const rdt = Math.min(.05, (now - last) / 1000); last = now; G.time += rdt;
  try { if (!portrait.matches) update(rdt); render(); } catch (err) { console.error(err); }
  btnE?.classList.toggle('hot', !!G.near && G.scene === 'game');
  clearPressed();
  requestAnimationFrame(frame);
}

const fontReady = (document as any).fonts?.load ? (document as any).fonts.load('8px "Press Start 2P"') : Promise.resolve();
fontReady.catch(() => {}).finally(() => requestAnimationFrame(frame));

// Atalho de depuração no console do navegador: window.G
(window as any).G = G;
(window as any).DBG = { loadLevel, killEnemy };
