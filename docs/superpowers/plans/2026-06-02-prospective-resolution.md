# Prospective Memory Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn prospective memory from a write-only list that injects every pending intent on every turn into a living lifecycle — intents stay dormant until their `contextClue` matches the current moment, get reinforced when triggered, resolved when the topic is addressed, and abandoned (forgotten) when they fade.

**Architecture:** Trigger and resolve run at two different points of a turn, each reusing machinery the engine already has. **Trigger** happens in `retrieve()` (before the reply) using cheap semantic match (`cosineSimilarity(query, clueEmbedding)`) — only matched intents are injected. **Resolve** happens in `tick()` (after the reply) by folding a `resolved: string[]` answer into the `extract()` LLM call that already runs every tick — no extra model calls. **Abandonment** reuses the episodic decay math (`exp(-dt/tau)`): an intent that never re-triggers decays below a floor and is marked `abandoned`. Old persisted intents (loaded from JSON without the new fields) are normalized at the top of `tick()`, so no SQLite migration is needed.

**Tech Stack:** TypeScript (pure, framework-agnostic engine), vitest, `engine/test/timeMachine.ts` deterministic time-travel harness with `FakeClock`/`FakeEmbed`/`FakeChat`.

---

## Background: current behavior (verified in code)

- `ProspectiveMemory` (`engine/src/types.ts:33-40`): `{ id, intent, status, priority, contextClue, createdAt }`.
- Created in `tick()` (`engine/src/engine.ts:122-124`) with `status: 'pending'` — **never** flipped to `resolved`/`abandoned` (confirmed by grep: the only writes of `status` are the literal `'pending'` at creation and the read-filter).
- Read in `retrieve()` (`engine/src/engine.ts:64`): `snap.prospective.filter(p => p.status === 'pending')` → **all** pending intents injected as `[You are anticipating]` every turn (the over-injection / nagging bug).
- `contextClue` is stored but **never evaluated**.

## File structure

| File | Responsibility | Change |
|---|---|---|
| `engine/src/types.ts` | `ProspectiveMemory` shape + `EngineConfig` + `DEFAULT_CONFIG` | add 3 fields + 4 config knobs |
| `engine/src/consolidation.ts` | pure memory-math functions | add `decayProspective`, `abandonWeakProspective` |
| `engine/src/engine.ts` | `retrieve()` (trigger), `tick()` (create/resolve/decay/abandon/normalize) | wire lifecycle |
| `engine/src/ports.ts` | `ExtractResult` + `ChatPort.extract` signature | add `resolved?`, pass `pending` |
| `engine/provider/adapters.ts` | real OpenAI-compatible `extract()` prompt | ask for `resolved`, define `contextClue` |
| `engine/test/prospective.test.ts` | unit tests for the new consolidation helpers | create |
| `engine/test/respond.test.ts` | existing fixture literal needs new fields | modify one literal |
| `engine/test/behaviors.test.ts` | end-to-end lifecycle behavior tests | add cases |

**Out of scope (deliberate):** `mobile/` needs only `cd engine && npm run build` to pick up the new engine — storage is whole-snapshot JSON (`mobile/lib/storage.ts:18`), so new fields persist automatically and old rows are handled by the `tick()` normalizer. The "เพื่อนกำลังรออะไรอยู่" UI surface is a **separate follow-up plan**, not this one.

---

### Task 1: Extend the schema and config

**Files:**
- Modify: `engine/src/types.ts:33-40` (`ProspectiveMemory`)
- Modify: `engine/src/types.ts:50-80` (`EngineConfig` + `DEFAULT_CONFIG`)
- Modify: `engine/test/respond.test.ts:33` (fixture literal must compile against new required fields)

- [ ] **Step 1: Add fields to `ProspectiveMemory`**

Replace `engine/src/types.ts:33-40` with:

```ts
export interface ProspectiveMemory {
  id: string;
  intent: string;
  status: 'pending' | 'resolved' | 'abandoned';
  priority: number;
  contextClue: string;
  createdAt: number;
  clueEmbedding: number[] | null; // embed(contextClue); null = embed failed, backfilled in tick
  strength: number;               // decays like episodic; abandoned when it falls below the floor
  lastTriggeredAt: number;        // -1 = never triggered (used for cooldown)
}
```

