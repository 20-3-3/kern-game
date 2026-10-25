// Сохранения в localStorage. Любое чтение и запись — в try/catch: в приватном режиме
// или при запрете хранилища игра работает, просто без сохранений.

import { newProgress, sanitizeProgress, type ProgressState } from '../systems/progress';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const PROGRESS_KEY = 'kern.progress.v1';
const SETTINGS_KEY = 'kern.settings.v1';

const defaultStorage = (): KeyValueStorage | null => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
};

export class SaveStore {
  constructor(private storage: KeyValueStorage | null = defaultStorage()) {}

  hasProgress(): boolean {
    try {
      return !!this.storage?.getItem(PROGRESS_KEY);
    } catch {
      return false;
    }
  }

  loadProgress(): ProgressState {
    try {
      const raw = this.storage?.getItem(PROGRESS_KEY);
      return raw ? sanitizeProgress(JSON.parse(raw)) : newProgress();
    } catch {
      return newProgress();
    }
  }

  saveProgress(p: ProgressState): boolean {
    try {
      if (!this.storage) return false;
      this.storage.setItem(PROGRESS_KEY, JSON.stringify(p));
      return true;
    } catch {
      return false;
    }
  }

  clearProgress(): void {
    try {
      this.storage?.removeItem(PROGRESS_KEY);
    } catch {
      // Нечего делать: хранилище недоступно.
    }
  }

  loadSettings<T extends object>(defaults: T): T {
    try {
      const raw = this.storage?.getItem(SETTINGS_KEY);
      if (!raw) return { ...defaults };
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const out = { ...defaults } as Record<string, unknown>;
      for (const k of Object.keys(defaults)) {
        if (typeof parsed[k] === typeof (defaults as Record<string, unknown>)[k]) out[k] = parsed[k];
      }
      return out as T;
    } catch {
      return { ...defaults };
    }
  }

  saveSettings(s: object): void {
    try {
      this.storage?.setItem(SETTINGS_KEY, JSON.stringify(s));
    } catch {
      // Настройки просто не сохранятся.
    }
  }
}
