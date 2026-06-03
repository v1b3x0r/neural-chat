import { describe, it, expect } from 'vitest';
import { decay, reinforce, merge, prune } from '../src/consolidation.js';
import { DEFAULT_CONFIG, type EpisodicMemory } from '../src/types.js';

const DAY = 86_400_000;
const mem = (over: Partial<EpisodicMemory>): EpisodicMemory => ({
  id: 'm', content: 'c', embedding: [1, 0], importance: 5, strength: 1,
  createdAt: 0, lastRecalledAt: -1, tags: [], crystallizeAt: 4, sourceMsgIds: [], ...over,
});

describe('decay', () => {
  it('weakens by exp(-dt/tau) since lastTick', () => {
    const m = mem({ strength: 1, createdAt: 0 });
    decay([m], { now: 7 * DAY, lastTick: 0, tau: 7 });
    expect(m.strength).toBeCloseTo(Math.exp(-1));
  });
});

describe('reinforce', () => {
  it('boosts memories recalled since lastTick, not freshly-created ones', () => {
    const recalled = mem({ id: 'r', strength: 0.2, lastRecalledAt: 5 });
    const stale = mem({ id: 's', strength: 0.2, lastRecalledAt: -1 });
    reinforce([recalled, stale], { lastTick: 1, boost: 0.5 });
    expect(recalled.strength).toBeCloseTo(0.7);
    expect(stale.strength).toBeCloseTo(0.2);
  });
});

describe('merge', () => {
  it('combines near-duplicate weak memories into one', () => {
    const a = mem({ id: 'a', embedding: [1, 0], strength: 0.2, importance: 6, content: 'A' });
    const b = mem({ id: 'b', embedding: [0.999, 0.001], strength: 0.2, importance: 4, content: 'B' });
    const out = merge([a, b], { ...DEFAULT_CONFIG });
    expect(out).toHaveLength(1);
    expect(out[0]!.strength).toBeCloseTo(0.4);
    expect(out[0]!.importance).toBe(6);
    expect(out[0]!.content).toBe('A');
  });
  it('does not merge strong memories even if similar', () => {
    const a = mem({ id: 'a', embedding: [1, 0], strength: 0.9 });
    const b = mem({ id: 'b', embedding: [1, 0], strength: 0.9 });
    expect(merge([a, b], { ...DEFAULT_CONFIG })).toHaveLength(2);
  });
});

describe('prune', () => {
  it('drops memories below floor', () => {
    const out = prune([mem({ id: 'keep', strength: 0.2 }), mem({ id: 'drop', strength: 0.01 })], 0.05);
    expect(out.map(m => m.id)).toEqual(['keep']);
  });
});