- [ ] **Step 2: Add config knobs**

In `engine/src/types.ts`, add these four lines to the `EngineConfig` interface (after `minCrystallizeImportance: number;`):

```ts
  prospectiveTriggerSim: number;   // cosine(query, clueEmbedding) >= this -> intent surfaces this turn
  prospectiveFloor: number;        // abandon a pending intent below this strength
  prospectiveCooldownDays: number; // after triggering, wait this long before it can trigger again
  prospectiveDedupeSim: number;    // a new intent whose clue is this similar to a pending one is merged in
```

And add these four lines to `DEFAULT_CONFIG` (after `minCrystallizeImportance: 5,`):

```ts
  prospectiveTriggerSim: 0.4,
  prospectiveFloor: 0.05,
  prospectiveCooldownDays: 1,
  prospectiveDedupeSim: 0.9,
```

- [ ] **Step 3: Fix the compiling fixture in respond.test.ts**

The literal at `engine/test/respond.test.ts:33` constructs a `ProspectiveMemory` and will now fail typecheck. Replace that single line:

```ts
      prospective: [{ id: 'p', intent: 'ship the engine', status: 'pending', priority: 3, contextClue: '', createdAt: 0 }],
```

with:

```ts
      prospective: [{ id: 'p', intent: 'ship the engine', status: 'pending', priority: 3, contextClue: '', createdAt: 0, clueEmbedding: null, strength: 0.6, lastTriggeredAt: -1 }],
```

- [ ] **Step 4: Find any other ProspectiveMemory literals**

Run: `cd engine && grep -rn "status: 'pending'" src test`
Expected: matches in `src/engine.ts` (creation — fixed in Task 4) and `test/respond.test.ts:33` (just fixed). If grep surfaces any other literal that constructs a full `ProspectiveMemory`, add the same three fields (`clueEmbedding: null, strength: <priority/5>, lastTriggeredAt: -1`).

- [ ] **Step 5: Verify it builds and existing tests still pass**

Run: `cd engine && npm run build && npm test`
Expected: build succeeds; all 36 existing tests PASS.

- [ ] **Step 6: Commit**

```bash
git add engine/src/types.ts engine/test/respond.test.ts
git commit -m "feat(engine): extend ProspectiveMemory schema + config for resolution lifecycle"
```

---

### Task 2: Prospective consolidation helpers (decay + abandon)

**Files:**
- Modify: `engine/src/consolidation.ts` (add two functions + import `ProspectiveMemory`)
- Test: `engine/test/prospective.test.ts` (create)

- [ ] **Step 1: Write the failing tests**

Create `engine/test/prospective.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { decayProspective, abandonWeakProspective } from '../src/consolidation.js';
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd engine && npx vitest run test/prospective.test.ts`
Expected: FAIL — `decayProspective`/`abandonWeakProspective` are not exported.

- [ ] **Step 3: Implement the helpers**

In `engine/src/consolidation.ts`, change the type import on line 2 from:

```ts
import type { EngineConfig, EpisodicMemory, PatternEvidence } from './types.js';
```

to:

```ts
import type { EngineConfig, EpisodicMemory, PatternEvidence, ProspectiveMemory } from './types.js';
```

Then append to the end of the file:

```ts
// Prospective intents decay on the same curve as episodic memory: an intent that
// never re-triggers fades. Reinforcement happens at trigger time (in retrieve), not here.
export function decayProspective(
  ps: ProspectiveMemory[],
  o: { now: number; lastTick: number; tau: number },
): void {
  for (const p of ps) {
    if (p.status !== 'pending') continue;
    const from = Math.max(p.createdAt, o.lastTick);
    const dtDays = Math.max(0, (o.now - from) / DAY);
    p.strength *= Math.exp(-dtDays / o.tau);
  }
}

// A faded intent is forgotten (the friend "lets it go") — status, not deletion,
// so the UI can still show "we never got around to this".
export function abandonWeakProspective(ps: ProspectiveMemory[], floor: number): void {
  for (const p of ps) {
    if (p.status === 'pending' && p.strength < floor) p.status = 'abandoned';
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd engine && npx vitest run test/prospective.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add engine/src/consolidation.ts engine/test/prospective.test.ts
git commit -m "feat(engine): decayProspective + abandonWeakProspective helpers"
```

