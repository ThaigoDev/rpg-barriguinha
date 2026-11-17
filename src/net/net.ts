// Modo online cooperativo.
//
// Transporte: um retransmissor MQTT público via WebSocket seguro (wss). Todos os jogadores se conectam
// ao mesmo "broker" e trocam mensagens por tópicos da sala. Funciona em qualquer rede (4G, Wi-Fi de
// empresa, etc.), sem conexão direta entre aparelhos, sem servidor próprio e sem conta.
//
// - O ANFITRIÃO cria a sala (código de 4 letras) e é a "autoridade": simula inimigos, chefe e projéteis
//   e manda o estado do mundo ~15 vezes por segundo.
// - Os CONVIDADOS controlam o próprio personagem localmente (resposta imediata), mandam posição/pose e
//   avisam o anfitrião quando acertam um inimigo. O anfitrião aplica o dano e avisa quando um inimigo
//   acerta um convidado.
import mqtt from 'mqtt';
import { CHARS } from '../data/content';
import { G, addText, burst } from '../game/state';

export const NET: any = {
  role: 'solo', // solo | host | guest
  code: '', status: '', client: null as any, broker: 0, gen: 0,
  guests: new Map<string, number>(), // id do convidado -> último contato (anfitrião)
  remotes: new Map<string, any>(), myId: '', sendT: 0, lastHost: 0, welcomed: false, hooks: {} as any,
};
const ROOT = 'lenda6/v1/';
const ALPH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const RATE = 1 / 15;
const MAX_GUESTS = 5;
// brokers públicos gratuitos (o primeiro que funcionar). ?mqtt=wss://... na URL usa um próprio.
const BROKERS = (() => {
  const q = new URLSearchParams(location.search).get('mqtt');
  return q ? [q] : ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081'];
})();

export const online = () => NET.role !== 'solo';
export const isHost = () => NET.role === 'host';
export const isGuest = () => NET.role === 'guest';

function genCode() { let s = ''; for (let i = 0; i < 4; i++) s += ALPH[Math.floor(Math.random() * ALPH.length)]; return s; }
function genId() { return Math.random().toString(36).slice(2, 10); }
export function inviteLink() { return location.href.split('#')[0] + '#sala-' + NET.code; }

function note(text: string, t = 4) { G.netMsg = { text, t }; }
const T = (sub: string) => ROOT + NET.code + '/' + sub;

/** Conecta no broker de índice i; se falhar, tenta o próximo. */
function connect(i: number, onReady: () => void, onFail: (why: string) => void) {
  if (i >= BROKERS.length) { onFail('sem conexão com o servidor de salas'); return; }
  const gen = ++NET.gen;
  NET.broker = i;
  let done = false;
  const c = mqtt.connect(BROKERS[i], { clientId: 'l6_' + NET.myId, clean: true, connectTimeout: 6000, reconnectPeriod: 2000, keepalive: 20 });
  NET.client = c;
  const timer = setTimeout(() => { if (!done && gen === NET.gen) { done = true; try { c.end(true); } catch (e) { /* */ } connect(i + 1, onReady, onFail); } }, 7000);
  c.on('connect', () => { if (done || gen !== NET.gen) return; done = true; clearTimeout(timer); onReady(); });
  c.on('error', () => { /* o timeout cuida de trocar de broker */ });
  c.on('message', (topic: string, payload: Uint8Array) => {
    if (gen !== NET.gen) return;
    let m: any; try { m = JSON.parse(new TextDecoder().decode(payload)); } catch (e) { return; }
    if (NET.role === 'host') hostMsg(m.from, m);
    else if (NET.role === 'guest') guestMsg(m);
  });
}

export function hostRoom() {
  leave(); NET.role = 'host'; NET.status = 'Criando sala...'; NET.myId = 'host_' + genId();
  NET.code = genCode();
  connect(0, () => {
    NET.client.subscribe(T('h'), { qos: 0 });
    NET.status = '';
    G.banner = { text: 'SALA ' + NET.code, sub: 'Passe o código ou o convite pros amigos (pausa)', t: 0, dur: 5, color: '#9fd8ff' };
  }, why => fail('Não deu pra criar a sala: ' + why + '.'));
}

