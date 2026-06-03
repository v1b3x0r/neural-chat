import { describe, it, expect } from 'vitest';
import { SeededRandom } from '../src/random.js';

describe('SeededRandom', () => {
  it('is reproducible for the same seed', () => {
    const a = new SeededRandom(1337);
    const b = new SeededRandom(1337);
    expect([a.float(), a.float(), a.float()]).toEqual([b.float(), b.float(), b.float()]);
  });

  it('float() stays in [0,1)', () => {
    const r = new SeededRandom(1);
    for (let i = 0; i < 1000; i++) {
      const x = r.float();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('int(min,max) is inclusive and within range', () => {
    const r = new SeededRandom(42);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const x = r.int(3, 7);
      expect(x).toBeGreaterThanOrEqual(3);
      expect(x).toBeLessThanOrEqual(7);
      seen.add(x);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6, 7]);
  });
});
