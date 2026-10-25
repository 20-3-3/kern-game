import { describe, expect, it } from 'vitest';
import { SaveStore, type KeyValueStorage } from '../src/core/save';
import { addTail, newProgress, sanitizeProgress, setChapterJam } from '../src/systems/progress';

const memory = (): KeyValueStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
};

describe('сохранения', () => {
  it('сохраняет и загружает прогресс', () => {
    const store = new SaveStore(memory());
    const p = newProgress();
    addTail(p, 'druzhinnik');
    addTail(p, 'druzhinnik');
    setChapterJam(p, 0, 0.42);
    p.choices.prologue = 'finish';
    expect(store.saveProgress(p)).toBe(true);
    const loaded = store.loadProgress();
    expect(loaded.tails).toEqual(['druzhinnik']);
    expect(loaded.jamPerChapter).toEqual([0.42]);
    expect(loaded.choices.prologue).toBe('finish');
    expect(store.hasProgress()).toBe(true);
  });

  it('битые данные не ломают игру', () => {
    const mem = memory();
    mem.data.set('kern.progress.v1', '{не json');
    expect(new SaveStore(mem).loadProgress()).toEqual(newProgress());
  });

  it('хранилище, которое бросает исключения, не ломает игру', () => {
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceeded');
      },
      removeItem: () => {
        throw new Error('nope');
      },
    };
    const store = new SaveStore(broken);
    expect(store.loadProgress()).toEqual(newProgress());
    expect(store.saveProgress(newProgress())).toBe(false);
    expect(store.hasProgress()).toBe(false);
    expect(() => store.clearProgress()).not.toThrow();
    expect(store.loadSettings({ a: 1 })).toEqual({ a: 1 });
  });

  it('без хранилища вообще — тоже работает', () => {
    const store = new SaveStore(null);
    expect(store.saveProgress(newProgress())).toBe(false);
    expect(store.loadProgress()).toEqual(newProgress());
  });

  it('чинит неверные поля', () => {
    const p = sanitizeProgress({ tails: ['a', 5], comfortLies: -3, jamPerChapter: [2, 0.5], vetrovAlive: 'да', choices: { x: 'y', z: 1 } });
    expect(p.tails).toEqual([]);
    expect(p.comfortLies).toBe(0);
    expect(p.jamPerChapter).toEqual([1, 0.5]);
    expect(p.vetrovAlive).toBe(true);
    expect(p.choices).toEqual({ x: 'y' });
  });

  it('настройки: неверные типы заменяются значениями по умолчанию', () => {
    const mem = memory();
    mem.data.set('kern.settings.v1', JSON.stringify({ volume: 'громко', invert: true }));
    expect(new SaveStore(mem).loadSettings({ volume: 0.5, invert: false })).toEqual({ volume: 0.5, invert: true });
  });

  it('контрольная точка: сохранить, прочитать, стереть', () => {
    const store = new SaveStore(memory());
    expect(store.loadCheckpoint()).toBeNull();
    store.saveCheckpoint({ chapter: 'prologue', beat: 'boss' });
    expect(store.loadCheckpoint()).toEqual({ chapter: 'prologue', beat: 'boss' });
    store.clearCheckpoint();
    expect(store.loadCheckpoint()).toBeNull();
  });
});
