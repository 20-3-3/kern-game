// Сборка пролога: какие биты идут в каком порядке, и переход домой.

import type { GameContext } from '../../core/context';
import { PrologueScene, type BeatId } from './prologue-scene';
import { RideBeat } from './beats/ride';
import { BrawlBeat } from './beats/brawl';
import { KernBeat } from './beats/kern';
import { BossBeat } from './beats/boss';
import { AftermathBeat } from './beats/aftermath';
import { HomeScene } from './home';

export interface PrologueHooks {
  /** Пролог пройден целиком (после кассеты). */
  onFinished: () => void;
  /** Новая контрольная точка: с неё можно продолжить из меню. */
  onCheckpoint: (beat: BeatId | 'home') => void;
}

export const createPrologue = (ctx: GameContext, hooks: PrologueHooks, start: BeatId | 'home' = 'ride'): PrologueScene | HomeScene => {
  const home = (killed: boolean) => new HomeScene(ctx, killed, hooks.onFinished, () => hooks.onCheckpoint('home'));
  const goHome = (killed: boolean) => void ctx.scenes.switchTo(home(killed));
  if (start === 'home') return home(ctx.progress.choices.prologue === 'kill');
  const scene: PrologueScene = new PrologueScene(
    ctx,
    {
      ride: (s) => new RideBeat(s),
      brawl: (s) => new BrawlBeat(s),
      kern: (s) => new KernBeat(s),
      boss: (s) => new BossBeat(s),
      aftermath: (s) => new AftermathBeat(s),
    },
    start,
    () => goHome(scene.prologueResult === 'kill'),
    (beat) => {
      if (beat !== 'aftermath') hooks.onCheckpoint(beat);
    },
  );
  return scene;
};
