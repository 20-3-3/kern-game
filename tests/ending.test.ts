import { describe, expect, it } from 'vitest';
import { averageJam, computeEnding } from '../src/systems/ending';
import { newProgress, type ProgressState } from '../src/systems/progress';

const make = (over: Partial<ProgressState>): ProgressState => ({ ...newProgress(), ...over });
const tails = (n: number) => ['druzhinnik', 'grenadier', 'poedinshik', 'zvonar', 'khozyayka'].slice(0, n);

describe('концовки', () => {
  it('«Новая дорожка»: все пять хвостов, без утешений, заедание ниже половины, Ветров жив', () => {
    expect(computeEnding(make({ tails: tails(5), comfortLies: 0, jamPerChapter: [0.2, 0.3], vetrovAlive: true }))).toBe('novayaDorozhka');
  });

  it('одно утешение закрывает скрытую концовку', () => {
    const p = make({ tails: tails(5), comfortLies: 1, jamPerChapter: [0.2], vetrovAlive: true, listenedToKhozyayka: true });
    expect(computeEnding(p)).toBe('doslushat');
  });

  it('если Ветров погиб, скрытой концовки нет', () => {
    const p = make({ tails: tails(5), jamPerChapter: [0.2], vetrovAlive: false, listenedToKhozyayka: true });
    expect(computeEnding(p)).toBe('doslushat');
  });

  it('высокое заедание закрывает скрытую и истинную концовки', () => {
    const p = make({ tails: tails(5), jamPerChapter: [0.6], listenedToKhozyayka: true });
    expect(computeEnding(p)).toBe('igluVon');
  });

  it('«Дослушать»: слушал Хозяйку, три хвоста, заедание ниже половины', () => {
    expect(computeEnding(make({ tails: tails(3), listenedToKhozyayka: true, jamPerChapter: [0.49] }))).toBe('doslushat');
  });

  it('без выбора «слушать» истинной концовки нет', () => {
    expect(computeEnding(make({ tails: tails(4), listenedToKhozyayka: false, jamPerChapter: [0.1] }))).toBe('igluVon');
  });

  it('ровно 0.5 заедания — уже не «ниже половины»', () => {
    expect(computeEnding(make({ tails: tails(3), listenedToKhozyayka: true, jamPerChapter: [0.5] }))).toBe('igluVon');
  });

  it('«Заело»: заедание на максимуме, боссов добивали, хвостов мало', () => {
    const p = make({ tails: tails(1), jamPerChapter: [0.8, 0.9], bossesKilled: ['grenadier', 'poedinshik'] });
    expect(computeEnding(p)).toBe('zaelo');
  });

  it('«Иглу вон»: не слушал Хозяйку и меньше трёх хвостов', () => {
    expect(computeEnding(make({ tails: tails(2), jamPerChapter: [0.3] }))).toBe('igluVon');
  });

  it('среднее заедание по главам; пустой список — ноль', () => {
    expect(averageJam({ jamPerChapter: [0.2, 0.4] })).toBeCloseTo(0.3);
    expect(averageJam({ jamPerChapter: [] })).toBe(0);
  });
});