---

### Task 3: Trigger intents in retrieve (dormant-until-relevant)

**Files:**
- Modify: `engine/src/engine.ts:7` (import `cosineSimilarity`)
- Modify: `engine/src/engine.ts:51-67` (`retrieve()`)
- Test: `engine/test/behaviors.test.ts` (add a `describe` block)

- [ ] **Step 1: Write the failing tests**

Append to `engine/test/behaviors.test.ts` (inside the file, as a new top-level `describe`):

```ts
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
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd engine && npx vitest run test/behaviors.test.ts -t "prospective trigger"`
Expected: FAIL — `retrieve` still returns all pending (first test fails: length 1 not 0), and `lastTriggeredAt`/reinforcement are not set.

- [ ] **Step 3: Add the cosineSimilarity import**

In `engine/src/engine.ts`, change line 7 from:

```ts
import { mmrSearch } from './vector.js';
```

to:

```ts
import { mmrSearch, cosineSimilarity } from './vector.js';
```

- [ ] **Step 4: Replace the prospective line in retrieve() with the trigger logic**

In `engine/src/engine.ts`, the current `retrieve()` body (lines 52-66) computes `qv`, runs `mmrSearch`, sets `lastRecalledAt`, then returns. Change the `return` block. Replace:

```ts
    const picked = picks.map(p => snap.episodic.find(e => e.id === p.item.id)!);
    for (const m of picked) m.lastRecalledAt = now;
    await this.d.storage.save(snap);
    return {
      selfTier: snap.selfFacets,
      episodic: picked,
      prospective: snap.prospective.filter(p => p.status === 'pending'),
      tail: snap.messages.slice(-this.cfg.tailN),
    };
```

with:

```ts
    const picked = picks.map(p => snap.episodic.find(e => e.id === p.item.id)!);
    for (const m of picked) m.lastRecalledAt = now;

    // Trigger: a pending intent surfaces only when the moment matches its clue.
    // Reinforce-on-trigger lives here (the moment of relevance), not in tick.
    const triggered = snap.prospective.filter(p => {
      if (p.status !== 'pending' || !p.clueEmbedding) return false;
      const cooled = p.lastTriggeredAt < 0
        || (now - p.lastTriggeredAt) / DAY >= this.cfg.prospectiveCooldownDays;
      if (!cooled) return false;
      return cosineSimilarity(qv, p.clueEmbedding) >= this.cfg.prospectiveTriggerSim;
    });
    for (const p of triggered) { p.lastTriggeredAt = now; p.strength += this.cfg.boost; }

    await this.d.storage.save(snap);
    return {
      selfTier: snap.selfFacets,
      episodic: picked,
      prospective: triggered,
      tail: snap.messages.slice(-this.cfg.tailN),
    };
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd engine && npx vitest run test/behaviors.test.ts -t "prospective trigger"`
Expected: PASS (3 tests).

- [ ] **Step 6: Verify nothing else broke**

Run: `cd engine && npm test`
Expected: all PASS (existing + new).

- [ ] **Step 7: Commit**

```bash
git add engine/src/engine.ts engine/test/behaviors.test.ts
git commit -m "feat(engine): trigger prospective intents on clue match in retrieve"
```

---

### Task 4: Embed clue + init strength + dedup + normalize old data (creation)

**Files:**
- Modify: `engine/src/engine.ts:104-159` (`tick()` — creation block + a normalizer at the top)
- Test: `engine/test/behaviors.test.ts` (add a `describe` block)

- [ ] **Step 1: Write the failing tests**

Append to `engine/test/behaviors.test.ts`:

```ts
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
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd engine && npx vitest run test/behaviors.test.ts -t "prospective creation"`
Expected: FAIL — creation still pushes a bare object (no `clueEmbedding`/`strength`), no dedup, no normalizer.

- [ ] **Step 3: Add the normalizer at the top of tick()**

In `engine/src/engine.ts`, `tick()` begins (lines 104-106):

```ts
  async tick(): Promise<void> {
    const snap = await this.d.storage.load();
    const now = this.d.clock.now();
```

