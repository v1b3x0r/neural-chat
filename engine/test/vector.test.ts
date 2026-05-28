import { describe, it, expect } from 'vitest';
import { cosineSimilarity, mmrSearch } from '../src/vector.js';

describe('cosineSimilarity', () => {
  it('is 1 for identical, 0 for orthogonal', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });
  it('returns 0 on empty/mismatched vectors', () => {
    expect(cosineSimilarity([], [1])).toBe(0);
    expect(cosineSimilarity([1, 2], [1])).toBe(0);
  });
});

describe('mmrSearch', () => {
  // a = most relevant; b = near-duplicate of a (redundant); c = relevant but different direction.
  const items = [
    { id: 'a', embedding: [0.8, 0.6, 0] },
    { id: 'b', embedding: [0.79, 0.61, 0] },
    { id: 'c', embedding: [0.7, 0, 0.71] },
  ];
  it('prefers relevant + diverse picks', () => {
    const ids = mmrSearch([1, 0, 0], items, { topK: 2, lambda: 0.5 }).map(p => p.item.id);
    expect(ids[0]).toBe('a');
    expect(ids).toContain('c');
    expect(ids).not.toContain('b');
  });
  it('skips items without embeddings', () => {
    expect(mmrSearch([1, 0, 0], [{ id: 'x', embedding: null }], { topK: 3, lambda: 0.5 })).toHaveLength(0);
  });
  it('drops items below minSimilarity', () => {
    const picks = mmrSearch([1, 0, 0], [
      { id: 'rel', embedding: [1, 0, 0] },
      { id: 'irrel', embedding: [0, 1, 0] },
    ], { topK: 5, lambda: 0.5, minSimilarity: 0.15 });
    expect(picks.map(p => p.item.id)).toEqual(['rel']);
  });
});
