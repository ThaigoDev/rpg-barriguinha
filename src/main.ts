// A Lenda dos Seis: ponto de entrada. Loop principal e cenas de título/seleção.
import { ctx, resize, SC } from './core/canvas';
import { SFX } from './core/audio';
import { hit, pressed, clearPressed, initInput, isTouch, goFullscreen } from './core/input';
import { CHARS } from './data/content';
import { G } from './game/state';
import { save } from './game/save';
import { startGame, loadLevel } from './game/level';
import './game/coop';
import { hostRoom, joinRoom, NET } from './net/net';
import { updateMenu } from './game/interact';
import { drawMenu } from './render/ui';
import { killEnemy } from './game/combat';
import { updateWorld, renderWorld } from './game/world';
import { drawTitle, drawSelect, drawTitleBG } from './render/ui';

G.selIdx = save.sel || 0;
const inv = /^#sala-([A-Za-z0-9]{4})$/.exec(location.hash);
if (inv) G.invite = inv[1].toUpperCase();

// ---- caixa de digitar o código da sala ----
const jb = document.getElementById('joinBox')!, jc = document.getElementById('joinCode') as HTMLInputElement, je = document.getElementById('joinErr')!;
let joinCb: ((code: string | null) => void) | null = null;
function askCode(cb: (code: string | null) => void) {
  joinCb = cb; je.textContent = ''; jc.value = ''; jb.classList.add('on'); setTimeout(() => jc.focus(), 50);
}
function closeJoin(code: string | null) { jb.classList.remove('on'); jc.blur(); const cb = joinCb; joinCb = null; cb?.(code); }
document.getElementById('joinOk')!.addEventListener('click', () => {
  const c = jc.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (c.length !== 4) { je.textContent = 'O código tem 4 letras/números'; return; }
  closeJoin(c);
});
document.getElementById('joinCancel')!.addEventListener('click', () => closeJoin(null));
jc.addEventListener('keydown', e => { if (e.key === 'Enter') (document.getElementById('joinOk') as HTMLButtonElement).click(); if (e.key === 'Escape') closeJoin(null); });

function modeMenu(ci: number) {
  const opts: any[] = [];
  if (G.invite) opts.push({ label: 'Entrar na sala ' + G.invite + ' (convite)', fn: () => { const c = G.invite; G.invite = null; G.menu = null; startOnline(ci, c); } });
  opts.push(
    { label: 'Jogar sozinho', fn: () => { G.menu = null; startGame(ci); } },
    { label: 'Criar sala online', fn: () => { G.menu = null; startGame(ci); hostRoom(); } },
    { label: 'Entrar numa sala', fn: () => { G.menu = null; askCode(c => { if (c) startOnline(ci, c); }); } },
    { label: 'Voltar', fn: () => { G.menu = null; } },
  );
  G.menu = { title: CHARS[ci].short + ': COMO JOGAR?', sub: 'Online: cooperativo, até 6 amigos', idx: 0, wide: true, opts };
}
function startOnline(ci: number, code: string) { joinRoom(code); startGame(ci); }

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
    if (jb.classList.contains('on')) return;
    if (G.menu) { updateMenu(); return; }
    const n = CHARS.length;
    if (hit('left')) { G.selIdx = (G.selIdx + n - 1) % n; SFX.blip(); }
    if (hit('right')) { G.selIdx = (G.selIdx + 1) % n; SFX.blip(); }
    if (hit('confirm')) { SFX.blip(); modeMenu(G.selIdx); }
    if (hit('back')) G.scene = 'title';
    return;
  }
  updateWorld(rdt);
}

function render() {
  ctx.setTransform(SC, 0, 0, SC, 0, 0); ctx.imageSmoothingEnabled = false;
  if (G.scene === 'title') { drawTitleBG(); drawTitle(); return; }
  if (G.scene === 'select') { drawTitleBG(); drawSelect(); if (G.menu) drawMenu(); return; }
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
(window as any).DBG = { loadLevel, killEnemy, NET };
