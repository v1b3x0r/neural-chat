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

import { mergeSelfFacets } from '../src/consolidation.js';
import type { SelfFacet } from '../src/types.js';

const facet = (over: Partial<SelfFacet>): SelfFacet =>
  ({ id: 'f', statement: 's', kind: 'value', strength: 1, updatedAt: 0, embedding: [1, 0], ...over });

describe('mergeSelfFacets', () => {
  it('collapses near-duplicate facets: keeps the stronger, sums strength', () => {
    const facets = [
      facet({ id: 'a', statement: 'humid jasmine', strength: 1, embedding: [1, 0] }),
      facet({ id: 'b', statement: 'humid jasmine, reworded', strength: 2, embedding: [0.99, 0.01] }), // ~dup of a
      facet({ id: 'c', statement: 'likes coffee', strength: 1, embedding: [0, 1] }),                  // distinct
    ];
    const out = mergeSelfFacets(facets, 0.88);
    expect(out).toHaveLength(2);
    const merged = out.find(f => f.statement.includes('humid'))!;
    expect(merged.strength).toBe(3);   // 1 + 2
    expect(merged.id).toBe('b');        // stronger survivor
    expect(out.some(f => f.id === 'c')).toBe(true);
  });

  it('leaves distinct facets untouched', () => {
    const facets = [facet({ id: 'a', embedding: [1, 0] }), facet({ id: 'b', embedding: [0, 1] })];
    expect(mergeSelfFacets(facets, 0.88)).toHaveLength(2);
  });

  it('facets without an embedding pass through', () => {
    const out = mergeSelfFacets([facet({ id: 'x', embedding: null }), facet({ id: 'y', embedding: undefined })], 0.88);
    expect(out).toHaveLength(2);
  });
});
