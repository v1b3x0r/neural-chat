# Living-Memory Engine (core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and fully test (headless, pure TypeScript) the living-memory engine — the part that decays, reinforces, merges, prunes, and crystallizes memory — plus the OpenAI-compatible provider adapter. No Expo, no device required.

**Architecture:** A framework-agnostic `MemoryEngine` exposing `ingest()`, `retrieve()`, `tick()`. All side effects (storage, embeddings, chat, time, randomness) live behind injected ports, so the engine runs under Node and is validated with a fast-forwardable "TimeMachine" harness using a seeded PRNG. Crystallization is a pluggable policy (default `randomK(3,7)`).

**Tech Stack:** TypeScript (strict), Vitest, plain `fetch` for the OpenAI-compatible provider. Package lives at `neural-chat/engine/` (isolated from the Vite prototype at the repo root).

**Reference:** spec at `neural-chat/docs/superpowers/specs/2026-05-28-living-memory-chat-design.md`. Prototype at repo root is read-only reference; do not extend it.

---

## File Structure

```
neural-chat/engine/
  package.json                  # type:module, vitest, typescript, tsx
  tsconfig.json                 # strict
  vitest.config.ts
  src/
    types.ts                    # data shapes: Message, SelfFacet, EpisodicMemory, ProspectiveMemory, PatternEvidence, EngineConfig
    ports.ts                    # interfaces: StoragePort, EmbedPort, ChatPort, Clock, Random, CrystallizePolicy, Snapshot
    random.ts                   # SeededRandom (mulberry32) implements Random
    vector.ts                   # cosineSimilarity, mmrSearch
    policy.ts                   # fixedK, randomK, gamble  (CrystallizePolicy factories)
    consolidation.ts            # pure tick steps: decay, reinforce, merge, prune; detectPatterns
    engine.ts                   # MemoryEngine: ingest/retrieve/tick + crystallize orchestration
    index.ts                    # public exports
  provider/
    openaiCompat.ts             # chat (SSE stream) + embed against OpenAI-compatible REST
    adapters.ts                 # ChatPort/EmbedPort built on openaiCompat; safeUrl() guard
  test/
    fakes.ts                    # FakeClock, InMemoryStorage, FakeEmbed, FakeChat
    timeMachine.ts              # harness: wires engine+fakes, advance(days), feed(messages)
    *.test.ts                   # unit + behavior tests
```

Default constants live in one `EngineConfig` object (tunable later via the TimeMachine), never scattered as magic numbers.

---

## Task 1: Scaffold the engine package

**Files:**
- Create: `neural-chat/engine/package.json`
- Create: `neural-chat/engine/tsconfig.json`
- Create: `neural-chat/engine/vitest.config.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@nature-labs/living-memory-engine",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "tsx": "^4.19.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["vitest/globals"]
  },
  "include": ["src", "provider", "test"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { globals: true, environment: 'node' } });
```

- [ ] **Step 4: Install**

Run: `cd neural-chat/engine && npm install`
Expected: dependencies install, no errors.

- [ ] **Step 5: Commit**

```bash
cd neural-chat && git add engine/package.json engine/tsconfig.json engine/vitest.config.ts engine/package-lock.json && git commit -m "chore(engine): scaffold living-memory engine package"
```

---

## Task 2: Types and ports

**Files:**
- Create: `neural-chat/engine/src/types.ts`
- Create: `neural-chat/engine/src/ports.ts`

These are interface-only (no logic, no test of their own — exercised by later tasks).

- [ ] **Step 1: Write `src/types.ts`**

```ts
export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  imageUri?: string;
  imageMime?: string;
  ts: number;
}

export interface SelfFacet {
  id: string;
  statement: string;
  kind: 'voice' | 'value' | 'relationship';
  strength: number;
  updatedAt: number;
}

export interface EpisodicMemory {
  id: string;
  content: string;
  embedding: number[] | null;
  importance: number;        // 1..10
  strength: number;
  createdAt: number;
  lastRecalledAt: number;
  tags: string[];
  imageUri?: string;
  imageMime?: string;
  crystallizeAt: number;     // per-memory threshold (for the per-memory random variant)
  sourceMsgIds: string[];
}

export interface ProspectiveMemory {
  id: string;
  intent: string;
  status: 'pending' | 'resolved' | 'abandoned';
  priority: number;
  contextClue: string;
  createdAt: number;
}

export interface PatternEvidence {
  key: string;               // the tag/cluster identity
  recurrence: number;
  avgImportance: number;
  spanDays: number;
  memberIds: string[];
}

export interface EngineConfig {
  tau: number;               // decay time constant (days)
  floor: number;             // prune below this strength
  boost: number;             // reinforcement increment
  mergeThreshold: number;    // cosine >= this AND both weak -> merge
  mergeStrengthCeiling: number; // only merge memories weaker than this
  selfTierCap: number;       // max self-facets kept
  selfFloor: number;         // prune self-facet below this strength
  retrieveTopK: number;
  mmrLambda: number;
  tailN: number;             // recent raw messages included in injection
  minCrystallizeImportance: number; // pattern avgImportance gate
}

export const DEFAULT_CONFIG: EngineConfig = {
  tau: 7,
  floor: 0.05,
  boost: 0.5,
  mergeThreshold: 0.92,
  mergeStrengthCeiling: 0.5,
  selfTierCap: 12,
  selfFloor: 0.05,
  retrieveTopK: 5,
  mmrLambda: 0.5,
  tailN: 8,
  minCrystallizeImportance: 5,
};

export interface InjectionContext {
  selfTier: SelfFacet[];
  episodic: EpisodicMemory[];
  prospective: ProspectiveMemory[];
  tail: Message[];
}
```

