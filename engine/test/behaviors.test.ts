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

describe('prospective trigger (dormant until the clue matches)', () => {
  it('does NOT inject a pending intent when the query is unrelated', async () => {
    const tm = new TimeMachine({ seed: 1 });
    tm.storage.snap.prospective.push({
      id: 'p1', intent: 'ask how the job interview went', status: 'pending',
      priority: 3, contextClue: 'job interview',
      clueEmbedding: await tm.embed.embed('job interview'),
      strength: 0.6, createdAt: tm.clock.now(), lastTriggeredAt: -1,
    });
    const ctx = await tm.retrieve('what is the weather today');
    expect(ctx.prospective).toHaveLength(0);
  });

  it('injects + reinforces a pending intent when the query matches the clue', async () => {
    const tm = new TimeMachine({ seed: 1 });
    tm.storage.snap.prospective.push({
      id: 'p1', intent: 'ask how the job interview went', status: 'pending',
      priority: 3, contextClue: 'job interview',
      clueEmbedding: await tm.embed.embed('job interview'),
      strength: 0.6, createdAt: tm.clock.now(), lastTriggeredAt: -1,
    });
    const ctx = await tm.retrieve('how did the job interview go');
    expect(ctx.prospective.map(p => p.id)).toEqual(['p1']);
    const stored = tm.storage.snap.prospective[0]!;
    expect(stored.lastTriggeredAt).toBe(tm.clock.now());
    expect(stored.strength).toBeGreaterThan(0.6); // reinforced by boost on trigger
  });

  it('respects the cooldown: a just-triggered intent stays dormant until cooldown elapses', async () => {
    const tm = new TimeMachine({ seed: 1 });
    tm.storage.snap.prospective.push({
      id: 'p1', intent: 'ask how the job interview went', status: 'pending',
      priority: 3, contextClue: 'job interview',
      clueEmbedding: await tm.embed.embed('job interview'),
      strength: 0.6, createdAt: tm.clock.now(), lastTriggeredAt: -1,
    });
    const first = await tm.retrieve('how did the job interview go');
    expect(first.prospective).toHaveLength(1);
    const second = await tm.retrieve('and the job interview follow-up'); // same day -> cooled down
    expect(second.prospective).toHaveLength(0);
    tm.clock.advanceDays(2); // past prospectiveCooldownDays (1)
    const third = await tm.retrieve('back to the job interview');
    expect(third.prospective).toHaveLength(1);
  });

  it('does NOT trigger a pending intent whose clueEmbedding is null (embed failed)', async () => {
    const tm = new TimeMachine({ seed: 1 });
    tm.storage.snap.prospective.push({
      id: 'p_null', intent: 'ask how the job interview went', status: 'pending',
      priority: 3, contextClue: 'job interview',
      clueEmbedding: null, // embed failed at creation; must stay dormant until backfilled
      strength: 0.6, createdAt: tm.clock.now(), lastTriggeredAt: -1,
    });
    const ctx = await tm.retrieve('how did the job interview go'); // would match if embedding existed
    expect(ctx.prospective).toHaveLength(0); // null embedding is suppressed by design, not by luck
  });
});

describe('prospective creation (embed clue, init strength, dedup, normalize)', () => {
  it('embeds the clue and initializes strength from priority on creation', async () => {
    const tm = new TimeMachine({ seed: 1 });
    tm.chat.extractQueue.push({
      episodic: [],
      prospective: [{ intent: 'ask about the trip', priority: 5, contextClue: 'vacation trip' }],
    });
    await tm.respond('I am planning a vacation trip');
    const p = tm.storage.snap.prospective[0]!;
    expect(p.clueEmbedding).not.toBeNull();
    expect(p.strength).toBeCloseTo(1, 5); // priority 5 / 5
    expect(p.lastTriggeredAt).toBe(-1);
  });

  it('dedups a new intent whose clue nearly matches a pending one (reinforces instead)', async () => {
    const tm = new TimeMachine({ seed: 1 });
    tm.storage.snap.prospective.push({
      id: 'p1', intent: 'ask about the trip', status: 'pending',
      priority: 3, contextClue: 'vacation trip',
      clueEmbedding: await tm.embed.embed('vacation trip'),
      strength: 0.6, createdAt: tm.clock.now(), lastTriggeredAt: -1,
    });
    tm.chat.extractQueue.push({
      episodic: [],
      prospective: [{ intent: 'ask about the trip again', priority: 3, contextClue: 'vacation trip' }],
    });
    await tm.respond('still thinking about that vacation trip');
    expect(tm.storage.snap.prospective).toHaveLength(1);      // not duplicated
    expect(tm.storage.snap.prospective[0]!.strength).toBeGreaterThan(0.6); // reinforced
  });

  it('normalizes an old persisted intent that lacks the new fields', async () => {
    const tm = new TimeMachine({ seed: 1 });
    // Simulate a row saved before this feature: missing clueEmbedding/strength/lastTriggeredAt.
    tm.storage.snap.prospective.push({
      id: 'old', intent: 'ask about the move', status: 'pending',
      priority: 4, contextClue: 'moving house', createdAt: tm.clock.now(),
    } as any);
    await tm.respond('hello');
    const p = tm.storage.snap.prospective.find(x => x.id === 'old')!;
    expect(typeof p.strength).toBe('number');
    expect(p.lastTriggeredAt).toBe(-1);
    expect(p.clueEmbedding).not.toBeNull(); // backfilled
  });

  it('a clue that failed to embed at creation backfills, then can trigger on a later turn', async () => {
    const tm = new TimeMachine({ seed: 1 });
    tm.embed.fail = true; // embed is down when the intent is born
    tm.chat.extractQueue.push({
      episodic: [],
      prospective: [{ intent: 'ask about the trip', priority: 3, contextClue: 'vacation trip' }],
    });
    await tm.respond('thinking about a vacation trip');
    expect(tm.storage.snap.prospective[0]!.clueEmbedding).toBeNull(); // born dormant
    const dormant = await tm.retrieve('how was the vacation trip');
    expect(dormant.prospective).toHaveLength(0); // cannot trigger yet — no embedding

    tm.embed.fail = false;
    await tm.advanceAndTick(0); // a tick backfills the clue embedding
    expect(tm.storage.snap.prospective[0]!.clueEmbedding).not.toBeNull();
    const live = await tm.retrieve('how was the vacation trip');
    expect(live.prospective).toHaveLength(1); // now it surfaces on a matching moment
  });
});

