// Fogueiras, NPCs, mensagens no chão, saída da fase e os menus (fogueira, nível, viagem, pausa).
import { SFX } from '../core/audio';
import { pick } from '../core/math';
import { hit } from '../core/input';
import { LEVELS, LEVEL_ORDER } from '../data/content';
import { G, addText } from './state';
import { store } from './save';
import { applyStats } from './player';
import { respawnAll, loadLevel } from './level';

export function findNear() {
  const P = G.P, L = G.L, LS = G.LS;
  if (!P || !P.onGround) return null;
  for (let i = 0; i < L.fires.length; i++) if (Math.abs(P.x - L.fires[i].x) < 22) return { type: 'fire', i, x: L.fires[i].x, label: LS.lit[i] ? 'Descansar' : 'Acender fogueira' };
  if (L.npc && Math.abs(P.x - L.npc.x) < 24) return { type: 'npc', x: L.npc.x, label: 'Conversar' };
  for (const m of L.msgs) if (Math.abs(P.x - m.x) < 14) return { type: 'msg', m, x: m.x, label: 'Ler mensagem' };
  if (L.exit && LS.bossDead && Math.abs(P.x - L.exit.x) < 22) return { type: 'exit', x: L.exit.x, label: L.exit.label };
  return null;
}

export function interact(n: any) {
  const P = G.P, LS = G.LS, L = G.L;
  if (n.type === 'fire') {
    if (G.enemies.some((e: any) => e.state !== 'idle' && e.state !== 'dead' && Math.abs(e.x - P.x) < 180)) { addText(P.x, P.y - 36, 'Inimigos por perto!', '#ff8060'); return; }
    if (!LS.lit[n.i]) { LS.lit[n.i] = true; LS.fire = n.i; store(); SFX.bonfire(); G.banner = { text: 'FOGUEIRA ACESA', sub: 'Bora um churrasquinho?', t: 0, dur: 3, color: '#ffb060' }; return; }
    bonfireMenu(n.i);
  } else if (n.type === 'npc') {
    const talked = G.npcTalked[L.id];
    G.dialog = { who: L.npc.name, lines: talked ? [pick(L.npc.more)] : L.npc.intro.slice(), i: 0 };
    G.npcTalked[L.id] = true;
  } else if (n.type === 'msg') G.dialog = { who: 'MENSAGEM NO CHÃO', lines: [n.m.text], i: 0 };
  else if (n.type === 'exit') {
    if (L.exit.to) { loadLevel(L.exit.to, 0); return; }
    G.dialog = { who: 'CAMINHO BLOQUEADO', lines: ['Uma névoa densa cobre a passagem. Esse capítulo ainda está sendo escrito... (em breve)'], i: 0 };
  }
  SFX.blip();
}

export const levelCost = () => 60 + G.S.lv * 40;

function unlocked(id: string) {
  const i = LEVEL_ORDER.indexOf(id);
  if (i <= 0) return true;
  const prev = G.S.levels[LEVEL_ORDER[i - 1]];
  return !!(prev && prev.bossDead);
}

function bonfireMenu(i: number) {
  const opts: any[] = [
    { label: 'Descansar', fn: () => { G.LS.fire = i; respawnAll(); store(); G.menu = null; addText(G.P.x, G.P.y - 36, 'DESCANSOU', '#ffd08a'); SFX.bonfire(); } },
    { label: 'Subir de nível', fn: () => { G.menu = levelMenu(G.menu); } },
  ];
  if (LEVEL_ORDER.filter(unlocked).length > 1) opts.push({ label: 'Viajar', fn: () => { G.menu = travelMenu(G.menu); } });
  opts.push({ label: 'Sair', fn: () => { G.menu = null; } });
  G.menu = { title: G.L.fires[i].name, idx: 0, opts };
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

function travelMenu(parent: any) {
  const opts: any[] = LEVEL_ORDER.filter(id => unlocked(id) && id !== G.L.id).map(id => ({
    label: LEVELS[id].name,
    fn: () => { const ls = G.S.levels[id]; loadLevel(id, ls ? ls.fire : 0); SFX.bonfire(); },
  }));
  opts.push({ label: 'Voltar', fn: () => { G.menu = parent; } });
  return { title: 'VIAJAR', parent, idx: 0, opts };
}

export function pauseMenu() {
  G.menu = {
    title: 'PAUSADO', idx: 0, pause: true, opts: [
      { label: 'Continuar', fn: () => { G.menu = null; } },
      { label: 'Trocar personagem', fn: () => { store(); G.menu = null; G.scene = 'select'; } },
    ],
  };
}

export function updateMenu() {
  const m = G.menu;
  if (hit('up')) { m.idx = (m.idx + m.opts.length - 1) % m.opts.length; SFX.blip(); }
  if (hit('down')) { m.idx = (m.idx + 1) % m.opts.length; SFX.blip(); }
  if (hit('confirm')) { SFX.blip(); m.opts[m.idx].fn(); return; }
  if (hit('back')) G.menu = m.parent || null;
}
