// Звуковой движок: шины (эффекты, музыка, голос), звук в пространстве,
// эффект заедания — повтор последнего фрагмента, как скачок иглы на пластинке.

import { SOUNDS } from '../data/sounds';
import { SYNTHS } from './synth';

interface Listener {
  x: number;
  z: number;
  yaw: number;
}

export class AudioEngine {
  ac: AudioContext | null = null;
  master!: GainNode;
  sfx!: GainNode;
  music!: GainNode;
  voice!: GainNode;
  /** Узлы эффекта заедания. */
  private dry!: GainNode;
  private wet!: GainNode;
  private delay!: DelayNode;
  private feedback!: GainNode;
  private muffle!: BiquadFilterNode;
  private files = new Map<string, AudioBuffer>();
  private listener: Listener = { x: 0, z: 0, yaw: 0 };
  private volumes = { master: 0.8, music: 0.7 };
  private onReady: (() => void)[] = [];

  /** Браузер разрешает звук только после действия игрока: вызывать на клик/клавишу. */
  unlock(): void {
    // iPhone: звук игры идёт и при включённом беззвучном режиме (iOS 17+).
    try {
      const nav = navigator as Navigator & { audioSession?: { type: string } };
      if (nav.audioSession && nav.audioSession.type !== 'playback') nav.audioSession.type = 'playback';
    } catch {
      // Старые браузеры — без этого.
    }
    if (this.ac) {
      if (this.ac.state === 'suspended') void this.ac.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ac = new AC({ latencyHint: 'interactive' });
    this.ac = ac;
    // Старый приём для iOS: короткий тихий звук «будит» аудио после касания.
    try {
      const b = ac.createBuffer(1, 1, 22050);
      const src = ac.createBufferSource();
      src.buffer = b;
      src.connect(ac.destination);
      src.start(0);
      if (ac.state === 'suspended') void ac.resume();
    } catch {
      // ничего
    }
    this.master = ac.createGain();
    this.master.gain.value = this.volumes.master;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ac.destination);

    // Цепочка: всё → muffle → (dry | delay с обратной связью) → master.
    const pre = ac.createGain();
    this.muffle = ac.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.frequency.value = 20000;
    this.dry = ac.createGain();
    this.wet = ac.createGain();
    this.wet.gain.value = 0;
    this.delay = ac.createDelay(1);
    this.delay.delayTime.value = 0.09;
    this.feedback = ac.createGain();
    this.feedback.gain.value = 0;
    pre.connect(this.muffle);
    this.muffle.connect(this.dry).connect(this.master);
    this.muffle.connect(this.delay);
    this.delay.connect(this.feedback).connect(this.delay);
    this.delay.connect(this.wet).connect(this.master);

    this.sfx = ac.createGain();
    this.music = ac.createGain();
    this.music.gain.value = this.volumes.music;
    this.voice = ac.createGain();
    this.sfx.connect(pre);
    this.music.connect(pre);
    this.voice.connect(pre);
    void this.loadFiles();
    this.onReady.forEach((f) => f());
    this.onReady = [];
  }

  /** Выполнить, когда звук будет разрешён. */
  whenReady(f: () => void): void {
    if (this.ac) f();
    else this.onReady.push(f);
  }

  get now(): number {
    return this.ac?.currentTime ?? 0;
  }

  setVolumes(master: number, music: number): void {
    this.volumes = { master, music };
    if (!this.ac) return;
    this.master.gain.setTargetAtTime(master, this.ac.currentTime, 0.05);
    this.music.gain.setTargetAtTime(music, this.ac.currentTime, 0.05);
  }

  setListener(x: number, z: number, yaw: number): void {
    this.listener = { x, z, yaw };
  }

  /** Подгрузка файлов из реестра (если они прописаны). */
  private async loadFiles(): Promise<void> {
    const ac = this.ac!;
    await Promise.all(
      Object.entries(SOUNDS)
        .filter(([, d]) => d.file)
        .map(async ([id, d]) => {
          try {
            const res = await fetch(`${import.meta.env.BASE_URL}${d.file}`);
            if (!res.ok) return;
            this.files.set(id, await ac.decodeAudioData(await res.arrayBuffer()));
          } catch {
            // Нет файла — остаётся синтез.
          }
        }),
    );
  }

  /** Сыграть звук из реестра. pos — точка в мире (для громкости и панорамы). */
  play(id: string, pos?: { x: number; z: number }, volMul = 1, at?: number): void {
    const ac = this.ac;
    if (!ac || ac.state !== 'running') return;
    const def = SOUNDS[id];
    if (!def) return;
    const bus = def.bus === 'music' ? this.music : def.bus === 'voice' ? this.voice : this.sfx;
    let out: AudioNode = bus;
    let vol = def.volume * volMul;
    if (def.spatial && pos) {
      const dx = pos.x - this.listener.x;
      const dz = pos.z - this.listener.z;
      const d = Math.hypot(dx, dz);
      vol *= 1 / (1 + d / 10);
      if (vol < 0.01) return;
      const pan = ac.createStereoPanner();
      // Камера смотрит вдоль yaw; правее — положительная панорама.
      const ang = Math.atan2(dx, dz) - this.listener.yaw;
      pan.pan.value = Math.max(-0.8, Math.min(0.8, -Math.sin(ang)));
      pan.connect(bus);
      out = pan;
    }
    const t = at ?? ac.currentTime + 0.005;
    const buf = this.files.get(id);
    if (buf) {
      const src = ac.createBufferSource();
      src.buffer = buf;
      const g = ac.createGain();
      g.gain.value = vol;
      src.connect(g).connect(out);
      src.start(t);
      return;
    }
    SYNTHS[def.synth]?.(ac, out, t, vol);
  }

  /** «Скачок иглы»: последние ~90 мс звука повторяются, живой звук на миг пропадает. */
  stutter(duration: number, slice = 0.09): void {
    const ac = this.ac;
    if (!ac) return;
    const t = ac.currentTime;
    this.delay.delayTime.setValueAtTime(slice, t);
    this.feedback.gain.cancelScheduledValues(t);
    this.wet.gain.cancelScheduledValues(t);
    this.dry.gain.cancelScheduledValues(t);
    this.feedback.gain.setValueAtTime(0.92, t);
    this.wet.gain.setValueAtTime(1, t);
    this.dry.gain.setValueAtTime(0.05, t);
    this.feedback.gain.setValueAtTime(0, t + duration);
    this.wet.gain.setTargetAtTime(0, t + duration, 0.03);
    this.dry.gain.setTargetAtTime(1, t + duration, 0.02);
  }

  /** Приглушить всё (датчик «Тишина», пауза). 1 — без приглушения. */
  setMuffle(amount: number): void {
    if (!this.ac) return;
    const f = 20000 * Math.pow(1 - Math.min(0.95, amount), 3) + 400;
    this.muffle.frequency.setTargetAtTime(f, this.ac.currentTime, 0.15);
  }

  suspend(on: boolean): void {
    if (!this.ac) return;
    if (on) void this.ac.suspend();
    else void this.ac.resume();
  }
}
