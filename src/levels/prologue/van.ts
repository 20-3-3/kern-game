// Чёрный минивэн Реставраторов в погоне. Чистая логика: едет за игроком,
// подтягивается, если тот слишком далеко, и «ловит» на малой дистанции.

import { VAN } from '../../data/balance';

export interface VanState {
  x: number;
  z: number;
  prevX: number;
  prevZ: number;
  yaw: number;
  speed: number;
  active: boolean;
  /** Сколько метров проехано с начала погони. */
  travelled: number;
}

export const createVan = (): VanState => ({ x: 0, z: 0, prevX: 0, prevZ: 0, yaw: Math.PI, speed: 0, active: false, travelled: 0 });

export const placeVanBehind = (v: VanState, playerX: number, playerZ: number): void => {
  v.x = v.prevX = Math.max(-VAN.maxX, Math.min(VAN.maxX, playerX));
  v.z = v.prevZ = playerZ + VAN.startBehind;
  v.speed = VAN.baseSpeed;
  v.active = true;
};

/** Шаг погони. Возвращает true, если минивэн догнал игрока. */
export const updateVan = (v: VanState, dt: number, playerX: number, playerZ: number, playerSpeed: number, boost = 0): boolean => {
  v.prevX = v.x;
  v.prevZ = v.z;
  if (!v.active) return false;
  const gap = v.z - playerZ;
  let speed = VAN.baseSpeed + (v.travelled / 100) * VAN.rampPer100m + boost;
  if (gap > VAN.rubberBandDist) speed = Math.max(speed, playerSpeed + 3);
  v.speed += (speed - v.speed) * Math.min(1, dt * 2);
  const tx = Math.max(-VAN.maxX, Math.min(VAN.maxX, playerX));
  const dx = Math.max(-VAN.steer * dt * 4, Math.min(VAN.steer * dt * 4, tx - v.x));
  v.x += dx;
  v.z -= v.speed * dt;
  v.travelled += v.speed * dt;
  v.yaw = Math.PI + Math.atan2(-dx, v.speed * dt) * 0.8;
  return Math.hypot(v.x - playerX, v.z - playerZ) < VAN.catchDist;
};
