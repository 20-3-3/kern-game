// «Громкость» записи: скрытый параметр Отпечатка. Огонь, взрывы и серия попаданий
// без пауз повышают её, датчик Ники понижает. Влияет на урон и скорость босса.
// Игрок видит её только по дрожанию камеры, свету и искажению звука.

import { LOUDNESS, SILENCE } from '../data/balance';
import { clamp } from '../core/math';

export class Loudness {
  value: number;
  private sinceHit = 99;
  private streak = 0;
  silenceTime = 0;
  silenceCooldown = 0;

  constructor(
    private cfg = LOUDNESS,
    private silenceCfg = SILENCE,
  ) {
    this.value = cfg.base;
  }

  get silenced(): boolean {
    return this.silenceTime > 0;
  }

  get silenceReady(): boolean {
    return this.silenceCooldown <= 0 && this.silenceTime <= 0;
  }

  /** Множители для босса. */
  get damageMul(): number {
    return 1 + this.value * (this.cfg.damageMulAtMax - 1);
  }

  get speedMul(): number {
    const base = 1 + this.value * (this.cfg.speedMulAtMax - 1);
    return this.silenced ? base * this.silenceCfg.slowMul : base;
  }

  /** Попадание по записи. */
  onHit(): void {
    this.streak = this.sinceHit < this.cfg.streakGap ? this.streak + 1 : 1;
    this.sinceHit = 0;
    if (this.streak >= this.cfg.streakFrom) this.add(this.cfg.streakGrowth);
  }

  onExplosion(): void {
    this.add(this.cfg.explosion);
  }

  /** Включить датчик «Тишина». Возвращает false, если он ещё не готов. */
  deploySilence(): boolean {
    if (!this.silenceReady) return false;
    this.silenceTime = this.silenceCfg.duration;
    this.silenceCooldown = this.silenceCfg.cooldown;
    return true;
  }

  /** nearFire — сколько секунд за шаг запись провела у огня (0 или dt). */
  update(dt: number, nearFire: boolean): void {
    this.sinceHit += dt;
    if (this.silenceTime > 0) {
      this.silenceTime = Math.max(0, this.silenceTime - dt);
      this.value -= this.silenceCfg.drain * dt;
    } else {
      this.silenceCooldown = Math.max(0, this.silenceCooldown - dt);
    }
    if (nearFire) this.add(this.cfg.fire * dt);
    // Медленно возвращается к базовому уровню.
    const d = this.cfg.base - this.value;
    this.value += Math.sign(d) * Math.min(Math.abs(d), this.cfg.drift * dt);
    this.value = clamp(this.value, 0, 1);
  }

  private add(v: number): void {
    this.value = clamp(this.value + v, 0, 1);
  }
}
