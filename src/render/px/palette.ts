// Rampas de cor (do mais escuro ao mais claro). Cada material do motor de pixel art aponta para uma rampa.
// rampFrom() gera uma rampa a partir de uma cor base, puxando as sombras para o azul/roxo e as luzes para o
// amarelo, como na pixel art feita à mão.

export const RAMP_COLS: Uint32Array[] = [new Uint32Array(1)];
export const RAMP_EMIS: boolean[] = [false];
const keyMap = new Map<string, number>();

export function hexToRgb(h: string): [number, number, number] {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const pack = (r: number, g: number, b: number, a = 255) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
export const packHex = (h: string) => { const [r, g, b] = hexToRgb(h); return pack(r, g, b); };

export function ramp(key: string, hexes: string[], emissive = false): number {
  const k = keyMap.get(key);
  if (k !== undefined) return k;
  const id = RAMP_COLS.length;
  RAMP_COLS.push(Uint32Array.from(hexes.map(packHex)));
  RAMP_EMIS.push(emissive);
  keyMap.set(key, id);
  return id;
}

function rgb2hsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60;
  }
  return [h, s, l];
}
function hsl2hex(h: number, s: number, l: number) {
  h = ((h % 360) + 360) % 360;
  const f = (n: number) => { const k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  const to = (x: number) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0');
  return '#' + to(f(0)) + to(f(8)) + to(f(4));
}
function hueToward(h: number, target: number, amt: number) {
  let d = ((target - h + 540) % 360) - 180;
  return h + d * amt;
}

export function rampFrom(hex: string, n = 6, opts: { emissive?: boolean; spread?: number; shift?: number } = {}): number {
  const key = 'f:' + hex + ':' + n + ':' + (opts.emissive ? 'e' : '') + (opts.spread || '') + ':' + (opts.shift ?? '');
  const k = keyMap.get(key);
  if (k !== undefined) return k;
  const [r, g, b] = hexToRgb(hex);
  const [h0, s0, l0] = rgb2hsl(r, g, b);
  const spread = opts.spread ?? (opts.emissive ? .7 : .55);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? .5 : i / (n - 1);
    const l = Math.max(.025, Math.min(.96, l0 + (t - .58) * spread));
    let h = h0;
    const sh = opts.shift ?? .22;
    if (t < .58) h = hueToward(h0, 235, (.58 - t) / .58 * sh);
    else h = hueToward(h0, 48, (t - .58) / .42 * .14);
    const s = Math.min(1, s0 * (.8 + .35 * (1 - Math.abs(t - .55) * 1.6)) * (t < .3 ? .8 : 1));
    out.push(hsl2hex(h, s, l));
  }
  return ramp(key, out, !!opts.emissive);
}

// Rampas fixas usadas por várias coisas (metais, madeira, brasa...)
export const C = {
  outline: pack(6, 6, 12),
  white: pack(255, 255, 255),
  steel: ramp('steel', ['#0e1119', '#1b212d', '#2b3343', '#424e63', '#62718a', '#8d9db6', '#c3cfe0']),
  dsteel: ramp('dsteel', ['#040508', '#090b10', '#10131a', '#181c24', '#22272f', '#2f343e', '#434852', '#5e626a']),
  blade: ramp('blade', ['#252c3a', '#434d60', '#6c7990', '#9eabbf', '#d2dbe8', '#ffffff']),
  rust: ramp('rust', ['#1a120c', '#33231a', '#4e3626', '#6b4c36', '#8a6a4e', '#a88a6a']),
  gold: ramp('gold', ['#24160a', '#462c10', '#704c18', '#9c7228', '#c89e44', '#ecd488']),
  silver: ramp('silver', ['#2a2e38', '#4a505e', '#767e8e', '#a8aebb', '#d8dce4', '#ffffff']),
  wood: ramp('wood', ['#120a06', '#21140c', '#352113', '#4d311d', '#674329', '#825a38']),
  leather: ramp('leather', ['#100b09', '#1e140e', '#321f15', '#47301f', '#5f412b']),
  ember: ramp('ember', ['#3a0e05', '#7a2208', '#bf4410', '#ec7420', '#ffab46', '#ffe4a0'], true),
  purple: ramp('purple', ['#22083e', '#42167a', '#7034b6', '#a266e0', '#d6b0ff'], true),
  cyanE: ramp('cyanE', ['#08302e', '#106a64', '#24aaa0', '#64e4d4', '#c8fff4'], true),
  redE: ramp('redE', ['#3a0004', '#7a0810', '#c41c1c', '#ff4c44', '#ffb0a0'], true),
  bone: ramp('bone', ['#2e2a22', '#5c5646', '#8c8572', '#bab29c', '#ddd7c4', '#f8f4e8']),
  wax: ramp('wax', ['#3a3026', '#6a5a44', '#9a8a6a', '#c8b890', '#e8dcb8', '#fff6dc']),
  dark: ramp('dark', ['#030305', '#07070c', '#0c0d14']),
};
