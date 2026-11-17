// Teclado, controles de toque (analógico + botões) e toque/clique no canvas.
import { audio } from './audio';
import { cv, W, H } from './canvas';
import { applyButtonIcons } from '../render/icons';

export const keys: Record<string, boolean> = {};
export const pressed: Record<string, boolean> = {};
export const isTouch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;

const BIND = {
  left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW', 'StickUp'], down: ['ArrowDown', 'KeyS'],
  jump: ['Space', 'KeyW', 'ArrowUp'], roll: ['ShiftLeft', 'ShiftRight'],
  light: ['KeyJ'], heavy: ['KeyK'], special: ['KeyL'], heal: ['KeyQ'], interact: ['KeyE'],
  confirm: ['Enter', 'KeyE', 'Space'], back: ['Escape', 'Backspace'],
};
export type Act = keyof typeof BIND;

export const held = (a: Act) => BIND[a].some(c => keys[c]);
export const hit = (a: Act) => BIND[a].some(c => pressed[c]);
export function clearPressed() { for (const k in pressed) delete pressed[k]; }
function setKey(k: string, v: boolean) { if (v && !keys[k]) pressed[k] = true; keys[k] = v; }

/** Tela cheia + travar na horizontal (funciona no Android; no iPhone, use "Adicionar à Tela de Início"). */
export function goFullscreen() {
  const el: any = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req || document.fullscreenElement) return;
  try {
    const p = req.call(el, { navigationUI: 'hide' });
    if (p && p.then) p.then(() => (screen.orientation as any)?.lock?.('landscape').catch(() => {})).catch(() => {});
  } catch (e) { /* recusado */ }
}

function toCanvas(e: PointerEvent): [number, number] {
  const r = cv.getBoundingClientRect();
  return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H];
}

export function initInput(onTap: (gx: number, gy: number) => void, isPlaying: () => boolean) {
  addEventListener('keydown', e => {
    if (e.target instanceof HTMLInputElement) return;
    audio();
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'F3'].includes(e.code)) e.preventDefault();
    if (!keys[e.code]) pressed[e.code] = true;
    keys[e.code] = true;
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('gesturestart', e => e.preventDefault());

  if (isTouch) document.getElementById('touch')?.classList.add('on');
  applyButtonIcons();

  // botões
  document.querySelectorAll<HTMLElement>('.tb[data-k]').forEach(b => {
    const k = b.dataset.k!;
    const down = (e: PointerEvent) => {
      e.preventDefault(); audio(); b.setPointerCapture?.(e.pointerId);
      setKey(k, true); b.classList.add('act');
      if (k === 'KeyE' || k === 'KeyJ') pressed.Enter = true; // confirmar em menus e diálogos
    };
    const up = (e: PointerEvent) => { e.preventDefault(); keys[k] = false; b.classList.remove('act'); };
    b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
  });
  const fs = document.getElementById('fsBtn');
  if (fs) {
    const can = !!((document.documentElement as any).requestFullscreen || (document.documentElement as any).webkitRequestFullscreen);
    if (!can) fs.style.display = 'none';
    fs.addEventListener('pointerdown', e => { e.preventDefault(); audio(); goFullscreen(); });
  }

  // analógico flutuante: aparece onde o polegar encosta
  const zone = document.getElementById('stickZone'), stick = document.getElementById('stick'), knob = document.getElementById('knob');
  let sid: number | null = null, cx = 0, cy = 0;
  const release = () => {
    sid = null; if (stick) stick.style.display = 'none';
    for (const k of ['ArrowLeft', 'ArrowRight', 'StickUp', 'ArrowDown']) keys[k] = false;
  };
  const move = (e: PointerEvent) => {
    const R = (stick?.offsetWidth || 100) / 2;
    let dx = (e.clientX - cx) / R, dy = (e.clientY - cy) / R;
    const len = Math.hypot(dx, dy); if (len > 1) { dx /= len; dy /= len; }
    if (knob) knob.style.transform = `translate(${dx * R * .7}px,${dy * R * .7}px)`;
    setKey('ArrowLeft', dx < -.32); setKey('ArrowRight', dx > .32);
    setKey('StickUp', dy < -.62); setKey('ArrowDown', dy > .62);
  };
  zone?.addEventListener('pointerdown', e => {
    e.preventDefault(); audio();
    if (!isPlaying()) { const [gx, gy] = toCanvas(e); onTap(gx, gy); return; }
    if (sid !== null) return;
    sid = e.pointerId; zone.setPointerCapture(e.pointerId); cx = e.clientX; cy = e.clientY;
    if (stick) { stick.style.display = 'block'; stick.style.left = cx + 'px'; stick.style.top = cy + 'px'; }
    move(e);
  });
  zone?.addEventListener('pointermove', e => { if (e.pointerId === sid) move(e); });
  zone?.addEventListener('pointerup', e => { if (e.pointerId === sid) release(); });
  zone?.addEventListener('pointercancel', e => { if (e.pointerId === sid) release(); });

  cv.addEventListener('pointerdown', e => { audio(); const [gx, gy] = toCanvas(e); onTap(gx, gy); });
}
