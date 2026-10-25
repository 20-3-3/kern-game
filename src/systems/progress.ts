// Состояние прохождения: хвосты, утешения, заедание по главам, ключевые выборы.

export interface ProgressState {
  version: 1;
  /** Собранные «хвосты» (id записи, например «druzhinnik»). */
  tails: string[];
  /** Сколько раз выбрано утешение вместо правды. */
  comfortLies: number;
  /** Итоговое заедание за главу 0..1, индекс — номер главы (пролог — 0). */
  jamPerChapter: number[];
  listenedToKhozyayka: boolean;
  vetrovAlive: boolean;
  /** Выборы по главам: id выбора → значение. */
  choices: Record<string, string>;
  /** Боссы, которых добили, а не доиграли. */
  bossesKilled: string[];
  /** Пройденные главы. */
  completed: string[];
}

export const newProgress = (): ProgressState => ({
  version: 1,
  tails: [],
  comfortLies: 0,
  jamPerChapter: [],
  listenedToKhozyayka: false,
  vetrovAlive: true,
  choices: {},
  bossesKilled: [],
  completed: [],
});

const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
const isNumArr = (v: unknown): v is number[] => Array.isArray(v) && v.every((x) => typeof x === 'number' && Number.isFinite(x));

/** Проверка и починка загруженных данных: всё непонятное заменяется значениями по умолчанию. */
export const sanitizeProgress = (raw: unknown): ProgressState => {
  const d = newProgress();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  if (isStrArr(r.tails)) d.tails = [...new Set(r.tails)];
  if (typeof r.comfortLies === 'number' && r.comfortLies >= 0) d.comfortLies = Math.floor(r.comfortLies);
  if (isNumArr(r.jamPerChapter)) d.jamPerChapter = r.jamPerChapter.map((v) => Math.max(0, Math.min(1, v)));
  if (typeof r.listenedToKhozyayka === 'boolean') d.listenedToKhozyayka = r.listenedToKhozyayka;
  if (typeof r.vetrovAlive === 'boolean') d.vetrovAlive = r.vetrovAlive;
  if (r.choices && typeof r.choices === 'object' && !Array.isArray(r.choices)) {
    for (const [k, v] of Object.entries(r.choices as Record<string, unknown>)) if (typeof v === 'string') d.choices[k] = v;
  }
  if (isStrArr(r.bossesKilled)) d.bossesKilled = [...new Set(r.bossesKilled)];
  if (isStrArr(r.completed)) d.completed = [...new Set(r.completed)];
  return d;
};

export const addTail = (p: ProgressState, id: string): void => {
  if (!p.tails.includes(id)) p.tails.push(id);
};

export const setChapterJam = (p: ProgressState, chapter: number, value: number): void => {
  while (p.jamPerChapter.length <= chapter) p.jamPerChapter.push(0);
  p.jamPerChapter[chapter] = Math.max(0, Math.min(1, value));
};
