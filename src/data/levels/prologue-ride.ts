// Погоня на самокате: препятствия, контрольные точки и сюжетные триггеры по оси Z.
// low: true — низкое препятствие, его перепрыгивают рывком (Shift).

export type ObstacleKind = 'cone' | 'barrier' | 'fence' | 'car' | 'trolley';

export interface ObstacleDef {
  kind: ObstacleKind;
  /** Центр и полуразмеры прямоугольника на земле. */
  x: number;
  z: number;
  hx: number;
  hz: number;
  rotY?: number;
}

export const LOW_KINDS: ObstacleKind[] = ['cone', 'barrier'];

const cones = (z: number, xs: number[]): ObstacleDef[] => xs.map((x) => ({ kind: 'cone', x, z, hx: 0.3, hz: 0.3 }));
const barrier = (z: number, x0 = -16, x1 = 16): ObstacleDef => ({ kind: 'barrier', x: (x0 + x1) / 2, z, hx: (x1 - x0) / 2, hz: 0.35 });
const fence = (z: number, x0: number, x1: number): ObstacleDef => ({ kind: 'fence', x: (x0 + x1) / 2, z, hx: (x1 - x0) / 2, hz: 0.3 });
const car = (x: number, z: number, rotY = 0): ObstacleDef => ({ kind: 'car', x, z, hx: 1.0, hz: 2.2, rotY });

export const RIDE = {
  scooterSpawn: { x: 6.5, z: 9 },
  playerSpawn: { x: 12.5, z: 13 },
  /** Где Лёва врезается во второй минивэн и слезает с самоката. */
  endZ: -490,
  blockVanZ: -508,
  checkpoints: [6, -170, -300, -400],
  obstacles: [
    ...cones(-40, [-1, 0, 1, 2]),
    ...cones(-62, [-6, -5, 5, 6]),
    barrier(-95),
    fence(-125, -10, -1.5),
    fence(-142, 1.5, 10),
    fence(-158, -10, -1.5),
    { kind: 'trolley', x: -6, z: -192, hx: 1.4, hz: 6 },
    ...cones(-186, [0.5, 1.5, 2.5]),
    barrier(-218),
    ...cones(-242, [-7, -3, 1, 5]),
    ...cones(-252, [-5, -1, 3, 7]),
    ...cones(-262, [-7, -3, 1, 5]),
    fence(-282, -10, 0),
    barrier(-282, 0, 16),
    car(-3, -318, 0.3),
    fence(-335, 0, 10),
    barrier(-350),
    fence(-366, -10, 1),
    car(4, -380, -0.2),
    barrier(-430),
    ...cones(-448, [-4, 0, 4]),
    barrier(-466),
    fence(-480, -10, -3),
    fence(-480, 3, 10),
  ] as ObstacleDef[],
  /** Припаркованные машины у бордюров (тоже препятствия). */
  parked: [
    [-8.6, -20], [8.6, -55], [-8.6, -110], [8.6, -175], [-8.6, -230], [8.6, -265], [-8.6, -300], [8.6, -340],
    [-8.6, -395], [8.6, -420], [-8.6, -455],
  ] as [number, number][],
};

/** Сюжетные триггеры погони: срабатывают один раз, когда игрок проезжает z. */
export const RIDE_TRIGGERS: { z: number; cue: string }[] = [
  { z: 0, cue: 'rideStart' },
  { z: -55, cue: 'vanAppears' },
  { z: -80, cue: 'hopHint' },
  { z: -170, cue: 'checkpoint' },
  { z: -205, cue: 'vanya1' },
  { z: -300, cue: 'checkpoint' },
  { z: -310, cue: 'late' },
  { z: -400, cue: 'checkpoint' },
  { z: -410, cue: 'vanBoost' },
  { z: -470, cue: 'kremlinAhead' },
];
