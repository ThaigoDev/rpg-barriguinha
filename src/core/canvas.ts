// Tela, resolução interna e helpers de desenho em pixel.
// A altura é fixa (270); a largura acompanha o formato da janela para a tela ficar cheia, sem faixas pretas.
export let W = 480;
export const H = 270, GY = 230; // GY = altura do chão (unidades do mundo)
/** Muda sempre que a largura lógica muda (quem guarda coisas do tamanho da tela usa isso para refazer). */
export let screenVer = 0;
export const SC = 2; // a tela tem o dobro de pixels: o mundo é 480x270, os sprites e cenários têm 960x540
export const cv = document.getElementById('c') as HTMLCanvasElement;
export const ctx = cv.getContext('2d') as CanvasRenderingContext2D;
cv.width = W * SC; cv.height = H * SC;

function wantW() {
  const vw = Math.max(1, innerWidth), vh = Math.max(1, innerHeight);
  return Math.max(320, Math.min(800, Math.round(H * vw / vh / 2) * 2));
}
function fit() {
  // ocupa a janela inteira; só sobra borda em formatos extremos (mais estreito que 4:3 ou mais largo que ~3:1)
  const s = Math.min(innerWidth / (W * SC), innerHeight / (H * SC));
  let w = W * SC * s, h = H * SC * s;
  // diferença de arredondamento (menos de 1%): estica para não sobrar 1 pixel preto na borda
  if (innerWidth - w < innerWidth * .01) w = innerWidth;
  if (innerHeight - h < innerHeight * .01) h = innerHeight;
  cv.style.width = Math.round(w) + 'px';
  cv.style.height = Math.round(h) + 'px';
}
function applyW(w: number) {
  if (w === W) return;
  W = w; cv.width = W * SC; cv.height = H * SC; screenVer++;
  ctx.imageSmoothingEnabled = false;
}
let rzT: any = 0;
export function resize() {
  const w = wantW();
  if (!screenVer) { applyW(w); screenVer = Math.max(1, screenVer); fit(); return; }
  fit();
  // espera a janela parar de mudar antes de refazer os cenários (são caros de gerar)
  clearTimeout(rzT); rzT = setTimeout(() => { applyW(wantW()); fit(); }, 160);
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
