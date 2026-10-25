// Юмор-слой: пуши приложения доставки и стрим Вани. Во время серьёзных
// кат-сцен молчит; накопленное за это время не показывается задним числом.

import type { EventBus } from '../core/events';
import type { GameEvents } from '../core/game-events';
import type { UI } from './ui';

export class HumorLayer {
  private serious = false;

  constructor(bus: EventBus<GameEvents>, private ui: UI) {
    bus.on('serious', ({ on }) => (this.serious = on));
    bus.on('push', ({ text }) => {
      if (!this.serious) this.ui.push(text);
    });
    bus.on('bark', ({ speaker, text }) => {
      if (this.serious) return;
      if (speaker === 'vanya') this.ui.stream(text);
      else if (speaker === 'donate') this.ui.stream(text, true);
    });
  }
}
