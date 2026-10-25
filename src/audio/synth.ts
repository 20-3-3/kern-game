// Синтез звуков кодом (пока нет файлов). Каждая функция ставит в очередь звук
// на время t и подключает его к выходу out.

export type Synth = (ac: AudioContext, out: AudioNode, t: number, vol: number) => void;

let noiseBuf: AudioBuffer | null = null;
export const noiseBuffer = (ac: AudioContext): AudioBuffer => {
  if (noiseBuf && noiseBuf.sampleRate === ac.sampleRate) return noiseBuf;
  const len = ac.sampleRate * 2;
  const b = ac.createBuffer(1, len, ac.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  noiseBuf = b;
  return b;
};

const EPS = 0.0001;

/** Огибающая: быстрая атака и спад. */
const env = (ac: AudioContext, out: AudioNode, t: number, peak: number, attack: number, decay: number): GainNode => {
  const g = ac.createGain();
  g.gain.setValueAtTime(EPS, t);
  g.gain.exponentialRampToValueAtTime(Math.max(EPS, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(EPS, t + attack + decay);
  g.connect(out);
  return g;
};

export const tone = (
  ac: AudioContext,
  out: AudioNode,
  t: number,
  freq: number,
  dur: number,
  vol: number,
  type: OscillatorType = 'sine',
  opts: { attack?: number; toFreq?: number; detune?: number; lowpass?: number } = {},
): void => {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (opts.toFreq) o.frequency.exponentialRampToValueAtTime(Math.max(1, opts.toFreq), t + dur);
  if (opts.detune) o.detune.setValueAtTime(opts.detune, t);
  let node: AudioNode = o;
  if (opts.lowpass) {
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(opts.lowpass, t);
    o.connect(f);
    node = f;
  }
  node.connect(env(ac, out, t, vol, opts.attack ?? 0.005, dur));
  o.start(t);
  o.stop(t + dur + (opts.attack ?? 0.005) + 0.05);
};

export const noise = (
  ac: AudioContext,
  out: AudioNode,
  t: number,
  dur: number,
  vol: number,
  filter: BiquadFilterType,
  freq: number,
  opts: { q?: number; toFreq?: number; attack?: number } = {},
): void => {
  const s = ac.createBufferSource();
  s.buffer = noiseBuffer(ac);
  s.loop = true;
  const f = ac.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(freq, t);
  if (opts.toFreq) f.frequency.exponentialRampToValueAtTime(opts.toFreq, t + dur);
  f.Q.value = opts.q ?? 1;
  s.connect(f);
  f.connect(env(ac, out, t, vol, opts.attack ?? 0.003, dur));
  s.start(t, Math.random() * 1.5);
  s.stop(t + dur + (opts.attack ?? 0.003) + 0.05);
};

/** Металлический звон: набор негармонических обертонов. */
const bell = (ac: AudioContext, out: AudioNode, t: number, base: number, dur: number, vol: number, ratios = [1, 2.76, 5.4, 8.93]) => {
  ratios.forEach((r, i) => tone(ac, out, t, base * r, dur / (1 + i * 0.6), vol / (1 + i * 1.4), 'sine'));
};

// ---------- Реестр синтезированных звуков ----------

export const SYNTHS: Record<string, Synth> = {
  kick: (ac, o, t, v) => tone(ac, o, t, 130, 0.22, v, 'sine', { toFreq: 42 }),
  snare: (ac, o, t, v) => {
    noise(ac, o, t, 0.14, v * 0.7, 'bandpass', 1900, { q: 0.8 });
    tone(ac, o, t, 190, 0.08, v * 0.5, 'triangle');
  },
  hat: (ac, o, t, v) => noise(ac, o, t, 0.035, v * 0.35, 'highpass', 7500),
  bass: (ac, o, t, v) => tone(ac, o, t, 55, 0.28, v * 0.6, 'triangle', { lowpass: 300 }),

  // Предупреждение удара босса: сухой щелчок в такт.
  bossWarn: (ac, o, t, v) => {
    tone(ac, o, t, 1500, 0.035, v * 0.6, 'square', { lowpass: 3500 });
    noise(ac, o, t, 0.03, v * 0.5, 'bandpass', 3200, { q: 3 });
  },
  bossWarnHeavy: (ac, o, t, v) => {
    bell(ac, o, t, 196, 0.9, v * 0.7);
    tone(ac, o, t, 98, 0.5, v * 0.5, 'triangle');
  },
  bossSwing: (ac, o, t, v) => noise(ac, o, t, 0.28, v * 0.8, 'bandpass', 500, { q: 1.5, toFreq: 1800 }),
  slam: (ac, o, t, v) => {
    tone(ac, o, t, 70, 0.7, v, 'sine', { toFreq: 28 });
    noise(ac, o, t, 0.8, v * 0.8, 'lowpass', 900, { toFreq: 120 });
  },

  swing: (ac, o, t, v) => noise(ac, o, t, 0.16, v * 0.9, 'bandpass', 900, { q: 1.2, toFreq: 3200 }),
  whiff: (ac, o, t, v) => noise(ac, o, t, 0.2, v * 0.35, 'bandpass', 600, { q: 1.5, toFreq: 1500 }),
  dash: (ac, o, t, v) => noise(ac, o, t, 0.22, v * 0.45, 'highpass', 900, { toFreq: 4000 }),
  dodge: (ac, o, t, v) => {
    noise(ac, o, t, 0.25, v * 0.4, 'highpass', 2000, { toFreq: 6000 });
    tone(ac, o, t, 1200, 0.25, v * 0.15, 'sine', { toFreq: 2400 });
  },
  kernHit: (ac, o, t, v) => {
    bell(ac, o, t, 660 + Math.random() * 80, 0.45, v * 0.55, [1, 1.5, 2.01, 3.03]);
    noise(ac, o, t, 0.05, v * 0.5, 'highpass', 3000);
  },
  bagHit: (ac, o, t, v) => {
    noise(ac, o, t, 0.12, v * 0.9, 'lowpass', 500);
    tone(ac, o, t, 95, 0.12, v * 0.6, 'sine', { toFreq: 60 });
  },
  throw: (ac, o, t, v) => {
    noise(ac, o, t, 0.3, v * 0.9, 'lowpass', 400);
    tone(ac, o, t, 70, 0.3, v * 0.7, 'sine', { toFreq: 35 });
  },
  parry: (ac, o, t, v) => {
    tone(ac, o, t, 1568, 0.7, v * 0.5, 'sine');
    tone(ac, o, t, 2349, 0.5, v * 0.3, 'sine');
    tone(ac, o, t, 3136, 0.3, v * 0.15, 'sine');
    noise(ac, o, t, 0.04, v * 0.6, 'highpass', 4000);
  },
  block: (ac, o, t, v) => {
    tone(ac, o, t, 280, 0.12, v * 0.5, 'square', { lowpass: 1200 });
    noise(ac, o, t, 0.08, v * 0.4, 'bandpass', 1500);
  },
  hurt: (ac, o, t, v) => {
    tone(ac, o, t, 110, 0.2, v * 0.8, 'sawtooth', { toFreq: 60, lowpass: 600 });
    noise(ac, o, t, 0.15, v * 0.5, 'lowpass', 1200);
  },

  tuningFork: (ac, o, t, v) => {
    tone(ac, o, t, 440, 2.6, v * 0.45, 'sine', { attack: 0.01 });
    tone(ac, o, t, 441.5, 2.6, v * 0.35, 'sine', { attack: 0.01 });
  },
  forkStrike: (ac, o, t, v) => {
    noise(ac, o, t, 0.06, v, 'highpass', 2500);
    tone(ac, o, t, 440, 4.5, v * 0.6, 'sine');
    tone(ac, o, t, 442, 4.5, v * 0.5, 'sine');
    tone(ac, o, t, 880, 2.5, v * 0.25, 'sine');
    tone(ac, o, t + 0.05, 110, 3.5, v * 0.35, 'sawtooth', { lowpass: 400, attack: 0.8 });
  },
  enemyWindupHuman: (ac, o, t, v) => tone(ac, o, t, 880, 0.35, v * 0.25, 'sine'),
  enemyWindupImprint: (ac, o, t, v) => noise(ac, o, t, 0.35, v * 0.35, 'bandpass', 400, { q: 4, toFreq: 1600, attack: 0.15 }),

  recordRise: (ac, o, t, v) => {
    tone(ac, o, t, 55, 3.5, v * 0.5, 'sawtooth', { attack: 1.5, lowpass: 500, toFreq: 73 });
    [220, 277, 330].forEach((f, i) => tone(ac, o, t + i * 0.2, f, 3, v * 0.12, 'sawtooth', { attack: 1.2, lowpass: 900 }));
    noise(ac, o, t, 3.5, v * 0.25, 'bandpass', 700, { q: 6, attack: 1.5 });
  },
  kernWake: (ac, o, t, v) => {
    [587, 740, 880, 1175, 1480].forEach((f, i) => tone(ac, o, t + i * 0.09, f, 1.4, v * 0.25, 'sine'));
    noise(ac, o, t, 1.2, v * 0.2, 'highpass', 6000, { attack: 0.3 });
  },
  horn: (ac, o, t, v) => {
    const osc = ac.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(174, t);
    osc.frequency.exponentialRampToValueAtTime(196, t + 0.25);
    const lfo = ac.createOscillator();
    lfo.frequency.value = 5.5;
    const lg = ac.createGain();
    lg.gain.value = 3;
    lfo.connect(lg).connect(osc.frequency);
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1300;
    osc.connect(f).connect(env(ac, o, t, v * 0.45, 0.15, 1.8));
    osc.start(t);
    lfo.start(t);
    osc.stop(t + 2.1);
    lfo.stop(t + 2.1);
  },
  imprintSpawn: (ac, o, t, v) => {
    noise(ac, o, t, 0.9, v * 0.3, 'bandpass', 300, { q: 3, toFreq: 1400, attack: 0.6 });
    tone(ac, o, t, 330, 0.9, v * 0.15, 'sine', { attack: 0.6, toFreq: 495 });
  },
  ask: (ac, o, t, v) => {
    [147, 220, 294].forEach((f) => tone(ac, o, t, f, 2.2, v * 0.12, 'sawtooth', { attack: 0.4, lowpass: 700 }));
    noise(ac, o, t, 2, v * 0.12, 'bandpass', 900, { q: 8, attack: 0.5 });
  },
  askFar: (ac, o, t, v) => [147, 220].forEach((f) => tone(ac, o, t, f, 2.5, v * 0.05, 'sawtooth', { attack: 0.8, lowpass: 400 })),
  phaseBreak: (ac, o, t, v) => {
    noise(ac, o, t, 0.4, v * 0.8, 'highpass', 3000, { toFreq: 800 });
    tone(ac, o, t, 1400, 0.9, v * 0.4, 'sine', { toFreq: 300 });
    tone(ac, o, t, 73, 0.9, v * 0.6, 'sine');
  },
  cutoff: (ac, o, t, v) => {
    const osc = ac.createOscillator();
    osc.frequency.value = 1760;
    const trem = ac.createOscillator();
    trem.frequency.value = 9;
    const tg = ac.createGain();
    tg.gain.value = 0.4;
    const g = ac.createGain();
    g.gain.setValueAtTime(EPS, t);
    g.gain.exponentialRampToValueAtTime(v * 0.18, t + 0.5);
    g.gain.setValueAtTime(v * 0.18, t + 4.5);
    g.gain.exponentialRampToValueAtTime(EPS, t + 5.2);
    trem.connect(tg).connect(g.gain);
    osc.connect(g).connect(o);
    osc.start(t);
    trem.start(t);
    osc.stop(t + 5.3);
    trem.stop(t + 5.3);
    tone(ac, o, t, 73.4, 5, v * 0.3, 'sawtooth', { attack: 0.5, lowpass: 300 });
  },
  lastNoteStart: (ac, o, t, v) => noise(ac, o, t, 1.2, v * 0.6, 'bandpass', 200, { q: 2, toFreq: 4000, attack: 1.1 }),
  lastNote: (ac, o, t, v) => {
    [293.66, 369.99, 440, 587.33, 739.99].forEach((f, i) => tone(ac, o, t + i * 0.03, f, 6.5, v * 0.2, i % 2 ? 'triangle' : 'sine', { attack: 0.05 }));
    tone(ac, o, t, 73.4, 6, v * 0.35, 'sine');
    noise(ac, o, t, 2.5, v * 0.25, 'highpass', 5000, { attack: 0.02 });
  },
  killed: (ac, o, t, v) => {
    noise(ac, o, t, 0.5, v, 'lowpass', 5000, { toFreq: 200 });
    tone(ac, o, t, 900, 0.4, v * 0.4, 'square', { toFreq: 40 });
  },
  silence: (ac, o, t, v) => {
    noise(ac, o, t, 0.6, v * 0.4, 'lowpass', 2000, { toFreq: 200 });
    tone(ac, o, t, 520, 0.8, v * 0.2, 'sine', { toFreq: 260 });
  },
  accord: (ac, o, t, v) => {
    [220, 277.2, 329.6, 440, 554.4].forEach((f) => tone(ac, o, t, f, 1.6, v * 0.22, 'sawtooth', { lowpass: 2400 }));
    tone(ac, o, t, 55, 1.2, v * 0.6, 'sine', { toFreq: 40 });
    noise(ac, o, t, 0.6, v * 0.5, 'lowpass', 3000, { toFreq: 300 });
  },
  skip: (ac, o, t, v) => noise(ac, o, t, 0.02, v * 0.9, 'highpass', 1500),
  replay: (ac, o, t, v) => {
    tone(ac, o, t, 800, 0.5, v * 0.3, 'sawtooth', { toFreq: 120, lowpass: 2000 });
    noise(ac, o, t, 0.5, v * 0.3, 'bandpass', 1200, { toFreq: 300 });
  },
  nikaVoice: (ac, o, t, v) => {
    tone(ac, o, t, 1320, 0.07, v * 0.25, 'sine');
    tone(ac, o, t + 0.09, 1760, 0.09, v * 0.25, 'sine');
  },

  hop: (ac, o, t, v) => {
    noise(ac, o, t, 0.18, v * 0.3, 'highpass', 1500, { toFreq: 4000 });
    tone(ac, o, t, 300, 0.15, v * 0.2, 'sine', { toFreq: 600 });
  },
  cone: (ac, o, t, v) => {
    tone(ac, o, t, 620, 0.08, v * 0.4, 'square', { lowpass: 1500 });
    noise(ac, o, t, 0.1, v * 0.4, 'bandpass', 1200);
  },
  crash: (ac, o, t, v) => {
    noise(ac, o, t, 0.9, v, 'lowpass', 2500, { toFreq: 200 });
    bell(ac, o, t, 230, 0.6, v * 0.4);
  },
  brake: (ac, o, t, v) => tone(ac, o, t, 1300, 0.9, v * 0.18, 'sawtooth', { lowpass: 2500, toFreq: 1000 }),
  push: (ac, o, t, v) => {
    tone(ac, o, t, 1046, 0.12, v * 0.25, 'sine');
    tone(ac, o, t + 0.11, 1568, 0.2, v * 0.25, 'sine');
  },
  stream: (ac, o, t, v) => tone(ac, o, t, 700, 0.06, v * 0.15, 'triangle'),
  cassette: (ac, o, t, v) => {
    noise(ac, o, t, 0.05, v * 0.6, 'bandpass', 2000);
    noise(ac, o, t + 0.1, 7.5, v * 0.08, 'bandpass', 4000, { q: 0.5, attack: 0.3 });
    tone(ac, o, t + 0.1, 50, 7.5, v * 0.05, 'sine', { attack: 0.3 });
  },
  cassetteStop: (ac, o, t, v) => noise(ac, o, t, 0.06, v * 0.6, 'bandpass', 1800),
  uiClick: (ac, o, t, v) => tone(ac, o, t, 900, 0.04, v * 0.2, 'triangle'),
};
