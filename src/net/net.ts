// Modo online cooperativo, sem servidor: conexão direta entre os navegadores (WebRTC via PeerJS).
//
// - O ANFITRIÃO cria a sala (código de 4 letras) e é a "autoridade": simula inimigos, chefe e projéteis
//   e manda o estado do mundo ~15 vezes por segundo.
// - Os CONVIDADOS controlam o próprio personagem localmente (resposta imediata), mandam posição/pose e
//   avisam o anfitrião quando acertam um inimigo. O anfitrião aplica o dano e avisa quando um inimigo
//   acerta um convidado.
// - A sinalização inicial usa o servidor público gratuito do PeerJS; depois disso o tráfego é direto.
import { Peer, DataConnection } from 'peerjs';
import { CHARS } from '../data/content';
import { G, addText, burst } from '../game/state';

export const NET: any = {
  role: 'solo', // solo | host | guest
  code: '', status: '', peer: null as Peer | null, conns: new Map<string, DataConnection>(), host: null as DataConnection | null,
  remotes: new Map<string, any>(), myId: '', sendT: 0, hooks: {} as any,
};
const PREFIX = 'lenda6-sala-';
const ALPH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const RATE = 1 / 15;
const MAX_GUESTS = 5;

export const online = () => NET.role !== 'solo';
export const isHost = () => NET.role === 'host';
export const isGuest = () => NET.role === 'guest';

/** Servidor de sinalização: o público do PeerJS por padrão; ?peer=host:porta usa um próprio (testes ou servidor dedicado). */
function peerOpts(): any {
  const q = new URLSearchParams(location.search).get('peer');
  if (!q) return { debug: 0 };
  const [host, port] = q.split(':');
  return { debug: 0, host, port: Number(port) || 9000, path: '/', secure: location.protocol === 'https:' && host !== 'localhost' };
}

function genCode() { let s = ''; for (let i = 0; i < 4; i++) s += ALPH[Math.floor(Math.random() * ALPH.length)]; return s; }
export function inviteLink() { return location.href.split('#')[0] + '#sala-' + NET.code; }

function note(text: string, t = 4) { G.netMsg = { text, t }; }

export function hostRoom(tries = 0) {
  leave(); NET.role = 'host'; NET.status = 'Criando sala...'; NET.myId = 'host';
  const code = genCode(), peer = new Peer(PREFIX + code, peerOpts());
  NET.peer = peer; NET.code = code;
  peer.on('open', () => { NET.status = ''; G.banner = { text: 'SALA ' + code, sub: 'Passe o código ou o convite pros amigos (pausa)', t: 0, dur: 5, color: '#9fd8ff' }; });
  peer.on('connection', c => {
    c.on('open', () => {
      if (NET.conns.size >= MAX_GUESTS) { c.send({ t: 'full' }); setTimeout(() => c.close(), 400); return; }
      NET.conns.set(c.peer, c);
    });
    c.on('data', (m: any) => hostMsg(c, m));
    c.on('close', () => dropGuest(c.peer));
    c.on('error', () => dropGuest(c.peer));
  });
  peer.on('error', (e: any) => {
    if (e.type === 'unavailable-id' && tries < 4) { hostRoom(tries + 1); return; }
    fail('Não deu pra criar a sala (' + e.type + ').');
  });
  peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) { /* ignore */ } });
}

export function joinRoom(code: string) {
  leave(); code = code.toUpperCase().trim();
  NET.role = 'guest'; NET.code = code; NET.status = 'Conectando à sala ' + code + '...';
  const peer = new Peer(peerOpts()); NET.peer = peer;
  peer.on('open', id => {
    NET.myId = id;
    const c = peer.connect(PREFIX + code, { reliable: true }); NET.host = c;
    c.on('open', () => { NET.status = ''; c.send({ t: 'hello', c: G.P?.d.id }); });
    c.on('data', (m: any) => guestMsg(m));
    c.on('close', () => { if (NET.role === 'guest') fail('O anfitrião saiu. Continuando sozinho.'); });
  });
  peer.on('error', (e: any) => fail(e.type === 'peer-unavailable' ? 'Sala ' + code + ' não encontrada.' : 'Erro de conexão (' + e.type + ').'));
  setTimeout(() => { if (NET.role === 'guest' && NET.status) fail('Não consegui entrar na sala ' + code + '.'); }, 15000);
}

export function leave() {
  const was = NET.role;
  if (NET.peer) { try { NET.peer.destroy(); } catch (e) { /* ignore */ } }
  NET.peer = null; NET.conns.clear(); NET.host = null; NET.remotes.clear(); NET.role = 'solo'; NET.code = ''; NET.status = '';
  return was;
}

function fail(msg: string) {
  const wasGuest = NET.role === 'guest';
  leave(); note(msg, 6);
  if (wasGuest && G.P) NET.hooks.backToSolo?.();
}

function dropGuest(id: string) {
  const r = NET.remotes.get(id);
  NET.conns.delete(id); NET.remotes.delete(id);
  if (r) note((CHARS.find(c => c.id === r.c)?.short || 'Alguém') + ' saiu da sala.');
}

