// Камера от третьего лица. Логика (углы, захват цели, тряска) отделена от Three.js:
// на выходе — позиция камеры и точка, куда она смотрит.

import { CAMERA } from '../data/balance';
import { clamp, dampAngle, damp, yawTo, type Vec3 } from '../core/math';

export type RayFn = (origin: Vec3, dir: Vec3, maxDist: number) => number;

export class CameraRig {
  yaw = 0;
  pitch = CAMERA.defaultPitch;
  distance = CAMERA.distance;
  /** Текущая дистанция с учётом стен (сглаженная). */
  private actualDist = CAMERA.distance;
  /** Сила тряски 0..1 (громкость записи, удары). */
  shake = 0;
  private impulse = 0;
  private t = 0;
  sensitivity: number;
  invertY = false;
  /** Дополнительный сдвиг точки взгляда вверх (для самоката, кат-сцен). */
  heightOffset = 0;

  constructor(sensitivity: number) {
    this.sensitivity = sensitivity;
  }

  /** Короткий толчок камеры (попадание, удар по земле). */
  kick(strength: number): void {
    this.impulse = Math.max(this.impulse, strength);
  }

  update(dt: number, lookX: number, lookY: number, pivot: Vec3, lockTarget: Vec3 | null): void {
    this.t += dt;
    this.yaw -= lookX * this.sensitivity;
    this.pitch += (this.invertY ? -lookY : lookY) * this.sensitivity;
    if (lockTarget) {
      // При захвате цели камера разворачивается так, чтобы цель была впереди.
      this.yaw = dampAngle(this.yaw, yawTo(pivot, lockTarget), CAMERA.lockLambda, dt);
      this.pitch = damp(this.pitch, 0.2, 3, dt);
    }
    this.pitch = clamp(this.pitch, CAMERA.minPitch, CAMERA.maxPitch);
    this.impulse = Math.max(0, this.impulse - dt * 3);
  }

  /** Поза камеры для рендера. pivot — интерполированная позиция игрока (у ног). */
  pose(pivot: Vec3, frameDt: number, ray?: RayFn): { pos: Vec3; look: Vec3 } {
    const look: Vec3 = { x: pivot.x, y: pivot.y + CAMERA.height + this.heightOffset, z: pivot.z };
    const cp = Math.cos(this.pitch);
    const dir: Vec3 = {
      x: -Math.sin(this.yaw) * cp,
      y: Math.sin(this.pitch),
      z: -Math.cos(this.yaw) * cp,
    };
    let want = this.distance;
    if (ray) want = Math.max(CAMERA.minDistance, Math.min(want, ray(look, dir, want + 0.3) - 0.3));
    // К стене приближаемся быстро, отдаляемся плавно.
    this.actualDist = want < this.actualDist ? want : damp(this.actualDist, want, 4, frameDt);
    const pos: Vec3 = {
      x: look.x + dir.x * this.actualDist,
      y: look.y + dir.y * this.actualDist,
      z: look.z + dir.z * this.actualDist,
    };
    const amp = this.shake * 0.06 + this.impulse * 0.12;
    if (amp > 0.0005) {
      const t = this.t * 31;
      pos.x += Math.sin(t * 1.3) * amp;
      pos.y += Math.sin(t * 1.7 + 1) * amp;
      look.x += Math.sin(t * 1.1 + 2) * amp * 0.5;
    }
    return { pos, look };
  }
}
