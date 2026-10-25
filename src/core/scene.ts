// Загрузчик сцен. Каждая сцена (уровень, меню, кат-сцена) реализует GameScene.
// Новые главы добавляются как новые сцены без правки систем.

import type { InputFrame } from './input';
import type { Action } from '../data/controls';

/** Экранная кнопка для телефона: какое действие, подпись, подсветка. */
export interface TouchButton {
  action: Action;
  label: string;
  /** Подсветить (например, «Нота» в момент обрыва). */
  hot?: boolean;
  /** Показать тусклой (ещё не готова). */
  dim?: boolean;
}

/** Нужен ли джойстик и какие кнопки показать на телефоне сейчас. */
export interface TouchLayout {
  move: boolean;
  look: boolean;
  buttons: TouchButton[];
}

export interface GameScene {
  readonly id: string;
  load(): Promise<void>;
  update(dt: number, input: InputFrame): void;
  render(alpha: number, frameDt: number): void;
  dispose(): void;
  /** Раскладка экранного управления (для телефонов). */
  touchLayout?(): TouchLayout;
}

export class SceneManager {
  current: GameScene | null = null;
  loading = false;

  constructor(private onLoading: (on: boolean) => void) {}

  async switchTo(next: GameScene): Promise<void> {
    this.loading = true;
    this.onLoading(true);
    const prev = this.current;
    this.current = null;
    prev?.dispose();
    try {
      await next.load();
      this.current = next;
    } finally {
      this.loading = false;
      this.onLoading(false);
    }
  }

  update(dt: number, input: InputFrame): void {
    if (!this.loading) this.current?.update(dt, input);
  }

  render(alpha: number, frameDt: number): void {
    if (!this.loading) this.current?.render(alpha, frameDt);
  }
}
