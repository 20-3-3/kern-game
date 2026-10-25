// Адаптивная музыка из слоёв: тихий эмбиент ночного города, ритм-слой боя
// и слой «записи», который громче, когда громче Отпечаток.
// В бою с боссом ритм идёт по долям босса — парирование можно выучить на слух.

import { MUSIC, MUSIC_MIX } from '../data/sounds';
import type { AudioEngine } from './engine';
import { noise, noiseBuffer, tone } from './synth';

/** Гармония по тактам: ля минор — фа — соль — ми. */
const BASS = [55, 55, 43.65, 49, 55, 55, 43.65, 41.2];

export class AdaptiveMusic {
  private ambient!: GainNode;
  private record!: GainNode;
  private shaper!: WaveShaperNode;
  private recordFilter!: BiquadFilterNode;
  private rhythmLevel = 0;
  private rhythmTarget = 0;
  private mode = 'silent';
  private loud = 0.3;
  private lastExternalBeat = -99;
  private internalBeat = 0;
  private nextBeatTime = 0;
  private timer = 0;
  private carTimer = 0;
  private started = false;

  constructor(private e: AudioEngine) {
    e.whenReady(() => this.build());
  }

  private build(): void {
    const ac = this.e.ac!;
    const out = this.e.music;
    // Эмбиент: пэд ля минор и шум далёкого города.
    this.ambient = ac.createGain();
    this.ambient.gain.value = 0;
    this.ambient.connect(out);
    const padFilter = ac.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 520;
    padFilter.connect(this.ambient);
    const lfo = ac.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ac.createGain();
    lfoGain.gain.value = 220;
    lfo.connect(lfoGain).connect(padFilter.frequency);
    lfo.start();
    for (const [f, det] of [[110, -6], [130.8, 5], [164.8, -3], [220, 7]]) {
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      const g = ac.createGain();
      g.gain.value = 0.035;
      o.connect(g).connect(padFilter);
      o.start();
    }
    const city = ac.createBufferSource();
    city.buffer = noiseBuffer(ac);
    city.loop = true;
    const cf = ac.createBiquadFilter();
    cf.type = 'lowpass';
    cf.frequency.value = 260;
    const cg = ac.createGain();
    cg.gain.value = 0.09;
    city.connect(cf).connect(cg).connect(this.ambient);
    city.start();

    // Слой записи: квинта ре–ля, искажение растёт с громкостью, «хор» — узкие полосы шума.
    this.record = ac.createGain();
    this.record.gain.value = 0;
    this.recordFilter = ac.createBiquadFilter();
    this.recordFilter.type = 'lowpass';
    this.recordFilter.frequency.value = 900;
    this.shaper = ac.createWaveShaper();
    this.shaper.curve = distortionCurve(0.2);
    this.shaper.connect(this.recordFilter).connect(this.record).connect(out);
    for (const [f, det] of [[73.4, 0], [110, 4], [146.8, -5]]) {
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      const g = ac.createGain();
      g.gain.value = 0.05;
      o.connect(g).connect(this.shaper);
      o.start();
    }
    for (const f of [620, 980]) {
      const n = ac.createBufferSource();
      n.buffer = noiseBuffer(ac);
      n.loop = true;
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = 14;
      const g = ac.createGain();
      g.gain.value = 0.25;
      const l = ac.createOscillator();
      l.frequency.value = 0.13 + f / 10000;
      const lg = ac.createGain();
      lg.gain.value = 0.2;
      l.connect(lg).connect(g.gain);
      n.connect(bp).connect(g).connect(this.record);
      n.start();
      l.start();
    }
    this.started = true;
    this.applyMix();
  }

  setMode(mode: string): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.applyMix();
  }

  setLoudness(v: number): void {
    this.loud = v;
    if (!this.started) return;
    this.applyMix();
    this.shaper.curve = distortionCurve(0.1 + v * 0.9);
    this.recordFilter.frequency.setTargetAtTime(700 + v * 1800, this.e.now, 0.3);
  }

  private applyMix(): void {
    if (!this.started) return;
    const m = MUSIC_MIX[this.mode] ?? MUSIC_MIX.calm;
    const t = this.e.now;
    this.ambient.gain.setTargetAtTime(m.ambient * MUSIC.master, t, 1.2);
    const rec = m.record * (0.35 + this.loud * 0.9);
    this.record.gain.setTargetAtTime(rec * MUSIC.master, t, 0.8);
    this.rhythmTarget = m.rhythm;
  }

  /** Доля босса: ударные звучат ровно на ней. */
  onExternalBeat(index: number): void {
    this.lastExternalBeat = this.e.now;
    this.playBeat(index, this.e.now + 0.01, 60 / MUSIC.bpm);
  }

  private playBeat(index: number, t: number, beatLen: number): void {
    const lvl = this.rhythmLevel;
    if (lvl < 0.02) return;
    const inBar = index % 4;
    const bar = Math.floor(index / 4);
    const e = this.e;
    if (inBar === 0 || inBar === 2) e.play('kick', undefined, lvl, t);
    if (inBar === 1 || inBar === 3) e.play('snare', undefined, lvl, t);
    e.play('hat', undefined, lvl * 0.8, t);
    e.play('hat', undefined, lvl * 0.5, t + beatLen / 2);
    const ac = e.ac!;
    tone(ac, e.music, t, BASS[bar % BASS.length], beatLen * 0.8, 0.22 * lvl * MUSIC.master, 'triangle', { lowpass: 320 });
    // В слое записи — колокол в начале каждых четырёх тактов.
    if (index % 16 === 0 && (MUSIC_MIX[this.mode]?.record ?? 0) > 0) {
      tone(ac, e.music, t, 146.8, 2.5, 0.12 * MUSIC.master, 'sine');
      tone(ac, e.music, t, 405, 1.2, 0.05 * MUSIC.master, 'sine');
    }
  }

  /** Вызывать каждый кадр: собственный такт, если босс не задаёт доли. */
  update(dt: number): void {
    if (!this.started) return;
    this.rhythmLevel += (this.rhythmTarget - this.rhythmLevel) * Math.min(1, dt * 1.5);
    const e = this.e;
    const now = e.now;
    const beatLen = 60 / MUSIC.bpm;
    const external = now - this.lastExternalBeat < beatLen * 2;
    if (!external && this.rhythmLevel > 0.02) {
      if (this.nextBeatTime < now) this.nextBeatTime = now + 0.05;
      // Планируем на 150 мс вперёд — так ритм ровный даже при просадке кадров.
      while (this.nextBeatTime < now + 0.15) {
        this.playBeat(this.internalBeat++, this.nextBeatTime, beatLen);
        this.nextBeatTime += beatLen;
      }
    } else if (external) {
      this.nextBeatTime = 0;
    }
    // Изредка — далёкая машина по ночному проспекту.
    this.timer += dt;
    this.carTimer -= dt;
    if (this.carTimer <= 0) {
      this.carTimer = 8 + Math.random() * 10;
      const m = MUSIC_MIX[this.mode];
      if (m && m.ambient > 0.3 && this.mode !== 'home') {
        noise(e.ac!, e.music, now, 3, 0.05 * MUSIC.master, 'bandpass', 300, { q: 2, toFreq: 900, attack: 1.4 });
      }
    }
  }
}

const curves = new Map<number, Float32Array>();
const distortionCurve = (amount: number): Float32Array => {
  const key = Math.round(amount * 20);
  let c = curves.get(key);
  if (c) return c;
  const k = key * 8;
  const n = 512;
  c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    c[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
  }
  curves.set(key, c);
  return c;
};