Immediately after `const now = this.d.clock.now();`, insert:

```ts
    // Normalize intents persisted before this feature (whole-snapshot JSON has no migration).
    for (const p of snap.prospective) {
      if (typeof p.strength !== 'number') p.strength = p.priority / 5;
      if (typeof p.lastTriggeredAt !== 'number') p.lastTriggeredAt = -1;
      if (p.clueEmbedding === undefined) p.clueEmbedding = null;
    }
```

- [ ] **Step 4: Replace the prospective creation block with embed + strength + dedup**

In `engine/src/engine.ts`, replace the current creation loop (lines 122-124):

```ts
      for (const p of ex.prospective) {
        snap.prospective.push({ id: uid('p'), intent: p.intent, status: 'pending', priority: p.priority, contextClue: p.contextClue, createdAt: now });
      }
```

with:

```ts
      for (const p of ex.prospective) {
        const clueEmbedding = await this.d.embed.embed(p.contextClue || p.intent);
        const dup = clueEmbedding
          ? snap.prospective.find(q => q.status === 'pending' && q.clueEmbedding
              && cosineSimilarity(q.clueEmbedding, clueEmbedding) >= this.cfg.prospectiveDedupeSim)
          : undefined;
        if (dup) { dup.strength += this.cfg.boost; continue; }
        snap.prospective.push({
          id: uid('p'), intent: p.intent, status: 'pending', priority: p.priority,
          contextClue: p.contextClue, createdAt: now,
          clueEmbedding, strength: p.priority / 5, lastTriggeredAt: -1,
        });
      }
```

- [ ] **Step 5: Backfill failed clue embeddings (alongside the episodic backfill)**

In `engine/src/engine.ts`, find the episodic backfill line (line 128):

```ts
    // BACKFILL embeddings that failed earlier
    for (const m of snap.episodic) if (!m.embedding) m.embedding = await this.d.embed.embed(m.content);
```

Add immediately after it:

```ts
    for (const p of snap.prospective) if (p.status === 'pending' && !p.clueEmbedding) p.clueEmbedding = await this.d.embed.embed(p.contextClue || p.intent);
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd engine && npx vitest run test/behaviors.test.ts -t "prospective creation"`
Expected: PASS (3 tests).

- [ ] **Step 7: Verify nothing else broke**

Run: `cd engine && npm test`
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add engine/src/engine.ts engine/test/behaviors.test.ts
git commit -m "feat(engine): embed clue, init strength, dedup + normalize prospective on creation"
```

---

### Task 5: Resolve intents via the extract() call

**Files:**
- Modify: `engine/src/ports.ts:29-39` (`ExtractResult` + `ChatPort.extract` signature)
- Modify: `engine/src/engine.ts:112-114` (pass `pending` to extract) + resolve loop in `tick()`
- Test: `engine/test/behaviors.test.ts` (add a `describe` block)

- [ ] **Step 1: Write the failing test**

Append to `engine/test/behaviors.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd engine && npx vitest run test/behaviors.test.ts -t "prospective resolution"`
Expected: FAIL — `resolved` is not part of `ExtractResult` and nothing flips status.

- [ ] **Step 3: Extend ExtractResult and the extract signature**

In `engine/src/ports.ts`, replace lines 29-32:

```ts
export interface ExtractResult {
  episodic: { content: string; importance: number; tags: string[] }[];
  prospective: { intent: string; priority: number; contextClue: string }[];
}
```

with:

```ts
export interface ExtractResult {
  episodic: { content: string; importance: number; tags: string[] }[];
  prospective: { intent: string; priority: number; contextClue: string }[];
  resolved?: string[]; // ids of previously-pending intents this exchange has addressed
}
```

And replace the `extract` line (line 37):

```ts
  extract(recent: Message[]): Promise<ExtractResult>;
```

with:

```ts
  extract(recent: Message[], pending?: { id: string; intent: string }[]): Promise<ExtractResult>;
