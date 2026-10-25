// Управление на телефоне: плавающий джойстик в левой половине экрана,
// камера — свайпом в правой, кнопки действий под правый большой палец.
// Сенсор только «нажимает» те же действия, что клавиатура и мышь, — логика игры не меняется.

import type { Input } from '../core/input';
import type { Settings } from '../core/context';
import type { TouchButton, TouchLayout } from '../core/scene';
import type { Action } from '../data/controls';
import { TOUCH_TEXT } from '../data/text/ui';

/** Какая доля ширины экрана слева отдана джойстику. */
const JOY_ZONE = 0.45;
/** Мёртвая зона джойстика. */
const DEAD = 0.12;
/** Поворот камеры на один CSS-пиксель свайпа, радиан (при чувствительности 1). */
const LOOK_RAD_PER_PX = 0.0065;

const BUTTON_ACTIONS: Action[] = ['attack', 'block', 'dash', 'accord', 'lock', 'lockNext', 'silence', 'lastNote', 'confirm'];

export class TouchControls {
  private layer: HTMLElement;
  private joyBase: HTMLElement;
  private joyKnob: HTMLElement;
  private buttons = new Map<Action, HTMLElement>();
  private pauseBtn: HTMLElement;
  private joyId: number | null = null;
  private joyOrigin = { x: 0, y: 0 };
  private lookId: number | null = null;
  private lookLast = { x: 0, y: 0 };
  private held = new Map<number, Action>();
  private layoutKey = '';
  private move = false;
  private look = false;
  /** Подпись кнопки E в текущем бою — для подсказок («[Бросок]» или «[Аккорд]»). */
  accordLabel: string = TOUCH_TEXT.accord;
  enabled = false;

