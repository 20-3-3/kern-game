import { describe, expect, it } from 'vitest';
import { EventBus } from '../src/core/events';

type E = { ping: { n: number } };

describe('EventBus', () => {
  it('доставляет события подписчикам и отписывает', () => {
    const bus = new EventBus<E>();
    const got: number[] = [];
    const off = bus.on('ping', (p) => got.push(p.n));
    bus.emit('ping', { n: 1 });
    off();
    bus.emit('ping', { n: 2 });
    expect(got).toEqual([1]);
  });

  it('once срабатывает один раз', () => {
    const bus = new EventBus<E>();
    let count = 0;
    bus.once('ping', () => count++);
    bus.emit('ping', { n: 1 });
    bus.emit('ping', { n: 1 });
    expect(count).toBe(1);
  });
});
