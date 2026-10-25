// Главное меню, пауза, настройки и управление — обычный HTML поверх canvas.

import { CONTROLS_TEXT, CONTROLS_TOUCH_TEXT, MENU_TEXT, SETTINGS_TEXT } from '../data/text/ui';
import type { Settings } from '../core/context';

export interface MenuActions {
  newGame(): void;
  continueGame(): void;
  resume(): void;
  restartChapter(): void;
  toMenu(): void;
  settingsChanged(s: Settings): void;
}

const h = (tag: string, cls: string, text?: string): HTMLElement => {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

export class Menu {
  private root: HTMLElement;
  private panel: HTMLElement;
  private mode: 'main' | 'pause' | 'none' = 'none';
  /** Текст «продолжить с …» и итог пролога для главного меню. */
  continueLabel: string | null = null;
  summary: string | null = null;

  constructor(
    parent: HTMLElement,
    private settings: Settings,
    private actions: MenuActions,
    private click: () => void,
    private isTouch: () => boolean = () => false,
  ) {
    this.root = h('div', 'menu');
    this.panel = h('div', 'menu-panel');
    this.root.appendChild(this.panel);
    parent.appendChild(this.root);
  }

  get open(): boolean {
    return this.mode !== 'none';
  }

  get isPause(): boolean {
    return this.mode === 'pause';
  }

  hide(): void {
    this.mode = 'none';
    this.root.classList.remove('show', 'main', 'pause');
  }

  private button(text: string, onClick: () => void, cls = ''): HTMLButtonElement {
    const b = h('button', `menu-btn ${cls}`, text) as HTMLButtonElement;
    b.onclick = () => {
      this.click();
      onClick();
    };
    return b;
  }

  showMain(): void {
    this.mode = 'main';
    this.root.classList.add('show', 'main');
    this.root.classList.remove('pause');
    const p = this.panel;
    p.innerHTML = '';
    p.appendChild(h('div', 'menu-title', MENU_TEXT.title));
    p.appendChild(h('div', 'menu-sub', MENU_TEXT.subtitle));
    if (this.summary) p.appendChild(h('div', 'menu-summary', this.summary));
    const list = h('div', 'menu-list');
    if (this.continueLabel) list.appendChild(this.button(`${MENU_TEXT.continue} · ${this.continueLabel}`, () => this.actions.continueGame(), 'primary'));
    list.appendChild(
      this.button(MENU_TEXT.newGame, () => (this.continueLabel ? this.confirmNew() : this.actions.newGame()), this.continueLabel ? '' : 'primary'),
    );
    list.appendChild(this.button(MENU_TEXT.settings, () => this.showSettings(() => this.showMain())));
    list.appendChild(this.button(MENU_TEXT.controls, () => this.showControls(() => this.showMain())));
    p.appendChild(list);
    p.appendChild(h('div', 'menu-footer', this.isTouch() ? MENU_TEXT.footerTouch : MENU_TEXT.footer));
  }

  private confirmNew(): void {
    const p = this.panel;
    p.innerHTML = '';
    p.appendChild(h('div', 'menu-sub', MENU_TEXT.confirmNew));
    const list = h('div', 'menu-list');
    list.appendChild(this.button(MENU_TEXT.yes, () => this.actions.newGame(), 'primary'));
    list.appendChild(this.button(MENU_TEXT.no, () => this.showMain()));
    p.appendChild(list);
  }

  showPause(): void {
    this.mode = 'pause';
    this.root.classList.add('show', 'pause');
    this.root.classList.remove('main');
    const p = this.panel;
    p.innerHTML = '';
    p.appendChild(h('div', 'menu-title small', MENU_TEXT.pause));
    const list = h('div', 'menu-list');
    list.appendChild(this.button(MENU_TEXT.resume, () => this.actions.resume(), 'primary'));
    list.appendChild(this.button(MENU_TEXT.settings, () => this.showSettings(() => this.showPause())));
    list.appendChild(this.button(MENU_TEXT.controls, () => this.showControls(() => this.showPause())));
    list.appendChild(this.button(MENU_TEXT.restartChapter, () => this.actions.restartChapter()));
    list.appendChild(this.button(MENU_TEXT.toMenu, () => this.actions.toMenu()));
    p.appendChild(list);
  }

  private showControls(back: () => void): void {
    const p = this.panel;
    p.innerHTML = '';
    p.appendChild(h('div', 'menu-title small', MENU_TEXT.controls));
    const t = h('table', 'menu-controls');
    for (const [a, k] of this.isTouch() ? CONTROLS_TOUCH_TEXT : CONTROLS_TEXT) {
      const tr = document.createElement('tr');
      tr.appendChild(h('td', '', a));
      tr.appendChild(h('td', 'keys', k));
      t.appendChild(tr);
    }
    p.appendChild(t);
    p.appendChild(this.button(MENU_TEXT.back, back));
  }

  private showSettings(back: () => void): void {
    const s = this.settings;
    const p = this.panel;
    p.innerHTML = '';
    p.appendChild(h('div', 'menu-title small', MENU_TEXT.settings));
    const form = h('div', 'menu-settings');
    const changed = () => this.actions.settingsChanged(s);
    const slider = (label: string, value: number, min: number, max: number, step: number, set: (v: number) => void) => {
      const row = h('label', 'set-row');
      row.appendChild(h('span', '', label));
      const inp = document.createElement('input');
      inp.type = 'range';
      inp.min = String(min);
      inp.max = String(max);
      inp.step = String(step);
      inp.value = String(value);
      inp.oninput = () => {
        set(Number(inp.value));
        changed();
      };
      row.appendChild(inp);
      form.appendChild(row);
    };
    const check = (label: string, value: boolean, set: (v: boolean) => void) => {
      const row = h('label', 'set-row');
      row.appendChild(h('span', '', label));
      const inp = document.createElement('input');
      inp.type = 'checkbox';
      inp.checked = value;
      inp.onchange = () => {
        set(inp.checked);
        changed();
      };
      row.appendChild(inp);
      form.appendChild(row);
    };
    if (this.isTouch()) slider(SETTINGS_TEXT.touchSensitivity, s.touchSensitivity, 0.3, 2.5, 0.1, (v) => (s.touchSensitivity = v));
    else slider(SETTINGS_TEXT.sensitivity, s.mouseSensitivity, 0.0008, 0.006, 0.0002, (v) => (s.mouseSensitivity = v));
    check(SETTINGS_TEXT.invertY, s.invertY, (v) => (s.invertY = v));
    slider(SETTINGS_TEXT.master, s.masterVolume, 0, 1, 0.05, (v) => (s.masterVolume = v));
    slider(SETTINGS_TEXT.music, s.musicVolume, 0, 1, 0.05, (v) => (s.musicVolume = v));
    check(SETTINGS_TEXT.voice, s.voice, (v) => (s.voice = v));
    const row = h('label', 'set-row');
    row.appendChild(h('span', '', SETTINGS_TEXT.quality));
    const sel = document.createElement('select');
    for (const [v, t] of [['high', SETTINGS_TEXT.qualityHigh], ['low', SETTINGS_TEXT.qualityLow]]) {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = t;
      sel.appendChild(o);
    }
    sel.value = s.quality;
    sel.onchange = () => {
      s.quality = sel.value as Settings['quality'];
      changed();
    };
    row.appendChild(sel);
    form.appendChild(row);
    p.appendChild(form);
    p.appendChild(this.button(MENU_TEXT.back, back));
  }
}
