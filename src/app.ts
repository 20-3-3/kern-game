// Приложение: главное меню, пауза, запуск глав, сохранение и контрольные точки.

import type { GameContext, Settings } from './core/context';
import { Menu } from './ui/menu';
import { MenuScene } from './levels/menu-scene';
import { createPrologue } from './levels/prologue';
import type { BeatId } from './levels/prologue/prologue-scene';
import { newProgress } from './systems/progress';
import { averageJam } from './systems/ending';
import { MENU_TEXT } from './data/text/ui';

type StartPoint = BeatId | 'home';

export class App {
  readonly menu: Menu;
  paused = false;
  inGame = false;
  private pausedAt = 0;

  constructor(private ctx: GameContext) {
    this.menu = new Menu(
      ctx.ui.root,
      ctx.settings,
      {
        newGame: () => this.newGame(),
        continueGame: () => this.continueGame(),
        resume: () => this.resume(),
        restartChapter: () => this.startPrologue('ride'),
        toMenu: () => void this.toMenu(),
        settingsChanged: (s) => this.applySettings(s),
      },
      () => ctx.audio.play('uiClick'),
    );
    ctx.input.onPause = () => {
      // Esc мог уже поставить паузу через снятие захвата мыши.
      if (performance.now() - this.pausedAt < 400) return;
      this.togglePause();
    };
    document.addEventListener('pointerlockchange', () => {
      // Esc в Chrome сначала снимает захват мыши — считаем это паузой.
      if (!ctx.input.pointerLocked && this.inGame && !this.paused && !ctx.scenes.loading) this.pause();
    });
    ctx.renderer.canvas.addEventListener('click', () => {
      if (this.inGame && !this.paused) ctx.input.requestPointerLock();
    });
    this.applySettings(ctx.settings);
  }

  applySettings(s: Settings): void {
    const ctx = this.ctx;
    ctx.audio.setVolumes(s.masterVolume, s.musicVolume);
    ctx.voice.enabled = s.voice;
    if (!s.voice) ctx.voice.stop();
    ctx.renderer.setQuality(s.quality === 'low' ? 0.75 : Math.min(window.devicePixelRatio || 1, 1.5));
    ctx.save.saveSettings(s);
  }

  async toMenu(): Promise<void> {
    const ctx = this.ctx;
    this.inGame = false;
    this.paused = false;
    ctx.input.exitPointerLock();
    ctx.voice.stop();
    ctx.hud.show(false);
    ctx.ui.clear();
    ctx.ui.fade(0, 0);
    ctx.loop.timeScale = 1;
    ctx.audio.setMuffle(0);
    ctx.bus.emit('music', { mode: 'calm' });
    await ctx.scenes.switchTo(new MenuScene(ctx.renderer));
    const cp = ctx.save.loadCheckpoint();
    this.menu.continueLabel = cp && cp.chapter === 'prologue' ? MENU_TEXT.checkpoint[cp.beat] ?? cp.beat : null;
    const p = ctx.progress;
    this.menu.summary = p.completed.includes('prologue')
      ? `${MENU_TEXT.done}. ${MENU_TEXT.summary(p.tails.length, p.choices.prologue, averageJam(p))}`
      : null;
    this.menu.showMain();
  }

  private newGame(): void {
    this.ctx.progress = newProgress();
    this.ctx.save.clearCheckpoint();
    this.startPrologue('ride');
  }

  private continueGame(): void {
    const cp = this.ctx.save.loadCheckpoint();
    this.startPrologue((cp?.beat as StartPoint | undefined) ?? 'ride');
  }

  startPrologue(start: StartPoint): void {
    const ctx = this.ctx;
    this.menu.hide();
    this.paused = false;
    this.inGame = true;
    ctx.ui.clear();
    ctx.hud.show(false);
    ctx.loop.timeScale = 1;
    ctx.audio.setMuffle(0);
    ctx.input.requestPointerLock();
    const scene = createPrologue(
      ctx,
      {
        onFinished: () => this.onPrologueFinished(),
        onCheckpoint: (beat) => {
          ctx.save.saveCheckpoint({ chapter: 'prologue', beat });
          ctx.save.saveProgress(ctx.progress);
        },
      },
      start,
    );
    void ctx.scenes.switchTo(scene);
  }

  private onPrologueFinished(): void {
    const ctx = this.ctx;
    ctx.progress.completed = [...new Set([...ctx.progress.completed, 'prologue'])];
    ctx.save.saveProgress(ctx.progress);
    ctx.save.clearCheckpoint();
    void this.toMenu();
  }

  togglePause(): void {
    if (this.paused) this.resume();
    else this.pause();
  }

  pause(): void {
    if (!this.inGame || this.paused) return;
    this.paused = true;
    this.pausedAt = performance.now();
    this.ctx.input.exitPointerLock();
    this.ctx.audio.setMuffle(0.7);
    this.ctx.voice.stop();
    this.menu.showPause();
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.menu.hide();
    this.ctx.audio.setMuffle(0);
    this.ctx.input.requestPointerLock();
  }
}
