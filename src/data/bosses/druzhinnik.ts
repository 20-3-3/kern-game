// Босс пролога: Дружинник, 1380 г. Запись длиной 40 секунд (64 доли при 96 ударах в минуту).
// Каждая запись начинается с вопроса «Где князь?». Атаки привязаны к долям — ритм можно выучить.

export interface BossAttackDef {
  id: string;
  /** Длина приёма в долях. */
  length: number;
  /** На каких долях от начала приёма приходится удар. */
  impacts: number[];
  damage: number;
  range: number;
  arc: number;
  /** Рывок вперёд на долю перед ударом, м. */
  lunge: number;
  heavy?: boolean;
  unblockable?: boolean;
  /** Круговая ударная волна вместо дуги. */
  radial?: boolean;
  style: 'horizontal' | 'backhand' | 'overhead' | 'thrust' | 'bash' | 'spin' | 'slam';
}

export type BossMove = { kind: 'walk'; beats: number } | { kind: 'idle'; beats: number } | { kind: 'attack'; id: string } | { kind: 'horn' };

export interface BossPhaseDef {
  name: string;
  hp: number;
  cycle: BossMove[];
  /** Сколько отзвуков-ратников зовёт рог в начале фазы. */
  summon: number;
  /** Прибавка к громкости в начале фазы. */
  loudnessBoost: number;
}

export const DRUZHINNIK_BOSS = {
  id: 'druzhinnik',
  bpm: 96,
  loopBeats: 64,
  /** «Где князь?» в начале каждой записи: сколько долей он стоит и спрашивает. */
  askBeats: 4,
  radius: 0.75,
  height: 2.2,
  walkSpeed: 2.8,
  stopDist: 2.3,
  /** Открыт после парирования, долей. */
  parryOpenBeats: 3,
  /** Шатается после слома фазы, долей. */
  phaseBreakBeats: 6,
  openDamageMul: 1.5,
  /** Ниже этой доли здоровья в третьей фазе запись подходит к обрыву. */
  cutoffThreshold: 0.35,
  /** Сколько долей длится момент обрыва (окно для Последней ноты или добивания). */
  cutoffBeats: 8,
  /** Урон по записи в момент обрыва. */
  cutoffDamageMul: 1.6,
  /** На какой доле записи обрыв повторяется, если его пропустили. */
  cutoffLoopBeat: 54,
  /** Через сколько секунд добитая запись перезапускается. */
  restartSeconds: 40,
  attacks: {
    slash: { id: 'slash', length: 4, impacts: [2], damage: 14, range: 3.2, arc: 140, lunge: 1.0, style: 'horizontal' },
    doubleSlash: { id: 'doubleSlash', length: 5, impacts: [2, 3], damage: 11, range: 3.2, arc: 140, lunge: 0.8, style: 'backhand' },
    tripleSlash: { id: 'tripleSlash', length: 6, impacts: [2, 3, 4], damage: 10, range: 3.2, arc: 140, lunge: 0.7, style: 'horizontal' },
    shieldBash: { id: 'shieldBash', length: 5, impacts: [2], damage: 16, range: 2.8, arc: 90, lunge: 2.6, heavy: true, style: 'bash' },
    charge: { id: 'charge', length: 5, impacts: [3], damage: 18, range: 2.6, arc: 70, lunge: 6.5, style: 'thrust' },
    slam: { id: 'slam', length: 6, impacts: [3], damage: 20, range: 6.5, arc: 360, lunge: 0, unblockable: true, radial: true, style: 'slam' },
    finalBlow: { id: 'finalBlow', length: 4, impacts: [1], damage: 26, range: 8, arc: 360, lunge: 0, unblockable: true, radial: true, style: 'slam' },
  } satisfies Record<string, BossAttackDef>,
  phases: [
    {
      name: 'Дозор',
      hp: 140,
      summon: 0,
      loudnessBoost: 0,
      cycle: [
        { kind: 'walk', beats: 4 },
        { kind: 'attack', id: 'slash' },
        { kind: 'walk', beats: 2 },
        { kind: 'attack', id: 'doubleSlash' },
        { kind: 'idle', beats: 1 },
        { kind: 'walk', beats: 2 },
        { kind: 'attack', id: 'shieldBash' },
        { kind: 'idle', beats: 2 },
      ],
    },
    {
      name: 'Сеча',
      hp: 150,
      summon: 2,
      loudnessBoost: 0.1,
      cycle: [
        { kind: 'walk', beats: 2 },
        { kind: 'attack', id: 'doubleSlash' },
        { kind: 'attack', id: 'charge' },
        { kind: 'walk', beats: 2 },
        { kind: 'attack', id: 'shieldBash' },
        { kind: 'attack', id: 'slash' },
        { kind: 'idle', beats: 2 },
      ],
    },
    {
      name: 'Обрыв',
      hp: 160,
      summon: 0,
      loudnessBoost: 0.15,
      cycle: [
        { kind: 'walk', beats: 2 },
        { kind: 'attack', id: 'tripleSlash' },
        { kind: 'attack', id: 'slam' },
        { kind: 'walk', beats: 2 },
        { kind: 'attack', id: 'charge' },
        { kind: 'attack', id: 'doubleSlash' },
        { kind: 'idle', beats: 1 },
        { kind: 'attack', id: 'slam' },
        { kind: 'idle', beats: 2 },
      ],
    },
  ] satisfies BossPhaseDef[],
  /** Огонь на площади: у бочек запись громче. */
  fires: [
    { x: -13, z: -566 },
    { x: 13, z: -578 },
  ],
};

export type DruzhinnikConfig = typeof DRUZHINNIK_BOSS;
