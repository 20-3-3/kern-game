// Самокат: газ, тормоз, руль, рывок-подскок, аварии. Чистая логика.

import { SCOOTER } from '../data/balance';
import { copyVec, type Vec3 } from '../core/math';
import type { Mover } from '../core/physics';
import { isPressed, type InputFrame } from '../core/input';
import type { PlayerState } from './controller';

export interface Obstacle {
  x: number;
  z: number;
  hx: number;
  hz: number;
  rotY: number;
  low: boolean;
  /** Сбитое препятствие больше не мешает (конусы разлетаются). */
  knocked: boolean;
  id: number;
}

export interface ScooterState {
  speed: number;
  boost: number;
  hopTimer: number;
  hopCooldown: number;
  hopY: number;
  crashTimer: number;
  lean: number;
  steer: number;
}

export const createScooterState = (): ScooterState => ({
  speed: 0,
  boost: 0,
  hopTimer: 0,
  hopCooldown: 0,
  hopY: 0,
  crashTimer: 0,
  lean: 0,
  steer: 0,
});

/** Пересечение круга с повёрнутым прямоугольником на земле. */
export const circleHitsRect = (px: number, pz: number, r: number, o: Obstacle): boolean => {
  const dx = px - o.x;
  const dz = pz - o.z;
  const c = Math.cos(-o.rotY);
  const s = Math.sin(-o.rotY);
  const lx = dx * c + dz * s;
  const lz = -dx * s + dz * c;
  const cx = Math.max(-o.hx, Math.min(o.hx, lx));
  const cz = Math.max(-o.hz, Math.min(o.hz, lz));
  return (lx - cx) ** 2 + (lz - cz) ** 2 < r * r;
};

export type ScooterEvent = { type: 'hop' } | { type: 'crash'; obstacle: Obstacle | null } | { type: 'knock'; obstacle: Obstacle };

export class ScooterController {
  readonly sc = createScooterState();
  hopEnabled = true;

  constructor(
    private s: PlayerState,
    private mover: Mover,
    private obstacles: Obstacle[],
  ) {}

  reset(): void {
    Object.assign(this.sc, createScooterState());
  }

  update(dt: number, f: InputFrame): ScooterEvent[] {
    const s = this.s;
    const sc = this.sc;
    const events: ScooterEvent[] = [];
    copyVec(s.prevPos, s.pos);
    s.prevYaw = s.yaw;
    sc.hopCooldown = Math.max(0, sc.hopCooldown - dt);
    sc.boost = Math.max(0, sc.boost - SCOOTER.boostDecay * dt);

    const ctrl = s.controllable && sc.crashTimer <= 0;
    if (sc.crashTimer > 0) {
      sc.crashTimer -= dt;
      sc.speed = Math.max(0, sc.speed - SCOOTER.brake * 2 * dt);
    } else if (ctrl) {
      if (f.my > 0.1) sc.speed += SCOOTER.accel * f.my * dt;
      else if (f.my < -0.1) sc.speed -= SCOOTER.brake * -f.my * dt;
      else sc.speed -= SCOOTER.coastDecel * dt;
      sc.speed = Math.max(0, Math.min(SCOOTER.maxSpeed, sc.speed));
    }

    if (ctrl && this.hopEnabled && isPressed(f, 'dash') && sc.hopCooldown <= 0 && sc.hopTimer <= 0) {
      sc.hopTimer = SCOOTER.hop.duration;
      sc.hopCooldown = SCOOTER.hop.cooldown;
      sc.boost = SCOOTER.hop.boost;
      events.push({ type: 'hop' });
    }
    if (sc.hopTimer > 0) {
      sc.hopTimer = Math.max(0, sc.hopTimer - dt);
      const t = 1 - sc.hopTimer / SCOOTER.hop.duration;
      sc.hopY = Math.sin(t * Math.PI) * SCOOTER.hop.height;
    } else {
      sc.hopY = 0;
    }

    // Руль: на малой скорости поворачивать сложнее, как на настоящем самокате.
    const steerIn = ctrl ? -f.mx : 0;
    sc.steer += (steerIn - sc.steer) * Math.min(1, dt * 10);
    const speedK = Math.min(1, 0.35 + sc.speed / 6);
    s.yaw += sc.steer * SCOOTER.steerRate * speedK * dt;
    sc.lean += (-sc.steer * Math.min(1, sc.speed / 8) * 0.35 - sc.lean) * Math.min(1, dt * 8);

    const v = sc.speed + sc.boost;
    const want = { x: Math.sin(s.yaw) * v * dt, y: -2 * dt, z: Math.cos(s.yaw) * v * dt };
    const res = this.mover.move(s.id, want);
    s.pos.x += res.delta.x;
    s.pos.y += res.delta.y;
    s.pos.z += res.delta.z;
    s.grounded = res.grounded;
    const wantLen = Math.hypot(want.x, want.z);
    const gotLen = Math.hypot(res.delta.x, res.delta.z);
    s.groundSpeed = gotLen / dt;
    s.stride += gotLen;

    // Врезался в стену или столб на скорости — авария.
    if (sc.crashTimer <= 0 && v > SCOOTER.crash.minSpeed && wantLen > 0 && gotLen < wantLen * 0.45) {
      this.crash(events, null);
    }

    // Препятствия на дороге.
    if (sc.crashTimer <= 0) {
      for (const o of this.obstacles) {
        if (o.knocked) continue;
        if (!circleHitsRect(s.pos.x, s.pos.z, SCOOTER.radius, o)) continue;
        if (o.low && sc.hopY > SCOOTER.hop.clearHeight) continue;
        if (o.low && o.hx < 0.5) {
          // Конус просто разлетается, но скорость теряется.
          o.knocked = true;
          sc.speed *= 0.7;
          events.push({ type: 'knock', obstacle: o });
          continue;
        }
        this.crash(events, o);
        break;
      }
    }
    return events;
  }

  private crash(events: ScooterEvent[], o: Obstacle | null): void {
    const s = this.s;
    const sc = this.sc;
    sc.crashTimer = SCOOTER.crash.stun;
    sc.boost = 0;
    sc.speed = 0;
    sc.hopTimer = 0;
    // Отбрасывает немного назад, чтобы не застрять в препятствии.
    const back: Vec3 = { x: -Math.sin(s.yaw) * 1.2, y: 0, z: -Math.cos(s.yaw) * 1.2 };
    const res = this.mover.move(s.id, back);
    s.pos.x += res.delta.x;
    s.pos.z += res.delta.z;
    events.push({ type: 'crash', obstacle: o });
  }
}