  constructor(
    parent: HTMLElement,
    private input: Input,
    private settings: Settings,
    onPause: () => void,
  ) {
    this.layer = document.createElement('div');
    this.layer.className = 'touch-layer';
    parent.appendChild(this.layer);

    this.joyBase = document.createElement('div');
    this.joyBase.className = 'joy-base';
    this.joyKnob = document.createElement('div');
    this.joyKnob.className = 'joy-knob';
    this.joyBase.appendChild(this.joyKnob);
    this.layer.appendChild(this.joyBase);

    for (const a of BUTTON_ACTIONS) {
      const b = document.createElement('div');
      b.className = `tbtn tb-${a}`;
      b.style.display = 'none';
      b.addEventListener('pointerdown', (e) => this.buttonDown(e, a, b));
      b.addEventListener('pointerup', (e) => this.buttonUp(e, b));
      b.addEventListener('pointercancel', (e) => this.buttonUp(e, b));
      b.addEventListener('lostpointercapture', (e) => this.buttonUp(e, b));
      this.layer.appendChild(b);
      this.buttons.set(a, b);
    }

    this.pauseBtn = document.createElement('div');
    this.pauseBtn.className = 'tbtn tb-pause';
    this.pauseBtn.textContent = TOUCH_TEXT.pause;
    this.pauseBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onPause();
    });
    this.layer.appendChild(this.pauseBtn);

    this.layer.addEventListener('pointerdown', this.onDown);
    this.layer.addEventListener('pointermove', this.onMove);
    this.layer.addEventListener('pointerup', this.onUp);
    this.layer.addEventListener('pointercancel', this.onUp);
    this.layer.addEventListener('contextmenu', (e) => e.preventDefault());

    const rot = document.createElement('div');
    rot.className = 'rotate-hint';
    rot.innerHTML = '<div class="rotate-icon">⟳</div><div class="rotate-main"></div><div class="rotate-sub"></div>';
    (rot.querySelector('.rotate-main') as HTMLElement).textContent = TOUCH_TEXT.rotate;
    (rot.querySelector('.rotate-sub') as HTMLElement).textContent = TOUCH_TEXT.rotateSub;
    parent.appendChild(rot);
  }

  /** Включить экранное управление (телефон, планшет). */
  setEnabled(on: boolean): void {
    this.enabled = on;
    document.body.classList.toggle('touch', on);
    this.input.touchMode = on;
    if (!on) this.releaseAll();
  }

  /** Раскладка на этот кадр. null — игра не идёт (меню, пауза, загрузка). */
  setLayout(layout: TouchLayout | null): void {
    if (!this.enabled) return;
    const visible = !!layout;
    this.layer.classList.toggle('show', visible);
    if (!layout) {
      if (this.layoutKey !== '') this.releaseAll();
      this.layoutKey = '';
      return;
    }
    this.move = layout.move;
    this.look = layout.look;
    if (!this.move && this.joyId !== null) this.endJoy();
    const key = JSON.stringify(layout);
    if (key === this.layoutKey) return;
    this.layoutKey = key;
    const wanted = new Map<Action, TouchButton>(layout.buttons.map((b) => [b.action, b]));
    for (const [a, el] of this.buttons) {
      const spec = wanted.get(a);
      if (!spec) {
        if (el.style.display !== 'none') {
          el.style.display = 'none';
          this.releaseAction(a);
        }
        continue;
      }
      el.style.display = '';
      if (el.textContent !== spec.label) el.textContent = spec.label;
      el.classList.toggle('hot', !!spec.hot);
      el.classList.toggle('dim', !!spec.dim);
      if (a === 'accord') this.accordLabel = spec.label;
    }
    this.joyBase.style.display = this.move ? '' : 'none';
  }

  private buttonDown(e: PointerEvent, a: Action, el: HTMLElement): void {
    e.preventDefault();
    e.stopPropagation();
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // Не все браузеры дают захватить касание — кнопка всё равно сработает.
    }
    this.held.set(e.pointerId, a);
    el.classList.add('down');
    this.input.touchDown(a);
  }

  private buttonUp(e: PointerEvent, el: HTMLElement): void {
    const a = this.held.get(e.pointerId);
    if (a === undefined) return;
    this.held.delete(e.pointerId);
    el.classList.remove('down');
    if (![...this.held.values()].includes(a)) this.input.touchUp(a);
  }

  private releaseAction(a: Action): void {
    for (const [id, act] of [...this.held]) if (act === a) this.held.delete(id);
    this.buttons.get(a)?.classList.remove('down');
    this.input.touchUp(a);
  }

  private onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    const w = window.innerWidth;
    if (e.clientX < w * JOY_ZONE && this.move && this.joyId === null) {
      this.joyId = e.pointerId;
      const r = this.joyRadius();
      // База появляется под пальцем, но не вылезает за край экрана.
      this.joyOrigin = {
        x: Math.max(r + 8, Math.min(w * JOY_ZONE - r, e.clientX)),
        y: Math.max(r + 8, Math.min(window.innerHeight - r - 8, e.clientY)),
      };
      this.joyBase.classList.add('active');
      this.placeBase(this.joyOrigin.x, this.joyOrigin.y);
      this.updateJoy(e.clientX, e.clientY);
    } else if (this.lookId === null && this.look && e.clientX >= w * JOY_ZONE) {
      this.lookId = e.pointerId;
      this.lookLast = { x: e.clientX, y: e.clientY };
    }
    try {
      this.layer.setPointerCapture(e.pointerId);
    } catch {
      // ничего
    }
  };

  private onMove = (e: PointerEvent) => {
    if (e.pointerId === this.joyId) {
      e.preventDefault();
      this.updateJoy(e.clientX, e.clientY);
    } else if (e.pointerId === this.lookId) {
      e.preventDefault();
      const dx = e.clientX - this.lookLast.x;
      const dy = e.clientY - this.lookLast.y;
      this.lookLast = { x: e.clientX, y: e.clientY };
      // Перевод в «пиксели мыши», чтобы камера не зависела от настройки мыши.
      const k = (LOOK_RAD_PER_PX * this.settings.touchSensitivity) / Math.max(1e-5, this.settings.mouseSensitivity);
      this.input.addLook(dx * k, dy * k);
    }
  };

  private onUp = (e: PointerEvent) => {
    if (e.pointerId === this.joyId) this.endJoy();
    if (e.pointerId === this.lookId) this.lookId = null;
  };

  private joyRadius(): number {
    return Math.max(42, Math.min(80, Math.min(window.innerWidth, window.innerHeight) * 0.15));
  }

  private placeBase(x: number, y: number): void {
    const r = this.joyRadius();
    const s = this.joyBase.style;
    s.width = s.height = `${r * 2}px`;
    s.left = `${x - r}px`;
    s.top = `${y - r}px`;
    s.bottom = 'auto';
  }

  private updateJoy(x: number, y: number): void {
    const r = this.joyRadius();
    let dx = x - this.joyOrigin.x;
    let dy = y - this.joyOrigin.y;
    const d = Math.hypot(dx, dy);
    if (d > r) {
      dx = (dx / d) * r;
      dy = (dy / d) * r;
    }
    this.joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    let nx = dx / r;
    let ny = -dy / r;
    const len = Math.hypot(nx, ny);
    if (len < DEAD) {
      nx = 0;
      ny = 0;
    } else {
      // Плавный старт после мёртвой зоны.
      const k = (len - DEAD) / (1 - DEAD) / len;
      nx *= k;
      ny *= k;
    }
    this.input.setTouchMove(nx, ny);
  }

  private endJoy(): void {
    this.joyId = null;
    this.joyKnob.style.transform = '';
    this.joyBase.classList.remove('active');
    // База возвращается в угол, чтобы было видно, где джойстик.
    const s = this.joyBase.style;
    s.left = s.top = s.width = s.height = s.bottom = '';
    this.input.setTouchMove(0, 0);
  }

  releaseAll(): void {
    this.held.clear();
    for (const el of this.buttons.values()) el.classList.remove('down');
    if (this.joyId !== null) this.endJoy();
    this.lookId = null;
    this.input.touchReset();
  }
}