- [ ] **Step 2: Write `src/ports.ts`**

```ts
import type {
  Message, SelfFacet, EpisodicMemory, ProspectiveMemory, PatternEvidence,
} from './types.js';

export interface Random {
  float(): number;            // [0,1)
  int(minInclusive: number, maxInclusive: number): number;
}

export interface Clock { now(): number; }

export interface Snapshot {
  messages: Message[];
  episodic: EpisodicMemory[];
  selfFacets: SelfFacet[];
  prospective: ProspectiveMemory[];
  lastTick: number;
}

export interface StoragePort {
  load(): Promise<Snapshot>;
  save(s: Snapshot): Promise<void>;
}

export interface EmbedPort {
  embed(text: string): Promise<number[] | null>;  // null on failure -> backfill later
}

export interface ExtractResult {
  episodic: { content: string; importance: number; tags: string[] }[];
  prospective: { intent: string; priority: number; contextClue: string }[];
}

export interface ChatPort {
  stream(messages: Message[], systemPrompt: string, inject: string): AsyncIterable<string>;
  describeImage(dataUrl: string): Promise<string>;
  extract(recent: Message[]): Promise<ExtractResult>;
  summarizePattern(members: EpisodicMemory[]): Promise<{ statement: string; kind: SelfFacet['kind'] }>;
}

export interface CrystallizePolicy {
  shouldCrystallize(e: PatternEvidence, rng: Random): boolean;
}
```

- [ ] **Step 3: Typecheck**

Run: `cd neural-chat/engine && npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 4: Commit**

```bash
cd neural-chat && git add engine/src/types.ts engine/src/ports.ts && git commit -m "feat(engine): define core types and ports"
```

---

## Task 3: SeededRandom (deterministic PRNG)

**Files:**
- Create: `neural-chat/engine/src/random.ts`
- Test: `neural-chat/engine/test/random.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { SeededRandom } from '../src/random.js';

