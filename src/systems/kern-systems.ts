// Системы боя керном вместе: заедание (с повтором ввода), шкала Аккорда.
// Слушают шину событий и сообщают о порогах тоже через шину.

import { JAM } from '../data/balance';
import type { EventBus } from '../core/events';
import type { GameEvents } from '../core/game-events';
import { InputRecorder, type InputFrame } from '../core/input';
import { ACTION_BIT } from '../data/controls';
import { JamMeter } from './jam';
import { AccordGauge } from './accord';

export class KernSystems {
  readonly jam = new JamMeter();
  readonly accord = new AccordGauge();
  private recorder = new InputRecorder(Math.round(JAM.replaySeconds * 60));
  private replayFrames: InputFrame[] | null = null;
  private replayIndex = 0;
  /** Системы работают только в бою керном. */
  enabled = false;
  private offs: (() => void)[] = [];

  constructor(private bus: EventBus<GameEvents>, private playerId: () => number) {
    this.offs.push(
      bus.on('playerAction', ({ action }) => {
        if (!this.enabled || this.replaying) return;
        this.jam.record(action);
        this.accord.onAction(action);
      }),
      bus.on('hit', (e) => {
        if (this.enabled && e.attacker === this.playerId()) this.accord.onHit();
      }),
      bus.on('perfectDodge', () => {
        if (this.enabled) this.accord.onDodgeThrough();
      }),
    );
  }

  get replaying(): boolean {
    return this.replayFrames !== null;
  }

  /**
   * Пропустить ввод через систему: живой кадр записывается, а во время повтора
   * вместо него идёт записанный (камера остаётся у игрока).
   */
  filter(f: InputFrame): InputFrame {
    if (!this.enabled) return f;
    if (this.replayFrames) {
      const rec = this.replayFrames[this.replayIndex++];
      if (!rec || this.replayIndex >= this.replayFrames.length) {
        this.replayFrames = null;
        this.bus.emit('jamReplay', { active: false });
        return f;
      }
      return { ...rec, lookX: f.lookX, lookY: f.lookY, pressed: rec.pressed & ~PAUSE_MASK, held: rec.held };
    }
    this.recorder.push(f);
    return f;
  }

  update(dt: number, inCombat: boolean): void {
    if (!this.enabled) return;
    for (const e of this.jam.update(dt, inCombat)) {
      if (e.type === 'level') this.bus.emit('jamThreshold', { level: e.level });
      if (e.type === 'skip') this.bus.emit('jamSkip', { strength: e.strength });
      if (e.type === 'replay') {
        this.replayFrames = this.recorder.snapshot();
        this.replayIndex = 0;
        this.recorder.clear();
        if (this.replayFrames.length > 0) this.bus.emit('jamReplay', { active: true });
        else this.replayFrames = null;
      }
    }
    this.accord.blocked = this.jam.high;
  }

  dispose(): void {
    this.offs.forEach((o) => o());
  }
}

// Пауза в повторе не проигрывается.
const PAUSE_MASK = ACTION_BIT.pause;
