// Проверка попаданий: дуга перед бойцом или круг вокруг него. Без физики.

import { wrapAngle, type Vec3 } from '../core/math';

export interface Target {
  id: number;
  pos: Vec3;
  radius: number;
  alive: boolean;
}

/** Попадает ли цель в дугу удара: дальность от центра бойца, угол — полный. */
export const inArc = (origin: Vec3, yaw: number, target: Vec3, targetRadius: number, range: number, arcDeg: number): boolean => {
  const dx = target.x - origin.x;
  const dz = target.z - origin.z;
  const d = Math.hypot(dx, dz);
  if (d > range + targetRadius) return false;
  if (d < 0.6) return true;
  const ang = Math.abs(wrapAngle(Math.atan2(dx, dz) - yaw));
  // Широкая цель «видна» под чуть большим углом.
  const slack = Math.atan2(targetRadius, d);
  return ang <= (arcDeg * Math.PI) / 360 + slack;
};

export const inRadius = (origin: Vec3, target: Vec3, targetRadius: number, radius: number): boolean =>
  Math.hypot(target.x - origin.x, target.z - origin.z) <= radius + targetRadius;
