// Сборка пролога: какие биты идут в каком порядке.

import type { GameContext } from '../../core/context';
import { PrologueScene, type BeatId } from './prologue-scene';
import { RideBeat } from './beats/ride';
import { FreeBeat } from './beats/free';
import { BrawlBeat } from './beats/brawl';

export const createPrologue = (ctx: GameContext, start: BeatId = 'ride'): PrologueScene =>
  new PrologueScene(
    ctx,
    {
      ride: (s) => new RideBeat(s),
      brawl: (s) => new BrawlBeat(s),
      kern: (s) => new FreeBeat(s),
      boss: (s) => new FreeBeat(s),
      aftermath: (s) => new FreeBeat(s),
    },
    start,
  );
