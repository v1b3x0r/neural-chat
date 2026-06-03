import { describe, it, expect } from 'vitest';
import { detectPatterns } from '../src/consolidation.js';
import { type EpisodicMemory } from '../src/types.js';

const DAY = 86_400_000;
const mem = (id: string, tags: string[], importance: number, createdAt: number): EpisodicMemory => ({
  id, content: id, embedding: [1, 0], importance, strength: 1,
  createdAt, lastRecalledAt: createdAt, tags, crystallizeAt: 4, sourceMsgIds: [],
});

describe('detectPatterns', () => {
  it('groups episodic by shared tag into pattern evidence', () => {
    const patterns = detectPatterns([
      mem('a', ['mds'], 8, 0),
      mem('b', ['mds'], 6, 2 * DAY),
      mem('c', ['food'], 3, 0),
    ]);
    const mds = patterns.find(p => p.key === 'mds')!;
    expect(mds.recurrence).toBe(2);
    expect(mds.avgImportance).toBeCloseTo(7);
    expect(mds.spanDays).toBeCloseTo(2);
    expect(mds.memberIds.sort()).toEqual(['a', 'b']);
  });
});
