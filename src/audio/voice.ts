// Голоса реплик. Если в браузере есть русский синтез речи — реплики озвучиваются им
// (Ника голосом подсказывает момент последней ноты). Иначе — короткое «бормотание» звуком.

import type { AudioEngine } from './engine';
import { tone, noise } from './synth';

const VOICES: Record<string, { pitch: number; rate: number; base: number }> = {
  leva: { pitch: 1.0, rate: 1.1, base: 135 },
  nika: { pitch: 1.25, rate: 1.12, base: 215 },
  vanya: { pitch: 1.1, rate: 1.25, base: 160 },
  druzhinnik: { pitch: 0.35, rate: 0.75, base: 85 },
  restorer: { pitch: 0.8, rate: 1.0, base: 115 },
  leader: { pitch: 0.7, rate: 0.95, base: 105 },
  ded: { pitch: 0.6, rate: 0.85, base: 110 },
};

export class Voice {
  enabled = true;
  volume = 0.9;
  private ru: SpeechSynthesisVoice | null = null;

  constructor(private e: AudioEngine) {
    const pick = () => {
      try {
        const vs = window.speechSynthesis?.getVoices() ?? [];
        this.ru = vs.find((v) => v.lang.toLowerCase().startsWith('ru') && /google/i.test(v.name)) ?? vs.find((v) => v.lang.toLowerCase().startsWith('ru')) ?? null;
      } catch {
        this.ru = null;
      }
    };
    pick();
    try {
      window.speechSynthesis?.addEventListener('voiceschanged', pick);
    } catch {
      // Нет синтеза речи — будет бормотание.
    }
  }

  get hasSpeech(): boolean {
    return !!this.ru;
  }

  stop(): void {
    try {
      window.speechSynthesis?.cancel();
    } catch {
      // ничего
    }
  }

  say(speaker: string, text: string): void {
    if (!this.enabled) return;
    const v = VOICES[speaker];
    if (!v) return;
    if (this.ru) {
      try {
        const synth = window.speechSynthesis;
        synth.cancel();
        const u = new SpeechSynthesisUtterance(text.replace(/[«»]/g, ''));
        u.voice = this.ru;
        u.lang = this.ru.lang;
        u.pitch = v.pitch;
        u.rate = v.rate;
        u.volume = this.volume;
        synth.speak(u);
        return;
      } catch {
        // Упадём в бормотание.
      }
    }
    this.murmur(v.base, text, speaker);
  }

  /** Слоги-«бормотание» с формантой, длина по тексту. */
  private murmur(base: number, text: string, speaker: string): void {
    const ac = this.e.ac;
    if (!ac || ac.state !== 'running') return;
    const syll = Math.min(14, Math.max(2, Math.round(text.length / 5)));
    let t = ac.currentTime + 0.02;
    for (let i = 0; i < syll; i++) {
      const f = base * (0.9 + Math.random() * 0.3);
      const d = 0.07 + Math.random() * 0.06;
      tone(ac, this.e.voice, t, f, d, 0.07 * this.volume, 'sawtooth', { lowpass: 900 + Math.random() * 600 });
      if (speaker === 'ded' || speaker === 'vanya') noise(ac, this.e.voice, t, d, 0.02, 'bandpass', 3000);
      t += d + 0.03;
    }
  }
}
