// Движок диалогов и выборов. Работает в шагах логики, ничего не знает о DOM:
// показ реплик и кнопок делает интерфейс через хуки.

export type SpeakerId = string;

export type DialogueNode =
  /** Реплика. dur — сколько держать (по умолчанию по длине текста). */
  | { kind: 'line'; speaker: SpeakerId; text: string; dur?: number }
  /** Выбор: значение уходит в onChoice и событие choiceMade. */
  | { kind: 'choice'; id: string; prompt?: string; options: { value: string; label: string }[] }
  | { kind: 'wait'; dur: number }
  /** Сюжетная метка: сцена по ней двигает камеру, спавнит врагов и т. п. */
  | { kind: 'cue'; name: string };

export type Script = DialogueNode[];

export interface DialogueHooks {
  showLine(speaker: SpeakerId, text: string): void;
  hideLine(): void;
  showChoice(prompt: string | undefined, options: { value: string; label: string }[]): void;
  hideChoice(): void;
  cue(name: string): void;
  choice(id: string, value: string): void;
}

/** Время показа реплики по длине текста. */
export const lineDuration = (text: string): number => Math.min(8, 1.3 + text.length * 0.065);

export class DialogueRunner {
  private script: Script = [];
  private index = -1;
  private timer = 0;
  private onDone: (() => void) | null = null;
  private waitingChoice: string | null = null;

  constructor(private hooks: DialogueHooks) {}

  get active(): boolean {
    return this.index >= 0;
  }

  get awaitingChoice(): boolean {
    return this.waitingChoice !== null;
  }

  play(script: Script, onDone?: () => void): void {
    this.stop();
    this.script = script;
    this.onDone = onDone ?? null;
    this.index = -1;
    this.next();
  }

  /** Прервать без вызова onDone. */
  stop(): void {
    if (this.index >= 0) {
      this.hooks.hideLine();
      this.hooks.hideChoice();
    }
    this.index = -1;
    this.waitingChoice = null;
    this.script = [];
    this.onDone = null;
  }

  /** skip — игрок нажал «дальше»: реплика пропускается. */
  update(dt: number, skip: boolean): void {
    if (this.index < 0 || this.waitingChoice) return;
    const node = this.script[this.index];
    this.timer -= dt;
    if (node.kind === 'line' && skip) this.timer = 0;
    if (this.timer <= 0) this.next();
  }

  choose(value: string): void {
    if (!this.waitingChoice) return;
    const id = this.waitingChoice;
    this.waitingChoice = null;
    this.hooks.hideChoice();
    this.hooks.choice(id, value);
    this.next();
  }

  private next(): void {
    this.index++;
    if (this.index >= this.script.length) {
      this.hooks.hideLine();
      const done = this.onDone;
      this.index = -1;
      this.script = [];
      this.onDone = null;
      done?.();
      return;
    }
    const node = this.script[this.index];
    switch (node.kind) {
      case 'line':
        this.timer = node.dur ?? lineDuration(node.text);
        this.hooks.showLine(node.speaker, node.text);
        break;
      case 'choice':
        this.hooks.hideLine();
        this.waitingChoice = node.id;
        this.hooks.showChoice(node.prompt, node.options);
        break;
      case 'wait':
        this.hooks.hideLine();
        this.timer = node.dur;
        break;
      case 'cue':
        this.timer = 0;
        this.hooks.cue(node.name);
        // Метка не занимает времени: сразу к следующему узлу.
        if (this.index >= 0 && this.script[this.index] === node) this.next();
        break;
    }
  }
}

/** Короткий способ записывать сценарии в данных. */
export const say = (speaker: SpeakerId, text: string, dur?: number): DialogueNode => ({ kind: 'line', speaker, text, dur });
export const cue = (name: string): DialogueNode => ({ kind: 'cue', name });
export const wait = (dur: number): DialogueNode => ({ kind: 'wait', dur });
