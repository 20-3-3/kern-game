// Общий контекст игры: то, что нужно каждой сцене.

import type { Renderer } from '../render/renderer';
import type { Input } from './input';
import type { EventBus } from './events';
import type { GameEvents } from './game-events';
import type { FixedLoop } from './loop';
import type { SceneManager } from './scene';
import type { UI } from '../ui/ui';
import type { Hud } from '../ui/hud';
import type { SaveStore } from './save';
import type { ProgressState } from '../systems/progress';

export interface Settings {
  mouseSensitivity: number;
  invertY: boolean;
  masterVolume: number;
  musicVolume: number;
  /** Озвучка реплик синтезом речи браузера. */
  voice: boolean;
  quality: 'low' | 'high';
}

export interface GameContext {
  renderer: Renderer;
  input: Input;
  bus: EventBus<GameEvents>;
  loop: FixedLoop;
  scenes: SceneManager;
  settings: Settings;
  ui: UI;
  hud: Hud;
  save: SaveStore;
  /** Текущее прохождение (сохраняется в конце глав). */
  progress: ProgressState;
}
