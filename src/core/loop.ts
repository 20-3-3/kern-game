// Игровой цикл: логика идёт фиксированными шагами 60 Гц, рендер — с интерполяцией.

export const FIXED_DT = 1 / 60;
const MAX_FRAME = 0.25;

export interface LoopCallbacks {
  /** Один шаг логики длиной FIXED_DT. */
  update(dt: number): void;
  /** alpha — доля между предыдущим и текущим шагом логики, frameDt — реальное время кадра. */
  render(alpha: number, frameDt: number): void;
}

export class FixedLoop {
  /** Замедление времени (1 — норма). Используется в кинематографичных моментах. */
  timeScale = 1;
  private acc = 0;
  private last = 0;
  private raf = 0;
  private running = false;
  /** Короткий стоп-кадр при сильном попадании (в реальных секундах). */
  private stop = 0;

  constructor(private cb: LoopCallbacks) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const frame = (now: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(frame);
      const frameDt = Math.min((now - this.last) / 1000, MAX_FRAME);
      this.last = now;
      let scale = this.timeScale;
      if (this.stop > 0) {
        this.stop -= frameDt;
        scale *= 0.08;
      }
      this.acc += frameDt * scale;
      let steps = 0;
      while (this.acc >= FIXED_DT && steps < 8) {
        this.cb.update(FIXED_DT);
        this.acc -= FIXED_DT;
        steps++;
      }
      if (steps === 8) this.acc = 0;
      this.cb.render(this.acc / FIXED_DT, frameDt);
    };
    this.raf = requestAnimationFrame(frame);
  }

  /** Стоп-кадр: логика почти замирает на sec секунд. */
  hitStop(sec: number): void {
    this.stop = Math.max(this.stop, sec);
  }

  halt(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }
}
