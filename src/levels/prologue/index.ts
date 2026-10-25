// Сборка пролога: какие биты идут в каком порядке.

import type { GameContext } from '../../core/context';
import { PrologueScene, type BeatId } from './prologue-scene';
import { RideBeat } from './beats/ride';
import { FreeBeat } from './beats/free';
import { BrawlBeat } from './beats/brawl';
import { KernBeat } from './beats/kern';
import { BossBeat } from './beats/boss';

export const createPrologue = (ctx: GameContext, start: BeatId = 'ride'): PrologueScene =>
  new PrologueScene(
    ctx,
    {
      ride: (s) => new RideBeat(s),
      brawl: (s) => new BrawlBeat(s),
      kern: (s) => new KernBeat(s),
      boss: (s) => new BossBeat(s),
      aftermath: (s) => new FreeBeat(s),
    },
    start,
  );
