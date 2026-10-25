// Захват цели: Q — взять/отпустить, колесо мыши — следующая/предыдущая цель.

import { LOCK_ON } from '../data/combat';
import { isPressed, type InputFrame } from '../core/input';
import { wrapAngle, yawTo, type Vec3 } from '../core/math';
import type { Target } from '../combat/hitbox';

export class LockOn {
  target: number | null = null;
  enabled = true;

  /** Возвращает true, если игрок что-то сделал с захватом (для заедания). */
  update(f: InputFrame, from: Vec3, camYaw: number, cands: Target[]): boolean {
    let acted = false;
    const alive = cands.filter((c) => c.alive);
    const current = alive.find((c) => c.id === this.target);
    if (this.target !== null && (!current || dist(from, current.pos) > LOCK_ON.breakRange)) {
      // Цель пропала: переключаемся на ближайшую, если она есть.
      this.target = this.best(from, camYaw, alive, true);
    }
    if (!this.enabled) {
      this.target = null;
      return false;
    }
    if (isPressed(f, 'lock')) {
      acted = true;
      this.target = this.target === null ? this.best(from, camYaw, alive, false) : null;
    }
    if (this.target !== null && (isPressed(f, 'lockNext') || isPressed(f, 'lockPrev'))) {
      acted = true;
      const sorted = alive
        .filter((c) => dist(from, c.pos) <= LOCK_ON.range)
        .map((c) => ({ c, a: wrapAngle(yawTo(from, c.pos) - camYaw) }))
        .sort((x, y) => x.a - y.a);
      const i = sorted.findIndex((s) => s.c.id === this.target);
      if (sorted.length > 1 && i >= 0) {
        const step = isPressed(f, 'lockNext') ? -1 : 1;
        this.target = sorted[(i + step + sorted.length) % sorted.length].c.id;
      }
    } else if (this.target === null && (isPressed(f, 'lockNext') || isPressed(f, 'lockPrev'))) {
      acted = true;
      this.target = this.best(from, camYaw, alive, false);
    }
    return acted;
  }

  private best(from: Vec3, camYaw: number, cands: Target[], anyAngle: boolean): number | null {
    let best: Target | null = null;
    let score = Infinity;
    for (const c of cands) {
      const d = dist(from, c.pos);
      if (d > LOCK_ON.range) continue;
      const ang = Math.abs(wrapAngle(yawTo(from, c.pos) - camYaw));
      if (!anyAngle && ang > (LOCK_ON.maxAngle * Math.PI) / 180) continue;
      const s = d + ang * 6;
      if (s < score) {
        score = s;
        best = c;
      }
    }
    return best ? best.id : null;
  }
}

const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z);