```

(`FakeChat.extract()` takes no args — a zero-arg function is still assignable to this type, so no fake change is needed.)

- [ ] **Step 4: Pass pending intents to extract and apply resolutions in tick()**

In `engine/src/engine.ts`, the extract block currently reads (lines 111-114):

```ts
    // EXTRACT from messages since last tick
    const recent = snap.messages.filter(m => m.ts >= snap.lastTick);
    if (recent.length) {
      const ex = await this.d.chat.extract(recent);
```

Replace those four lines with:

```ts
    // EXTRACT from messages since last tick
    const recent = snap.messages.filter(m => m.ts >= snap.lastTick);
    if (recent.length) {
      const pending = snap.prospective
        .filter(p => p.status === 'pending')
        .map(p => ({ id: p.id, intent: p.intent }));
      const ex = await this.d.chat.extract(recent, pending);
      for (const id of ex.resolved ?? []) {
        const p = snap.prospective.find(q => q.id === id);
        if (p && p.status === 'pending') p.status = 'resolved';
      }
```

Note: this only opens the `if (recent.length) {` block and adds the resolve loop right after the `extract` call. The existing episodic/prospective creation loops that follow stay exactly as they are (the closing `}` of the `if` block is unchanged).

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd engine && npx vitest run test/behaviors.test.ts -t "prospective resolution"`
Expected: PASS (2 tests).

- [ ] **Step 6: Verify nothing else broke**

Run: `cd engine && npm test`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add engine/src/ports.ts engine/src/engine.ts engine/test/behaviors.test.ts
git commit -m "feat(engine): resolve pending intents via extract() resolved ids"
```

---

### Task 6: Wire decay + abandon into tick (the forgetting loop)

**Files:**
- Modify: `engine/src/engine.ts:8` (import the new helpers) + `tick()` (call them)
- Test: `engine/test/behaviors.test.ts` (add a lifecycle case)

- [ ] **Step 1: Write the failing test**

Append to `engine/test/behaviors.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd engine && npx vitest run test/behaviors.test.ts -t "prospective abandonment"`
Expected: FAIL — the never-triggered intent is still `pending` (no decay/abandon wired into tick).

- [ ] **Step 3: Import the helpers**

In `engine/src/engine.ts`, line 8 currently reads:

```ts
import { decay, reinforce, merge, prune, detectPatterns } from './consolidation.js';
```

Replace with:

```ts
import { decay, reinforce, merge, prune, detectPatterns, decayProspective, abandonWeakProspective } from './consolidation.js';
```

- [ ] **Step 4: Call decay right after the episodic reinforce, and abandon after the extract block**

In `engine/src/engine.ts`, find the episodic decay/reinforce pair in `tick()` (lines 108-109):

```ts
    decay(snap.episodic, { now, lastTick: snap.lastTick, tau: this.cfg.tau });
    reinforce(snap.episodic, { lastTick: snap.lastTick, boost: this.cfg.boost });
```

Add immediately after:

```ts
    decayProspective(snap.prospective, { now, lastTick: snap.lastTick, tau: this.cfg.tau });
```

Then find the episodic `merge`/`prune` lines (lines 130-131):

```ts
    snap.episodic = merge(snap.episodic, this.cfg);
    snap.episodic = prune(snap.episodic, this.cfg.floor);
```

Add immediately before them:

```ts
    abandonWeakProspective(snap.prospective, this.cfg.prospectiveFloor);
```

(Order matters: `decayProspective` lowers strength early in the tick; `abandonWeakProspective` runs after creation/resolution so freshly-created intents — strength ≥ 0.2 — are never abandoned in the same tick they are born.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd engine && npx vitest run test/behaviors.test.ts -t "prospective abandonment"`
Expected: PASS (2 tests).

- [ ] **Step 6: Verify the whole suite**

Run: `cd engine && npm test`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add engine/src/engine.ts engine/test/behaviors.test.ts
git commit -m "feat(engine): wire prospective decay + abandonment into tick"
```

---

### Task 7: Real provider prompt (extract reports resolutions + understands contextClue)

**Files:**
- Modify: `engine/provider/adapters.ts:37-45` (`extract` method)

- [ ] **Step 1: Update the extract prompt to accept pending intents and ask for resolutions**

In `engine/provider/adapters.ts`, replace the entire `extract` method (lines 37-45):

```ts
    async extract(recent: Message[]): Promise<ExtractResult> {
      const prompt =
        'Extract durable facts and anticipatory intents from this chat as JSON ' +
        '{"episodic":[{"content","importance"(1-10),"tags":[]}],"prospective":[{"intent","priority"(1-5),"contextClue"}]}.\n\n' +
        recent.map(m => `${m.role}: ${m.text}`).join('\n');
      const out = await collect(chatStream(cfg, { messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' } }, fetchImpl));
      try { const j = JSON.parse(out); return { episodic: j.episodic ?? [], prospective: j.prospective ?? [] }; }
      catch { return { episodic: [], prospective: [] }; }
    },
```

with:

```ts
    async extract(recent: Message[], pending: { id: string; intent: string }[] = []): Promise<ExtractResult> {
      const pendingBlock = pending.length
        ? '\n\nIntents you previously formed but have not yet acted on (id: intent). ' +
          'For any the exchange above has now addressed, fulfilled, or made irrelevant, put its id in "resolved":\n' +
          pending.map(p => `${p.id}: ${p.intent}`).join('\n')
        : '';
      const prompt =
        'Extract durable facts and anticipatory intents from this chat as JSON ' +
        '{"episodic":[{"content","importance"(1-10),"tags":[]}],' +
        '"prospective":[{"intent","priority"(1-5),"contextClue"}],"resolved":["id"]}. ' +
        'contextClue is a short phrase naming the topic/situation that should make this intent resurface later.\n\n' +
        recent.map(m => `${m.role}: ${m.text}`).join('\n') + pendingBlock;
      const out = await collect(chatStream(cfg, { messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' } }, fetchImpl));
      try { const j = JSON.parse(out); return { episodic: j.episodic ?? [], prospective: j.prospective ?? [], resolved: j.resolved ?? [] }; }
      catch { return { episodic: [], prospective: [], resolved: [] }; }
    },
```

- [ ] **Step 2: Verify build + full suite + typecheck**

Run: `cd engine && npm run build && npm test`
Expected: build succeeds; all tests PASS (the provider is exercised through `FakeChat` in tests, so this is a typecheck/compile gate).

- [ ] **Step 3: Rebuild so the mobile app picks up the new engine**

Run: `cd engine && npm run build`
Expected: `engine/dist/` updated. (The app imports the compiled `dist` via `file:../engine`; no `mobile/` code change is required — storage is whole-snapshot JSON and old rows are normalized by `tick()`.)

- [ ] **Step 4: Commit**

```bash
git add engine/provider/adapters.ts engine/dist
git commit -m "feat(engine): extract prompt reports resolved intents + defines contextClue"
```

---

## Self-review checklist (completed during authoring)

- **Spec coverage:** trigger (Task 3), resolve (Task 5), abandon/decay (Tasks 2+6), creation+embed+dedup+normalize (Task 4), schema+config (Task 1), real provider prompt (Task 7). All four lifecycle transitions (`pending→triggered`, `pending→resolved`, `pending→abandoned`, dedup-merge) covered.
- **Type consistency:** field names `clueEmbedding`, `strength`, `lastTriggeredAt` and config keys `prospectiveTriggerSim`/`prospectiveFloor`/`prospectiveCooldownDays`/`prospectiveDedupeSim` are used identically across Tasks 1, 3, 4, 6. `ExtractResult.resolved` and the `extract(recent, pending?)` signature match between `ports.ts` (Task 5), `engine.ts` (Task 5), and `adapters.ts` (Task 7).
- **Reinforcement location:** reinforce-on-trigger lives in `retrieve()` (Task 3), NOT in `tick()` — this deliberately avoids the `lastTriggeredAt >= lastTick` double-reinforce trap that a tick-based reinforce would hit on the turn after a trigger.
- **No placeholders:** every code/test step shows complete code; every run step shows the exact command + expected result.

## Known follow-ups (NOT in this plan)

- **UI surface** "เพื่อนกำลังรออะไรจากคุณอยู่" — list pending intents sorted by `strength`, show resolved as history, fade low-strength ones. Separate plan.
- **Priority-modulated trigger threshold** (high-priority intents trigger on a looser clue match) — a refinement once the flat `prospectiveTriggerSim` is observed in real use.
- **harness tap / debug screen** (spec Phase F) — surfacing the exact injected string per turn; complementary observability work discussed alongside this design.
