// «Заедание»: если игрок повторяет одну и ту же связку приёмов, мир начинает заедать.
// ~50% — враги ускоряются и кадр «перескакивает», 100% — последние 3 секунды ввода
// проигрываются заново без участия игрока. Пока заедание высокое, Аккорд не заряжается.

import { JAM } from '../data/balance';

export type JamLevel = 'calm' | 'high' | 'max';

export type JamEvent = { type: 'level'; level: JamLevel } | { type: 'skip'; strength: number } | { type: 'replay' };

export class JamMeter {
  value = 0;
  private history: string[] = [];
  private links: string[] = [];
  private idle = 0;
  private skipTimer = 0;
  private levelNow: JamLevel = 'calm';
  /** Накопленные значения для среднего за главу. */
  private integral = 0;
  private time = 0;
  private peak = 0;
  private pendingReplay = false;

  constructor(private cfg = JAM) {}

  get level(): JamLevel {
    return this.levelNow;
  }

  get high(): boolean {
    return this.value >= this.cfg.highThreshold;
  }

  /** Множитель скорости врагов. */
  get enemySpeedMul(): number {
    const c = this.cfg;
    if (this.value < c.highThreshold) return 1;
    const k = (this.value - c.highThreshold) / (c.maxThreshold - c.highThreshold);
    return 1 + Math.min(1, k) * (c.enemySpeedMax - 1);
  }

  /** Записать действие игрока в историю. */
  record(action: string): void {
    const c = this.cfg;
    this.idle = 0;
    this.history.push(action);
    if (this.history.length > c.historySize) this.history.shift();
    if (this.history.length >= c.linkLength) {
      const link = this.history.slice(-c.linkLength).join('>');
      const repeats = this.links.filter((l) => l === link).length;
      if (repeats > 0) this.value += c.repeatGrowth * Math.min(3, repeats);
      else this.value -= c.newLinkRelief;
      this.links.push(link);
      if (this.links.length > c.historySize) this.links.shift();
    }
    const recent = this.history.slice(-c.diversityWindow);
    if (recent.length >= c.diversityWindow && new Set(recent).size >= c.diversityMin) this.value -= c.diversityRelief;
    this.value = Math.max(0, Math.min(c.maxThreshold, this.value));
    if (this.value >= c.maxThreshold) this.pendingReplay = true;
  }

  /** Шаг: события порогов, «перескоков» и повтора. inCombat — считать ли время для среднего за главу. */
  update(dt: number, inCombat: boolean, rng: () => number = Math.random): JamEvent[] {
    const c = this.cfg;
    const out: JamEvent[] = [];
    this.idle += dt;
    if (this.idle > c.idleAfter) this.value = Math.max(0, this.value - c.idleDecay * dt);
    if (inCombat) {
      this.integral += this.value * dt;
      this.time += dt;
      this.peak = Math.max(this.peak, this.value);
    }
    const lvl: JamLevel = this.value >= c.maxThreshold ? 'max' : this.value >= c.highThreshold ? 'high' : 'calm';
    if (lvl !== this.levelNow) {
      this.levelNow = lvl;
      out.push({ type: 'level', level: lvl });
    }
    if (this.pendingReplay) {
      this.pendingReplay = false;
      out.push({ type: 'replay' });
      this.value = c.afterReplay;
      this.history = [];
      this.links = [];
    }
    if (this.high) {
      this.skipTimer -= dt;
      if (this.skipTimer <= 0) {
        const k = (this.value - c.highThreshold) / (c.maxThreshold - c.highThreshold);
        const interval = c.skipIntervalAtHigh + (c.skipIntervalAtMax - c.skipIntervalAtHigh) * k;
        this.skipTimer = interval * (0.7 + rng() * 0.6);
        out.push({ type: 'skip', strength: 0.4 + k * 0.6 });
      }
    } else {
      this.skipTimer = 0.5;
    }
    return out;
  }

  /** Итог за главу: среднее значение шкалы за время боя. */
  chapterAverage(): number {
    return this.time > 0 ? this.integral / this.time : 0;
  }

  chapterPeak(): number {
    return this.peak;
  }
}
