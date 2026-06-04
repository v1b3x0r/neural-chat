// Unit tests for the pure prospective helpers in consolidation.ts.
// End-to-end lifecycle (trigger/resolve/abandon/cap through the engine) lives in behaviors.test.ts.
import { describe, it, expect } from 'vitest';
import { decayProspective, abandonWeakProspective, capProspective } from '../src/consolidation.js';
import type { ProspectiveMemory } from '../src/types.js';

const DAY = 86_400_000;

function mk(over: Partial<ProspectiveMemory> = {}): ProspectiveMemory {
  return {
    id: 'p1', intent: 'ask about the interview', status: 'pending',
    priority: 3, contextClue: 'job interview', createdAt: 0,
    clueEmbedding: null, strength: 0.6, lastTriggeredAt: -1, ...over,
  };
}

describe('decayProspective', () => {
  it('decays a pending intent by exp(-dt/tau)', () => {
    const p = mk({ strength: 1, createdAt: 0 });
    decayProspective([p], { now: 7 * DAY, lastTick: 0, tau: 7 });
    expect(p.strength).toBeCloseTo(Math.exp(-1), 5); // dt = 1 tau
  });

  it('leaves resolved/abandoned intents untouched', () => {
    const p = mk({ strength: 1, status: 'resolved' });
    decayProspective([p], { now: 100 * DAY, lastTick: 0, tau: 7 });
    expect(p.strength).toBe(1);
  });
});

describe('abandonWeakProspective', () => {
  it('marks a pending intent below the floor as abandoned', () => {
    const p = mk({ strength: 0.02 });
    abandonWeakProspective([p], 0.05);
    expect(p.status).toBe('abandoned');
  });

  it('keeps a pending intent at or above the floor', () => {
    const p = mk({ strength: 0.05 });
    abandonWeakProspective([p], 0.05);
    expect(p.status).toBe('pending');
  });
});

describe('capProspective', () => {
  it('keeps the strongest pending up to activeCap, drops the weakest overflow', () => {
    const ps = [mk({ id: 'a', strength: 0.9 }), mk({ id: 'b', strength: 0.1 }), mk({ id: 'c', strength: 0.5 })];
    const out = capProspective(ps, { activeCap: 2, archiveCap: 10 });
    expect(out.map(p => p.id).sort()).toEqual(['a', 'c']); // b (weakest) dropped
  });

  it('archives the most-recent dead up to archiveCap, reaps older', () => {
    const ps = [
      mk({ id: 'old', status: 'resolved', createdAt: 1 }),
      mk({ id: 'mid', status: 'abandoned', createdAt: 2 }),
      mk({ id: 'new', status: 'resolved', createdAt: 3 }),
    ];
    const out = capProspective(ps, { activeCap: 10, archiveCap: 2 });
    expect(out.map(p => p.id).sort()).toEqual(['mid', 'new']); // 'old' reaped
  });

  it('budgets pending and dead separately (a full archive never evicts pending)', () => {
    const ps = [mk({ id: 'p1', status: 'pending', strength: 0.8 }), mk({ id: 'd1', status: 'resolved', createdAt: 5 })];
    const out = capProspective(ps, { activeCap: 1, archiveCap: 1 });
    expect(out).toHaveLength(2);
  });
});