describe('SeededRandom', () => {
  it('is reproducible for the same seed', () => {
    const a = new SeededRandom(1337);
    const b = new SeededRandom(1337);
    const seqA = [a.float(), a.float(), a.float()];
    const seqB = [b.float(), b.float(), b.float()];
    expect(seqA).toEqual(seqB);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd neural-chat/engine && npx vitest run test/random.test.ts`
Expected: FAIL (Cannot find module '../src/random.js').

- [ ] **Step 3: Write minimal implementation**

```ts
import type { Random } from './ports.js';

// mulberry32 — small, fast, deterministic PRNG
export class SeededRandom implements Random {
  private state: number;
  constructor(seed: number) { this.state = seed >>> 0; }

  float(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(minInclusive: number, maxInclusive: number): number {
    const span = maxInclusive - minInclusive + 1;
    return minInclusive + Math.floor(this.float() * span);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd neural-chat/engine && npx vitest run test/random.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd neural-chat && git add engine/src/random.ts engine/test/random.test.ts && git commit -m "feat(engine): seeded PRNG (mulberry32)"
```

---

## Task 4: Vector math (cosine + MMR)

**Files:**
- Create: `neural-chat/engine/src/vector.ts`
- Test: `neural-chat/engine/test/vector.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { cosineSimilarity, mmrSearch } from '../src/vector.js';

describe('cosineSimilarity', () => {
  it('is 1 for identical, 0 for orthogonal', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });
  it('returns 0 on empty vectors', () => {
    expect(cosineSimilarity([], [1])).toBe(0);
  });
});

describe('mmrSearch', () => {
  const items = [
    { id: 'a', embedding: [1, 0, 0] },
    { id: 'b', embedding: [0.99, 0.01, 0] }, // near-duplicate of a
    { id: 'c', embedding: [0, 1, 0] },
  ];
  it('prefers relevant + diverse picks', () => {
    const picks = mmrSearch([1, 0, 0], items, { topK: 2, lambda: 0.5 });
    const ids = picks.map(p => p.item.id);
    expect(ids[0]).toBe('a');           // most relevant first
    expect(ids).toContain('c');         // diversity beats near-dup 'b'
    expect(ids).not.toContain('b');
  });
  it('skips items without embeddings', () => {
    const picks = mmrSearch([1, 0, 0], [{ id: 'x', embedding: null }], { topK: 3, lambda: 0.5 });
    expect(picks).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd neural-chat/engine && npx vitest run test/vector.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```ts
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0, ma = 0, mb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!, y = b[i]!;
    dot += x * y; ma += x * x; mb += y * y;
  }
  const denom = Math.sqrt(ma) * Math.sqrt(mb);
  return denom === 0 ? 0 : dot / denom;
}

export interface MmrItem { id: string; embedding: number[] | null; }
export interface MmrPick<T> { item: T; similarity: number; }

export function mmrSearch<T extends MmrItem>(
  query: number[],
  items: T[],
  opts: { topK: number; lambda: number },
): MmrPick<T>[] {
  const candidates = items.filter((i): i is T & { embedding: number[] } => !!i.embedding?.length);
  const scored = candidates.map(item => ({ item, similarity: cosineSimilarity(query, item.embedding) }));
  const selected: MmrPick<T>[] = [];
  const remaining = [...scored];
  while (selected.length < opts.topK && remaining.length) {
    let bestIdx = -1, best = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const cand = remaining[i]!;
      let maxSimSel = 0;
      for (const s of selected) {
        const sim = cosineSimilarity(cand.item.embedding!, (s.item as MmrItem).embedding!);
        if (sim > maxSimSel) maxSimSel = sim;
      }
      const mmr = opts.lambda * cand.similarity - (1 - opts.lambda) * maxSimSel;
      if (mmr > best) { best = mmr; bestIdx = i; }
    }
    if (bestIdx === -1) break;
    selected.push(remaining.splice(bestIdx, 1)[0]!);
  }
  return selected;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd neural-chat/engine && npx vitest run test/vector.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd neural-chat && git add engine/src/vector.ts engine/test/vector.test.ts && git commit -m "feat(engine): cosine similarity + MMR search"
```

---

## Task 5: Crystallize policies

**Files:**
- Create: `neural-chat/engine/src/policy.ts`
- Test: `neural-chat/engine/test/policy.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { fixedK, randomK, gamble } from '../src/policy.js';
import { SeededRandom } from '../src/random.js';

const ev = (recurrence: number, avgImportance = 8) =>
  ({ key: 'k', recurrence, avgImportance, spanDays: 2, memberIds: [] });

describe('fixedK', () => {
  it('crystallizes at or above k', () => {
    const p = fixedK(3); const r = new SeededRandom(1);
    expect(p.shouldCrystallize(ev(2), r)).toBe(false);
    expect(p.shouldCrystallize(ev(3), r)).toBe(true);
  });
});

describe('randomK', () => {
  it('threshold lies within [min,max] and is reproducible for a seed', () => {
    const decide = (seed: number, rec: number) =>
      randomK(3, 7).shouldCrystallize(ev(rec), new SeededRandom(seed));
    // recurrence below min never crystallizes; at/above max always does
    expect(decide(99, 2)).toBe(false);
    expect(decide(99, 7)).toBe(true);
    // same seed + same recurrence -> same decision
    expect(decide(5, 5)).toBe(decide(5, 5));
  });
});

describe('gamble', () => {
  it('scales probability by importance and is reproducible', () => {
    const hi = gamble(0.5).shouldCrystallize(ev(1, 10), new SeededRandom(7));
    const hi2 = gamble(0.5).shouldCrystallize(ev(1, 10), new SeededRandom(7));
    expect(hi).toBe(hi2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd neural-chat/engine && npx vitest run test/policy.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```ts
import type { CrystallizePolicy } from './ports.js';

export function fixedK(k: number): CrystallizePolicy {
  return { shouldCrystallize: (e) => e.recurrence >= k };
}

export function randomK(min: number, max: number): CrystallizePolicy {
  return { shouldCrystallize: (e, rng) => e.recurrence >= rng.int(min, max) };
}

export function gamble(baseP: number): CrystallizePolicy {
  return {
    shouldCrystallize: (e, rng) => rng.float() < baseP * (e.avgImportance / 10),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd neural-chat/engine && npx vitest run test/policy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd neural-chat && git add engine/src/policy.ts engine/test/policy.test.ts && git commit -m "feat(engine): pluggable crystallize policies (fixedK/randomK/gamble)"
```

---

## Task 6: Consolidation pure functions (decay / reinforce / merge / prune)

**Files:**
- Create: `neural-chat/engine/src/consolidation.ts`
- Test: `neural-chat/engine/test/consolidation.test.ts`

These operate on plain arrays — no ports, fully deterministic.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { decay, reinforce, merge, prune } from '../src/consolidation.js';
import { DEFAULT_CONFIG, type EpisodicMemory } from '../src/types.js';

const DAY = 86_400_000;
const mem = (over: Partial<EpisodicMemory>): EpisodicMemory => ({
  id: 'm', content: 'c', embedding: [1, 0], importance: 5, strength: 1,
  createdAt: 0, lastRecalledAt: 0, tags: [], crystallizeAt: 4, sourceMsgIds: [], ...over,
});

describe('decay', () => {
  it('weakens by exp(-dt/tau) since lastTick, clamped to memory age', () => {
    const m = mem({ strength: 1, createdAt: 0 });
    decay([m], { now: 7 * DAY, lastTick: 0, tau: 7 });
    expect(m.strength).toBeCloseTo(Math.exp(-1)); // dt = 1 tau
  });
});

describe('reinforce', () => {
  it('boosts memories recalled since lastTick', () => {
    const recalled = mem({ id: 'r', strength: 0.2, lastRecalledAt: 5 });
    const stale = mem({ id: 's', strength: 0.2, lastRecalledAt: 0 });
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
    expect(out[0]!.importance).toBe(6);          // keeps the stronger source's importance
    expect(out[0]!.sourceMsgIds.length).toBe(0); // unions sources (none here)
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd neural-chat/engine && npx vitest run test/consolidation.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```ts
import { cosineSimilarity } from './vector.js';
import type { EngineConfig, EpisodicMemory } from './types.js';

const DAY = 86_400_000;

export function decay(
  mems: EpisodicMemory[],
  o: { now: number; lastTick: number; tau: number },
): void {
  for (const m of mems) {
    const from = Math.max(m.createdAt, o.lastTick);
    const dtDays = Math.max(0, (o.now - from) / DAY);
    m.strength *= Math.exp(-dtDays / o.tau);
  }
}

export function reinforce(
  mems: EpisodicMemory[],
  o: { lastTick: number; boost: number },
): void {
  for (const m of mems) {
    if (m.lastRecalledAt >= o.lastTick) m.strength += o.boost;
  }
}

export function merge(mems: EpisodicMemory[], cfg: EngineConfig): EpisodicMemory[] {
  const out: EpisodicMemory[] = [];
  const consumed = new Set<string>();
  for (const m of mems) {
    if (consumed.has(m.id)) continue;
    if (m.strength >= cfg.mergeStrengthCeiling || !m.embedding) { out.push(m); continue; }
    let acc = m;
    for (const n of mems) {
      if (n.id === acc.id || consumed.has(n.id)) continue;
      if (n.strength >= cfg.mergeStrengthCeiling || !n.embedding) continue;
      if (cosineSimilarity(acc.embedding!, n.embedding) >= cfg.mergeThreshold) {
        const strong = acc.importance >= n.importance ? acc : n;
        acc = {
          ...strong,
          strength: acc.strength + n.strength,
          importance: Math.max(acc.importance, n.importance),
          content: strong.content,
          tags: [...new Set([...acc.tags, ...n.tags])],
          sourceMsgIds: [...new Set([...acc.sourceMsgIds, ...n.sourceMsgIds])],
        };
        consumed.add(n.id);
      }
    }
    consumed.add(m.id);
    out.push(acc);
  }
  return out;
}

export function prune(mems: EpisodicMemory[], floor: number): EpisodicMemory[] {
  return mems.filter(m => m.strength >= floor);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd neural-chat/engine && npx vitest run test/consolidation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd neural-chat && git add engine/src/consolidation.ts engine/test/consolidation.test.ts && git commit -m "feat(engine): decay/reinforce/merge/prune consolidation steps"
```

---

## Task 7: Pattern detection

**Files:**
- Modify: `neural-chat/engine/src/consolidation.ts` (add `detectPatterns`)
- Test: `neural-chat/engine/test/patterns.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
    const mems = [
      mem('a', ['mds'], 8, 0),
      mem('b', ['mds'], 6, 2 * DAY),
      mem('c', ['food'], 3, 0),
    ];
    const patterns = detectPatterns(mems);
    const mds = patterns.find(p => p.key === 'mds')!;
    expect(mds.recurrence).toBe(2);
    expect(mds.avgImportance).toBeCloseTo(7);
    expect(mds.spanDays).toBeCloseTo(2);
    expect(mds.memberIds.sort()).toEqual(['a', 'b']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd neural-chat/engine && npx vitest run test/patterns.test.ts`
Expected: FAIL (detectPatterns not exported).

- [ ] **Step 3: Add implementation to `src/consolidation.ts`**

```ts
import type { PatternEvidence } from './types.js';
// ...append:

export function detectPatterns(mems: EpisodicMemory[]): PatternEvidence[] {
  const byTag = new Map<string, EpisodicMemory[]>();
  for (const m of mems) {
    for (const tag of m.tags) {
      const arr = byTag.get(tag) ?? [];
      arr.push(m);
      byTag.set(tag, arr);
    }
  }
  const out: PatternEvidence[] = [];
  for (const [key, group] of byTag) {
    const created = group.map(g => g.createdAt);
    out.push({
      key,
      recurrence: group.length,
      avgImportance: group.reduce((s, g) => s + g.importance, 0) / group.length,
      spanDays: (Math.max(...created) - Math.min(...created)) / 86_400_000,
      memberIds: group.map(g => g.id),
    });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd neural-chat/engine && npx vitest run test/patterns.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd neural-chat && git add engine/src/consolidation.ts engine/test/patterns.test.ts && git commit -m "feat(engine): pattern detection from episodic tags"
```

---

## Task 8: Test fakes

**Files:**
- Create: `neural-chat/engine/test/fakes.ts`

No test of its own; used by Tasks 9–10. Deterministic so tests are reproducible.

- [ ] **Step 1: Write `test/fakes.ts`**

```ts
import type { Clock, StoragePort, EmbedPort, ChatPort, Snapshot, ExtractResult } from '../src/ports.js';
import type { Message, EpisodicMemory, SelfFacet } from '../src/types.js';

export class FakeClock implements Clock {
  constructor(public t = 0) {}
  now() { return this.t; }
  advanceDays(d: number) { this.t += d * 86_400_000; }
}

export class InMemoryStorage implements StoragePort {
  snap: Snapshot = { messages: [], episodic: [], selfFacets: [], prospective: [], lastTick: 0 };
  async load() { return this.snap; }
  async save(s: Snapshot) { this.snap = s; }
}

// Deterministic embedding: hash tags/words into a small fixed vector.
export class FakeEmbed implements EmbedPort {
  fail = false;
  async embed(text: string): Promise<number[] | null> {
    if (this.fail) return null;
    const v = new Array(8).fill(0);
    for (const w of text.toLowerCase().split(/\W+/).filter(Boolean)) {
      let h = 0;
      for (const ch of w) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      v[h % 8] += 1;
    }
    return v;
  }
}

// Scripted chat: extract/summarize are programmable per test.
export class FakeChat implements ChatPort {
  extractQueue: ExtractResult[] = [];
  summary: { statement: string; kind: SelfFacet['kind'] } = { statement: 'pattern', kind: 'value' };
  async *stream(): AsyncIterable<string> { yield 'ok'; }
  async describeImage() { return 'an image'; }
  async extract(): Promise<ExtractResult> {
    return this.extractQueue.shift() ?? { episodic: [], prospective: [] };
  }
  async summarizePattern(members: EpisodicMemory[]) {
    return { ...this.summary, statement: `${this.summary.statement}:${members.length}` };
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `cd neural-chat/engine && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
cd neural-chat && git add engine/test/fakes.ts && git commit -m "test(engine): deterministic fakes for clock/storage/embed/chat"
```

---

## Task 9: MemoryEngine + TimeMachine harness + behavior tests

**Files:**
- Create: `neural-chat/engine/src/engine.ts`
- Create: `neural-chat/engine/src/index.ts`
- Create: `neural-chat/engine/test/timeMachine.ts`
- Test: `neural-chat/engine/test/behaviors.test.ts`

- [ ] **Step 1: Write the failing behavior tests**

```ts
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
      { content: 'mds is physics layer', importance: 6, tags: ['mds'] },
      { content: 'random trivia', importance: 6, tags: ['x'] },
    ]);
    for (let d = 0; d < 8; d++) { await tm.retrieve('tell me about mds'); await tm.advanceAndTick(3); }
    const contents = tm.episodic().map(m => m.content);
    expect(contents).toContain('mds is physics layer');
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
    expect(await run()).toBe(await run()); // reproducible under fixed seed
  });

  it('6. RETRIEVE: emits self-tier always + bounded episodic, never full history', async () => {
    for (let i = 0; i < 50; i++) await tm.ingestUser(`msg ${i}`);
    const ctx = await tm.retrieve('anything');
    expect(ctx.episodic.length).toBeLessThanOrEqual(5);
    expect(ctx.tail.length).toBeLessThanOrEqual(8);
  });

  it('7. POLICY-SWAP: fixedK(3) crystallizes earlier than randomK(3,7) on the same seed', async () => {
    const ticksToCrystallize = async (policy: 'fixed' | 'random') => {
      const t = new TimeMachine({ seed: 9, policy });
      for (let i = 0; i < 12; i++) {
        await t.seedEpisodic([{ content: `p${i}`, importance: 9, tags: ['p'] }]);
        await t.advanceAndTick(1);
        if (t.selfTier().length) return i + 1;
      }
      return Infinity;
    };
    expect(await ticksToCrystallize('fixed')).toBeLessThanOrEqual(await ticksToCrystallize('random'));
  });

  it('8. BACKFILL: embed failure stores null, later tick backfills', async () => {
    tm.embed.fail = true;
    await tm.seedEpisodic([{ content: 'offline note', importance: 6, tags: ['o'] }]);
    expect(tm.episodic()[0]!.embedding).toBeNull();
    tm.embed.fail = false;
    await tm.advanceAndTick(0);
    expect(tm.episodic()[0]!.embedding).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd neural-chat/engine && npx vitest run test/behaviors.test.ts`
Expected: FAIL (timeMachine/engine not found).

- [ ] **Step 3: Write `src/engine.ts`**

```ts
import {
  DEFAULT_CONFIG, type EngineConfig, type EpisodicMemory, type Message,
  type ProspectiveMemory, type SelfFacet, type InjectionContext,
} from './types.js';
import type {
  StoragePort, EmbedPort, ChatPort, Clock, Random, CrystallizePolicy, Snapshot,
} from './ports.js';
import { mmrSearch } from './vector.js';
import { decay, reinforce, merge, prune, detectPatterns } from './consolidation.js';

export interface EngineDeps {
  storage: StoragePort; embed: EmbedPort; chat: ChatPort;
  clock: Clock; random: Random; policy: CrystallizePolicy;
  config?: Partial<EngineConfig>; systemPrompt?: string;
}

let counter = 0;
const uid = (p: string) => `${p}_${Date.now().toString(36)}_${(counter++).toString(36)}`;

export class MemoryEngine {
  private cfg: EngineConfig;
  constructor(private d: EngineDeps) { this.cfg = { ...DEFAULT_CONFIG, ...d.config }; }

  async ingestUser(text: string, image?: { dataUrl: string; mime: string }): Promise<void> {
    const snap = await this.d.storage.load();
    const now = this.d.clock.now();
    const msg: Message = { id: uid('m'), role: 'user', text, ts: now };
    if (image) {
      msg.imageMime = image.mime;
      const desc = await this.d.chat.describeImage(image.dataUrl);
      msg.text = text ? `${text}\n[image: ${desc}]` : `[image: ${desc}]`;
    }
    snap.messages.push(msg);
    await this.d.storage.save(snap);
  }

  // Directly add an episodic memory (used by extract and by tests).
  async addEpisodic(e: { content: string; importance: number; tags: string[]; imageUri?: string }): Promise<void> {
    const snap = await this.d.storage.load();
    const now = this.d.clock.now();
    snap.episodic.push({
      id: uid('e'), content: e.content, embedding: await this.d.embed.embed(e.content),
      importance: e.importance, strength: e.importance / 10, createdAt: now, lastRecalledAt: now,
      tags: e.tags, imageUri: e.imageUri, crystallizeAt: this.d.random.int(3, 7), sourceMsgIds: [],
    });
    await this.d.storage.save(snap);
  }

  async retrieve(query: string): Promise<InjectionContext> {
    const snap = await this.d.storage.load();
    const now = this.d.clock.now();
    const qv = (await this.d.embed.embed(query)) ?? [];
    const picks = mmrSearch(qv, snap.episodic, { topK: this.cfg.retrieveTopK, lambda: this.cfg.mmrLambda });
    for (const p of picks) {
      const m = snap.episodic.find(e => e.id === p.item.id)!;
      m.lastRecalledAt = now;
    }
    await this.d.storage.save(snap);
    return {
      selfTier: snap.selfFacets,
      episodic: picks.map(p => snap.episodic.find(e => e.id === p.item.id)!),
      prospective: snap.prospective.filter(p => p.status === 'pending'),
      tail: snap.messages.slice(-this.cfg.tailN),
    };
  }

  async tick(): Promise<void> {
    const snap = await this.d.storage.load();
    const now = this.d.clock.now();

    decay(snap.episodic, { now, lastTick: snap.lastTick, tau: this.cfg.tau });
    reinforce(snap.episodic, { lastTick: snap.lastTick, boost: this.cfg.boost });

    // EXTRACT from messages since last tick
    const recent = snap.messages.filter(m => m.ts >= snap.lastTick);
    if (recent.length) {
      const ex = await this.d.chat.extract(recent);
      for (const e of ex.episodic) {
        snap.episodic.push({
          id: uid('e'), content: e.content, embedding: await this.d.embed.embed(e.content),
          importance: e.importance, strength: e.importance / 10, createdAt: now, lastRecalledAt: now,
          tags: e.tags, crystallizeAt: this.d.random.int(3, 7), sourceMsgIds: [],
        });
      }
      for (const p of ex.prospective) {
        snap.prospective.push({ id: uid('p'), intent: p.intent, status: 'pending', priority: p.priority, contextClue: p.contextClue, createdAt: now });
      }
    }

    // BACKFILL embeddings
    for (const m of snap.episodic) if (!m.embedding) m.embedding = await this.d.embed.embed(m.content);

    snap.episodic = merge(snap.episodic, this.cfg);
    snap.episodic = prune(snap.episodic, this.cfg.floor);

    // CRYSTALLIZE
    for (const ev of detectPatterns(snap.episodic)) {
      if (ev.avgImportance < this.cfg.minCrystallizeImportance) continue;
      if (!this.d.policy.shouldCrystallize(ev, this.d.random)) continue;
      const members = snap.episodic.filter(m => ev.memberIds.includes(m.id));
      const { statement, kind } = await this.d.chat.summarizePattern(members);
      const existing = snap.selfFacets.find(f => f.statement === statement);
      if (existing) { existing.strength += this.cfg.boost; existing.updatedAt = now; }
      else snap.selfFacets.push({ id: uid('s'), statement, kind, strength: 1, updatedAt: now });
    }
    // self-tier decay + cap
    const dt = (now - snap.lastTick) / 86_400_000;
    for (const f of snap.selfFacets) f.strength *= Math.exp(-Math.max(0, dt) / (this.cfg.tau * 3));
    snap.selfFacets = snap.selfFacets
      .filter(f => f.strength >= this.cfg.selfFloor)
      .sort((a, b) => b.strength - a.strength)
      .slice(0, this.cfg.selfTierCap);

    snap.lastTick = now;
    await this.d.storage.save(snap);
  }
}
```

- [ ] **Step 4: Write `src/index.ts`**

```ts
export * from './types.js';
export * from './ports.js';
export { MemoryEngine, type EngineDeps } from './engine.js';
export { SeededRandom } from './random.js';
export { fixedK, randomK, gamble } from './policy.js';
export { cosineSimilarity, mmrSearch } from './vector.js';
```

- [ ] **Step 5: Write `test/timeMachine.ts`**

```ts
import { MemoryEngine } from '../src/engine.js';
import { SeededRandom } from '../src/random.js';
import { fixedK, randomK } from '../src/policy.js';
import { FakeClock, InMemoryStorage, FakeEmbed, FakeChat } from './fakes.js';

export class TimeMachine {
  clock = new FakeClock(0);
  storage = new InMemoryStorage();
  embed = new FakeEmbed();
  chat = new FakeChat();
  engine: MemoryEngine;

  constructor(opts: { seed: number; policy?: 'fixed' | 'random' }) {
    const policy = opts.policy === 'fixed' ? fixedK(3) : randomK(3, 7);
    this.engine = new MemoryEngine({
      storage: this.storage, embed: this.embed, chat: this.chat,
      clock: this.clock, random: new SeededRandom(opts.seed), policy,
    });
  }

  async ingestUser(text: string) { await this.engine.ingestUser(text); }
  async seedEpisodic(items: { content: string; importance: number; tags: string[] }[]) {
    for (const it of items) await this.engine.addEpisodic(it);
  }
  async retrieve(q: string) { return this.engine.retrieve(q); }
  async advanceAndTick(days: number) { this.clock.advanceDays(days); await this.engine.tick(); }

  episodic() { return this.storage.snap.episodic; }
  selfTier() { return this.storage.snap.selfFacets; }
}
```

- [ ] **Step 6: Run all tests**

Run: `cd neural-chat/engine && npx vitest run`
Expected: PASS (all unit + the behavior suite). If a behavior fails, tune the relevant constant in `DEFAULT_CONFIG` (e.g. `tau`, `floor`, `mergeThreshold`) and re-run — that is the intended workflow.

- [ ] **Step 7: Commit**

```bash
cd neural-chat && git add engine/src/engine.ts engine/src/index.ts engine/test/timeMachine.ts engine/test/behaviors.test.ts && git commit -m "feat(engine): MemoryEngine + TimeMachine harness + behavior suite"
```

---

## Task 10: OpenAI-compatible provider + adapters

**Files:**
- Create: `neural-chat/engine/provider/openaiCompat.ts`
- Create: `neural-chat/engine/provider/adapters.ts`
- Test: `neural-chat/engine/test/provider.test.ts`

- [ ] **Step 1: Write the failing test (mocked fetch — no network)**

```ts
import { describe, it, expect, vi } from 'vitest';
import { embedOnce } from '../provider/openaiCompat.js';
import { safeUrl } from '../provider/adapters.js';

describe('safeUrl', () => {
  it('accepts http(s), rejects others', () => {
    expect(safeUrl('https://x.com')).toBe(true);
    expect(safeUrl('javascript:alert(1)')).toBe(false);
    expect(safeUrl('file:///etc/passwd')).toBe(false);
  });
});

describe('embedOnce', () => {
  it('posts to /v1/embeddings and returns the vector', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true, json: async () => ({ data: [{ embedding: [0.1, 0.2, 0.3] }] }),
    })) as unknown as typeof fetch;
    const v = await embedOnce(
      { baseURL: 'http://localhost:1234/v1', apiKey: '', model: 'nomic-embed-text' },
      'hello', fetchMock,
    );
    expect(v).toEqual([0.1, 0.2, 0.3]);
    expect((fetchMock as any).mock.calls[0][0]).toContain('/v1/embeddings');
  });

  it('returns null on non-ok response (triggers backfill)', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 500 })) as unknown as typeof fetch;
    const v = await embedOnce({ baseURL: 'http://x/v1', apiKey: '', model: 'm' }, 'hi', fetchMock);
    expect(v).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd neural-chat/engine && npx vitest run test/provider.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Write `provider/openaiCompat.ts`**

```ts
export interface EndpointConfig { baseURL: string; apiKey: string; model: string; }

export async function embedOnce(
  cfg: EndpointConfig, text: string, fetchImpl: typeof fetch = fetch,
): Promise<number[] | null> {
  try {
    const res = await fetchImpl(`${cfg.baseURL}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}) },
      body: JSON.stringify({ model: cfg.model, input: text }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.[0]?.embedding ?? null;
  } catch { return null; }
}

export async function* chatStream(
  cfg: EndpointConfig, body: unknown, fetchImpl: typeof fetch = fetch,
): AsyncIterable<string> {
  const res = await fetchImpl(`${cfg.baseURL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}) },
    body: JSON.stringify({ ...(body as object), model: cfg.model, stream: true }),
  });
  if (!res.ok || !res.body) throw new Error(`chat failed: ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      const payload = t.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
        if (delta) yield delta as string;
      } catch { /* skip keep-alive */ }
    }
  }
}
```

- [ ] **Step 4: Write `provider/adapters.ts`**

```ts
import type { EmbedPort, ChatPort, ExtractResult } from '../src/ports.js';
import type { Message, SelfFacet, EpisodicMemory } from '../src/types.js';
import { embedOnce, chatStream, type EndpointConfig } from './openaiCompat.js';

export function safeUrl(u: string): boolean { return /^https?:\/\//i.test(u); }

export function makeEmbedPort(cfg: EndpointConfig): EmbedPort {
  return { embed: (text) => embedOnce(cfg, text) };
}

const toContent = (m: Message) => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.text });

export function makeChatPort(cfg: EndpointConfig): ChatPort {
  return {
    async *stream(messages, systemPrompt, inject) {
      const sys = [systemPrompt, inject].filter(Boolean).join('\n\n');
      const body = { messages: [...(sys ? [{ role: 'system', content: sys }] : []), ...messages.map(toContent)] };
      yield* chatStream(cfg, body);
    },
    async describeImage(dataUrl) {
      let out = '';
      const body = { messages: [{ role: 'user', content: [
        { type: 'text', text: 'Describe this image for semantic indexing (one line).' },
        { type: 'image_url', image_url: { url: dataUrl } },
      ] }] };
      for await (const c of chatStream(cfg, body)) out += c;
      return out.trim();
    },
    async extract(recent: Message[]): Promise<ExtractResult> {
      const prompt = `Extract durable facts and anticipatory intents from this chat as JSON ` +
        `{"episodic":[{"content","importance"(1-10),"tags":[]}],"prospective":[{"intent","priority"(1-5),"contextClue"}]}.\n\n` +
        recent.map(m => `${m.role}: ${m.text}`).join('\n');
      let out = '';
      for await (const c of chatStream(cfg, { messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' } })) out += c;
      try { const j = JSON.parse(out); return { episodic: j.episodic ?? [], prospective: j.prospective ?? [] }; }
      catch { return { episodic: [], prospective: [] }; }
    },
    async summarizePattern(members: EpisodicMemory[]): Promise<{ statement: string; kind: SelfFacet['kind'] }> {
      const prompt = `These recurring memories suggest one trait. Reply JSON {"statement","kind":"voice"|"value"|"relationship"}.\n` +
        members.map(m => `- ${m.content}`).join('\n');
      let out = '';
      for await (const c of chatStream(cfg, { messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' } })) out += c;
      try { const j = JSON.parse(out); return { statement: j.statement, kind: j.kind ?? 'value' }; }
      catch { return { statement: members[0]?.content ?? 'trait', kind: 'value' }; }
    },
  };
}
```

- [ ] **Step 5: Run all tests**

Run: `cd neural-chat/engine && npx vitest run`
Expected: PASS (everything, including provider).

- [ ] **Step 6: Commit**

```bash
cd neural-chat && git add engine/provider/openaiCompat.ts engine/provider/adapters.ts engine/test/provider.test.ts && git commit -m "feat(engine): OpenAI-compatible provider + chat/embed adapters"
```

---

## Self-Review

**Spec coverage:**
- §3 ports → Task 2. §4.1 data model → Task 2. §4.2 lifecycle (ingest/retrieve/tick) → Task 9. §4.2 decay/reinforce/merge/prune → Task 6; crystallize → Task 9; pattern detection → Task 7. §4.3 policy + seeded random + `randomK(3,7)` default → Tasks 3,5,9. §5 provider (chat+embed split, SSE, multimodal) → Task 10. §5.1 safeUrl guard → Task 10. §5.2 embed-fail backfill → Tasks 8,9 (behavior 8). §10 all 8 behaviors → Task 9 (behaviors 1,2,3,4,6,7,8 covered as integration; behavior 5 self-decay is exercised by the self-tier decay+cap in Task 9 `tick` — add an explicit assertion if desired).
- **Out of plan scope (Plan 2, by design):** §6 Expo UI, §7 persona multi-instance wiring, §8 SQLite/FileSystem StoragePort, §9 in-app tick scheduling, §6.1 in-app time travel. The engine exposes the seams (StoragePort, per-instance construction, Clock port) these will plug into.

**Placeholder scan:** none — every code step contains complete code; commands have expected output.

**Type consistency:** `EngineDeps`, `Snapshot`, `ExtractResult`, `CrystallizePolicy`, `EpisodicMemory.crystallizeAt`, `EndpointConfig` are defined once (Tasks 2/10) and reused consistently. Method names (`shouldCrystallize`, `detectPatterns`, `addEpisodic`, `advanceAndTick`) match across tasks.

**Gap noted (minor):** Behavior 5 (self-facet fade) is implemented in Task 9 `tick` but not separately asserted. Optional follow-up test; not blocking.

---

## Execution Handoff

Plan complete. Two execution options:
1. **Subagent-Driven** — fresh subagent per task, review between tasks.
2. **Inline Execution** — execute tasks in this session (run vitest here, tune constants against real output).