describe('prospective resolution (extract reports addressed intents)', () => {
  it('flips a pending intent to resolved when extract returns its id', async () => {
    const tm = new TimeMachine({ seed: 1 });
    tm.storage.snap.prospective.push({
      id: 'p_known', intent: 'ask how the interview went', status: 'pending',
      priority: 3, contextClue: 'job interview',
      clueEmbedding: await tm.embed.embed('job interview'),
      strength: 0.6, createdAt: tm.clock.now(), lastTriggeredAt: -1,
    });
    tm.chat.extractQueue.push({ episodic: [], prospective: [], resolved: ['p_known'] });
    await tm.respond('the interview went great, I got the job');
    expect(tm.storage.snap.prospective.find(p => p.id === 'p_known')!.status).toBe('resolved');
  });

  it('ignores resolved ids that are not pending (no crash, no state change)', async () => {
    const tm = new TimeMachine({ seed: 1 });
    tm.chat.extractQueue.push({ episodic: [], prospective: [], resolved: ['does-not-exist'] });
    await tm.respond('hello');
    expect(tm.storage.snap.prospective).toHaveLength(0);
  });
});

describe('prospective abandonment (an intent that never re-triggers fades)', () => {
  it('decays a never-triggered intent below the floor and marks it abandoned', async () => {
    const tm = new TimeMachine({ seed: 1 });
    tm.storage.snap.prospective.push({
      id: 'p_fade', intent: 'ask about the dentist', status: 'pending',
      priority: 1, contextClue: 'dentist appointment', // strength starts at 0.2
      clueEmbedding: await tm.embed.embed('dentist appointment'),
      strength: 0.2, createdAt: tm.clock.now(), lastTriggeredAt: -1,
    });
    await tm.advanceAndTick(20); // 20 days, tau 7 -> 0.2 * e^(-20/7) ≈ 0.011 < floor 0.05
    expect(tm.storage.snap.prospective.find(p => p.id === 'p_fade')!.status).toBe('abandoned');
  });

  it('keeps an intent alive if it keeps getting triggered', async () => {
    const tm = new TimeMachine({ seed: 1 });
    tm.storage.snap.prospective.push({
      id: 'p_live', intent: 'ask about the interview', status: 'pending',
      priority: 1, contextClue: 'job interview',
      clueEmbedding: await tm.embed.embed('job interview'),
      strength: 0.2, createdAt: tm.clock.now(), lastTriggeredAt: -1,
    });
    for (let i = 0; i < 5; i++) {
      tm.clock.advanceDays(2);               // past cooldown each round
      await tm.respond('how did the job interview go');
    }
    expect(tm.storage.snap.prospective.find(p => p.id === 'p_live')!.status).toBe('pending');
  });
});

describe('prospective archive + cap (the graveyard stays bounded)', () => {
  it('retains done/faded intents but caps the archive to the newest N', async () => {
    const tm = new TimeMachine({ seed: 1, config: { prospectiveArchiveCap: 2 } });
    for (const [id, createdAt] of [['r1', 1], ['r2', 2], ['r3', 3]] as const) {
      tm.storage.snap.prospective.push({
        id, intent: `done ${id}`, status: 'resolved', priority: 3, contextClue: '',
        clueEmbedding: null, strength: 0.3, createdAt, lastTriggeredAt: -1,
      });
    }
    await tm.respond('hello'); // a turn runs tick() -> capProspective
    const ids = tm.storage.snap.prospective.map(p => p.id).sort();
    expect(ids).toEqual(['r2', 'r3']); // r1 (oldest) reaped; archive bounded, not infinite
  });

  it('caps a burst of pending intents to the strongest activeCap', async () => {
    const tm = new TimeMachine({ seed: 1, config: { prospectiveActiveCap: 2 } });
    for (const [id, strength] of [['weak', 0.1], ['mid', 0.5], ['strong', 0.9]] as const) {
      tm.storage.snap.prospective.push({
        id, intent: `intent ${id}`, status: 'pending', priority: 3, contextClue: 'unrelated topic',
        clueEmbedding: await tm.embed.embed('unrelated topic'),
        strength, createdAt: tm.clock.now(), lastTriggeredAt: tm.clock.now(), // createdAt = now -> negligible decay when tick runs immediately
      });
    }
    await tm.respond('hello'); // unrelated query -> no trigger; tick caps to strongest 2
    const kept = tm.storage.snap.prospective.filter(p => p.status === 'pending').map(p => p.id).sort();
    expect(kept).toEqual(['mid', 'strong']); // 'weak' dropped
  });
});
