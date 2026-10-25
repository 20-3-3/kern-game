// Точка входа: загрузка движка, создание контекста и запуск игрового цикла.

import { initRapier } from './core/physics';
import { Input } from './core/input';
import { FixedLoop } from './core/loop';
import { SceneManager } from './core/scene';
import { EventBus } from './core/events';
import type { GameEvents } from './core/game-events';
import type { GameContext } from './core/context';
import { Renderer } from './render/renderer';
import { PrologueScene } from './levels/prologue/prologue-scene';
import { DEFAULT_MOUSE_SENSITIVITY } from './data/controls';

const boot = async () => {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const loadingEl = document.getElementById('loading') as HTMLDivElement;
  const ui = document.getElementById('ui') as HTMLDivElement;
  await initRapier();

  const renderer = new Renderer(canvas);
  const input = new Input(canvas);
  const bus = new EventBus<GameEvents>();
  const scenes = new SceneManager((on) => loadingEl.classList.toggle('hidden', !on));
  const loop = new FixedLoop({
    update: (dt) => scenes.update(dt, input.sample()),
    render: (alpha, frameDt) => scenes.render(alpha, frameDt),
  });
  const ctx: GameContext = {
    renderer,
    input,
    bus,
    loop,
    scenes,
    ui,
    settings: {
      mouseSensitivity: DEFAULT_MOUSE_SENSITIVITY,
      invertY: false,
      masterVolume: 0.8,
      musicVolume: 0.7,
      voice: true,
      quality: 'high',
    },
  };

  canvas.addEventListener('click', () => input.requestPointerLock());
  // Отладка: ?debug открывает доступ к контексту из консоли браузера.
  if (new URLSearchParams(location.search).has('debug')) (window as unknown as { kern: GameContext }).kern = ctx;
  await scenes.switchTo(new PrologueScene(ctx));
  loop.start();
};

boot().catch((err) => {
  console.error(err);
  const el = document.getElementById('loading');
  if (el) el.textContent = 'Не удалось запустить игру. Нужен Chrome с поддержкой WebGL2.';
});
