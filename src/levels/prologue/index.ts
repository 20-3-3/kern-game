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
}

export const createPrologue = (ctx: GameContext, hooks: PrologueHooks, start: BeatId | 'home' = 'ride'): PrologueScene | HomeScene => {
  const goHome = (killed: boolean) => void ctx.scenes.switchTo(new HomeScene(ctx, killed, hooks.onFinished));
  if (start === 'home') return new HomeScene(ctx, ctx.progress.choices.prologue === 'kill', hooks.onFinished);
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
  );
  return scene;
};
