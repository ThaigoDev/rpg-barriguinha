// Efeitos sonoros sintetizados (sem arquivos de áudio).
let AC: AudioContext | null = null;
let NB: AudioBuffer | null = null;

export function audio() {
  if (!AC) { try { AC = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch (e) { /* sem áudio */ } }
  if (AC && AC.state === 'suspended') AC.resume();
}

export function tone(f: number, d: number, type: OscillatorType = 'square', v = .08, f2?: number) {
  if (!AC) return;
  const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
  o.connect(g).connect(AC.destination); o.start(t); o.stop(t + d + .02);
}

export function noise(d: number, v = .1, fq = 1200, type: BiquadFilterType = 'lowpass') {
  if (!AC) return;
  if (!NB) {
    NB = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const a = NB.getChannelData(0);
    for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1;
  }
  const t = AC.currentTime, s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = NB; f.type = type; f.frequency.value = fq;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
  s.connect(f).connect(g).connect(AC.destination); s.start(t); s.stop(t + d + .02);
}

export const SFX: Record<string, () => void> = {
  swing: () => noise(.12, .12, 2500, 'highpass'),
  heavy: () => noise(.25, .16, 900),
  hit: () => { tone(180, .12, 'square', .06, 60); noise(.08, .1, 3000); },
  hurt: () => tone(140, .25, 'sawtooth', .08, 50),
  roll: () => noise(.2, .06, 600),
  parry: () => { tone(1400, .25, 'triangle', .08, 900); tone(2100, .2, 'sine', .05); },
  block: () => { tone(700, .1, 'square', .05, 400); noise(.08, .08, 4000, 'highpass'); },
  die: () => tone(300, 1.2, 'sawtooth', .08, 40),
  slam: () => { noise(.5, .25, 300); tone(80, .4, 'sine', .15, 30); },
  fire: () => { noise(.3, .12, 1500, 'bandpass'); tone(300, .3, 'sawtooth', .03, 600); },
  heal: () => tone(400, .4, 'sine', .07, 900),
  souls: () => { tone(880, .12, 'sine', .05); setTimeout(() => tone(1320, .15, 'sine', .05), 70); },
  blip: () => tone(660, .05, 'square', .04),
  bonfire: () => { noise(.8, .08, 700); tone(220, .8, 'sine', .05, 440); },
  bark: () => { tone(500, .08, 'square', .05, 300); setTimeout(() => tone(520, .08, 'square', .05, 280), 110); },
  howl: () => tone(380, .9, 'sine', .06, 620),
  arrow: () => { noise(.15, .1, 3500, 'highpass'); tone(900, .1, 'triangle', .03, 500); },
  throw: () => { noise(.1, .1, 4500, 'highpass'); },
  boss: () => { tone(55, 1.5, 'sawtooth', .12, 40); noise(1, .1, 200); },
  curse: () => { tone(200, .6, 'sawtooth', .06, 90); tone(203, .6, 'sawtooth', .06, 92); },
  victory: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, .5, 'triangle', .07), i * 160)),
};
