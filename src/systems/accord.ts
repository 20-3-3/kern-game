// Шкала Аккорда: заряжается разнообразием приёмов и парированиями.
// Однообразный игрок её не зарядит: пока заедание высокое, рост стоит.

import { ACCORD } from '../data/balance';

export class AccordGauge {
  value = 0;
  private recent: string[] = [];
  /** Внешний запрет роста (высокое заедание). */
  blocked = false;

  constructor(private cfg = ACCORD) {}

  get full(): boolean {
    return this.value >= 1;
  }

  private add(v: number): void {
    if (this.blocked) return;
    this.value = Math.min(1, this.value + v);
  }

  /** Действие игрока: удар, рывок, блок, захват и т. п. */
  onAction(action: string): void {
    const c = this.cfg;
    if (action === 'parry') this.add(c.parry);
    const last2 = this.recent.slice(-2);
    if (last2.length === 2 && !last2.includes(action)) this.add(c.varied);
    if (this.recent.length >= 3 && !this.recent.slice(-6).includes(action)) this.add(c.fresh);
    this.recent.push(action);
    if (this.recent.length > 8) this.recent.shift();
  }

  onHit(): void {
    this.add(this.cfg.hit);
  }

  /** Рывок сквозь удар (увернулся в последний момент). */
  onDodgeThrough(): void {
    this.add(this.cfg.dodgeThrough);
  }

  /** Потратить полную шкалу. */
  spend(): boolean {
    if (!this.full) return false;
    this.value = 0;
    return true;
  }
}
