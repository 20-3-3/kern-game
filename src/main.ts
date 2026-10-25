// Точка входа: загрузка движка, создание контекста и запуск игрового цикла.

import { initRapier } from './core/physics';
import { Input } from './core/input';
import { FixedLoop } from './core/loop';
import { SceneManager } from './core/scene';
import { EventBus } from './core/events';
import type { GameEvents } from './core/game-events';
import type { GameContext, Settings } from './core/context';
import { Renderer } from './render/renderer';
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
import { App } from './app';

const DEFAULT_SETTINGS: Settings = {
  mouseSensitivity: DEFAULT_MOUSE_SENSITIVITY,
  invertY: false,
  masterVolume: 0.8,
  musicVolume: 0.7,
  voice: true,
  quality: 'high',
};

const boot = async () => {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const loadingEl = document.getElementById('loading') as HTMLDivElement;
  const uiRoot = document.getElementById('ui') as HTMLDivElement;
  const params = new URLSearchParams(location.search);
  const debug = params.has('debug');

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
  let app: App | null = null;
  const fpsEl = debug ? Object.assign(document.createElement('div'), { className: 'fps' }) : null;
  if (fpsEl) uiRoot.appendChild(fpsEl);
  let frames = 0;
  let fpsTime = 0;
  const loop = new FixedLoop({
    update: (dt) => {
      const f = input.sample();
      if (!app?.paused) scenes.update(dt, f);
    },
    render: (alpha, frameDt) => {
      scenes.render(alpha, frameDt);
      ui.tick(frameDt);
      reactions.update(frameDt);
      if (fpsEl) {
        frames++;
        fpsTime += frameDt;
        if (fpsTime >= 0.5) {
          fpsEl.textContent = `${Math.round(frames / fpsTime)} FPS · ${renderer.three.info.render.calls} DC`;
          frames = 0;
          fpsTime = 0;
        }
      }
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
    settings: save.loadSettings(DEFAULT_SETTINGS),
  };
  // Отладка: ?debug открывает доступ к контексту из консоли браузера.
  if (debug) (window as unknown as { kern: GameContext }).kern = ctx;

  app = new App(ctx);
  loop.start();
  // ?beat=boss — сразу к нужному отрезку пролога (для проверки).
  const beat = params.get('beat') as BeatId | 'home' | null;
  if (beat) await app.startPrologue(beat);
  else await app.toMenu();
};

boot().catch((err) => {
  console.error(err);
  const el = document.getElementById('loading');
  if (el) el.textContent = 'Не удалось запустить игру. Нужен Chrome с поддержкой WebGL2.';
});
