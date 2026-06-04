import { describe, it, expect } from 'vitest';
import { TimeMachine } from './timeMachine.js';
import type { Snapshot } from '../src/ports.js';

describe('1A migration (v0 snapshot loads + ticks clean)', () => {
  it('normalizes a v0 snapshot (no persons/personRegistry/interactions) on tick', async () => {
    const tm = new TimeMachine({ seed: 1 });
    // Hand it a snapshot that PREDATES 1A: the three tiers are literally absent.
    const v0 = { messages: [], episodic: [], selfFacets: [], prospective: [], lastTick: 0 } as Snapshot;
    tm.storage.snap = v0;
    // advanceAndTick(0) exercises tick()'s normalize in ISOLATION (no ingest). Do NOT use respond()
    // here: from Task 4 on, respond() appends user+model Interactions, which would make the
    // `interactions).toEqual([])` assertion fail at later tasks' regression gates.
    await tm.advanceAndTick(0);                          // tick alone normalizes the three tiers, no crash
    expect(tm.storage.snap.persons).toEqual({});
    expect(tm.storage.snap.personRegistry).toEqual({});
    expect(tm.storage.snap.interactions).toEqual([]);
  });

  it('retrieve() also tolerates a v0 snapshot (defensive normalize)', async () => {
    const tm = new TimeMachine({ seed: 1 });
    tm.storage.snap = { messages: [], episodic: [], selfFacets: [], prospective: [], lastTick: 0 } as Snapshot;
    const ctx = await tm.retrieve('anything');          // must not throw on snap.persons undefined
    expect(ctx.episodic).toEqual([]);
  });
});
