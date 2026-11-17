// Tela, resolução interna e helpers de desenho em pixel.
export const W = 480, H = 270, GY = 230; // GY = altura do chão
export const cv = document.getElementById('c') as HTMLCanvasElement;
export const ctx = cv.getContext('2d') as CanvasRenderingContext2D;
cv.width = W; cv.height = H;

export function resize() {
  const s = Math.min(innerWidth / W, innerHeight / H);
  const k = s >= 2 ? Math.floor(s) : s;
  cv.style.width = W * k + 'px';
  cv.style.height = H * k + 'px';
}

export const FONT = '"Press Start 2P", monospace';

export function R(c: string, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = c; ctx.fillRect(x, y, w, h);
}

export function txt(s: string, x: number, y: number, size = 8, color = '#e8dcc0', align: CanvasTextAlign = 'left', shadow = true) {
  ctx.font = size + 'px ' + FONT; ctx.textAlign = align; ctx.textBaseline = 'top';
  if (shadow) { ctx.fillStyle = 'rgba(0,0,0,.85)'; ctx.fillText(s, x + 1, y + 1); }
  ctx.fillStyle = color; ctx.fillText(s, x, y);
}

export function wrap(s: string, maxW: number, size = 8): string[] {
  ctx.font = size + 'px ' + FONT;
  const out: string[] = [];
  for (const para of s.split('\n')) {
    let cur = '';
    for (const w of para.split(' ')) {
      const t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t;
    }
    out.push(cur);
  }
  return out;
}

export function panel(x: number, y: number, w: number, h: number) {
  R('rgba(8,6,12,.92)', x, y, w, h);
  R('#6a5a3a', x, y, w, 1); R('#6a5a3a', x, y + h - 1, w, 1); R('#6a5a3a', x, y, 1, h); R('#6a5a3a', x + w - 1, y, 1, h);
  R('#a08a5a', x + 2, y + 2, 3, 1); R('#a08a5a', x + w - 5, y + 2, 3, 1);
}

export function bar(x: number, y: number, w: number, h: number, v: number, max: number, c: string, lag?: number) {
  const f = (n: number) => Math.round(w * Math.max(0, Math.min(1, n / max)));
  R('#000', x - 1, y - 1, w + 2, h + 2); R('#2a1a1a', x, y, w, h);
  if (lag != null) R('#d8b060', x, y, f(lag), h);
  R(c, x, y, f(v), h); R('rgba(255,255,255,.18)', x, y, f(v), 1);
}
