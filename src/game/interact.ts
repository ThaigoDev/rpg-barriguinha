// Fogueiras, NPCs, mensagens no chão, portas, portões, elevadores, saída da fase e os menus
// (fogueira, nível, viagem, mapa, pausa).
import { SFX } from '../core/audio';
import { pick } from '../core/math';
import { hit } from '../core/input';
import { LEVELS } from '../data/content';
import { G, addText, burst } from './state';
import { store } from './save';
import { applyStats } from './player';
import { respawnAll, loadLevel, goTo } from './level';
import { prepLevel } from './physics';
import { NET, isGuest, online, leave, inviteLink } from '../net/net';

const near = (a: any, b: any, r: number) => Math.abs(a.x - b.x) < r && Math.abs(a.y - b.y) < 30;

export function findNear() {
  const P = G.P, L = G.L, LS = G.LS;
  if (!P || !P.onGround) return null;
  for (let i = 0; i < L.fires.length; i++) if (near(P, L.fires[i], 22)) return { type: 'fire', i, x: L.fires[i].x, y: L.fires[i].y, label: LS.lit[i] ? 'Descansar' : (L.fires[i].grill ? 'Acender churrasqueira' : 'Acender fogueira') };
  for (let i = 0; i < L.npcs.length; i++) if (near(P, L.npcs[i], 24)) return { type: 'npc', i, x: L.npcs[i].x, y: L.npcs[i].y, label: 'Conversar' };
  for (const d of L.doors) if (near(P, d, 18)) return { type: 'door', d, x: d.x, y: d.y, label: d.label };
  for (const g of L.gates) if (!G.S.opened[L.id + ':' + g.id] && Math.abs(P.x - g.x) < 18 && P.y > g.top) return { type: 'gate', g, x: g.x, y: g.y, label: 'Portão' };
  for (const l of G.lifts) if (Math.abs(P.x - (l.x + l.w / 2)) < l.w / 2 + 4 && Math.abs(P.y - l.y) < 2) return { type: 'lift', l, x: l.x + l.w / 2, y: l.y, label: 'Usar elevador' };
  for (const m of L.msgs) if (near(P, m, 14)) return { type: 'msg', m, x: m.x, y: m.y, label: 'Ler mensagem' };
  if (L.exit && LS.bossDead && near(P, L.exit, 22)) return { type: 'exit', x: L.exit.x, y: L.exit.y, label: L.exit.label };
  return null;
}

