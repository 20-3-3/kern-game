import { describe, expect, it } from 'vitest';
import { DruzhinnikBoss, type BossEvent } from '../src/bosses/druzhinnik';
import { FreeMover } from '../src/core/physics';
import { DRUZHINNIK_BOSS as CFG } from '../src/data/bosses/druzhinnik';

const DT = 1 / 60;
const make = () => {
  const b = new DruzhinnikBoss({ x: 0, y: 0, z: 0 }, new FreeMover(), 1);
  b.start();
  return b;
};
/** Прогнать время; цель стоит рядом с боссом. */
const run = (b: DruzhinnikBoss, seconds: number, target = { x: 0, y: 0, z: 1.5 }) => {
  const ev: { t: number; e: BossEvent }[] = [];
  let t = 0;
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    t += DT;
    for (const e of b.update(DT, { target, speedMul: 1 })) ev.push({ t, e });
  }
  return ev;
};

describe('Дружинник: ритм записи', () => {
  it('«Где князь?» в начале каждой записи — каждые 40 секунд', () => {
    const b = make();
    const asks = run(b, 81).filter((x) => x.e.type === 'ask');
    expect(asks.length).toBe(3);
    expect(asks[1].t - asks[0].t).toBeCloseTo(40, 0);
    expect(CFG.loopBeats * (60 / CFG.bpm)).toBeCloseTo(40);
  });

  it('удары приходятся ровно на доли, перед каждым — предупреждение', () => {
    const b = make();
    const ev = run(b, 30);
    const beat = 60 / CFG.bpm;
    const impacts = ev.filter((x) => x.e.type === 'impact');
    expect(impacts.length).toBeGreaterThan(3);
    for (const i of impacts) {
      const frac = (i.t / beat) % 1;
      expect(Math.min(frac, 1 - frac)).toBeLessThan(DT / beat + 0.01);
    }
    const warns = ev.filter((x) => x.e.type === 'warn');
    expect(warns.length).toBeGreaterThanOrEqual(impacts.length);
  });

  it('запись повторяется: одинаковый порядок атак в двух записях подряд', () => {
    const b = make();
    const ev = run(b, 80);
    const seq = (from: number, to: number) =>
      ev.filter((x) => x.t >= from && x.t < to && x.e.type === 'windup').map((x) => (x.e as { attack: { id: string } }).attack.id);
    expect(seq(0, 40)).toEqual(seq(40, 80));
  });
});

describe('Дружинник: фазы', () => {
  it('урон ломает фазу, после паузы начинается следующая', () => {
    const b = make();
    run(b, 3);
    const r = b.takeHit(9999);
    expect(r.events.some((e) => e.type === 'phaseBroken')).toBe(true);
    expect(b.state).toBe('phaseBreak');
    const ev = run(b, 6);
    expect(ev.some((x) => x.e.type === 'phaseStart')).toBe(true);
    expect(b.phase).toBe(1);
    // Во второй фазе рог зовёт отзвуков.
    expect(ev.some((x) => x.e.type === 'summon')).toBe(true);
  });

  it('Аккорд ломает текущую фазу сразу', () => {
    const b = make();
    run(b, 3);
    const ev = b.accord();
    expect(ev[0]).toMatchObject({ type: 'phaseBroken', phase: 0, byAccord: true });
  });

  const toPhase3 = () => {
    const b = make();
    run(b, 3);
    b.takeHit(9999);
    run(b, 6);
    b.takeHit(9999);
    run(b, 6);
    expect(b.phase).toBe(2);
    return b;
  };

  it('в третьей фазе запись не добить до момента обрыва', () => {
    const b = toPhase3();
    b.takeHit(9999);
    expect(b.alive).toBe(true);
    expect(b.hp).toBeGreaterThan(0);
    const ev = run(b, 2);
    expect(ev.some((x) => x.e.type === 'cutoff' && (x.e as { active: boolean }).active)).toBe(true);
    expect(b.inCutoff).toBe(true);
  });

  it('в момент обрыва можно добить — хвоста нет', () => {
    const b = toPhase3();
    b.takeHit(9999);
    run(b, 2);
    const r = b.takeHit(9999);
    expect(r.events.some((e) => e.type === 'killed')).toBe(true);
    expect(b.state).toBe('dying');
  });

  it('Последняя нота доступна только в момент обрыва', () => {
    const b = toPhase3();
    expect(b.lastNote()).toBe(false);
    b.takeHit(9999);
    run(b, 2);
    expect(b.lastNote()).toBe(true);
    expect(b.state).toBe('lastNote');
  });

  it('пропущенный обрыв: последний удар и повтор обрыва в конце следующей записи', () => {
    const b = toPhase3();
    b.takeHit(9999);
    const ev = run(b, 45);
    const cut = ev.filter((x) => x.e.type === 'cutoff' && (x.e as { active: boolean }).active);
    expect(ev.some((x) => x.e.type === 'windup' && (x.e as { attack: { id: string } }).attack.id === 'finalBlow')).toBe(true);
    expect(cut.length).toBeGreaterThanOrEqual(2);
  });

  it('Аккорд в третьей фазе сразу ведёт к обрыву', () => {
    const b = toPhase3();
    b.accord();
    run(b, 1);
    expect(b.inCutoff).toBe(true);
  });

  it('парирование открывает запись: урон выше', () => {
    const b = make();
    run(b, 5);
    b.parried();
    expect(b.state).toBe('open');
    expect(b.takeHit(10).dealt).toBe(10 * CFG.openDamageMul);
  });
});
