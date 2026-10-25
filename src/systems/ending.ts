// Концовка считается одной чистой функцией по состоянию прохождения.

import { ENDINGS } from '../data/endings';
import type { ProgressState } from './progress';

export type Ending = 'zaelo' | 'igluVon' | 'doslushat' | 'novayaDorozhka';

export const averageJam = (p: Pick<ProgressState, 'jamPerChapter'>): number =>
  p.jamPerChapter.length ? p.jamPerChapter.reduce((a, b) => a + b, 0) / p.jamPerChapter.length : 0;

/**
 * Порядок проверки: скрытая → истинная → плохая → холодная.
 * Если не подошло ни одно условие, концовка холодная («Иглу вон»): мир спасён, но без лучшего исхода.
 */
export const computeEnding = (p: ProgressState, cfg = ENDINGS): Ending => {
  const jam = averageJam(p);
  const tails = p.tails.length;
  if (tails >= cfg.tailsAll && p.comfortLies === 0 && jam < cfg.jamLow && p.vetrovAlive) return 'novayaDorozhka';
  if (p.listenedToKhozyayka && tails >= cfg.tailsEnough && jam < cfg.jamLow) return 'doslushat';
  if (jam >= cfg.jamMax && tails < cfg.tailsEnough && p.bossesKilled.length > 0) return 'zaelo';
  return 'igluVon';
};
