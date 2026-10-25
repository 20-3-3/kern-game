// Точка входа: загрузка движка, создание контекста и запуск игрового цикла.

import { initRapier } from './core/physics';
import { Input } from './core/input';
import { FixedLoop } from './core/loop';
import { SceneManager } from './core/scene';
import { EventBus } from './core/events';
import type { GameEvents } from './core/game-events';
import { Renderer } from './render/renderer';
import { SandboxScene } from './levels/sandbox';

const boot = async () => {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const loadingEl = document.getElementById('loading') as HTMLDivElement;
  await initRapier();

  const renderer = new Renderer(canvas);
  const input = new Input(canvas);
  const bus = new EventBus<GameEvents>();
  const scenes = new SceneManager((on) => loadingEl.classList.toggle('hidden', !on));

  canvas.addEventListener('click', () => input.requestPointerLock());

  const loop = new FixedLoop({
    update: (dt) => scenes.update(dt, input.sample()),
    render: (alpha, frameDt) => scenes.render(alpha, frameDt),
  });

  await scenes.switchTo(new SandboxScene(renderer, bus));
  loop.start();
};

boot().catch((err) => {
  console.error(err);
  const el = document.getElementById('loading');
  if (el) el.textContent = 'Не удалось запустить игру. Нужен Chrome с поддержкой WebGL2.';
});