export function joinRoom(code: string) {
  leave(); code = code.toUpperCase().trim();
  NET.role = 'guest'; NET.code = code; NET.myId = genId(); NET.welcomed = false;
  tryJoin(0);
}
function tryJoin(i: number) {
  NET.status = 'Procurando a sala ' + NET.code + '...';
  connect(i, () => {
    NET.client.subscribe([T('all'), T('g/' + NET.myId)], { qos: 0 });
    const hello = () => toHost({ t: 'hello', c: G.P?.d.id });
    hello();
    let tries = 0;
    const iv = setInterval(() => {
      if (NET.role !== 'guest' || NET.welcomed) { clearInterval(iv); return; }
      if (++tries < 8) { hello(); return; }
      clearInterval(iv);
      // ninguém respondeu neste broker: tenta o próximo (o anfitrião pode estar em outro)
      if (NET.broker + 1 < BROKERS.length) { try { NET.client.end(true); } catch (e) { /* */ } tryJoin(NET.broker + 1); }
      else fail('Sala ' + NET.code + ' não encontrada.');
    }, 700);
  }, why => fail('Não consegui entrar: ' + why + '.'));
}

export function leave() {
  const was = NET.role;
  if (NET.client) {
    try { if (NET.role === 'guest') toHost({ t: 'bye' }); else if (NET.role === 'host') broadcast({ t: 'closed' }); } catch (e) { /* */ }
    const c = NET.client; setTimeout(() => { try { c.end(true); } catch (e) { /* */ } }, 150);
  }
  NET.gen++; NET.client = null; NET.guests.clear(); NET.remotes.clear(); NET.role = 'solo'; NET.code = ''; NET.status = ''; NET.welcomed = false;
  return was;
}

function fail(msg: string) {
  const wasGuest = NET.role === 'guest';
  leave(); note(msg, 6);
  if (wasGuest && G.P) NET.hooks.backToSolo?.();
}

function dropGuest(id: string) {
  const r = NET.remotes.get(id);
  NET.guests.delete(id); NET.remotes.delete(id);
  if (r) note((CHARS.find(c => c.id === r.c)?.short || 'Alguém') + ' saiu da sala.');
}

// ---------------- envio ----------------
function pub(topic: string, m: any) { if (NET.client?.connected) NET.client.publish(topic, JSON.stringify(m), { qos: 0 }); }
export function toHost(m: any) { if (NET.role === 'guest') pub(T('h'), { ...m, from: NET.myId }); }
export function toGuest(id: string, m: any) { pub(T('g/' + id), m); }
export function broadcast(m: any) { if (NET.role === 'host') pub(T('all'), m); }

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
  const now = performance.now();
  if (NET.role === 'guest') {
    if (NET.welcomed && now - NET.lastHost > 8000) { fail('Perdi a conexão com o anfitrião. Continuando sozinho.'); return; }
    if (G.P && G.scene !== 'select' && NET.welcomed) toHost({ t: 'p', ...mySnap() });
    return;
  }
  for (const [id, last] of NET.guests) if (now - last > 8000) dropGuest(id);
  if (!NET.client?.connected) return;
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
function hostMsg(from: string, m: any) {
  if (!from) return;
  if (m.t !== 'hello' && !NET.guests.has(from)) return;
  NET.guests.set(from, performance.now());
  switch (m.t) {
    case 'hello': {
      if (!NET.remotes.has(from)) {
        if (NET.remotes.size >= MAX_GUESTS) { toGuest(from, { t: 'full' }); NET.guests.delete(from); return; }
        const name = CHARS.find(ch => ch.id === m.c)?.short || '???';
        NET.remotes.set(from, { id: from, c: m.c, x: G.P.x, y: G.P.y, tx: G.P.x, ty: G.P.y, f: 1, s: 'idle', hp: 1, mh: 1, o: {} });
        note(name + ' entrou na sala!'); burst(G.P.x, G.P.y - 20, '#9fd8ff', 10, 60, 0);
      }
      toGuest(from, { t: 'welcome', lv: G.L.id, code: NET.code });
      break;
    }
    case 'p': {
      const r = NET.remotes.get(from); if (!r) return;
      r.tx = m.x; r.ty = m.y; r.f = m.f; r.s = m.s; r.hp = m.hp; r.mh = m.mh; r.o = m.o; r.c = m.c;
      if (Math.abs(r.x - r.tx) > 80) { r.x = r.tx; r.y = r.ty; }
      break;
    }
    case 'hit': NET.hooks.remoteHit?.(m); break;
    case 'parry': NET.hooks.remoteParry?.(m.eid); break;
    case 'bye': dropGuest(from); break;
  }
}

function guestMsg(m: any) {
  NET.lastHost = performance.now();
  switch (m.t) {
    case 'full': fail('A sala está cheia (máx. 6 jogadores).'); break;
    case 'welcome': if (!NET.welcomed) { NET.welcomed = true; NET.status = ''; note('Você entrou na sala ' + m.code + '!'); NET.hooks.gotoLevel?.(m.lv); } break;
    case 'closed': fail('O anfitrião fechou a sala. Continuando sozinho.'); break;
    case 'lv': NET.hooks.gotoLevel?.(m.id); break;
    case 's': if (!NET.welcomed) return; NET.hooks.applyState?.(m); syncRemotes(m.pl); break;
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
