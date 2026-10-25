// Надписи интерфейса.

export const HUD_TEXT = {
  hp: 'Лёва',
  accord: 'Аккорд',
  jam: 'Заедание',
  silenceReady: '[F] Тишина',
  silenceCooldown: 'Тишина',
};

export const MENU_TEXT = {
  title: 'КЕРН',
  subtitle: 'Пролог · «Ваш заказ у двери»',
  newGame: 'Новая игра',
  continue: 'Продолжить',
  settings: 'Настройки',
  controls: 'Управление',
  back: 'Назад',
  resume: 'Продолжить',
  restartChapter: 'Начать пролог заново',
  toMenu: 'В главное меню',
  pause: 'Пауза',
  clickToPlay: 'Кликни по экрану, чтобы управлять камерой мышью',
  confirmNew: 'Начать заново? Прогресс пролога будет сброшен.',
  yes: 'Да',
  no: 'Нет',
  done: 'Пролог пройден',
  footer: 'Звук включается после первого клика · лучше всего в Google Chrome',
  checkpoint: {
    ride: 'Проспект Ленина',
    brawl: 'Минивэн у площади',
    kern: 'Ворота кремля',
    boss: 'Дружинник',
    home: 'Дом',
  } as Record<string, string>,
  summary: (tails: number, choice: string | undefined, jam: number) =>
    `Хвостов записи: ${tails} · Дружинник: ${choice === 'kill' ? 'добит' : choice === 'finish' ? 'доигран' : '—'} · Заедание: ${Math.round(jam * 100)}%`,
};

export const SETTINGS_TEXT = {
  sensitivity: 'Чувствительность мыши',
  invertY: 'Инверсия по вертикали',
  master: 'Общая громкость',
  music: 'Музыка',
  voice: 'Озвучка реплик (синтез речи браузера)',
  quality: 'Качество графики',
  qualityHigh: 'Высокое',
  qualityLow: 'Экономное',
};

export const CONTROLS_TEXT: [string, string][] = [
  ['Движение', 'W A S D'],
  ['Камера', 'мышь'],
  ['Удар (серия из трёх)', 'ЛКМ'],
  ['Блок / парирование', 'ПКМ (держать / нажать в момент удара)'],
  ['Рывок', 'Shift'],
  ['Захват цели', 'Q или колесо мыши'],
  ['Аккорд · бросок (против людей)', 'E'],
  ['Последняя нота', 'R'],
  ['Датчик Ники «Тишина»', 'F'],
  ['Пропустить реплику', 'Пробел'],
  ['Пауза', 'Esc или P'],
];
