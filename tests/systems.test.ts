import { describe, expect, it } from 'vitest';
import { JamMeter } from '../src/systems/jam';
import { AccordGauge } from '../src/systems/accord';
import { Loudness } from '../src/systems/loudness';
import { JAM, LOUDNESS, SILENCE } from '../src/data/balance';

describe('заедание', () => {
  it('одна и та же связка поднимает шкалу до порога и выше', () => {
    const j = new JamMeter();
    for (let i = 0; i < 10; i++) ['kern1', 'kern2', 'kern3'].forEach((a) => j.record(a));
    expect(j.value).toBeGreaterThanOrEqual(JAM.highThreshold);
    expect(j.enemySpeedMul).toBeGreaterThan(1);
  });

  it('разнообразие держит шкалу низкой', () => {
    const j = new JamMeter();
    const moves = ['kern1', 'dash', 'kern2', 'block', 'parry', 'kern1', 'lock', 'kern2', 'kern3', 'dash', 'silence', 'kern1', 'parry'];
    for (let r = 0; r < 3; r++) for (let i = 0; i < moves.length; i++) j.record(moves[(i * 7 + r * 3) % moves.length]);
    expect(j.value).toBeLessThan(JAM.highThreshold);
  });

  it('на максимуме запускается повтор ввода, после него шкала падает', () => {
    const j = new JamMeter();
    for (let i = 0; i < 40; i++) j.record('kern1');
    expect(j.value).toBe(1);
    const ev = j.update(1 / 60, true);
    expect(ev.some((e) => e.type === 'replay')).toBe(true);
    expect(j.value).toBe(JAM.afterReplay);
  });

  it('при высоком заедании бывают «перескоки» кадра', () => {
    const j = new JamMeter();
    j.value = 0.8;
    let skips = 0;
    for (let i = 0; i < 600; i++) skips += j.update(1 / 60, true, () => 0.5).filter((e) => e.type === 'skip').length;
    expect(skips).toBeGreaterThan(2);
  });

  it('среднее за главу считается по времени боя', () => {
    const j = new JamMeter();
    j.value = 0.4;
    for (let i = 0; i < 60; i++) j.update(1 / 60, true);
    j.value = 0.4;
    for (let i = 0; i < 60; i++) j.update(1 / 60, false);
    expect(j.chapterAverage()).toBeCloseTo(0.4, 1);
  });
});

describe('Аккорд', () => {
  it('парирования и разные приёмы заряжают шкалу', () => {
    const a = new AccordGauge();
    ['kern1', 'dash', 'parry', 'lock', 'kern2', 'parry', 'block', 'parry', 'dash', 'parry'].forEach((x) => a.onAction(x));
    expect(a.value).toBeGreaterThan(0.8);
  });

  it('при высоком заедании не заряжается', () => {
    const a = new AccordGauge();
    a.blocked = true;
    ['parry', 'parry', 'dash', 'lock'].forEach((x) => a.onAction(x));
    a.onHit();
    expect(a.value).toBe(0);
  });

  it('тратится только полной', () => {
    const a = new AccordGauge();
    a.value = 0.9;
    expect(a.spend()).toBe(false);
    a.value = 1;
    expect(a.spend()).toBe(true);
    expect(a.value).toBe(0);
  });
});

describe('громкость', () => {
  it('серия попаданий без пауз повышает громкость', () => {
    const l = new Loudness();
    for (let i = 0; i < 10; i++) {
      l.onHit();
      l.update(0.3, false);
    }
    expect(l.value).toBeGreaterThan(LOUDNESS.base + 0.1);
  });

  it('удары с паузами громкость не поднимают', () => {
    const l = new Loudness();
    for (let i = 0; i < 10; i++) {
      l.onHit();
      l.update(1.5, false);
    }
    expect(l.value).toBeCloseTo(LOUDNESS.base, 2);
  });

  it('огонь повышает, датчик «Тишина» понижает и замедляет запись', () => {
    const l = new Loudness();
    for (let i = 0; i < 300; i++) l.update(1 / 60, true);
    const loud = l.value;
    expect(loud).toBeGreaterThan(LOUDNESS.base);
    const fast = l.speedMul;
    expect(l.deploySilence()).toBe(true);
    expect(l.speedMul).toBeLessThan(fast);
    for (let i = 0; i < 120; i++) l.update(1 / 60, false);
    expect(l.value).toBeLessThan(loud);
    expect(l.deploySilence()).toBe(false);
    for (let i = 0; i < (SILENCE.duration + SILENCE.cooldown) * 60; i++) l.update(1 / 60, false);
    expect(l.silenceReady).toBe(true);
  });

  it('громкость влияет на урон и скорость босса', () => {
    const l = new Loudness();
    l.value = 1;
    expect(l.damageMul).toBeCloseTo(LOUDNESS.damageMulAtMax);
    expect(l.speedMul).toBeCloseTo(LOUDNESS.speedMulAtMax);
  });
});
