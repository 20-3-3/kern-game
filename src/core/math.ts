// Простая математика без Three.js: логика игры работает только с этими типами,
// поэтому её можно тестировать в Node без браузера.

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const vec3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });

export const copyVec = (out: Vec3, v: Vec3): Vec3 => {
  out.x = v.x;
  out.y = v.y;
  out.z = v.z;
  return out;
};

export const cloneVec = (v: Vec3): Vec3 => ({ x: v.x, y: v.y, z: v.z });

export const distXZ = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.z - b.z);

export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Плавное приближение к цели, не зависящее от частоты кадров. */
export const damp = (current: number, target: number, lambda: number, dt: number): number =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

/** Нормализует угол в диапазон (-PI, PI]. */
export const wrapAngle = (a: number): number => {
  let r = a % (Math.PI * 2);
  if (r > Math.PI) r -= Math.PI * 2;
  if (r <= -Math.PI) r += Math.PI * 2;
  return r;
};

export const lerpAngle = (a: number, b: number, t: number): number => a + wrapAngle(b - a) * t;

export const dampAngle = (current: number, target: number, lambda: number, dt: number): number =>
  lerpAngle(current, target, 1 - Math.exp(-lambda * dt));

/** Угол поворота по Y, при котором «вперёд» (+Z модели) смотрит из a в b. */
export const yawTo = (from: Vec3, to: Vec3): number => Math.atan2(to.x - from.x, to.z - from.z);

/** Вектор «вперёд» в плоскости XZ для угла yaw. */
export const forwardXZ = (yaw: number): { x: number; z: number } => ({
  x: Math.sin(yaw),
  z: Math.cos(yaw),
});

/** Детерминированный генератор случайных чисел (mulberry32). */
export const makeRng = (seed: number): (() => number) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
