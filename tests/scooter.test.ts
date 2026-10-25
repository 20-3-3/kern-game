import { describe, expect, it } from 'vitest';
import { circleHitsRect, ScooterController, type Obstacle } from '../src/player/scooter';
import { createPlayerState } from '../src/player/controller';
import { FreeMover } from '../src/core/physics';
import { emptyFrame } from '../src/core/input';
import { ACTION_BIT } from '../src/data/controls';

const obstacle = (z: number, low: boolean, hx = 10): Obstacle => ({ x: 0, z, hx, hz: 0.35, rotY: 0, low, knocked: false, id: 1 });

const ride = (c: ScooterController, frames: number, hopAtFrame = -1) => {
  const events: string[] = [];
  for (let i = 0; i < frames; i++) {
    const f = { ...emptyFrame(), my: 1 };
    if (i === hopAtFrame) f.pressed = ACTION_BIT.dash;
    for (const e of c.update(1 / 60, f)) events.push(e.type);
  }
  return events;
};

describe('самокат', () => {
  it('круг пересекает прямоугольник', () => {
    expect(circleHitsRect(0, 0.6, 0.45, obstacle(0, true))).toBe(true);
    expect(circleHitsRect(0, 1.0, 0.45, obstacle(0, true))).toBe(false);
  });

  it('разгоняется до максимальной скорости', () => {
    const s = createPlayerState(1, { x: 0, y: 0, z: 0 }, 0);
    const c = new ScooterController(s, new FreeMover(), []);
    ride(c, 240);
    expect(c.sc.speed).toBeCloseTo(12, 0);
    expect(s.pos.z).toBeGreaterThan(20);
  });

  it('врезается в высокое препятствие', () => {
    const s = createPlayerState(1, { x: 0, y: 0, z: 0 }, 0);
    const c = new ScooterController(s, new FreeMover(), [obstacle(8, false)]);
    expect(ride(c, 120)).toContain('crash');
  });

  it('перепрыгивает низкое препятствие рывком', () => {
    const s = createPlayerState(1, { x: 0, y: 0, z: 0 }, 0);
    const c = new ScooterController(s, new FreeMover(), [obstacle(12, true)]);
    // Разгон ~ до 1.3 с, затем подскок незадолго до барьера.
    const before = ride(c, 80);
    expect(before).not.toContain('crash');
    const zNow = s.pos.z;
    const v = c.sc.speed;
    const framesToBarrier = Math.round(((12 - zNow) / v) * 60);
    const ev = ride(c, 120, Math.max(0, framesToBarrier - 25));
    expect(ev).toContain('hop');
    expect(ev).not.toContain('crash');
    expect(s.pos.z).toBeGreaterThan(13);
  });
});
