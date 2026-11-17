export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp(t, 0, 1);
export const ease = (t: number) => { t = clamp(t, 0, 1); return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
export const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

/** Escolhe um item de uma lista com campo `w` (peso). */
export function weighted<T extends { w?: number }>(a: T[]): T {
  const total = a.reduce((s, x) => s + (x.w ?? 1), 0);
  let r = Math.random() * total;
  for (const x of a) { r -= x.w ?? 1; if (r <= 0) return x; }
  return a[a.length - 1];
}

/** Gerador pseudo-aleatório com semente (cenários sempre iguais). */
export function rng(a: number) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
