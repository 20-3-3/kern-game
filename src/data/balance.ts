// Баланс игры: скорости, тайминги, урон, окна парирования, рост шкал.
// Менять цифры только здесь — логика берёт их отсюда.

export const PLAYER = {
  height: 1.75,
  radius: 0.35,
  maxHp: 100,
  runSpeed: 6.2,
  /** Скорость при удержании блока. */
  blockMoveSpeed: 2.2,
  /** Скорость во время атаки (лёгкий шаг вперёд). */
  attackMoveSpeed: 1.2,
  accel: 40,
  decel: 30,
  turnRate: 14,
  gravity: 28,
  dash: {
    speed: 17,
    duration: 0.2,
    /** Неуязвимость (i-frames) от начала рывка. */
    iframes: 0.24,
    cooldown: 0.5,
  },
  hurtStun: 0.35,
  /** Регенерация здоровья вне боя, ед/с. */
  regenOutOfCombat: 12,
};

export const CAMERA = {
  distance: 5.2,
  minDistance: 1.2,
  height: 1.55,
  minPitch: -0.45,
  maxPitch: 0.9,
  defaultPitch: 0.22,
  fov: 62,
  lockLambda: 7,
  /** Поворот камеры к спине игрока, когда мышь не трогают. */
  followLambda: 0,
};

export const SCOOTER = {
  maxSpeed: 12,
  accel: 6.5,
  brake: 14,
  coastDecel: 1.2,
  steerRate: 2.1,
  /** Рывок на самокате — подскок с ускорением. */
  hop: { duration: 0.55, height: 0.95, boost: 4.5, cooldown: 0.75, clearHeight: 0.3 },
  boostDecay: 3.5,
  crash: { stun: 1.0, minSpeed: 3.5 },
  radius: 0.45,
};

export const VAN = {
  startBehind: 42,
  baseSpeed: 9.2,
  /** Прирост скорости по ходу погони, м/с на 100 м. */
  rampPer100m: 0.35,
  /** Если игрок далеко впереди, минивэн подтягивается. */
  rubberBandDist: 45,
  catchDist: 3.2,
  steer: 1.4,
  maxX: 6.5,
};

/** Таймер заказа идёт быстрее реального времени, чтобы опоздание было смешным, а не долгим. */
export const ORDER_TIMER = { rate: 6 };