// ---------------- envio ----------------
export function toHost(m: any) { if (NET.host?.open) NET.host.send(m); }
export function toGuest(id: string, m: any) { const c = NET.conns.get(id); if (c?.open) c.send(m); }
export function broadcast(m: any) { for (const c of NET.conns.values()) if (c.open) c.send(m); }

const r1 = (v: number) => Math.round(v * 10) / 10;

export function mySnap() {
  const P = G.P;
  return { x: r1(P.x), y: r1(P.y), f: P.face, c: P.d.id, s: P.state, hp: Math.max(0, Math.round(P.hp)), mh: P.maxhp, o: NET.hooks.pose() };
}

/** Chamado todo quadro pelo loop do jogo. */
export function netTick(dt: number) {
  if (NET.role === 'solo') return;
  for (const r of NET.remotes.values()) { // suaviza o movimento dos outros jogadores
    const k = Math.min(1, dt * 14);
    r.x += (r.tx - r.x) * k; r.y += (r.ty - r.y) * k;
  }
  NET.sendT -= dt;
  if (NET.sendT > 0) return;
  NET.sendT = RATE;
  if (NET.role === 'guest') { if (G.P && G.scene !== 'select') toHost({ t: 'p', ...mySnap() }); return; }
  // anfitrião: estado do mundo
  const b = G.boss;
  const pl: any = { host: mySnap() };
  for (const [id, r] of NET.remotes) pl[id] = { x: r1(r.tx), y: r1(r.ty), f: r.f, c: r.c, s: r.s, hp: r.hp, mh: r.mh, o: r.o };
  broadcast({
    t: 's', lv: G.L.id, ar: G.arenaOn ? 1 : 0, pl,
    en: G.enemies.map((e: any) => [e.id, e.type, r1(e.x), r1(e.y), e.face, e.state, r1(e.t * 10) / 10, e.hp, e.maxhp, e.flash > 0 ? 1 : 0, r1(e.alpha), e.vx ? 1 : 0]),
    b: b ? { id: b.id, x: r1(b.x), y: r1(b.y), f: b.face, s: b.state, t: b.t, hp: b.hp, ph: b.phase, mv: b.move, wd: b.wd, rd: b.rd, fl: b.flash > 0 ? 1 : 0, al: b.alpha, og: b.onGround ? 1 : 0 } : null,
    pr: G.projs.filter((p: any) => !p.rep).map((p: any) => [p.type, r1(p.x), r1(p.y), r1(p.vx), r1(p.vy || 0), p.delay || 0, p.owner]),
  });
}

// ---------------- mensagens ----------------
function hostMsg(c: DataConnection, m: any) {
  switch (m.t) {
    case 'hello': {
      const name = CHARS.find(ch => ch.id === m.c)?.short || '???';
      NET.remotes.set(c.peer, { id: c.peer, c: m.c, x: G.P.x, y: G.P.y, tx: G.P.x, ty: G.P.y, f: 1, s: 'idle', hp: 1, mh: 1, o: {} });
      c.send({ t: 'welcome', lv: G.L.id, code: NET.code });
      note(name + ' entrou na sala!'); burst(G.P.x, G.P.y - 20, '#9fd8ff', 10, 60, 0);
      break;
    }
    case 'p': {
      const r = NET.remotes.get(c.peer); if (!r) return;
      r.tx = m.x; r.ty = m.y; r.f = m.f; r.s = m.s; r.hp = m.hp; r.mh = m.mh; r.o = m.o; r.c = m.c;
      if (Math.abs(r.x - r.tx) > 80) { r.x = r.tx; r.y = r.ty; }
      break;
    }
    case 'hit': NET.hooks.remoteHit?.(m); break;
    case 'parry': NET.hooks.remoteParry?.(m.eid); break;
  }
}

function guestMsg(m: any) {
  switch (m.t) {
    case 'full': fail('A sala está cheia (máx. 6 jogadores).'); break;
    case 'welcome': note('Você entrou na sala ' + m.code + '!'); NET.hooks.gotoLevel?.(m.lv); break;
    case 'lv': NET.hooks.gotoLevel?.(m.id); break;
    case 's': NET.hooks.applyState?.(m); syncRemotes(m.pl); break;
    case 'hurt': NET.hooks.remoteHurt?.(m); break;
    case 'kill': NET.hooks.shareSouls?.(m); break;
    case 'bossdead': NET.hooks.bossDead?.(); break;
    case 'msg': note(m.text); break;
  }
}

function syncRemotes(pl: any) {
  const seen = new Set<string>();
  for (const id in pl) {
    if (id === NET.myId) continue;
    seen.add(id);
    const s = pl[id]; let r = NET.remotes.get(id);
    if (!r) { r = { id, x: s.x, y: s.y }; NET.remotes.set(id, r); }
    r.tx = s.x; r.ty = s.y; r.f = s.f; r.s = s.s; r.hp = s.hp; r.mh = s.mh; r.o = s.o; r.c = s.c;
    if (Math.abs(r.x - r.tx) > 80) { r.x = r.tx; r.y = r.ty; }
  }
  for (const id of [...NET.remotes.keys()]) if (!seen.has(id)) NET.remotes.delete(id);
}

void addText;
