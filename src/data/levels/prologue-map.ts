// Карта пролога: отрезок проспекта Ленина и площадь у стены кремля.
// Ось -Z — «вперёд по проспекту». Все размеры в метрах.

export const MAP = {
  /** Начало проспекта (точка старта курьера). */
  startZ: 20,
  /** Конец проспекта, дальше площадь. */
  avenueEndZ: -520,
  roadHalfWidth: 10,
  sidewalkWidth: 6,
  /** Площадь перед кремлём. */
  square: { minX: -45, maxX: 45, minZ: -610, maxZ: -520 },
  /** Стена кремля. */
  wall: { z: -620, halfLength: 80, height: 11, thickness: 3.5 },
  lampSpacing: 28,
  treeSpacing: 14,
  fog: { color: 0x0e1828, density: 0.012 },
  /** Дальше этого камера не рисует: туман там уже сплошной (важно для телефонов). */
  viewDistance: 240,
  sky: { top: 0x02040a, horizon: 0x1b2740 },
};

/** Вывески вдоль проспекта: z, сторона (-1 левая, 1 правая), высота, цвет. Тексты вымышленные. */
export const SIGNS: { z: number; side: -1 | 1; y: number; text: string; color: string }[] = [
  { z: 13, side: 1, y: 4.5, text: 'ПЕЛЬМЕННАЯ', color: '#5fd8ff' },
  { z: -30, side: 1, y: 5, text: 'ПРЯНИКИ', color: '#ff6fb1' },
  { z: -70, side: -1, y: 4.5, text: 'АПТЕКА 24', color: '#4dff9a' },
  { z: -120, side: 1, y: 6, text: 'САМОВАРЫ', color: '#ffb347' },
  { z: -170, side: -1, y: 5, text: 'ОРУЖЕЙНАЯ ЛАВКА', color: '#5fd8ff' },
  { z: -230, side: 1, y: 4.5, text: 'ШАУРМА', color: '#ffd24d' },
  { z: -290, side: -1, y: 6.5, text: 'ГОСТИНИЦА', color: '#c48bff' },
  { z: -350, side: 1, y: 5, text: 'ЦВЕТЫ 24', color: '#ff5d7a' },
  { z: -410, side: -1, y: 5, text: 'КНИГИ', color: '#7fb8ff' },
  { z: -470, side: 1, y: 5.5, text: 'ГАРМОНИ', color: '#ffa04d' },
];

/** Башни кремля: x, тип, размер. */
export const TOWERS: { x: number; kind: 'square' | 'round' | 'gate'; size: number; height: number }[] = [
  { x: -80, kind: 'round', size: 6, height: 17 },
  { x: -40, kind: 'square', size: 7, height: 18 },
  { x: 0, kind: 'gate', size: 9, height: 22 },
  { x: 40, kind: 'square', size: 7, height: 18 },
  { x: 80, kind: 'round', size: 6, height: 17 },
];
