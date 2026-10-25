import { describe, expect, it } from 'vitest';
import { PlayerCombat } from '../src/combat/player-combat';
import { createPlayerState } from '../src/player/controller';
import { emptyFrame, type InputFrame } from '../src/core/input';
import { ACTION_BIT } from '../src/data/controls';
import { DEFENSE, KERN_ATTACKS } from '../src/data/combat';
import { inArc } from '../src/combat/hitbox';
import { AttackTokens, createFighter, damageFighter, parryFighter, updateFighter, isThrowable } from '../src/enemies/fighter';
import { FreeMover } from '../src/core/physics';
import { makeRng } from '../src/core/math';

const DT = 1 / 60;
const press = (a: keyof typeof ACTION_BIT, hold = false): InputFrame => ({
  ...emptyFrame(),
  pressed: ACTION_BIT[a],
  held: hold ? ACTION_BIT[a] : 0,
});

const setup = () => {
  const p = createPlayerState(1, { x: 0, y: 0, z: 0 }, 0);
  const c = new PlayerCombat(p);
  c.mode = 'kern';
  const target = { id: 7, pos: { x: 0, y: 0, z: 1.8 }, radius: 0.4, alive: true };
  return { p, c, target };
};

describe('хитбоксы', () => {
  it('дуга перед бойцом', () => {
    expect(inArc({ x: 0, y: 0, z: 0 }, 0, { x: 0, y: 0, z: 2 }, 0.4, 2, 90)).toBe(true);
    expect(inArc({ x: 0, y: 0, z: 0 }, 0, { x: 0, y: 0, z: -2 }, 0.4, 2, 90)).toBe(false);
    expect(inArc({ x: 0, y: 0, z: 0 }, 0, { x: 0, y: 0, z: 4 }, 0.4, 2, 90)).toBe(false);
  });
});

describe('серия ударов', () => {
  it('три удара подряд при нажатии в окне', () => {
    const { c, target } = setup();
    const actions: string[] = [];
    let hits = 0;
    const run = (frames: number, attackEvery = 0) => {
      for (let i = 0; i < frames; i++) {
        const f = attackEvery && i % attackEvery === 0 ? press('attack') : emptyFrame();
        const r = c.update(DT, f, [target], null, () => false);
        actions.push(...r.actions);
        hits += r.hits.length;
      }
    };
    run(78, 12);
    expect(actions.filter((a) => a.startsWith('kern'))).toEqual(['kern1', 'kern2', 'kern3']);
    expect(hits).toBe(3);
  });

  it('без повторного нажатия серия обрывается на первом ударе', () => {
    const { c, target } = setup();
    const actions: string[] = [];
    c.update(DT, press('attack'), [target], null, () => false).actions.forEach((a) => actions.push(a));
    for (let i = 0; i < 60; i++) actions.push(...c.update(DT, emptyFrame(), [target], null, () => false).actions);
    expect(actions).toEqual(['kern1']);
    expect(c.attackIndex).toBe(-1);
  });

  it('урон первого удара берётся из данных', () => {
    const { c, target } = setup();
    let dmg = 0;
    c.update(DT, press('attack'), [target], null, () => false);
    for (let i = 0; i < 30; i++) for (const h of c.update(DT, emptyFrame(), [target], null, () => false).hits) dmg += h.damage;
    expect(dmg).toBe(KERN_ATTACKS[0].damage);
  });
});

describe('блок и парирование', () => {
  it('нажатие блока прямо перед ударом — парирование', () => {
    const { c } = setup();
    c.update(DT, press('block', true), [], null, () => false);
    expect(c.receive({ damage: 10, from: { x: 0, y: 0, z: 2 } })).toBe('parried');
  });

  it('удержание блока после окна — обычный блок', () => {
    const { c } = setup();
    c.update(DT, press('block', true), [], null, () => false);
    const held = { ...emptyFrame(), held: ACTION_BIT.block };
    const frames = Math.ceil((DEFENSE.parryWindow + 0.1) / DT);
    for (let i = 0; i < frames; i++) c.update(DT, held, [], null, () => false);
    expect(c.receive({ damage: 10, from: { x: 0, y: 0, z: 2 } })).toBe('blocked');
  });

  it('тяжёлый удар блок не держит, а удар в спину не блокируется', () => {
    const { c } = setup();
    const held = { ...emptyFrame(), held: ACTION_BIT.block };
    for (let i = 0; i < 30; i++) c.update(DT, held, [], null, () => false);
    expect(c.receive({ damage: 10, heavy: true, from: { x: 0, y: 0, z: 2 } })).toBe('hit');
    expect(c.receive({ damage: 10, from: { x: 0, y: 0, z: -2 } })).toBe('hit');
  });

  it('рывок уворачивает', () => {
    const { c, p } = setup();
    p.iframes = 0.2;
    expect(c.receive({ damage: 10, from: { x: 0, y: 0, z: 2 } })).toBe('dodged');
  });
});

describe('враг-боец', () => {
  it('подходит, замахивается и бьёт', () => {
    const f = createFighter(1, 1, 'ratnik', { x: 0, y: 0, z: 6 }, Math.PI);
    f.cooldown = 0;
    const tokens = new AttackTokens(2);
    const ctx = { target: { x: 0, y: 0, z: 0 }, mover: new FreeMover(), tokens, rng: makeRng(1), speedMul: 1 };
    const states = new Set<string>();
    let struck = false;
    for (let i = 0; i < 600 && !struck; i++) {
      const e = updateFighter(f, DT, ctx);
      states.add(f.state);
      if (e?.inRange) struck = true;
    }
    expect(states.has('approach')).toBe(true);
    expect(states.has('windup')).toBe(true);
    expect(struck).toBe(true);
  });

  it('не больше двух атакующих одновременно', () => {
    const tokens = new AttackTokens(2);
    expect(tokens.take(1)).toBe(true);
    expect(tokens.take(2)).toBe(true);
    expect(tokens.take(3)).toBe(false);
    tokens.release(1);
    expect(tokens.take(3)).toBe(true);
  });

  it('после парирования враг открыт, получает больше урона и его можно бросить', () => {
    const tokens = new AttackTokens(2);
    const f = createFighter(1, 1, 'restorer', { x: 0, y: 0, z: 2 });
    parryFighter(f, { x: 0, y: 0, z: 0 }, tokens);
    expect(f.state).toBe('open');
    expect(isThrowable(f)).toBe(true);
    const r = damageFighter(f, { damage: 10, knockback: 0, stagger: 0, dir: { x: 0, z: 1 } }, tokens);
    expect(r.dealt).toBe(10 * DEFENSE.openDamageMul);
  });

  it('человек в нокауте, Отпечаток растворяется', () => {
    const tokens = new AttackTokens(2);
    const h = createFighter(1, 1, 'restorer', { x: 0, y: 0, z: 2 });
    damageFighter(h, { damage: 999, knockback: 0, stagger: 0, dir: { x: 0, z: 1 } }, tokens);
    expect(h.state).toBe('down');
    const r = createFighter(2, 2, 'ratnik', { x: 0, y: 0, z: 2 });
    damageFighter(r, { damage: 999, knockback: 0, stagger: 0, dir: { x: 0, z: 1 } }, tokens);
    expect(r.state).toBe('dead');
  });
});
