import { describe, expect, it } from 'vitest';
import { cue, DialogueRunner, say, type DialogueHooks } from '../src/dialogue/engine';

const makeHooks = () => {
  const log: string[] = [];
  const hooks: DialogueHooks = {
    showLine: (s, t) => log.push(`line:${s}:${t}`),
    hideLine: () => log.push('hide'),
    showChoice: () => log.push('choice'),
    hideChoice: () => log.push('hideChoice'),
    cue: (n) => log.push(`cue:${n}`),
    choice: (id, v) => log.push(`chose:${id}=${v}`),
  };
  return { log, hooks };
};

describe('движок диалогов', () => {
  it('проигрывает реплики по времени и вызывает onDone', () => {
    const { log, hooks } = makeHooks();
    const r = new DialogueRunner(hooks);
    let done = false;
    r.play([say('leva', 'Ваш заказ у двери.', 1), cue('spawn'), say('druzhinnik', 'Где князь?', 1)], () => (done = true));
    expect(log).toContain('line:leva:Ваш заказ у двери.');
    for (let i = 0; i < 61; i++) r.update(1 / 60, false);
    expect(log).toContain('cue:spawn');
    expect(log).toContain('line:druzhinnik:Где князь?');
    for (let i = 0; i < 61; i++) r.update(1 / 60, false);
    expect(done).toBe(true);
    expect(r.active).toBe(false);
  });

  it('пропуск реплики по нажатию', () => {
    const { hooks } = makeHooks();
    const r = new DialogueRunner(hooks);
    let done = false;
    r.play([say('nika', 'Это не призрак, это стоячая волна.', 10)], () => (done = true));
    r.update(1 / 60, true);
    expect(done).toBe(true);
  });

  it('выбор ждёт игрока и передаёт значение', () => {
    const { log, hooks } = makeHooks();
    const r = new DialogueRunner(hooks);
    r.play([
      { kind: 'choice', id: 'prologue', options: [{ value: 'finish', label: 'Доиграть' }, { value: 'kill', label: 'Добить' }] },
      say('nika', 'Ясно.', 1),
    ]);
    for (let i = 0; i < 300; i++) r.update(1 / 60, true);
    expect(r.awaitingChoice).toBe(true);
    r.choose('finish');
    expect(log).toContain('chose:prologue=finish');
    expect(log).toContain('line:nika:Ясно.');
  });
});
