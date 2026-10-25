// Боевой баланс: удары Лёвы, блок и парирование, враги. Время — в секундах.

import type { SwingStyle } from '../render/characters';
import type { DamageKind } from '../core/game-events';

export interface PlayerAttackDef {
  id: string;
  style: SwingStyle;
  duration: number;
  /** Окно, когда удар наносит урон. */
  hitStart: number;
  hitEnd: number;
  damage: number;
  range: number;
  /** Полный угол поражения, градусы. */
  arc: number;
  /** Шаг вперёд во время удара, м. */
  lunge: number;
  knockback: number;
  /** С какого момента можно нажать следующий удар (буфер) и до какого. */
  comboOpen: number;
  comboClose: number;
  /** С какого момента следующий удар может начаться (отмена хвоста анимации). */
  cancelAt: number;
  kind: DamageKind;
  /** Сколько оглушения получает враг. */
  stagger: number;
}

const attack = (a: PlayerAttackDef): PlayerAttackDef => a;

/** Термосумка: против людей. */
export const BAG_ATTACKS: PlayerAttackDef[] = [
  attack({ id: 'bag1', style: 'horizontal', duration: 0.55, hitStart: 0.18, hitEnd: 0.3, damage: 12, range: 1.9, arc: 120, lunge: 0.5, knockback: 1.2, comboOpen: 0.15, comboClose: 0.55, cancelAt: 0.34, kind: 'bag', stagger: 0.35 }),
  attack({ id: 'bag2', style: 'backhand', duration: 0.55, hitStart: 0.18, hitEnd: 0.3, damage: 12, range: 1.9, arc: 120, lunge: 0.5, knockback: 1.2, comboOpen: 0.15, comboClose: 0.55, cancelAt: 0.34, kind: 'bag', stagger: 0.35 }),
  attack({ id: 'bag3', style: 'overhead', duration: 0.8, hitStart: 0.3, hitEnd: 0.42, damage: 22, range: 2.1, arc: 90, lunge: 0.9, knockback: 3.5, comboOpen: 0, comboClose: 0, cancelAt: 0.8, kind: 'bag', stagger: 0.9 }),
];

/** Керн-меч: против Отпечатков. */
export const KERN_ATTACKS: PlayerAttackDef[] = [
  attack({ id: 'kern1', style: 'horizontal', duration: 0.48, hitStart: 0.14, hitEnd: 0.26, damage: 10, range: 2.6, arc: 130, lunge: 0.6, knockback: 0.8, comboOpen: 0.12, comboClose: 0.5, cancelAt: 0.3, kind: 'light', stagger: 0.25 }),
  attack({ id: 'kern2', style: 'backhand', duration: 0.48, hitStart: 0.14, hitEnd: 0.26, damage: 10, range: 2.6, arc: 130, lunge: 0.6, knockback: 0.8, comboOpen: 0.12, comboClose: 0.5, cancelAt: 0.3, kind: 'light', stagger: 0.25 }),
  attack({ id: 'kern3', style: 'thrust', duration: 0.72, hitStart: 0.26, hitEnd: 0.38, damage: 20, range: 3.0, arc: 60, lunge: 1.4, knockback: 2.5, comboOpen: 0, comboClose: 0, cancelAt: 0.72, kind: 'heavy', stagger: 0.7 }),
];

export const DEFENSE = {
  /** Блок снижает урон до этой доли. */
  blockDamageMul: 0.25,
  /** Окно парирования: нажатие ПКМ не раньше чем за столько секунд до попадания. */
  parryWindow: 0.2,
  /** Сколько враг «открыт» после парирования. */
  parryOpenTime: 1.4,
  /** Множитель урона по открытому врагу. */
  openDamageMul: 1.5,
  blockStartup: 0.06,
};

export const THROW = {
  range: 2.0,
  damage: 20,
  distance: 4.5,
  downTime: 2.0,
  duration: 0.6,
};

export const LOCK_ON = {
  range: 18,
  breakRange: 26,
  /** Максимальный угол от взгляда камеры при выборе цели, градусы. */
  maxAngle: 70,
};

export interface EnemyAttackDef {
  id: string;
  style: SwingStyle;
  windup: number;
  strike: number;
  recover: number;
  damage: number;
  range: number;
  arc: number;
  lunge: number;
  /** Тяжёлый удар: блок держит хуже (только парирование или рывок). */
  heavy?: boolean;
  /** Нельзя ни блокировать, ни парировать — только рывок. */
  unblockable?: boolean;
  /** Удар по кругу (ударная волна): радиус вместо дуги. */
  radial?: boolean;
  weight: number;
}

export interface EnemyDef {
  kind: string;
  hp: number;
  speed: number;
  /** Дистанция, на которой ждут своей очереди атаковать. */
  circleDist: number;
  attackCooldown: [number, number];
  hurtStun: number;
  attacks: EnemyAttackDef[];
  /** true — человек (нокаут), false — Отпечаток (растворяется). */
  human: boolean;
  radius: number;
  height: number;
}

export const ENEMIES: Record<string, EnemyDef> = {
  restorer: {
    kind: 'restorer',
    hp: 46,
    speed: 3.6,
    circleDist: 4.2,
    attackCooldown: [1.4, 2.6],
    hurtStun: 0.35,
    human: true,
    radius: 0.4,
    height: 1.82,
    attacks: [
      { id: 'forkJab', style: 'thrust', windup: 0.55, strike: 0.15, recover: 0.6, damage: 10, range: 1.8, arc: 70, lunge: 0.8, weight: 2 },
      { id: 'forkSwing', style: 'horizontal', windup: 0.75, strike: 0.18, recover: 0.75, damage: 14, range: 2.0, arc: 120, lunge: 0.4, weight: 1 },
    ],
  },
  restorerLeader: {
    kind: 'restorerLeader',
    hp: 70,
    speed: 3.8,
    circleDist: 4.0,
    attackCooldown: [1.1, 2.0],
    hurtStun: 0.3,
    human: true,
    radius: 0.42,
    height: 1.82,
    attacks: [
      { id: 'forkJab', style: 'thrust', windup: 0.5, strike: 0.15, recover: 0.5, damage: 11, range: 1.9, arc: 70, lunge: 1.0, weight: 2 },
      { id: 'forkOverhead', style: 'overhead', windup: 0.9, strike: 0.2, recover: 0.8, damage: 20, range: 2.1, arc: 80, lunge: 0.6, heavy: true, weight: 1 },
    ],
  },
  ratnik: {
    kind: 'ratnik',
    hp: 40,
    speed: 3.3,
    circleDist: 4.5,
    attackCooldown: [1.3, 2.4],
    hurtStun: 0.3,
    human: false,
    radius: 0.42,
    height: 1.8,
    attacks: [
      { id: 'axeChop', style: 'overhead', windup: 0.7, strike: 0.18, recover: 0.6, damage: 12, range: 2.2, arc: 80, lunge: 0.7, weight: 2 },
      { id: 'spearThrust', style: 'thrust', windup: 0.6, strike: 0.15, recover: 0.7, damage: 10, range: 2.6, arc: 50, lunge: 1.2, weight: 1 },
    ],
  },
};

/** Сколько врагов могут атаковать одновременно (остальные кружат и ждут). */
export const MAX_ATTACKERS = 2;
