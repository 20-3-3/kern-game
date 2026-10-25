// Бой Лёвы: серия из трёх ударов с окнами продолжения, блок, парирование, бросок.
// Чистая логика: на вход — ввод и список целей, на выход — попадания и действия.

import { BAG_ATTACKS, DEFENSE, KERN_ATTACKS, THROW, type PlayerAttackDef } from '../data/combat';
import { isHeld, isPressed, type InputFrame } from '../core/input';
import { wrapAngle, yawTo, type Vec3 } from '../core/math';
import type { PlayerState } from '../player/controller';
import { inArc, type Target } from './hitbox';
import type { DamageKind } from '../core/game-events';

export type CombatMode = 'none' | 'bag' | 'kern';

export interface PlayerHit {
  target: number;
  damage: number;
  kind: DamageKind;
  knockback: number;
  stagger: number;
  /** Направление отброса (единичный вектор). */
  dir: { x: number; z: number };
  attack: string;
}

export interface IncomingAttack {
  damage: number;
  heavy?: boolean;
  unblockable?: boolean;
  from: Vec3;
}

export type DefenseResult = 'parried' | 'blocked' | 'hit' | 'dodged';

export interface CombatFrame {
  hits: PlayerHit[];
  /** Действия игрока за шаг (для заедания и Аккорда). */
  actions: string[];
  /** Начало броска: id цели. */
  throwTarget: number | null;
}

export class PlayerCombat {
  mode: CombatMode = 'none';
  private clock = 0;
  attackIndex = -1;
  attackTime = 0;
  private queued = false;
  private hitIds = new Set<number>();
  blocking = false;
  private blockHeld = 0;
  private lastBlockPress = -99;
  throwTime = -1;
  /** Урон умножается на это (Громкость, бонусы). */
  damageMul = 1;
  /** Разрешено ли нападать/блокировать (обучение открывает по очереди). */
  allowAttack = true;
  allowBlock = true;
  allowThrow = true;

  constructor(private p: PlayerState) {}

  get attacks(): PlayerAttackDef[] {
    return this.mode === 'kern' ? KERN_ATTACKS : BAG_ATTACKS;
  }

  get current(): PlayerAttackDef | null {
    return this.attackIndex >= 0 ? this.attacks[this.attackIndex] : null;
  }

  get busy(): boolean {
    return this.attackIndex >= 0 || this.throwTime >= 0;
  }

  /** Прогресс удара 0..1 для анимации. */
  get swingT(): number {
    const a = this.current;
    return a ? this.attackTime / a.duration : 0;
  }

  reset(): void {
    this.attackIndex = -1;
    this.queued = false;
    this.blocking = false;
    this.throwTime = -1;
  }

