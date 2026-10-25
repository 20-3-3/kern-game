// Единый реестр звуков: id → синтез по умолчанию, громкость и, позже, файл.
// Когда появится готовый файл, положить его в public/audio/ и прописать file —
// движок загрузит его и будет играть вместо синтеза (лицензию — в public/CREDITS.md).

export interface SoundDef {
  /** Имя синтезатора из src/audio/synth.ts. */
  synth: string;
  volume: number;
  /** Путь относительно public/, например 'audio/parry.ogg'. */
  file?: string;
  /** Звук в пространстве: тише вдали. */
  spatial?: boolean;
  bus?: 'sfx' | 'music' | 'voice';
}

const s = (synth: string, volume = 0.8, spatial = false, bus: SoundDef['bus'] = 'sfx'): SoundDef => ({ synth, volume, spatial, bus });

export const SOUNDS: Record<string, SoundDef> = {
  kick: s('kick', 0.8, false, 'music'),
  snare: s('snare', 0.55, false, 'music'),
  hat: s('hat', 0.4, false, 'music'),
  bass: s('bass', 0.6, false, 'music'),

  bossWarn: s('bossWarn', 0.9, true),
  bossWarnHeavy: s('bossWarnHeavy', 0.9, true),
  bossSwing: s('bossSwing', 0.8, true),
  slam: s('slam', 1, true),
  swing: s('swing', 0.8),
  whiff: s('whiff', 0.5, true),
  dash: s('dash', 0.6),
  dodge: s('dodge', 0.7),
  kernHit: s('kernHit', 0.7, true),
  bagHit: s('bagHit', 0.8, true),
  throw: s('throw', 0.9, true),
  parry: s('parry', 0.9),
  block: s('block', 0.7),
  hurt: s('hurt', 0.8),
  tuningFork: s('tuningFork', 0.7),
  forkStrike: s('forkStrike', 0.6),
  windupHuman: s('enemyWindupHuman', 0.6, true),
  windupImprint: s('enemyWindupImprint', 0.6, true),
  recordRise: s('recordRise', 0.8),
  kernWake: s('kernWake', 0.8),
  horn: s('horn', 0.8, true),
  imprintSpawn: s('imprintSpawn', 0.6, true),
  ask: s('ask', 0.8, true),
  askFar: s('askFar', 0.8),
  phaseBreak: s('phaseBreak', 0.9),
  cutoff: s('cutoff', 0.9),
  lastNoteStart: s('lastNoteStart', 0.8),
  lastNote: s('lastNote', 1),
  killed: s('killed', 0.9),
  silence: s('silence', 0.8),
  accord: s('accord', 0.9),
  skip: s('skip', 0.8),
  replay: s('replay', 0.8),
  nikaVoice: s('nikaVoice', 0.6, false, 'voice'),
  hop: s('hop', 0.6),
  cone: s('cone', 0.6),
  crash: s('crash', 0.8),
  brake: s('brake', 0.7),
  push: s('push', 0.6),
  stream: s('stream', 0.6),
  cassette: s('cassette', 0.8),
  cassetteStop: s('cassetteStop', 0.8),
  uiClick: s('uiClick', 0.6),
};

/** Громкость слоёв музыки в разных состояниях игры (0..1). */
export const MUSIC_MIX: Record<string, { ambient: number; rhythm: number; record: number }> = {
  calm: { ambient: 1, rhythm: 0, record: 0 },
  chase: { ambient: 0.7, rhythm: 0.8, record: 0 },
  fight: { ambient: 0.5, rhythm: 1, record: 0 },
  kern: { ambient: 0.4, rhythm: 0.9, record: 0.6 },
  boss: { ambient: 0.3, rhythm: 1, record: 1 },
  serious: { ambient: 0.8, rhythm: 0, record: 0.4 },
  home: { ambient: 0.35, rhythm: 0, record: 0 },
  silent: { ambient: 0, rhythm: 0, record: 0 },
};

export const MUSIC = {
  bpm: 96,
  master: 0.55,
};
