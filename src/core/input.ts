// Teclado, botões de toque e toque/clique no canvas.
import { audio } from './audio';
import { cv, W, H } from './canvas';

export const keys: Record<string, boolean> = {};
export const pressed: Record<string, boolean> = {};

const BIND = {
  left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
  jump: ['Space', 'KeyW', 'ArrowUp'], roll: ['ShiftLeft', 'ShiftRight'],
  light: ['KeyJ'], heavy: ['KeyK'], special: ['KeyL'], heal: ['KeyQ'], interact: ['KeyE'],
  confirm: ['Enter', 'KeyE', 'Space'], back: ['Escape', 'Backspace'],
};
export type Act = keyof typeof BIND;

export const held = (a: Act) => BIND[a].some(c => keys[c]);
export const hit = (a: Act) => BIND[a].some(c => pressed[c]);
export function clearPressed() { for (const k in pressed) delete pressed[k]; }

export function initInput(onTap: (gx: number, gy: number) => void) {
  addEventListener('keydown', e => {
    audio();
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    if (!keys[e.code]) pressed[e.code] = true;
    keys[e.code] = true;
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  if (matchMedia('(pointer:coarse)').matches) document.getElementById('touch')?.classList.add('on');
  document.querySelectorAll<HTMLElement>('.tb').forEach(b => {
    const k = b.dataset.k!;
    const down = (e: Event) => { e.preventDefault(); audio(); if (!keys[k]) pressed[k] = true; keys[k] = true; b.classList.add('act'); if (k === 'KeyE') pressed.Enter = true; };
    const up = (e: Event) => { e.preventDefault(); keys[k] = false; b.classList.remove('act'); };
    b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
  });
  cv.addEventListener('pointerdown', e => {
    audio();
    const r = cv.getBoundingClientRect();
    onTap((e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H);
  });
}
