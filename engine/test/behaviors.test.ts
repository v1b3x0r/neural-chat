import { describe, it, expect, beforeEach } from 'vitest';
import { TimeMachine } from './timeMachine.js';

describe('living-memory behaviors', () => {
  let tm: TimeMachine;
  beforeEach(() => { tm = new TimeMachine({ seed: 1337 }); });

  it('1. DECAY: unrecalled memory falls below floor and is pruned', async () => {
    await tm.seedEpisodic([{ content: 'trivia', importance: 3, tags: ['x'] }]);
    await tm.advanceAndTick(60);
    expect(tm.episodic().find(m => m.content === 'trivia')).toBeUndefined();
  });

  it('2. REINFORCE: recalled memory survives where an unrecalled one dies', async () => {
    await tm.seedEpisodic([
      { content: 'mds physics layer', importance: 6, tags: ['mds'] },
      { content: 'random trivia', importance: 6, tags: ['x'] },
    ]);
    for (let d = 0; d < 8; d++) { await tm.retrieve('mds'); await tm.advanceAndTick(3); }
    const contents = tm.episodic().map(m => m.content);
    expect(contents).toContain('mds physics layer');
    expect(contents).not.toContain('random trivia');
  });

  it('3. MERGE: two near-duplicate weak memories consolidate', async () => {
    await tm.seedEpisodic([
      { content: 'likes coffee', importance: 4, tags: ['coffee'] },
      { content: 'likes coffee', importance: 4, tags: ['coffee'] },
    ]);
    await tm.advanceAndTick(5);
    expect(tm.episodic().filter(m => m.tags.includes('coffee')).length).toBeLessThanOrEqual(1);
  });

  it('4. CRYSTALLIZE: repeated pattern (seed-fixed) produces a self-facet, reproducibly', async () => {
    const run = async () => {
      const t = new TimeMachine({ seed: 2024 });
      for (let i = 0; i < 7; i++) {
        await t.seedEpisodic([{ content: `mds talk ${i}`, importance: 9, tags: ['mds'] }]);
        await t.advanceAndTick(1);
      }
      return t.selfTier().some(f => f.statement.startsWith('pattern'));
    };
    expect(await run()).toBe(true);
    expect(await run()).toBe(await run());
  });

  it('5. SELF-DECAY: an unreinforced self-facet fades out of the tier', async () => {
    const t = new TimeMachine({ seed: 1, policy: 'fixed' });
    for (let i = 0; i < 4; i++) {
      await t.seedEpisodic([{ content: `mds ${i}`, importance: 9, tags: ['mds'] }]);
      await t.advanceAndTick(1);
    }
    expect(t.selfTier().length).toBeGreaterThan(0);
    for (let i = 0; i < 12; i++) await t.advanceAndTick(60); // ~2 years, no reinforcement
    expect(t.selfTier().length).toBe(0);
  });

  it('6. RETRIEVE: bounded episodic + tail, never the full history', async () => {
    for (let i = 0; i < 50; i++) await tm.ingestUser(`msg ${i}`);
    const ctx = await tm.retrieve('anything');
    expect(ctx.episodic.length).toBeLessThanOrEqual(5);
    expect(ctx.tail.length).toBeLessThanOrEqual(8);
  });

  it('7. POLICY-SWAP: fixedK(3) crystallizes no later than randomK(3,7) on the same seed', async () => {
    const ticksToCrystallize = async (policy: 'fixed' | 'random') => {
      const t = new TimeMachine({ seed: 9, policy });
      for (let i = 0; i < 12; i++) {
        await t.seedEpisodic([{ content: `p ${i}`, importance: 9, tags: ['p'] }]);
        await t.advanceAndTick(1);
        if (t.selfTier().length) return i + 1;
      }
      return Infinity;
    };
    expect(await ticksToCrystallize('fixed')).toBeLessThanOrEqual(await ticksToCrystallize('random'));
  });

  it('8. BACKFILL: embed failure stores null, a later tick backfills', async () => {
    tm.embed.fail = true;
    await tm.seedEpisodic([{ content: 'offline note', importance: 6, tags: ['o'] }]);
    expect(tm.episodic()[0]!.embedding).toBeNull();
    tm.embed.fail = false;
    await tm.advanceAndTick(0);
    expect(tm.episodic()[0]!.embedding).not.toBeNull();
  });
});
