// Все события шины. Новые события добавлять сюда, чтобы их типы проверялись.

import type { Vec3 } from './math';

export type DamageKind = 'light' | 'heavy' | 'accord' | 'lastNote' | 'bag' | 'throw' | 'shockwave';

export interface GameEvents {
  /** Попадание: кто, по кому, сколько и чем. */
  hit: {
    attacker: number;
    target: number;
    damage: number;
    kind: DamageKind;
    blocked: boolean;
    pos: Vec3;
  };
  /** Игрок парировал удар врага. */
  parry: { attacker: number; pos: Vec3 };
  /** Игрок что-то сделал (используют заедание и Аккорд). */
  playerAction: { action: string };
  /** Удар врага начался — звук должен предупредить в такт. */
  enemyWindup: { id: number; attack: string; pos: Vec3; heavy: boolean };
  enemyDefeated: { id: number; kind: string; pos: Vec3 };
  playerHurt: { damage: number; hp: number };
  playerDown: Record<string, never>;
  dash: { pos: Vec3 };
  /** Рывок сквозь удар: удар пришёлся на неуязвимость. */
  perfectDodge: { pos: Vec3 };
  accord: { pos: Vec3 };
  phaseBroken: { boss: string; phase: number; byAccord: boolean };
  cutoff: { boss: string; active: boolean };
  lastNote: { boss: string; tail: string };
  bossKilled: { boss: string };
  choiceMade: { id: string; value: string };
  silence: { pos: Vec3; active: boolean };
  beat: { index: number; bar: number; bpm: number };
  jamSkip: { strength: number };
  jamReplay: { active: boolean };
  jamThreshold: { level: 'calm' | 'high' | 'max' };
  loudness: { value: number };
  /** Сюжетный флаг: кат-сцена серьёзная, юмор-слой молчит. */
  serious: { on: boolean };
  sfx: { id: string; pos?: Vec3; volume?: number };
  push: { text: string };
  bark: { speaker: string; text: string };
}
