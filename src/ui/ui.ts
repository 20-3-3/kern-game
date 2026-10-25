// Интерфейс поверх canvas на обычном HTML/CSS: подсказки, субтитры, пуши,
// стрим Вани, выбор, титры, затемнение, оценка клиента.

import { SPEAKERS } from '../data/text/speakers';

const el = (cls: string, parent: HTMLElement, tag = 'div'): HTMLElement => {
  const e = document.createElement(tag);
  e.className = cls;
  parent.appendChild(e);
  return e;
};

export class UI {
  readonly root: HTMLElement;
  private hintEl: HTMLElement;
  private objectiveEl: HTMLElement;
  private timerEl: HTMLElement;
  private pushesEl: HTMLElement;
  private streamEl: HTMLElement;
  private subsEl: HTMLElement;
  private choiceEl: HTMLElement;
  private titleEl: HTMLElement;
  private fadeEl: HTMLElement;
  private flashEl: HTMLElement;
  private ratingEl: HTMLElement;
  private promptEl: HTMLElement;
  private centerEl: HTMLElement;
  private replayEl: HTMLElement;
  private canvas: HTMLElement | null = document.getElementById('game');
  private glitchTimer = 0;
  private hintTimer = 0;
  private subTimer = 0;
  private centerTimer = 0;
  onChoice: ((value: string) => void) | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.objectiveEl = el('objective', root);
    this.timerEl = el('order-timer', root);
    this.pushesEl = el('pushes', root);
    this.streamEl = el('stream', root);
    this.hintEl = el('hint', root);
    this.promptEl = el('key-prompt', root);
    this.subsEl = el('subs', root);
    this.choiceEl = el('choice', root);
    this.centerEl = el('center-msg', root);
    this.titleEl = el('title-card', root);
    this.ratingEl = el('rating', root);
    this.flashEl = el('flash', root);
    this.replayEl = el('replay-overlay', root);
    this.replayEl.innerHTML = '<div class="replay-text"></div>';
    this.fadeEl = el('fade', root);
  }

  /** Обновление таймеров интерфейса (раз в кадр). */
  tick(dt: number): void {
    if (this.glitchTimer > 0) {
      this.glitchTimer -= dt;
      if (this.glitchTimer <= 0) this.canvas?.classList.remove('glitch');
    }
    if (this.hintTimer > 0) {
      this.hintTimer -= dt;
      if (this.hintTimer <= 0) this.hint(null);
    }
    if (this.subTimer > 0) {
      this.subTimer -= dt;
      if (this.subTimer <= 0) this.subtitle(null);
    }
    if (this.centerTimer > 0) {
      this.centerTimer -= dt;
      if (this.centerTimer <= 0) this.centerEl.classList.remove('show');
    }
  }

  /** Подсказка управления. Ключи в [скобках] подсвечиваются. */
  hint(text: string | null, seconds = 0): void {
    if (!text) {
      this.hintEl.classList.remove('show');
      return;
    }
    this.hintEl.innerHTML = formatKeys(text);
    this.hintEl.classList.add('show');
    this.hintTimer = seconds;
  }

  /** Контекстная клавиша (например, «R — Последняя нота»). */
  keyPrompt(text: string | null): void {
    if (!text) {
      this.promptEl.classList.remove('show');
      return;
    }
    const html = formatKeys(text);
    if (this.promptEl.innerHTML !== html) this.promptEl.innerHTML = html;
    this.promptEl.classList.add('show');
  }

  objective(text: string | null): void {
    this.objectiveEl.textContent = text ?? '';
    this.objectiveEl.classList.toggle('show', !!text);
  }

  orderTimer(text: string | null, late = false): void {
    this.timerEl.textContent = text ?? '';
    this.timerEl.classList.toggle('show', !!text);
    this.timerEl.classList.toggle('late', late);
  }

  center(text: string, seconds = 2.5): void {
    this.centerEl.innerHTML = text;
    this.centerEl.classList.add('show');
    this.centerTimer = seconds;
  }

  /** Пуш приложения доставки. */
  push(text: string): void {
    const p = el('push', this.pushesEl);
    p.innerHTML = `<div class="push-app">ПОРОГ · доставка</div><div class="push-text"></div>`;
    (p.querySelector('.push-text') as HTMLElement).textContent = text;
    requestAnimationFrame(() => p.classList.add('show'));
    setTimeout(() => p.classList.remove('show'), 5200);
    setTimeout(() => p.remove(), 5800);
    while (this.pushesEl.children.length > 3) this.pushesEl.firstElementChild?.remove();
  }

  /** Реплика Вани или донат в стриме. */
  stream(text: string, donate = false): void {
    const p = el(donate ? 'stream-msg donate' : 'stream-msg', this.streamEl);
    p.innerHTML = `<span class="live">● ЭФИР</span> <b>${donate ? 'Донат' : 'Ваня'}:</b> <span class="t"></span>`;
    (p.querySelector('.t') as HTMLElement).textContent = text;
    requestAnimationFrame(() => p.classList.add('show'));
    setTimeout(() => p.classList.remove('show'), 5500);
    setTimeout(() => p.remove(), 6200);
    while (this.streamEl.children.length > 3) this.streamEl.firstElementChild?.remove();
  }

  /** Короткая реплика вне диалога: сама исчезнет через seconds. */
  say(speaker: string, text: string, seconds = 2.2): void {
    this.subtitle(speaker, text);
    this.subTimer = seconds;
  }

  subtitle(speaker: string | null, text?: string): void {
    this.subTimer = 0;
    if (!speaker || !text) {
      this.subsEl.classList.remove('show');
      return;
    }
    const sp = SPEAKERS[speaker] ?? { name: speaker, color: '#fff' };
    this.subsEl.innerHTML = `<span class="who" style="color:${sp.color}">${sp.name}</span><span class="what"></span>`;
    (this.subsEl.querySelector('.what') as HTMLElement).textContent = text;
    this.subsEl.classList.add('show');
  }

  choice(prompt: string | undefined, options: { value: string; label: string }[] | null): void {
    this.choiceEl.innerHTML = '';
    if (!options) {
      this.choiceEl.classList.remove('show');
      return;
    }
    if (prompt) el('choice-prompt', this.choiceEl).textContent = prompt;
    options.forEach((o, i) => {
      const b = el('choice-btn', this.choiceEl, 'button') as HTMLButtonElement;
      b.innerHTML = `<span class="k">${i + 1}</span>`;
      b.append(document.createTextNode(o.label));
      b.onclick = () => this.onChoice?.(o.value);
    });
    this.choiceEl.classList.add('show');
  }

  /** Большой титр по центру (например, «Тула. 03:07»). */
  title(main: string | null, sub = ''): void {
    if (!main) {
      this.titleEl.classList.remove('show');
      return;
    }
    this.titleEl.innerHTML = `<div class="main"></div><div class="sub"></div>`;
    (this.titleEl.querySelector('.main') as HTMLElement).textContent = main;
    (this.titleEl.querySelector('.sub') as HTMLElement).textContent = sub;
    this.titleEl.classList.add('show');
  }

  /** Затемнение экрана: 0 — нет, 1 — чёрный. */
  fade(v: number, seconds = 0.6): void {
    this.fadeEl.style.transition = `opacity ${seconds}s ease`;
    this.fadeEl.style.opacity = String(v);
  }

  flash(color = '#ffffff', seconds = 0.5): void {
    this.flashEl.style.background = color;
    this.flashEl.style.transition = 'none';
    this.flashEl.style.opacity = '1';
    requestAnimationFrame(() => {
      this.flashEl.style.transition = `opacity ${seconds}s ease`;
      this.flashEl.style.opacity = '0';
    });
  }

  /** Карточка оценки клиента после босса. */
  rating(client: string, stars: number, tip: string, review: string): void {
    const s = '★'.repeat(stars) + '☆'.repeat(5 - stars);
    this.ratingEl.innerHTML = `<div class="r-app">ПОРОГ · оценка клиента</div>
      <div class="r-client"></div><div class="r-stars">${s}</div><div class="r-tip"></div><div class="r-review"></div>`;
    (this.ratingEl.querySelector('.r-client') as HTMLElement).textContent = client;
    (this.ratingEl.querySelector('.r-tip') as HTMLElement).textContent = tip;
    (this.ratingEl.querySelector('.r-review') as HTMLElement).textContent = review;
    this.ratingEl.classList.add('show');
  }

  hideRating(): void {
    this.ratingEl.classList.remove('show');
  }

  /** «Перескок» кадра при заедании: картинка дёргается и меняет цвет. */
  glitch(strength: number): void {
    const c = this.canvas;
    if (!c) return;
    c.style.setProperty('--gx', `${(Math.random() - 0.5) * 22 * strength}px`);
    c.style.setProperty('--gy', `${(Math.random() - 0.5) * 8 * strength}px`);
    c.classList.add('glitch');
    this.glitchTimer = 0.07 + strength * 0.08;
  }

  /** Повтор ввода при максимальном заедании. */
  replay(on: boolean, text = ''): void {
    this.canvas?.classList.toggle('replay', on);
    (this.replayEl.firstElementChild as HTMLElement).textContent = text;
    this.replayEl.classList.toggle('show', on);
  }

  /** Убрать всё сюжетное (при смене сцены). */
  clear(): void {
    this.hint(null);
    this.keyPrompt(null);
    this.objective(null);
    this.orderTimer(null);
    this.subtitle(null);
    this.choice(undefined, null);
    this.title(null);
    this.hideRating();
    this.centerEl.classList.remove('show');
    this.replay(false);
    this.pushesEl.innerHTML = '';
    this.streamEl.innerHTML = '';
  }
}

/** «[Shift] — рывок» → клавиша в рамке. */
export const formatKeys = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/\[([^\]]+)\]/g, '<kbd>$1</kbd>');
