// Точка входа: загрузка движка, создание контекста и запуск игрового цикла.

import { initRapier } from './core/physics';
import { Input } from './core/input';
import { FixedLoop } from './core/loop';
import { SceneManager } from './core/scene';
import { EventBus } from './core/events';
import type { GameEvents } from './core/game-events';
import type { GameContext } from './core/context';
import { Renderer } from './render/renderer';
import { createPrologue } from './levels/prologue';
import type { BeatId } from './levels/prologue/prologue-scene';
import { DEFAULT_MOUSE_SENSITIVITY } from './data/controls';
import { UI } from './ui/ui';
import { HumorLayer } from './ui/humor';
import { Hud } from './ui/hud';
import { SaveStore } from './core/save';
import { AudioEngine } from './audio/engine';
import { AdaptiveMusic } from './audio/music';
import { AudioReactions } from './audio/reactions';
import { Voice } from './audio/voice';

const boot = async () => {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const loadingEl = document.getElementById('loading') as HTMLDivElement;
  const uiRoot = document.getElementById('ui') as HTMLDivElement;
  const bus = new EventBus<GameEvents>();
  const hud = new Hud(uiRoot);
  const ui = new UI(uiRoot);
  const save = new SaveStore();
  const audio = new AudioEngine();
  const music = new AdaptiveMusic(audio);
  const voice = new Voice(audio);
  const reactions = new AudioReactions(bus, audio, music);
  ui.onLine = (speaker, text) => voice.say(speaker, text);
  // Браузер разрешает звук только после действия игрока.
  const unlock = () => audio.unlock();
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  await initRapier();

  const renderer = new Renderer(canvas);
  const input = new Input(canvas);
  const scenes = new SceneManager((on) => loadingEl.classList.toggle('hidden', !on));
  const loop = new FixedLoop({
    update: (dt) => scenes.update(dt, input.sample()),
    render: (alpha, frameDt) => {
      scenes.render(alpha, frameDt);
      ui.tick(frameDt);
      reactions.update(frameDt);
    },
  });
  new HumorLayer(bus, ui);
  const ctx: GameContext = {
    renderer,
    input,
    bus,
    loop,
    scenes,
    ui,
    hud,
    save,
    audio,
    voice,
    progress: save.loadProgress(),
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
  const params = new URLSearchParams(location.search);
  const onFinished = () => {
    ctx.progress.completed = [...new Set([...ctx.progress.completed, 'prologue'])];
    save.saveProgress(ctx.progress);
  };
  await scenes.switchTo(createPrologue(ctx, { onFinished }, (params.get('beat') as BeatId | 'home' | null) ?? 'ride'));
  loop.start();
};

boot().catch((err) => {
  console.error(err);
  const el = document.getElementById('loading');
  if (el) el.textContent = 'Не удалось запустить игру. Нужен Chrome с поддержкой WebGL2.';
});