  /**
   * Шаг боя. targets — враги рядом; lock — захваченная цель; throwable — кого сейчас можно бросить.
   */
  update(dt: number, f: InputFrame, targets: Target[], lock: Target | null, throwable: (id: number) => boolean): CombatFrame {
    const out: CombatFrame = { hits: [], actions: [], throwTarget: null };
    this.clock += dt;
    const p = this.p;
    if (this.mode === 'none' || !p.controllable || p.action === 'down') {
      this.reset();
      return out;
    }
    if (p.action === 'hurt' || p.action === 'dash') {
      this.attackIndex = -1;
      this.queued = false;
      this.throwTime = -1;
    }

    // Бросок: короткая анимация, цель выбирается в начале.
    if (this.throwTime >= 0) {
      this.throwTime += dt;
      if (this.throwTime >= THROW.duration) {
        this.throwTime = -1;
        p.action = 'idle';
      }
      return out;
    }

    // Блок и парирование.
    if (this.allowBlock && isPressed(f, 'block')) {
      this.lastBlockPress = this.clock;
      out.actions.push('block');
    }
    const wantBlock = this.allowBlock && isHeld(f, 'block') && p.action !== 'dash' && p.action !== 'hurt';
    if (wantBlock && this.attackIndex < 0) {
      this.blockHeld += dt;
      this.blocking = this.blockHeld >= DEFENSE.blockStartup;
      if (p.action === 'idle' || p.action === 'run') p.action = 'block';
    } else {
      this.blockHeld = 0;
      this.blocking = false;
      if (p.action === 'block') p.action = 'idle';
    }

    // Бросок (только термосумка, только по открытому врагу).
    if (this.mode === 'bag' && this.allowThrow && isPressed(f, 'accord') && this.attackIndex < 0) {
      const cand = targets
        .filter((t) => t.alive && throwable(t.id) && inArc(p.pos, p.yaw, t.pos, t.radius, THROW.range, 140))
        .sort((a, b) => dist(p.pos, a.pos) - dist(p.pos, b.pos))[0];
      if (cand) {
        p.yaw = yawTo(p.pos, cand.pos);
        this.throwTime = 0;
        p.action = 'throw';
        out.throwTarget = cand.id;
        out.actions.push('throw');
        return out;
      }
    }

    // Удары.
    const attackPressed = this.allowAttack && isPressed(f, 'attack');
    if (this.attackIndex < 0) {
      if (attackPressed && !this.blocking && p.action !== 'dash' && p.action !== 'hurt') this.startAttack(0, targets, lock, f, out);
    } else {
      const a = this.attacks[this.attackIndex];
      this.attackTime += dt;
      if (attackPressed && this.attackTime >= a.comboOpen && this.attackTime <= a.comboClose && this.attackIndex < this.attacks.length - 1) {
        this.queued = true;
      }
      // Попадания в окне удара.
      if (this.attackTime >= a.hitStart && this.attackTime <= a.hitEnd + dt * 0.5) {
        for (const t of targets) {
          if (!t.alive || this.hitIds.has(t.id)) continue;
          if (!inArc(p.pos, p.yaw, t.pos, t.radius, a.range, a.arc)) continue;
          this.hitIds.add(t.id);
          const dx = t.pos.x - p.pos.x;
          const dz = t.pos.z - p.pos.z;
          const d = Math.hypot(dx, dz) || 1;
          out.hits.push({
            target: t.id,
            damage: a.damage * this.damageMul,
            kind: a.kind,
            knockback: a.knockback,
            stagger: a.stagger,
            dir: { x: dx / d, z: dz / d },
            attack: a.id,
          });
        }
      }
      if (this.queued && this.attackTime >= a.cancelAt) {
        this.startAttack(this.attackIndex + 1, targets, lock, f, out);
      } else if (this.attackTime >= a.duration) {
        this.attackIndex = -1;
        this.queued = false;
        if (p.action === 'attack') p.action = 'idle';
      }
    }
    return out;
  }

  private startAttack(i: number, targets: Target[], lock: Target | null, f: InputFrame, out: CombatFrame): void {
    const p = this.p;
    this.attackIndex = i;
    this.attackTime = 0;
    this.queued = false;
    this.hitIds.clear();
    p.action = 'attack';
    p.actionTime = 0;
    // Мягкое наведение: на захваченную цель или ближайшего врага впереди.
    const aim =
      lock ??
      targets
        .filter((t) => t.alive && dist(p.pos, t.pos) < 4 && Math.abs(wrapAngle(yawTo(p.pos, t.pos) - p.yaw)) < 1.3)
        .sort((a, b) => dist(p.pos, a.pos) - dist(p.pos, b.pos))[0];
    if (aim) p.yaw = yawTo(p.pos, aim.pos);
    void f;
    out.actions.push(this.attacks[i].id);
  }

  /** Скорость шага вперёд во время удара (для контроллера). */
  lungeVelocity(): { x: number; z: number } | undefined {
    const a = this.current;
    if (!a) return undefined;
    const t = this.attackTime;
    const v = t < a.hitEnd ? a.lunge / a.hitEnd : 0;
    return { x: Math.sin(this.p.yaw) * v, z: Math.cos(this.p.yaw) * v };
  }

  /** Обработка вражеского удара по Лёве. */
  receive(a: IncomingAttack): DefenseResult {
    const p = this.p;
    if (p.iframes > 0) return 'dodged';
    if (a.unblockable) return 'hit';
    // Блок работает только лицом к удару.
    const facing = Math.abs(wrapAngle(yawTo(p.pos, a.from) - p.yaw)) < 1.4;
    if (this.mode !== 'none' && facing && this.clock - this.lastBlockPress <= DEFENSE.parryWindow) {
      this.lastBlockPress = -99;
      return 'parried';
    }
    if (this.blocking && facing && !a.heavy) return 'blocked';
    return 'hit';
  }
}

const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z);