export function interact(n: any) {
  const P = G.P, LS = G.LS, L = G.L, S = G.S;
  if (n.type === 'fire') {
    if (G.enemies.some((e: any) => e.state !== 'idle' && e.state !== 'dead' && Math.abs(e.x - P.x) < 180)) { addText(P.x, P.y - 36, 'Inimigos por perto!', '#ff8060'); return; }
    if (!LS.lit[n.i]) {
      LS.lit[n.i] = true; LS.fire = n.i; S.rest = { lv: L.id, fire: n.i }; store(); SFX.bonfire();
      const grill = L.fires[n.i].grill;
      G.banner = { text: grill ? 'CHURRASQUEIRA ACESA' : 'FOGUEIRA ACESA', sub: grill ? 'Carne no ponto. Pode descansar.' : 'Bora um churrasquinho?', t: 0, dur: 3, color: '#ffb060' };
      return;
    }
    bonfireMenu(n.i);
  } else if (n.type === 'npc') {
    const npc = L.npcs[n.i], key = L.id + ':' + n.i, talked = G.npcTalked[key];
    G.dialog = { who: npc.name, lines: talked ? [pick(npc.more)] : npc.intro.slice(), i: 0 };
    G.npcTalked[key] = true;
  } else if (n.type === 'msg') G.dialog = { who: 'MENSAGEM NO CHÃO', lines: [n.m.text], i: 0 };
  else if (n.type === 'door') {
    const d = n.d;
    if (d.lock && !S.opened[d.lock]) { G.dialog = { who: d.label.toUpperCase(), lines: [d.lockedText || 'Trancado. Parece que abre pelo outro lado.'], i: 0 }; SFX.block(); return; }
    if (d.opens && !S.opened[d.opens]) { S.opened[d.opens] = true; store(); G.banner = { text: 'ATALHO ABERTO', sub: d.openText || 'Agora dá pra passar pelos dois lados.', t: 0, dur: 3, color: '#ffe0a0' }; }
    if (isGuest()) { addText(P.x, P.y - 36, 'Só o anfitrião muda de área', '#9fd8ff'); return; }
    goTo(d.to, d.toX, d.toY);
  } else if (n.type === 'gate') {
    const g = n.g, side = P.x < g.x ? 'left' : 'right';
    if (side !== g.opens) { G.dialog = { who: 'PORTÃO', lines: ['Trancado por dentro. Não abre por este lado.'], i: 0 }; SFX.block(); return; }
    S.opened[L.id + ':' + g.id] = true; store(); SFX.slam(); burst(g.x, g.y - 20, '#c8c8d0', 10, 60);
    G.banner = { text: 'ATALHO ABERTO', sub: 'O portão vai ficar aberto.', t: 0, dur: 2.6, color: '#ffe0a0' };
  } else if (n.type === 'lift') {
    const l = n.l; if (l.moving) return;
    l.moving = l.y <= l.yTop + 1 ? 1 : -1; SFX.slam();
  } else if (n.type === 'exit') {
    if (L.exit.to && isGuest()) { addText(P.x, P.y - 36, 'Só o anfitrião pode seguir viagem', '#9fd8ff'); return; }
    if (L.exit.to) { loadLevel(L.exit.to, 0); return; }
    G.dialog = { who: 'CAMINHO BLOQUEADO', lines: ['Uma névoa densa cobre a passagem. Esse capítulo ainda está sendo escrito... (em breve)'], i: 0 };
  }
  SFX.blip();
}

/** Elevadores: andam sozinhos quando alguém pisa, levando quem está em cima. */
export function updateLifts(dt: number) {
  for (const l of G.lifts || []) {
    const P = G.P, onIt = P.plat === l || (P.onGround && P.x > l.x - 2 && P.x < l.x + l.w + 2 && Math.abs(P.y - l.y) < 1);
    if (!l.moving && onIt && P.state !== 'dead') { l.t += dt; if (l.t > .6) { l.moving = l.y <= l.yTop + 1 ? 1 : -1; SFX.slam(); } } else if (!onIt) l.t = 0;
    if (l.moving) {
      const ny = l.y + l.moving * 60 * dt, target = l.moving > 0 ? l.yBot : l.yTop;
      const done = l.moving > 0 ? ny >= target : ny <= target;
      const y2 = done ? target : ny;
      if (onIt) { P.y = y2; P.vy = 0; }
      l.y = y2;
      if (done) { l.moving = 0; l.t = -1; G.S.lifts[G.L.id + ':' + l.id] = l.y === l.yBot ? 'bot' : 'top'; store(); }
    }
  }
}

export const levelCost = () => 60 + G.S.lv * 40;

function bonfireMenu(i: number) {
  const opts: any[] = [
    { label: 'Descansar', fn: () => { G.LS.fire = i; G.S.rest = { lv: G.L.id, fire: i }; respawnAll(); store(); G.menu = null; addText(G.P.x, G.P.y - 36, 'DESCANSOU', '#ffd08a'); SFX.bonfire(); } },
    { label: 'Subir de nível', fn: () => { G.menu = levelMenu(G.menu); } },
  ];
  if (!isGuest() && travelTargets().length) opts.push({ label: 'Viajar', fn: () => { G.menu = travelMenu(G.menu); } });
  opts.push({ label: 'Mapa', fn: () => { G.map = true; } });
  opts.push({ label: 'Sair', fn: () => { G.menu = null; } });
  G.menu = { title: G.L.fires[i].name, idx: 0, opts, fire: true };
}

