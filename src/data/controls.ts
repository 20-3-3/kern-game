// Раскладка управления. Коды клавиш — KeyboardEvent.code, кнопки мыши — "Mouse0/1/2".

export const ACTIONS = [
  'attack',
  'block',
  'dash',
  'lock',
  'lockNext',
  'lockPrev',
  'accord',
  'lastNote',
  'silence',
  'pause',
  'confirm',
] as const;

export type Action = (typeof ACTIONS)[number];

export const ACTION_BIT: Record<Action, number> = Object.fromEntries(
  ACTIONS.map((a, i) => [a, 1 << i]),
) as Record<Action, number>;

export const KEY_BINDINGS: Record<string, Action> = {
  Mouse0: 'attack',
  Mouse2: 'block',
  ShiftLeft: 'dash',
  ShiftRight: 'dash',
  KeyQ: 'lock',
  KeyE: 'accord',
  KeyR: 'lastNote',
  KeyF: 'silence',
  Escape: 'pause',
  KeyP: 'pause',
  Space: 'confirm',
  Enter: 'confirm',
};

export const MOVE_KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
};

/** Чувствительность мыши по умолчанию (радиан на пиксель). */
export const DEFAULT_MOUSE_SENSITIVITY = 0.0025;
