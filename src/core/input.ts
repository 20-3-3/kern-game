// Ввод: клавиатура и мышь (pointer lock). Каждый шаг логики получает снимок InputFrame.
// Снимки можно записывать и проигрывать заново — это нужно для «заедания».

import { ACTION_BIT, KEY_BINDINGS, MOVE_KEYS, type Action } from '../data/controls';

export interface InputFrame {
  /** Движение: x — вправо, y — вперёд, в диапазоне -1..1. */
  mx: number;
  my: number;
  /** Сдвиг мыши за шаг, в пикселях. */
  lookX: number;
  lookY: number;
  /** Битовая маска удерживаемых действий. */
  held: number;
  /** Действия, нажатые с прошлого шага. */
  pressed: number;
}

export const emptyFrame = (): InputFrame => ({ mx: 0, my: 0, lookX: 0, lookY: 0, held: 0, pressed: 0 });

export const isHeld = (f: InputFrame, a: Action): boolean => (f.held & ACTION_BIT[a]) !== 0;
export const isPressed = (f: InputFrame, a: Action): boolean => (f.pressed & ACTION_BIT[a]) !== 0;

export class Input {
  private keys = new Set<string>();
  private held = 0;
  private pressed = 0;
  private lookX = 0;
  private lookY = 0;
  /** Сенсорное управление: джойстик и удерживаемые кнопки на экране. */
  private touchMoveX = 0;
  private touchMoveY = 0;
  private touchHeld = 0;
  /** Колбэк для паузы: срабатывает сразу, даже если логика стоит. */
  onPause: (() => void) | null = null;
  /** Колбэк для любого нажатия (используется меню и диалогами). */
  onAnyAction: ((a: Action) => void) | null = null;
  enabled = true;

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.releaseAll);
    // Мышь слушаем на всём окне: поверх canvas может лежать экранный пульт.
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  get pointerLocked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  /** Захват мыши бессмыслен на сенсорных экранах (на iPhone его и нет). */
  touchMode = false;

  requestPointerLock(): void {
    if (this.pointerLocked || this.touchMode || typeof this.canvas.requestPointerLock !== 'function') return;
    try {
      const r = this.canvas.requestPointerLock() as unknown;
      if (r instanceof Promise) r.catch(() => undefined);
    } catch {
      // Браузер может отказать (например, сразу после выхода из lock) — повторим по клику.
    }
  }

  exitPointerLock(): void {
    if (this.pointerLocked) document.exitPointerLock();
  }

  /** Собирает снимок ввода для одного шага логики и сбрасывает накопленные нажатия. */
  sample(): InputFrame {
    const k = this.keys;
    const any = (codes: string[]) => codes.some((c) => k.has(c));
    let mx = (any(MOVE_KEYS.right) ? 1 : 0) - (any(MOVE_KEYS.left) ? 1 : 0);
    let my = (any(MOVE_KEYS.forward) ? 1 : 0) - (any(MOVE_KEYS.back) ? 1 : 0);
    // Если клавиатура молчит — движение берётся с экранного джойстика.
    if (mx === 0 && my === 0) {
      mx = this.touchMoveX;
      my = this.touchMoveY;
    }
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    const frame: InputFrame = {
      mx: this.enabled ? mx : 0,
      my: this.enabled ? my : 0,
      lookX: this.enabled ? this.lookX : 0,
      lookY: this.enabled ? this.lookY : 0,
      held: this.enabled ? this.held | this.touchHeld : 0,
      pressed: this.enabled ? this.pressed : 0,
    };
    this.pressed = 0;
    this.lookX = 0;
    this.lookY = 0;
    return frame;
  }

  /** Экранный джойстик: x — вправо, y — вперёд, -1..1. */
  setTouchMove(x: number, y: number): void {
    this.touchMoveX = x;
    this.touchMoveY = y;
  }

  /** Поворот камеры пальцем (в «пикселях мыши»). */
  addLook(dx: number, dy: number): void {
    this.lookX += dx;
    this.lookY += dy;
  }

  /** Экранная кнопка нажата. */
  touchDown(action: Action): void {
    const bit = ACTION_BIT[action];
    if ((this.touchHeld & bit) === 0 && (this.held & bit) === 0) this.pressed |= bit;
    this.touchHeld |= bit;
    if (action === 'pause') this.onPause?.();
    this.onAnyAction?.(action);
  }

  touchUp(action: Action): void {
    this.touchHeld &= ~ACTION_BIT[action];
  }

  /** Отпустить всё сенсорное (смена сцены, пауза). */
  touchReset(): void {
    this.touchHeld = 0;
    this.touchMoveX = 0;
    this.touchMoveY = 0;
  }

  private press(code: string): void {
    const action = KEY_BINDINGS[code];
    if (!action) return;
    const bit = ACTION_BIT[action];
    if ((this.held & bit) === 0) this.pressed |= bit;
    this.held |= bit;
    if (action === 'pause') this.onPause?.();
    this.onAnyAction?.(action);
  }

  private release(code: string): void {
    const action = KEY_BINDINGS[code];
    if (!action) return;
    // Действие отпускается, только если не зажата другая клавиша с тем же действием.
    const stillHeld = [...this.keys].some((c) => c !== code && KEY_BINDINGS[c] === action);
    if (!stillHeld) this.held &= ~ACTION_BIT[action];
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
    this.keys.add(e.code);
    this.press(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
    this.release(e.code);
  };

  private onMouseDown = (e: MouseEvent) => {
    // Клики по меню и кнопкам выбора — не удары.
    if ((e.target as HTMLElement | null)?.closest?.('button, .menu, .choice, .tbtn')) return;
    const code = `Mouse${e.button}`;
    this.keys.add(code);
    this.press(code);
  };

  private onMouseUp = (e: MouseEvent) => {
    const code = `Mouse${e.button}`;
    this.keys.delete(code);
    this.release(code);
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.pointerLocked) return;
    // Защита от редких огромных скачков movementX в Chrome при захвате указателя.
    if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
    this.lookX += e.movementX;
    this.lookY += e.movementY;
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const action: Action = e.deltaY > 0 ? 'lockNext' : 'lockPrev';
    this.pressed |= ACTION_BIT[action];
    this.onAnyAction?.(action);
  };

  private releaseAll = () => {
    this.keys.clear();
    this.held = 0;
  };
}

/** Кольцевой буфер последних снимков ввода. */
export class InputRecorder {
  private frames: InputFrame[] = [];
  constructor(private capacity: number) {}

  push(f: InputFrame): void {
    this.frames.push({ ...f });
    if (this.frames.length > this.capacity) this.frames.shift();
  }

  /** Копия последних кадров, от старого к новому. */
  snapshot(): InputFrame[] {
    return this.frames.map((f) => ({ ...f }));
  }

  clear(): void {
    this.frames = [];
  }
}