function levelMenu(parent: any) {
  const S = G.S;
  const m: any = { title: 'SUBIR DE NÍVEL', parent, idx: 0, level: true, msg: '', opts: [] };
  const up = (k: string, lb: () => string) => ({
    get label() { return lb(); },
    fn: () => {
      const c = levelCost();
      if (S.souls < c) { m.msg = 'Almas insuficientes!'; SFX.hurt(); return; }
      S.souls -= c; S[k]++; S.lv++; applyStats(G.P); G.P.hp = G.P.maxhp; G.P.hpLag = G.P.hp; G.P.st = G.P.maxst; store(); SFX.souls();
      m.msg = 'Subiu para o nível ' + S.lv + '!';
    },
  });
  m.opts = [
    up('vida', () => 'VIDA   ' + S.vida + '  (+10 HP)'),
    up('vigor', () => 'VIGOR  ' + S.vigor + '  (+10 stamina)'),
    up('forca', () => 'FORÇA  ' + S.forca + '  (+8% dano)'),
    { label: 'Voltar', fn: () => { G.menu = parent; } },
  ];
  return m;
}

/** Pode viajar para qualquer fogueira acesa de uma área já visitada. */
function travelTargets() {
  const out: { id: string; fire: number; label: string }[] = [];
  for (const id in LEVELS) {
    const ls = G.S.levels[id]; if (!ls || !G.S.visited?.[id] && id !== 'vila') continue;
    const L = prepLevel(LEVELS[id]);
    (ls.lit || []).forEach((lit: boolean, i: number) => { if (lit && L.fires[i] && !(id === G.L.id)) out.push({ id, fire: i, label: L.fires[i].name }); });
  }
  return out;
}
function travelMenu(parent: any) {
  const opts: any[] = travelTargets().map(t => ({ label: t.label, fn: () => { G.S.rest = { lv: t.id, fire: t.fire }; loadLevel(t.id, t.fire); SFX.bonfire(); } }));
  opts.push({ label: 'Voltar', fn: () => { G.menu = parent; } });
  return { title: 'VIAJAR', parent, idx: 0, opts, wide: true };
}

export function pauseMenu() {
  const opts: any[] = [{ label: 'Continuar', fn: () => { G.menu = null; } }, { label: 'Mapa', fn: () => { G.map = true; } }];
  if (online()) {
    opts.push({ label: 'Copiar convite (sala ' + NET.code + ')', fn: () => copyInvite() });
    opts.push({ label: 'Sair da sala', fn: () => { const g = isGuest(); leave(); G.menu = null; if (g) NET.hooks.backToSolo?.(); G.netMsg = { text: 'Você saiu da sala.', t: 3 }; } });
  }
  opts.push({ label: 'Trocar personagem', fn: () => { store(); leave(); G.menu = null; G.scene = 'select'; } });
  G.menu = { title: 'PAUSADO', idx: 0, pause: true, opts };
}

function copyInvite() {
  const link = inviteLink();
  const done = (ok: boolean) => { G.netMsg = { text: ok ? 'Convite copiado! Cole no zap dos amigos.' : 'Código da sala: ' + NET.code, t: 4 }; };
  try { navigator.clipboard.writeText(link).then(() => done(true), () => done(false)); } catch (e) { done(false); }
}

export function updateMenu() {
  if (G.map) { if (hit('back') || hit('confirm')) G.map = false; return; }
  const m = G.menu;
  if (hit('up')) { m.idx = (m.idx + m.opts.length - 1) % m.opts.length; SFX.blip(); }
  if (hit('down')) { m.idx = (m.idx + 1) % m.opts.length; SFX.blip(); }
  if (hit('confirm')) { SFX.blip(); m.opts[m.idx].fn(); return; }
  if (hit('back')) G.menu = m.parent || null;
}
