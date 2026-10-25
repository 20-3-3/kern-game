// Связь игры со звуком: слушает шину событий и решает, что и как звучит.

import type { EventBus } from '../core/events';
import type { GameEvents } from '../core/game-events';
import { SILENCE } from '../data/balance';
import type { AudioEngine } from './engine';
import type { AdaptiveMusic } from './music';

const SWINGS = new Set(['kern1', 'kern2', 'kern3', 'bag1', 'bag2', 'bag3']);

export class AudioReactions {
  private silenceLeft = 0;
  private replaying = false;

  constructor(bus: EventBus<GameEvents>, private e: AudioEngine, private music: AdaptiveMusic) {
    bus.on('sfx', ({ id, pos, volume }) => e.play(id, pos, volume ?? 1));
    bus.on('enemyWindup', ({ attack, pos, id }) => {
      if (id === 900) return;
      e.play(attack.startsWith('fork') ? 'windupHuman' : 'windupImprint', pos);
    });
    bus.on('playerAction', ({ action }) => {
      if (SWINGS.has(action)) e.play('swing');
    });
    bus.on('dash', () => e.play('dash'));
    bus.on('beat', ({ index }) => music.onExternalBeat(index));
    bus.on('jamSkip', ({ strength }) => e.stutter(0.12 + strength * 0.25));
    bus.on('jamReplay', ({ active }) => {
      this.replaying = active;
      if (active) e.stutter(0.45, 0.12);
      this.applyMuffle();
    });
    bus.on('loudness', ({ value }) => music.setLoudness(value));
    bus.on('silence', ({ active }) => {
      this.silenceLeft = active ? SILENCE.duration : 0;
      this.applyMuffle();
    });
    bus.on('push', () => e.play('push'));
    bus.on('bark', ({ speaker }) => {
      if (speaker === 'vanya' || speaker === 'donate') e.play('stream');
    });
    bus.on('music', ({ mode }) => music.setMode(mode));
  }

  private applyMuffle(): void {
    this.e.setMuffle(this.silenceLeft > 0 ? 0.55 : this.replaying ? 0.35 : 0);
  }

  update(dt: number): void {
    if (this.silenceLeft > 0) {
      this.silenceLeft -= dt;
      if (this.silenceLeft <= 0) this.applyMuffle();
    }
    this.music.update(dt);
  }
}
