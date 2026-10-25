// Временный бит: свободная прогулка (заглушка для ещё не собранных отрезков).

import type { InputFrame } from '../../../core/input';
import type { Beat, PrologueScene } from '../prologue-scene';

export class FreeBeat implements Beat {
  constructor(private s: PrologueScene) {}
  enter(): void {
    this.s.player.controllable = true;
  }
  update(dt: number, f: InputFrame): void {
    this.s.movePlayer(dt, f, null);
  }
  render(alpha: number, frameDt: number): void {
    this.s.playerView.update(this.s.player, alpha, frameDt);
  }
  exit(): void {}
}
