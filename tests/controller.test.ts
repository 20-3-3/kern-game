import { describe, expect, it } from 'vitest';
import { createPlayerState, inputToWorld, PlayerController } from '../src/player/controller';
import { FreeMover } from '../src/core/physics';
import { emptyFrame } from '../src/core/input';
import { ACTION_BIT } from '../src/data/controls';
import { PLAYER } from '../src/data/balance';

const step = (c: PlayerController, frames: number, f = emptyFrame(), camYaw = 0) => {
  for (let i = 0; i < frames; i++) c.update(1 / 60, f, { camYaw });
};

describe('контроллер Лёвы', () => {
  it('W двигает от камеры вперёд, D — вправо', () => {
    expect(inputToWorld(0, 1, 0)).toEqual({ x: 0, z: 1 });
    const r = inputToWorld(1, 0, 0);
    expect(r.x).toBeCloseTo(-1);
    expect(r.z).toBeCloseTo(0);
  });

  it('бежит и разгоняется до скорости бега', () => {
    const s = createPlayerState(1, { x: 0, y: 0, z: 0 });
    const c = new PlayerController(s, new FreeMover());
    step(c, 60, { ...emptyFrame(), my: 1 });
    expect(s.pos.z).toBeGreaterThan(PLAYER.runSpeed * 0.8);
    expect(s.action).toBe('run');
  });

  it('рывок даёт неуязвимость и перезаряжается', () => {
    const s = createPlayerState(1, { x: 0, y: 0, z: 0 });
    const c = new PlayerController(s, new FreeMover());
    c.update(1 / 60, { ...emptyFrame(), pressed: ACTION_BIT.dash, held: ACTION_BIT.dash }, { camYaw: 0 });
    expect(s.action).toBe('dash');
    expect(c.hurt(10)).toBe(false);
    expect(s.hp).toBe(PLAYER.maxHp);
    // Повторный рывок сразу не срабатывает.
    step(c, 15);
    c.update(1 / 60, { ...emptyFrame(), pressed: ACTION_BIT.dash }, { camYaw: 0 });
    expect(s.action).not.toBe('dash');
  });

  it('урон снижает здоровье, ноль — падение', () => {
    const s = createPlayerState(1, { x: 0, y: 0, z: 0 });
    const c = new PlayerController(s, new FreeMover());
    c.hurt(30);
    expect(s.hp).toBe(70);
    c.hurt(100);
    expect(s.action).toBe('down');
  });
});
