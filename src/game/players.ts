// Lista de jogadores que os inimigos podem atacar: o jogador local + (no anfitrião) os convidados.
import { G } from './state';
import { ov } from './physics';
import { hurtPlayer } from './combat';
import { NET, toGuest } from '../net/net';

export type Target = { id: string; x: number; y: number; state: string; local: boolean };

export function playerTargets(): Target[] {
  const P = G.P, a: Target[] = [];
  if (P && P.state !== 'dead') a.push({ id: 'me', x: P.x, y: P.y, state: P.state, local: true });
  if (NET.role === 'host') for (const r of NET.remotes.values()) if (r.s !== 'dead') a.push({ id: r.id, x: r.x, y: r.y, state: r.s, local: false });
  return a;
}

export function nearestTarget(x: number, y: number): Target | null {
  let best: Target | null = null, bd = 1e9;
  for (const t of playerTargets()) { const d = Math.abs(t.x - x) + Math.abs(t.y - y) * .5; if (d < bd) { bd = d; best = t; } }
  return best;
}

export const boxOf = (t: Target) => t.state === 'roll' ? { x: t.x - 5, y: t.y - 14, w: 10, h: 14 } : { x: t.x - 5, y: t.y - 24, w: 10, h: 24 };

export function hurtTarget(t: Target, dmg: number, src: any) {
  if (t.local) hurtPlayer(dmg, src);
  else toGuest(t.id, { t: 'hurt', dmg: Math.round(dmg), sx: src ? src.x : t.x, eid: src && src.id != null ? src.id : null });
}

/** Aplica dano a todo jogador dentro da caixa. `set` evita acertar o mesmo jogador duas vezes no mesmo golpe. */
export function hitPlayers(box: any, dmg: number, src: any, set?: Set<string>) {
  let any = false;
  for (const t of playerTargets()) {
    if (set && set.has(t.id)) continue;
    if (ov(box, boxOf(t))) { set?.add(t.id); hurtTarget(t, dmg, src); any = true; }
  }
  return any;
}
