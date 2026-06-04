# Spec 1A — Attributed Multi-Person Memory Implementation Plan

For agentic workers: use the `superpowers:subagent-driven-development` sub-skill to execute this plan task-by-task.

**Goal:** Give every episodic memory a *provenance* (`source` / `source_type`) and a *subject* (`'world' | 'self' | person-id`), route memories into an entity tier or a per-person tier by subject, and structurally kill the echo chamber (a self-utterance can never become a `SelfFacet`). Engine-only: the `InjectionContext` shape stays byte-identical, so the web app (which reads `snap.episodic/selfFacets/prospective/messages/lastTick` and the `InjectionContext`) runs unchanged. The just-shipped prospective-resolution + `[Self-state]` paths must stay green and untouched.

**Architecture:** Ports-and-adapters TS memory engine (`engine/src/engine.ts` = `MemoryEngine`, IO-free; adapters supply storage/embed/chat). A new **pure** module `engine/src/attribution.ts` holds the three load-bearing functions (`placeMemory`, `resolvePerson`, `deriveVisibility`) — the single router that `tick()` calls. `Snapshot` (in `ports.ts`) gains three **optional** fields (`persons` / `personRegistry` / `interactions`); `EpisodicMemory` and `Message` (in `types.ts`) gain **optional** fields. Because every new field is optional, old snapshots deserialize untouched, existing test literals compile untouched, and the build stays green with **no fixture edits**. `tick()` resolves names→ids via `resolvePerson` against `snap.personRegistry`, builds the `EpisodicMemory`, and routes it through one `placeMemory(subject)` switch. `retrieve()` widens the MMR pool to `entity ∪ all-person` episodic with **no** privacy filter (1B). Consolidation (`decay`/`reinforce`/`merge`/`prune`) runs symmetrically over each person tier; `detectPatterns`/crystallize stay **entity-only**.

**Tech Stack:** TypeScript (NodeNext ESM), Vitest. Deterministic test harness: `FakeClock` / `InMemoryStorage` / `FakeEmbed` / `FakeChat` (with `extractQueue`) + the `TimeMachine` wrapper (`engine/test/timeMachine.ts`). No web tests — the unchanged `InjectionContext` is the proof 1A is engine-only.

---

## Conventions (apply to every task)

- **Single test:** `cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npx vitest run test/<file> -t "<name>"`
- **Full suite:** `cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npm test`
- **Build (REQUIRED after ANY `engine/src` or `engine/provider` change):** `cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npm run build`
- **Typecheck:** `cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npx tsc --noEmit`
- **Commit (trailer is mandatory on EVERY commit):**
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  ```
  Use `git -C /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat ...` (cwd drift is real).
- **Regression invariant:** `respond.test.ts`, `behaviors.test.ts`, `prospective.test.ts`, `consolidation.test.ts`, `patterns.test.ts`, `provider.test.ts`, `rewind.test.ts` must stay GREEN unchanged through every task.
- **Optionality invariant:** every new `EpisodicMemory` / `Message` / `ExtractResult.episodic` field is **optional** — Task 1's build must pass with **zero edits to existing test fixtures or `fakes.ts`**.

---

## Task 1 — Schema/types: optional attribution fields + new shapes

Adds all optional fields and the three new interfaces. Nothing reads them yet; the gate is that the **build and full suite stay green with no fixture edits** (proving optionality).

- [ ] **1.1 Write failing test** — pins the new types compile and old literals still satisfy `EpisodicMemory` / `Message`.

  Create `engine/test/attribution-types.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';
  import type {
    EpisodicMemory, Message, Person, PersonMemory, Interaction,
  } from '../src/types.js';
  import type { Snapshot, ExtractResult } from '../src/ports.js';

  describe('1A schema (optional fields, new shapes)', () => {
    it('an episodic literal WITHOUT the new fields still satisfies EpisodicMemory (optionality)', () => {
      const e: EpisodicMemory = {
        id: 'e', content: 'c', embedding: [1], importance: 5, strength: 1,
        createdAt: 0, lastRecalledAt: -1, tags: [], crystallizeAt: 4, sourceMsgIds: [],
      };
      expect(e.source).toBeUndefined();
      expect(e.source_type).toBeUndefined();
      expect(e.subject).toBeUndefined();
    });

    it('an episodic literal WITH the new fields type-checks', () => {
      const e: EpisodicMemory = {
        id: 'e', content: 'c', embedding: [1], importance: 5, strength: 1,
        createdAt: 0, lastRecalledAt: -1, tags: [], crystallizeAt: 4, sourceMsgIds: [],
        source: 'person_x', source_type: 'user', subject: 'world',
      };
      expect(e.source_type).toBe('user');
    });

    it('a Message accepts an optional speaker', () => {
      const m: Message = { id: 'm', role: 'user', text: 'hi', ts: 0, speaker: null };
      expect(m.speaker).toBeNull();
    });

    it('Person / PersonMemory / Interaction shapes are constructible', () => {
      const p: Person = { id: 'person_1', known_names: ['วี'], createdAt: 0, lastSeenAt: 0, interactionCount: 1 };
      const pm: PersonMemory = { episodic: [] };
      const ix: Interaction = { id: 'i1', msgId: 'm1', source: null, source_type: 'user', role: 'user', ts: 0 };
      expect([p.id, pm.episodic.length, ix.role]).toEqual(['person_1', 0, 'user']);
    });

    it('Snapshot keeps loading with the three optional tiers absent, and accepts them present', () => {
      const v0: Snapshot = { messages: [], episodic: [], selfFacets: [], prospective: [], lastTick: 0 };
      expect(v0.persons).toBeUndefined();
      const v1: Snapshot = { ...v0, persons: {}, personRegistry: {}, interactions: [] };
      expect(v1.interactions).toEqual([]);
    });

    it('ExtractResult.episodic accepts optional source_name / subject / said_by', () => {
      const r: ExtractResult = {
        episodic: [{ content: 'c', importance: 5, tags: [], source_name: 'วี', subject: { person_name: 'วี' }, said_by: 'user' }],
        prospective: [],
      };
      expect(r.episodic[0]!.said_by).toBe('user');
    });
  });
  ```

- [ ] **1.2 Run — expect FAIL.** Type errors: `Person`/`PersonMemory`/`Interaction` are not exported, `EpisodicMemory.source` etc. do not exist, `Snapshot.persons` / `ExtractResult.episodic[].said_by` do not exist.
  ```
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npx vitest run test/attribution-types.test.ts
  ```

- [ ] **1.3 Implement — `engine/src/types.ts`.** Add three optional fields to `EpisodicMemory`, one to `Message`, and the three new interfaces.

  Edit — `Message` (add `speaker`). Replace:
  ```ts
  export interface Message {
    id: string;
    role: 'user' | 'model';
    text: string;
    imageUri?: string;
    imageMime?: string;
    ts: number;
  }
  ```
  with:
  ```ts
  export interface Message {
    id: string;
    role: 'user' | 'model';
    text: string;
    imageUri?: string;
    imageMime?: string;
    ts: number;
    speaker?: string | null; // a person.id; null in 1A until the 1B speaker-picker exists
  }
  ```

  Edit — `EpisodicMemory` (add `source` / `source_type` / `subject`). Replace:
  ```ts
    crystallizeAt: number; // per-memory threshold (for the per-memory random variant)
    sourceMsgIds: string[];
  }
  ```
  with:
  ```ts
    crystallizeAt: number; // per-memory threshold (for the per-memory random variant)
    sourceMsgIds: string[];
    // --- 1A attribution (all optional ⇒ existing rows & ambient deserialize unchanged) ---
    source?: string | null;                              // person.id who said/observed it; null = unknown speaker
    source_type?: 'user' | 'ambient' | 'self' | 'system';// kind of source — set on every new memory
    subject?: string | null;                             // 'world' | 'self' | a person.id ; absent ⇒ 'world'
  }
  ```

  Edit — add the three new interfaces immediately after `EpisodicMemory` (before `ProspectiveMemory`). Insert after the closing `}` of `EpisodicMemory`:
  ```ts

  // --- 1A: person identity + per-person memory + interaction ledger ---
  export interface Person {
    id: string;            // STABLE synthetic opaque id (uid('person')); NEVER derived from a name
    known_names: string[]; // appended on each sighting; an attribute, never a key
    createdAt: number;
    lastSeenAt: number;
    interactionCount: number;
  }
  export interface PersonMemory { episodic: EpisodicMemory[]; } // pure episodic; no per-person selfFacets/prospective in 1A
  export interface Interaction {
    id: string;
    msgId: string;
    source: string | null;
    source_type: 'user' | 'self' | 'system';
    role: 'user' | 'model';
    ts: number;
  }
  ```

- [ ] **1.4 Implement — `engine/src/ports.ts`.** Import the new types, extend `Snapshot`, widen `ExtractResult.episodic`.

  Edit — the type import. Replace:
  ```ts
  import type {
    Message, SelfFacet, EpisodicMemory, ProspectiveMemory, PatternEvidence,
  } from './types.js';
  ```
  with:
  ```ts
  import type {
    Message, SelfFacet, EpisodicMemory, ProspectiveMemory, PatternEvidence,
    Person, PersonMemory, Interaction,
  } from './types.js';
  ```

  Edit — `Snapshot`. Replace:
  ```ts
  export interface Snapshot {
    messages: Message[];
    episodic: EpisodicMemory[];
    selfFacets: SelfFacet[];
    prospective: ProspectiveMemory[];
    lastTick: number;
  }
  ```
  with:
  ```ts
  export interface Snapshot {
    messages: Message[];
    episodic: EpisodicMemory[];        // ENTITY tier (world/place) — unchanged path
    selfFacets: SelfFacet[];           // ENTITY identity — crystallized from entity episodic ONLY
    prospective: ProspectiveMemory[];  // ENTITY intents — unchanged (per-person is 1B)
    lastTick: number;
    // --- 1A additions (all optional ⇒ v0 snapshots load untouched) ---
    persons?: Record<string, PersonMemory>;   // PERSON tier, keyed by OPAQUE person.id
    personRegistry?: Record<string, Person>;  // person.id → identity (names are attributes)
    interactions?: Interaction[];             // who-said-what-when ledger (beside messages[])
  }
  ```

  Edit — `ExtractResult.episodic`. Replace:
  ```ts
  export interface ExtractResult {
    episodic: { content: string; importance: number; tags: string[] }[];
    prospective: { intent: string; priority: number; contextClue: string }[];
    resolved?: string[]; // ids of previously-pending intents this exchange has addressed
  }
  ```
  with:
  ```ts
  export interface ExtractResult {
    episodic: {
      content: string; importance: number; tags: string[];
      source_name?: string | null;                                 // who SAID/OBSERVED it (a name, or null = assistant/system)
      subject?: 'world' | 'self' | { person_name: string } | null; // who/what it is ABOUT
      said_by?: 'user' | 'self';                                    // role of the utterance → source_type (default 'user')
    }[];
    prospective: { intent: string; priority: number; contextClue: string }[];
    resolved?: string[]; // ids of previously-pending intents this exchange has addressed
  }
  ```

- [ ] **1.5 Run — expect PASS.**
  ```
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npx vitest run test/attribution-types.test.ts
  ```

- [ ] **1.6 Build + full suite + typecheck — must be GREEN with NO fixture edits** (the optionality proof: `fakes.ts`'s `InMemoryStorage` literal, every existing `mem(...)` helper, and old snapshots all still satisfy the widened types).
  ```
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npm run build
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npm test
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npx tsc --noEmit
  ```

- [ ] **1.7 Commit.**
  ```
  git -C /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat add engine/src/types.ts engine/src/ports.ts engine/test/attribution-types.test.ts
  git -C /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat commit -m "$(cat <<'EOF'
feat(engine): 1A schema — optional source/source_type/subject + Person/PersonMemory/Interaction

All new EpisodicMemory/Message/ExtractResult fields optional ⇒ v0 snapshots & existing
test fixtures load untouched. Snapshot gains optional persons/personRegistry/interactions.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
  ```

---

## Task 2 — `attribution.ts` (pure): placeMemory + resolvePerson + deriveVisibility

The single router + the stable-id minter + the derived-visibility seam, all pure (no engine/IO; `mintId` injected for determinism). Pins the load-bearing invariant: **a person id is opaque, never derived from a name, and the same name never splits**.

- [ ] **2.1 Write failing test** — `engine/test/attribution.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { placeMemory, resolvePerson, deriveVisibility } from '../src/attribution.js';
  import type { Person } from '../src/types.js';

  // Deterministic id minter for tests.
  function minter() {
    let n = 0;
    return () => `person_${(n++).toString(36)}`;
  }

  describe('placeMemory (subject decides the tier)', () => {
    it('world / null / undefined → entity', () => {
      expect(placeMemory('world')).toEqual({ tier: 'entity' });
      expect(placeMemory(null)).toEqual({ tier: 'entity' });
      expect(placeMemory(undefined)).toEqual({ tier: 'entity' });
    });
    it('self → interaction (no episodic push)', () => {
      expect(placeMemory('self')).toEqual({ tier: 'interaction' });
    });
    it('a person id → person tier carrying that id', () => {
      expect(placeMemory('person_42')).toEqual({ tier: 'person', personId: 'person_42' });
    });
  });

  describe('resolvePerson (name → stable opaque id)', () => {
    it('null/empty name → no person, registry untouched', () => {
      const reg: Record<string, Person> = {};
      expect(resolvePerson(null, reg, 0, minter()).personId).toBeNull();
      expect(resolvePerson('', reg, 0, minter()).personId).toBeNull();
      expect(resolvePerson('   ', reg, 0, minter()).personId).toBeNull();
    });

    it('an unseen name MINTS a synthetic id that is NOT the name', () => {
      const { personId, registry } = resolvePerson('วี', {}, 100, minter());
      expect(personId).toBe('person_0');
      expect(personId).not.toBe('วี');
      expect(personId).toMatch(/^person_/);
      expect(registry[personId!]!.known_names).toEqual(['วี']);
      expect(registry[personId!]!.createdAt).toBe(100);
      expect(registry[personId!]!.interactionCount).toBe(1);
    });

    it('the SAME name again → the SAME id (no split) and bumps interactionCount/lastSeenAt', () => {
      const mint = minter();
      const first = resolvePerson('วี', {}, 100, mint);
      const second = resolvePerson('วี', first.registry, 200, mint);
      expect(second.personId).toBe(first.personId);              // no split
      expect(Object.keys(second.registry)).toHaveLength(1);      // no new id minted
      expect(second.registry[second.personId!]!.interactionCount).toBe(2);
      expect(second.registry[second.personId!]!.lastSeenAt).toBe(200);
    });

    it('case/whitespace variants resolve to ONE id; a new surface form is appended to known_names', () => {
      const mint = minter();
      const a = resolvePerson('Wutty', {}, 0, mint);
      const b = resolvePerson('  wutty ', a.registry, 1, mint);
      expect(b.personId).toBe(a.personId);                       // one id
      expect(Object.keys(b.registry)).toHaveLength(1);
      // exact surface form ' wutty ' is trimmed; differs from 'Wutty' ⇒ appended
      expect(b.registry[b.personId!]!.known_names).toEqual(['Wutty', 'wutty']);
    });

    it('does not duplicate a known_name that already matches exactly', () => {
      const mint = minter();
      const a = resolvePerson('Wutty', {}, 0, mint);
      const b = resolvePerson('Wutty', a.registry, 1, mint);
      expect(b.registry[b.personId!]!.known_names).toEqual(['Wutty']);
    });

    it('two distinct names mint two ids (split-before-merge is accepted in 1A)', () => {
      const mint = minter();
      const a = resolvePerson('วี', {}, 0, mint);
      const b = resolvePerson('Wutty', a.registry, 0, mint);
      expect(b.personId).not.toBe(a.personId);
      expect(Object.keys(b.registry).sort()).toEqual(['person_0', 'person_1']);
    });
  });

  describe('deriveVisibility (derived, never stored)', () => {
    it('world/absent → public, self → internal, person → private', () => {
      expect(deriveVisibility({ subject: 'world' })).toBe('public');
      expect(deriveVisibility({})).toBe('public');
      expect(deriveVisibility({ subject: null })).toBe('public');
      expect(deriveVisibility({ subject: 'self' })).toBe('internal');
      expect(deriveVisibility({ subject: 'person_9' })).toBe('private');
    });
  });
  ```

- [ ] **2.2 Run — expect FAIL.** `Cannot find module '../src/attribution.js'` (the module does not exist yet).
  ```
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npx vitest run test/attribution.test.ts
  ```

- [ ] **2.3 Implement — create `engine/src/attribution.ts`:**
  ```ts
  import type { Person } from './types.js';

  export type Placement =
    | { tier: 'entity' }
    | { tier: 'person'; personId: string }
    | { tier: 'interaction' };

  // Subject decides the tier. The ONLY router; tick() never pushes an episodic any other way.
  export function placeMemory(subject: string | null | undefined): Placement {
    if (!subject || subject === 'world') return { tier: 'entity' };     // legacy/world ⇒ entity (today's path)
    if (subject === 'self')              return { tier: 'interaction' }; // echo-chamber kill: NO episodic push
    return { tier: 'person', personId: subject };
  }

  // Name → stable opaque id. The engine owns id minting; the LLM never sees an id.
  // Matching is exact (case/whitespace-insensitive) against known_names; fuzzy/alias-merge is 1B.
  export function resolvePerson(
    name: string | null | undefined,
    registry: Record<string, Person>,
    now: number,
    mintId: () => string,                  // === uid('person')
  ): { personId: string | null; registry: Record<string, Person> } {
    const surface = name?.trim();
    if (!surface) return { personId: null, registry };
    const norm = surface.toLowerCase();
    const hit = Object.values(registry).find(p => p.known_names.some(n => n.toLowerCase() === norm));
    if (hit) {
      hit.lastSeenAt = now;
      hit.interactionCount += 1;
      if (!hit.known_names.some(n => n === surface)) hit.known_names.push(surface);
      return { personId: hit.id, registry };
    }
    const id = mintId();                    // id is NEVER derived from the name
    registry[id] = { id, known_names: [surface], createdAt: now, lastSeenAt: now, interactionCount: 1 };
    return { personId: id, registry };
  }

  // Derived, never stored. Defined HERE so 1B has one place to plug the privacy filter.
  export function deriveVisibility(m: { subject?: string | null }): 'public' | 'private' | 'internal' {
    const s = m.subject;
    if (!s || s === 'world') return 'public';   // shared entity knowledge
    if (s === 'self')        return 'internal'; // entity self-talk — interaction-only
    return 'private';                           // tied to a specific person
  }
  ```
  > Note: this implementation **mutates** the passed `registry` in place and returns the same reference (matching how `tick()` will hold a single live `snap.personRegistry`). The spec's `{...registry, [id]: ...}` snippet is illustrative; in-place mutation of the snapshot's own object is the engine's existing style (`snap.episodic.push`) and keeps `tick()` simple. Tests above assert identity counts, not immutability.

- [ ] **2.4 Run — expect PASS.**
  ```
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npx vitest run test/attribution.test.ts
  ```

- [ ] **2.5 Export from `engine/src/index.ts`.** Replace:
  ```ts
  export { formatInjection } from './inject.js';
  ```
  with:
  ```ts
  export { formatInjection } from './inject.js';
  export { placeMemory, resolvePerson, deriveVisibility, type Placement } from './attribution.js';
  ```

- [ ] **2.6 Build + full suite — GREEN.**
  ```
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npm run build
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npm test
  ```

- [ ] **2.7 Commit.**
  ```
  git -C /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat add engine/src/attribution.ts engine/src/index.ts engine/test/attribution.test.ts
  git -C /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat commit -m "$(cat <<'EOF'
feat(engine): pure attribution module (placeMemory + resolvePerson + deriveVisibility)

resolvePerson pins the stable-id invariant: opaque id, never the name; same name (case/space
variants) → one id, no split; unseen name mints a stub + appends surface forms.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
  ```

---

## Task 3 — Snapshot normalization (v0 migration)

Normalize the three new tiers at the top of `tick()` **and** defensively at the top of `retrieve()`, mirroring the existing prospective back-fill, so a v0 snapshot loads and ticks clean.

- [ ] **3.1 Write failing test** — `engine/test/attributed.test.ts` (this file is shared by Tasks 3–8). Start it:
  ```ts
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
  ```

- [ ] **3.2 Run — expect FAIL.** The **`tick` migration** test is the RED: after `advanceAndTick(0)`, `tm.storage.snap.persons` / `personRegistry` / `interactions` are still `undefined` (nothing initializes them) so the `.toEqual({})` / `.toEqual([])` assertions fail. (The second test — `retrieve() also tolerates a v0 snapshot` — is a forward-guard for Task 8: with episodic `[]` it already returns `{ episodic: [] }` and passes now; it must stay green after Task 8 widens the pool to read `snap.persons`. A single failing test in the file makes this step RED.)
  ```
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npx vitest run test/attributed.test.ts -t "1A migration"
  ```

- [ ] **3.3 Implement — `engine/src/engine.ts`, `tick()`.** Add the normalization right after the `now` line, alongside the existing prospective normalize. Replace:
  ```ts
    async tick(): Promise<void> {
      const snap = await this.d.storage.load();
      const now = this.d.clock.now();

      // Normalize intents persisted before this feature (whole-snapshot JSON has no migration).
      for (const p of snap.prospective) {
  ```
  with:
  ```ts
    async tick(): Promise<void> {
      const snap = await this.d.storage.load();
      const now = this.d.clock.now();

      // Normalize 1A tiers persisted before this feature (whole-snapshot JSON has no migration).
      snap.persons ??= {};
      snap.personRegistry ??= {};
      snap.interactions ??= [];

      // Normalize intents persisted before this feature (whole-snapshot JSON has no migration).
      for (const p of snap.prospective) {
  ```

- [ ] **3.4 Implement — `engine/src/engine.ts`, `retrieve()`.** Add the same defensive normalize right after `now`. Replace:
  ```ts
    async retrieve(query: string): Promise<InjectionContext> {
      const snap = await this.d.storage.load();
      const now = this.d.clock.now();
      const qv = (await this.d.embed.embed(query)) ?? [];
  ```
  with:
  ```ts
    async retrieve(query: string): Promise<InjectionContext> {
      const snap = await this.d.storage.load();
      const now = this.d.clock.now();
      snap.persons ??= {};
      snap.personRegistry ??= {};
      snap.interactions ??= [];
      const qv = (await this.d.embed.embed(query)) ?? [];
  ```

- [ ] **3.5 Run — expect PASS.**
  ```
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npx vitest run test/attributed.test.ts -t "1A migration"
  ```

- [ ] **3.6 Build + full suite — GREEN.**
  ```
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npm run build
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npm test
  ```

- [ ] **3.7 Commit.**
  ```
  git -C /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat add engine/src/engine.ts engine/test/attributed.test.ts
  git -C /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat commit -m "$(cat <<'EOF'
feat(engine): normalize 1A tiers (persons/personRegistry/interactions) in tick + retrieve

Mirrors the prospective back-fill so v0 snapshots load and tick clean — no data loss.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
  ```

---

## Task 4 — Interaction ledger + Message.speaker (the who-said-what trail)

`ingestUser` gains an optional `speaker`, stamps `msg.speaker`, and appends an `Interaction(role 'user')`; `ingestModel` appends an `Interaction(role 'model', source_type 'self')`. This is the audit trail and where the self-utterance is preserved verbatim (quarantined from the identity path, not lost).

- [ ] **4.1 Write failing test** — append to `engine/test/attributed.test.ts`:
  ```ts
  describe('1A interaction ledger + Message.speaker', () => {
    it('ingestUser stamps msg.speaker and appends an Interaction(role user)', async () => {
      const tm = new TimeMachine({ seed: 1 });
      await tm.engine.ingestUser('hi there', undefined, 'person_7');
      const msg = tm.storage.snap.messages.at(-1)!;
      expect(msg.speaker).toBe('person_7');
      const ix = tm.storage.snap.interactions!.at(-1)!;
      expect(ix.msgId).toBe(msg.id);
      expect(ix.role).toBe('user');
      expect(ix.source).toBe('person_7');
      expect(ix.source_type).toBe('user');
      expect(ix.ts).toBe(tm.clock.now());
    });

    it('ingestUser with no speaker → speaker null, Interaction.source null (unknown speaker, still source_type user)', async () => {
      const tm = new TimeMachine({ seed: 1 });
      await tm.engine.ingestUser('hi');
      const msg = tm.storage.snap.messages.at(-1)!;
      expect(msg.speaker ?? null).toBeNull();
      const ix = tm.storage.snap.interactions!.at(-1)!;
      expect(ix.source).toBeNull();
      expect(ix.source_type).toBe('user');
    });

    it('ingestModel appends an Interaction(role model, source_type self, source null)', async () => {
      const tm = new TimeMachine({ seed: 1 });
      await tm.engine.ingestModel('a reply');
      const ix = tm.storage.snap.interactions!.at(-1)!;
      expect(ix.role).toBe('model');
      expect(ix.source_type).toBe('self');
      expect(ix.source).toBeNull();
      expect(ix.msgId).toBe(tm.storage.snap.messages.at(-1)!.id);
    });
  });
  ```

- [ ] **4.2 Run — expect FAIL.** `ingestUser` has arity 2 (no `speaker` param) → TS error on the 3-arg call; `snap.interactions` is empty (nothing appends), so `.at(-1)` is `undefined` and the assertions throw.
  ```
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npx vitest run test/attributed.test.ts -t "interaction ledger"
  ```

- [ ] **4.3 Implement — `engine/src/engine.ts`, `ingestUser`.** Replace the whole method:
  ```ts
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
  ```
  with:
  ```ts
    async ingestUser(
      text: string,
      image?: { dataUrl: string; mime: string },
      speaker?: string | null,
    ): Promise<void> {
      const snap = await this.d.storage.load();
      snap.interactions ??= [];
      const now = this.d.clock.now();
      const msg: Message = { id: uid('m'), role: 'user', text, ts: now, speaker: speaker ?? null };
      if (image) {
        msg.imageMime = image.mime;
        const desc = await this.d.chat.describeImage(image.dataUrl);
        msg.text = text ? `${text}\n[image: ${desc}]` : `[image: ${desc}]`;
      }
      snap.messages.push(msg);
      snap.interactions.push({
        id: uid('i'), msgId: msg.id, source: speaker ?? null, source_type: 'user', role: 'user', ts: now,
      });
      await this.d.storage.save(snap);
    }
  ```

- [ ] **4.4 Implement — `engine/src/engine.ts`, `ingestModel`.** Replace:
  ```ts
    async ingestModel(text: string): Promise<void> {
      const snap = await this.d.storage.load();
      snap.messages.push({ id: uid('m'), role: 'model', text, ts: this.d.clock.now() });
      await this.d.storage.save(snap);
    }
  ```
  with:
  ```ts
    async ingestModel(text: string): Promise<void> {
      const snap = await this.d.storage.load();
      snap.interactions ??= [];
      const now = this.d.clock.now();
      const msg: Message = { id: uid('m'), role: 'model', text, ts: now };
      snap.messages.push(msg);
      snap.interactions.push({
        id: uid('i'), msgId: msg.id, source: null, source_type: 'self', role: 'model', ts: now,
      });
      await this.d.storage.save(snap);
    }
  ```
  > `ingestModel` now constructs a named `msg` so the `Interaction.msgId` matches the message it ingested. `Message` is already imported at the top of `engine.ts`.

- [ ] **4.5 Run — expect PASS.**
  ```
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npx vitest run test/attributed.test.ts -t "interaction ledger"
  ```

- [ ] **4.6 Build + full suite — GREEN** (verifies `respond.test.ts`'s role-order assertion and rewind still pass; the optional `speaker` does not perturb them).
  ```
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npm run build
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npm test
  ```

- [ ] **4.7 Commit.**
  ```
  git -C /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat add engine/src/engine.ts engine/test/attributed.test.ts
  git -C /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat commit -m "$(cat <<'EOF'
feat(engine): interaction ledger + optional Message.speaker

ingestUser(text, image?, speaker?) stamps msg.speaker and appends Interaction(role user);
ingestModel appends Interaction(role model, source_type self). source null = unknown speaker.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
  ```

---

## Task 5 — tick() placement: resolve source/subject/source_type + route via placeMemory

The heart of 1A. Per extracted episodic item: resolve `source` (from `source_name`) and `subject` (from `subject`) through `resolvePerson`, set `source_type` from `said_by`, build the `EpisodicMemory` carrying today's exact fields **plus** the three attribution fields, then route through one `placeMemory(subject)` switch. `subject==='self'` pushes to **no** episodic array — the structural echo-chamber kill.

- [ ] **5.1 Write failing test** — append to `engine/test/attributed.test.ts`:
  ```ts
  describe('1A placement (subject → tier; echo-chamber kill)', () => {
    it('subject={person_name} → lands ONLY in snap.persons[id].episodic, not snap.episodic; registry records the name', async () => {
      const tm = new TimeMachine({ seed: 1 });
      tm.chat.extractQueue.push({
        episodic: [{ content: 'วี ชอบเดินตลาดนัด', importance: 7, tags: ['market'],
          source_name: 'วี', subject: { person_name: 'วี' }, said_by: 'user' }],
        prospective: [],
      });
      await tm.respond('คุยกับวี');
      expect(tm.storage.snap.episodic).toHaveLength(0);                 // NOT in entity tier
      const persons = tm.storage.snap.persons!;
      const ids = Object.keys(persons);
      expect(ids).toHaveLength(1);
      const mem = persons[ids[0]!]!.episodic[0]!;
      expect(mem.content).toBe('วี ชอบเดินตลาดนัด');
      expect(mem.subject).toBe(ids[0]);                                 // subject is the resolved id, not the name
      expect(mem.source).toBe(ids[0]);                                  // วี both said it and is about it
      expect(mem.source_type).toBe('user');
      const reg = tm.storage.snap.personRegistry!;
      expect(reg[ids[0]!]!.known_names).toContain('วี');
    });

    it("subject='world' (and an omitted subject) → entity tier (parity with today)", async () => {
      const tm = new TimeMachine({ seed: 1 });
      tm.chat.extractQueue.push({
        episodic: [
          { content: 'ตลาดเช้าวันนี้คนเยอะ', importance: 6, tags: ['market'], source_name: 'วี', subject: 'world', said_by: 'user' },
          { content: 'a bare legacy fact', importance: 6, tags: ['x'] }, // no source_name/subject/said_by
        ],
        prospective: [],
      });
      await tm.respond('hi');
      const contents = tm.storage.snap.episodic.map(m => m.content);
      expect(contents).toContain('ตลาดเช้าวันนี้คนเยอะ');
      expect(contents).toContain('a bare legacy fact');                 // back-compat: absent subject ⇒ world ⇒ entity
      expect(Object.keys(tm.storage.snap.persons!)).toHaveLength(0);
      const worldMem = tm.storage.snap.episodic.find(m => m.content === 'ตลาดเช้าวันนี้คนเยอะ')!;
      expect(worldMem.subject).toBe('world');
      expect(worldMem.source_type).toBe('user');
      const bareMem = tm.storage.snap.episodic.find(m => m.content === 'a bare legacy fact')!;
      expect(bareMem.subject).toBe('world');                            // defaulted
      expect(bareMem.source).toBeNull();                               // no source_name ⇒ null
      expect(bareMem.source_type).toBe('user');                        // no said_by ⇒ default 'user'
    });

    it("subject='self' → pushes NOTHING to any episodic; ledger still has the model interaction", async () => {
      const tm = new TimeMachine({ seed: 1 });
      tm.chat.extractQueue.push({
        episodic: [{ content: 'ฉันชอบฝน', importance: 9, tags: ['self'], source_name: null, subject: 'self', said_by: 'self' }],
        prospective: [],
      });
      await tm.respond('คุยเล่น');
      expect(tm.storage.snap.episodic).toHaveLength(0);
      expect(Object.values(tm.storage.snap.persons!).flatMap(p => p.episodic)).toHaveLength(0);
      // the verbatim utterance is preserved as a model interaction (audit), not lost
      expect(tm.storage.snap.interactions!.some(i => i.role === 'model' && i.source_type === 'self')).toBe(true);
    });

    it('ECHO-CHAMBER regression: a self-subject utterance NEVER crystallizes; a world utterance DOES (positive control)', async () => {
      // Negative: repeated self-subject extracts must produce zero selfFacets.
      const neg = new TimeMachine({ seed: 2024, policy: 'fixed' });
      for (let i = 0; i < 8; i++) {
        neg.chat.extractQueue.push({
          episodic: [{ content: `ฉันชอบฝน ${i}`, importance: 9, tags: ['selftrait'], source_name: null, subject: 'self', said_by: 'self' }],
          prospective: [],
        });
        await neg.respond(`turn ${i}`);
        neg.clock.advanceDays(1);
      }
      expect(neg.storage.snap.episodic).toHaveLength(0);
      expect(neg.selfTier()).toHaveLength(0);                          // no path self→selfFacet

      // Positive control: repeated WORLD extracts with the same tag DO crystallize.
      const pos = new TimeMachine({ seed: 2024, policy: 'fixed' });
      for (let i = 0; i < 8; i++) {
        pos.chat.extractQueue.push({
          episodic: [{ content: `ตลาดคึกคัก ${i}`, importance: 9, tags: ['worldtrait'], source_name: null, subject: 'world', said_by: 'self' }],
          prospective: [],
        });
        await pos.respond(`turn ${i}`);
        pos.clock.advanceDays(1);
      }
      expect(pos.selfTier().length).toBeGreaterThan(0);                // world facts crystallize identity
    });
  });
  ```
  > Why the positive control uses `said_by:'self'` with `subject:'world'`: it proves the spec's rule "a world OBSERVATION the assistant makes is still `world`, not `self`" — the assistant speaking still routes to the entity tier when the subject is the world, so identity crystallizes from world facts (the intended path), while pure self-assertions are quarantined.

- [ ] **5.2 Run — expect FAIL.** Today's `tick()` pushes every extracted item to `snap.episodic` with no `source/subject/source_type`. So: the person test fails (`snap.episodic` has length 1, `snap.persons` empty); the world test fails (`subject`/`source_type` undefined); the self test fails (`snap.episodic` has length 1); the echo-chamber negative fails (self utterances land in entity episodic and crystallize).
  ```
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npx vitest run test/attributed.test.ts -t "placement"
  ```

- [ ] **5.3 Implement — `engine/src/engine.ts`.** First add the import. Replace:
  ```ts
  import { formatInjection } from './inject.js';
  ```
  with:
  ```ts
  import { formatInjection } from './inject.js';
  import { placeMemory, resolvePerson } from './attribution.js';
  ```

- [ ] **5.4 Implement — replace the extract→push loop in `tick()`.** Replace exactly:
  ```ts
        for (const e of ex.episodic) {
          snap.episodic.push({
            id: uid('e'), content: e.content, embedding: await this.d.embed.embed(e.content),
            importance: e.importance, strength: e.importance / 10, createdAt: now, lastRecalledAt: -1,
            tags: e.tags, crystallizeAt: this.d.random.int(3, 7), sourceMsgIds: [],
          });
        }
  ```
  with:
  ```ts
        for (const e of ex.episodic) {
          // Provenance: who SAID it (source) + the kind of source (source_type from said_by).
          const src = resolvePerson(e.source_name, snap.personRegistry, now, () => uid('person'));
          const source = src.personId;
          const source_type = e.said_by === 'self' ? 'self' : 'user';

          // Subject: who/what it is ABOUT. {person_name} resolves to an id via the SAME resolver;
          // 'world'/'self' sentinels pass through; absent ⇒ 'world'.
          let subject: string;
          const s = e.subject;
          if (s && typeof s === 'object' && 'person_name' in s) {
            subject = resolvePerson(s.person_name, snap.personRegistry, now, () => uid('person')).personId ?? 'world';
          } else if (s === 'self') {
            subject = 'self';
          } else {
            subject = 'world'; // 'world', null, undefined all land here
          }

          const mem = {
            id: uid('e'), content: e.content, embedding: await this.d.embed.embed(e.content),
            importance: e.importance, strength: e.importance / 10, createdAt: now, lastRecalledAt: -1,
            tags: e.tags, crystallizeAt: this.d.random.int(3, 7), sourceMsgIds: [],
            source, source_type, subject,
          };

          const place = placeMemory(subject);
          if (place.tier === 'entity') {
            snap.episodic.push(mem);                                  // today's exact behavior
          } else if (place.tier === 'person') {
            (snap.persons[place.personId] ??= { episodic: [] }).episodic.push(mem);
          }
          // place.tier === 'interaction' (subject === 'self'): push NOTHING — echo-chamber kill.
        }
  ```
  > `snap.personRegistry` and `snap.persons` are guaranteed defined here by the Task-3 normalize at the top of `tick()`. The `() => uid('person')` minter wraps the module-level `uid` so ids match the `/^person_/` invariant resolvePerson's tests pin.

- [ ] **5.5 Run — expect PASS.**
  ```
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npx vitest run test/attributed.test.ts -t "placement"
  ```

- [ ] **5.6 Build + full suite — GREEN.** Critically, `respond.test.ts`'s `'user likes mds'` bare extract (no attribution fields) still routes to entity episodic — back-compat.
  ```
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npm run build
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npm test
  ```

- [ ] **5.7 Commit.**
  ```
  git -C /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat add engine/src/engine.ts engine/test/attributed.test.ts
  git -C /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat commit -m "$(cat <<'EOF'
feat(engine): attributed placement in tick — route episodic by subject via placeMemory

Per extracted item: resolve source (source_name) + subject + source_type (said_by), build the
EpisodicMemory, route through one placeMemory() switch. subject='self' pushes to NO episodic
array — the structural echo-chamber kill (no path self→selfFacet). world→entity, person→person tier.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
  ```

---

## Task 6 — Ambient attribution (addEpisodic sets world/null/ambient inline)

The ambient `observe()` path does not pass through `extract`/`place`, so `addEpisodic` must stamp `subject:'world'`, `source:null`, `source_type:'ambient'` at the push or ambient facts arrive unattributed.

- [ ] **6.1 Write failing test** — append to `engine/test/attributed.test.ts`:
  ```ts
  describe('1A ambient attribution', () => {
    it('addEpisodic stamps subject=world, source=null, source_type=ambient', async () => {
      const tm = new TimeMachine({ seed: 1 });
      await tm.engine.addEpisodic({ content: 'อากาศเย็นผิดปกติเช้านี้', importance: 6, tags: ['weather'] });
      const mem = tm.storage.snap.episodic.at(-1)!;
      expect(mem.subject).toBe('world');
      expect(mem.source).toBeNull();
      expect(mem.source_type).toBe('ambient');
      // and it stays in the entity tier (world → entity)
      expect(Object.keys(tm.storage.snap.persons ?? {})).toHaveLength(0);
    });
  });
  ```

- [ ] **6.2 Run — expect FAIL.** `addEpisodic` pushes without the three fields → `mem.subject` etc. are `undefined`.
  ```
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npx vitest run test/attributed.test.ts -t "ambient attribution"
  ```

- [ ] **6.3 Implement — `engine/src/engine.ts`, `addEpisodic`.** Replace:
  ```ts
      snap.episodic.push({
        id: uid('e'), content: e.content, embedding,
        importance: e.importance, strength: e.importance / 10, createdAt: now, lastRecalledAt: -1,
        tags: e.tags, imageUri: e.imageUri, crystallizeAt: this.d.random.int(3, 7), sourceMsgIds: [],
      });
  ```
  with:
  ```ts
      snap.episodic.push({
        id: uid('e'), content: e.content, embedding,
        importance: e.importance, strength: e.importance / 10, createdAt: now, lastRecalledAt: -1,
        tags: e.tags, imageUri: e.imageUri, crystallizeAt: this.d.random.int(3, 7), sourceMsgIds: [],
        source: null, source_type: 'ambient', subject: 'world',
      });
  ```

- [ ] **6.4 Run — expect PASS.**
  ```
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npx vitest run test/attributed.test.ts -t "ambient attribution"
  ```

- [ ] **6.5 Build + full suite — GREEN** (existing `seedEpisodic`-based behavior tests — which call `addEpisodic` — still pass; the stamped fields don't affect decay/merge/crystallize, and they all use `subject:'world'` ⇒ entity tier).
  ```
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npm run build
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npm test
  ```

- [ ] **6.6 Commit.**
  ```
  git -C /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat add engine/src/engine.ts engine/test/attributed.test.ts
  git -C /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat commit -m "$(cat <<'EOF'
feat(engine): ambient attribution — addEpisodic stamps subject=world/source=null/source_type=ambient

The observe() path bypasses extract/place; stamp inline at the push so ambient facts are attributed.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
  ```

---

## Task 7 — Consolidation symmetry (decay/reinforce/merge/prune over person tiers)

`tick()` must run the **same** `decay`/`reinforce`/`merge`/`prune` over each `snap.persons[id].episodic` it runs over `snap.episodic`. No new math — reuse `consolidation.ts` with the same `cfg`. `detectPatterns`/crystallize stay **entity-only**. Correctness note from the spec: because `retrieve()` (Task 8) stamps `lastRecalledAt` on person episodic, the reinforce/decay loop **must** iterate person tiers or person memories decay without ever reinforcing.

- [ ] **7.1 Write failing test** — append to `engine/test/attributed.test.ts`:
  ```ts
  describe('1A consolidation symmetry (person tiers decay/reinforce/prune like entity)', () => {
    function seedPerson(tm: TimeMachine, personId: string, content: string, importance: number, tags: string[]) {
      const now = tm.clock.now();
      tm.storage.snap.persons ??= {};
      (tm.storage.snap.persons[personId] ??= { episodic: [] }).episodic.push({
        id: `pe_${content}`, content, embedding: [1, 0, 0], importance, strength: importance / 10,
        createdAt: now, lastRecalledAt: -1, tags, crystallizeAt: 4, sourceMsgIds: [],
        source: personId, source_type: 'user', subject: personId,
      });
    }

    it('an unrecalled person memory decays below floor and is pruned (parity with entity DECAY)', async () => {
      const tm = new TimeMachine({ seed: 1 });
      seedPerson(tm, 'person_a', 'a low-importance person fact', 3, ['ptag']);
      await tm.advanceAndTick(60);
      expect(tm.storage.snap.persons!['person_a']!.episodic.find(m => m.content === 'a low-importance person fact')).toBeUndefined();
    });

    it('a recalled person memory survives where an unrecalled one dies (parity with entity REINFORCE)', async () => {
      const tm = new TimeMachine({ seed: 1 });
      // pre-register so retrieve's pool/embedding line up; seed two person memories with distinct embeddings
      tm.storage.snap.personRegistry = { person_a: { id: 'person_a', known_names: ['A'], createdAt: 0, lastSeenAt: 0, interactionCount: 1 } };
      const now = tm.clock.now();
      tm.storage.snap.persons = { person_a: { episodic: [
        { id: 'keep', content: 'person likes mds', embedding: await tm.embed.embed('person likes mds'), importance: 6, strength: 0.6, createdAt: now, lastRecalledAt: -1, tags: ['mds'], crystallizeAt: 4, sourceMsgIds: [], source: 'person_a', source_type: 'user', subject: 'person_a' },
        { id: 'die', content: 'random person trivia', embedding: await tm.embed.embed('random person trivia'), importance: 6, strength: 0.6, createdAt: now, lastRecalledAt: -1, tags: ['x'], crystallizeAt: 4, sourceMsgIds: [], source: 'person_a', source_type: 'user', subject: 'person_a' },
      ] } };
      for (let d = 0; d < 8; d++) { await tm.retrieve('person likes mds'); await tm.advanceAndTick(3); }
      const contents = tm.storage.snap.persons!['person_a']!.episodic.map(m => m.content);
      expect(contents).toContain('person likes mds');     // reinforced via retrieve stamping lastRecalledAt
      expect(contents).not.toContain('random person trivia');
    });

    it('detectPatterns/crystallize stay ENTITY-ONLY (a recurring person tag does not crystallize a selfFacet)', async () => {
      const tm = new TimeMachine({ seed: 2024, policy: 'fixed' });
      for (let i = 0; i < 8; i++) {
        seedPerson(tm, 'person_a', `person mds talk ${i}`, 9, ['pmds']);
        await tm.advanceAndTick(1);
      }
      expect(tm.selfTier()).toHaveLength(0);              // person tier excluded from crystallization in 1A
    });
  });
  ```

- [ ] **7.2 Run — expect FAIL.** `tick()` only consolidates `snap.episodic`; person tiers never decay/reinforce/prune → the DECAY test still finds the faded memory, the REINFORCE test keeps both (no reinforce on person tier).
  ```
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npx vitest run test/attributed.test.ts -t "consolidation symmetry"
  ```

- [ ] **7.3 Implement — `engine/src/engine.ts`, `tick()`.** Mirror the entity decay/reinforce onto person tiers, and the merge/prune. Place the person decay/reinforce right after the entity decay/reinforce/decayProspective block. Replace:
  ```ts
      decay(snap.episodic, { now, lastTick: snap.lastTick, tau: this.cfg.tau });
      reinforce(snap.episodic, { lastTick: snap.lastTick, boost: this.cfg.boost });
      decayProspective(snap.prospective, { now, lastTick: snap.lastTick, tau: this.cfg.tau });
  ```
  with:
  ```ts
      decay(snap.episodic, { now, lastTick: snap.lastTick, tau: this.cfg.tau });
      reinforce(snap.episodic, { lastTick: snap.lastTick, boost: this.cfg.boost });
      decayProspective(snap.prospective, { now, lastTick: snap.lastTick, tau: this.cfg.tau });

      // Person tiers decay/reinforce on the SAME curve. retrieve() stamps lastRecalledAt on person
      // episodic, so this reinforce MUST run here or person memories decay without ever reinforcing.
      for (const pm of Object.values(snap.persons)) {
        decay(pm.episodic, { now, lastTick: snap.lastTick, tau: this.cfg.tau });
        reinforce(pm.episodic, { lastTick: snap.lastTick, boost: this.cfg.boost });
      }
  ```
  > `snap.persons` is normalized to `{}` at the top of `tick()` (Task 3), so `Object.values` is safe.

- [ ] **7.4 Implement — merge/prune over person tiers in `tick()`.** Place right after the entity merge/prune. Replace:
  ```ts
      snap.episodic = merge(snap.episodic, this.cfg);
      snap.episodic = prune(snap.episodic, this.cfg.floor);
  ```
  with:
  ```ts
      snap.episodic = merge(snap.episodic, this.cfg);
      snap.episodic = prune(snap.episodic, this.cfg.floor);

      // Same merge/prune over each person tier (no new math; same cfg). Crystallize stays entity-only below.
      for (const pm of Object.values(snap.persons)) {
        pm.episodic = prune(merge(pm.episodic, this.cfg), this.cfg.floor);
      }
  ```

- [ ] **7.5 Run — expect PASS.**
  ```
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npx vitest run test/attributed.test.ts -t "consolidation symmetry"
  ```

- [ ] **7.6 Build + full suite — GREEN.**
  ```
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npm run build
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npm test
  ```

- [ ] **7.7 Commit.**
  ```
  git -C /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat add engine/src/engine.ts engine/test/attributed.test.ts
  git -C /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat commit -m "$(cat <<'EOF'
feat(engine): consolidation symmetry — decay/reinforce/merge/prune over person tiers

Reuses consolidation.ts with the same cfg; no new math. detectPatterns/crystallize stay
entity-only (no per-person selfFacets in 1A). Reinforce must iterate person tiers because
retrieve() stamps lastRecalledAt on person episodic.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
  ```

---

## Task 8 — Transitional retrieval (MMR pool = entity ∪ all persons; no privacy gate)

`retrieve()` widens the MMR pool to the union of entity + all person episodic, with **no** visibility filter (that is 1B). `InjectionContext` shape stays byte-identical; picked person memories get `lastRecalledAt` stamped and survive save/reload.

- [ ] **8.1 Write failing test** — append to `engine/test/attributed.test.ts`:
  ```ts
  describe('1A transitional retrieval (pool = entity ∪ persons, no privacy gate)', () => {
    it('a person memory can be retrieved, gets lastRecalledAt stamped, and survives save/reload', async () => {
      const tm = new TimeMachine({ seed: 1 });
      const now = tm.clock.now();
      // entity memory (unrelated) + person memory (the match)
      tm.storage.snap.episodic.push({
        id: 'ent', content: 'the shop opens at 8am', embedding: await tm.embed.embed('the shop opens at 8am'),
        importance: 6, strength: 0.6, createdAt: now, lastRecalledAt: -1, tags: ['shop'], crystallizeAt: 4,
        sourceMsgIds: [], source: null, source_type: 'ambient', subject: 'world',
      });
      tm.storage.snap.persons = { person_a: { episodic: [{
        id: 'per', content: 'วี กำลังหางานใหม่', embedding: await tm.embed.embed('วี กำลังหางานใหม่'),
        importance: 7, strength: 0.7, createdAt: now, lastRecalledAt: -1, tags: ['job'], crystallizeAt: 4,
        sourceMsgIds: [], source: 'person_a', source_type: 'user', subject: 'person_a',
      }] } };
      const ctx = await tm.retrieve('วี หางานใหม่ ยังไง');
      expect(ctx.episodic.map(m => m.id)).toContain('per');           // person memory is in the MMR pool
      // stamped on the LIVE person array (refs into snap ⇒ persists on save)
      expect(tm.storage.snap.persons!['person_a']!.episodic[0]!.lastRecalledAt).toBe(now);
      // survives reload (InMemoryStorage already round-trips the whole snapshot)
      const reloaded = await tm.storage.load();
      expect(reloaded.persons!['person_a']!.episodic[0]!.lastRecalledAt).toBe(now);
    });

    it('InjectionContext shape is byte-identical (selfTier/episodic/prospective/tail; episodic is EpisodicMemory[])', async () => {
      const tm = new TimeMachine({ seed: 1 });
      const ctx = await tm.retrieve('anything');
      expect(Object.keys(ctx).sort()).toEqual(['episodic', 'prospective', 'selfTier', 'tail']);
      expect(Array.isArray(ctx.episodic)).toBe(true);
    });
  });
  ```

- [ ] **8.2 Run — expect FAIL.** Today `retrieve()` searches only `snap.episodic`; the person memory `'per'` is never in the pool → first assertion fails.
  ```
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npx vitest run test/attributed.test.ts -t "transitional retrieval"
  ```

- [ ] **8.3 Implement — `engine/src/engine.ts`, `retrieve()`.** Replace:
  ```ts
      const qv = (await this.d.embed.embed(query)) ?? [];
      const picks = mmrSearch(qv, snap.episodic, {
        topK: this.cfg.retrieveTopK, lambda: this.cfg.mmrLambda, minSimilarity: this.cfg.retrieveMinSimilarity,
      });
      const picked = picks.map(p => snap.episodic.find(e => e.id === p.item.id)!);
      for (const m of picked) m.lastRecalledAt = now;
  ```
  with:
  ```ts
      const qv = (await this.d.embed.embed(query)) ?? [];
      // Transitional pool: entity ∪ all-person episodic, UNSCOPED (the privacy gate is 1B; this is its seam).
      const pool = [...snap.episodic, ...Object.values(snap.persons).flatMap(p => p.episodic)];
      const picks = mmrSearch(qv, pool, {
        topK: this.cfg.retrieveTopK, lambda: this.cfg.mmrLambda, minSimilarity: this.cfg.retrieveMinSimilarity,
      });
      const picked = picks.map(p => pool.find(e => e.id === p.item.id)!);
      for (const m of picked) m.lastRecalledAt = now;                 // refs into the live arrays ⇒ save persists
  ```
  > `pool` holds the **same object references** as `snap.episodic` and `snap.persons[*].episodic`, so stamping `m.lastRecalledAt` mutates the live arrays — the subsequent `await this.d.storage.save(snap)` persists them. `snap.persons` is normalized to `{}` by the Task-3 retrieve normalize, so `Object.values` is safe. `InjectionContext` is unchanged: `episodic: picked` is still `EpisodicMemory[]`.

- [ ] **8.4 Run — expect PASS.**
  ```
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npx vitest run test/attributed.test.ts -t "transitional retrieval"
  ```

- [ ] **8.5 Build + full suite — GREEN** (`behaviors.test.ts` RETRIEVE/REINFORCE tests still pass; with no person tiers the pool equals `snap.episodic` exactly, so entity-only behavior is unchanged).
  ```
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npm run build
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npm test
  ```

- [ ] **8.6 Commit.**
  ```
  git -C /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat add engine/src/engine.ts engine/test/attributed.test.ts
  git -C /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat commit -m "$(cat <<'EOF'
feat(engine): transitional retrieval — MMR pool = entity ∪ all-person episodic (no privacy gate)

The pool union is the single seam where 1B inserts the viewer/visibility filter. InjectionContext
shape byte-identical; picked person memories get lastRecalledAt stamped and survive save/reload.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
  ```

---

## Task 9 — Provider extract prompt+parse (real adapter widened, signature unchanged)

`adapters.ts` `extract()` widens its **prompt** to ask for `source_name` / `subject` / `said_by`, widens its **join** to include the speaker name when known, and passes the new fields straight through the parse with back-compat defaults. Signature unchanged (`extract(recent, pending?)`). This is exercised by build + typecheck (the engine tests drive `FakeChat`, not the real adapter; `provider.test.ts` covers `safeUrl`/`embedOnce` and must stay green).

- [ ] **9.1 Write failing test** — append a parse-shape test to `engine/test/provider.test.ts`. The real `extract` is hard to unit-test (it streams over `chatStream`), so test the **parse logic** by importing a small exported pure helper. First, the test:
  ```ts
  import { parseExtract } from '../provider/adapters.js';

  describe('parseExtract (back-compat defaults + passthrough of 1A fields)', () => {
    it('passes source_name/subject/said_by straight through', () => {
      const r = parseExtract(JSON.stringify({
        episodic: [{ content: 'วี ชอบตลาด', importance: 7, tags: ['m'], source_name: 'วี', subject: { person_name: 'วี' }, said_by: 'user' }],
        prospective: [], resolved: [],
      }));
      expect(r.episodic[0]!.source_name).toBe('วี');
      expect(r.episodic[0]!.subject).toEqual({ person_name: 'วี' });
      expect(r.episodic[0]!.said_by).toBe('user');
    });

    it('defaults a legacy response (no 1A fields) to empty arrays / undefined fields — back-compat', () => {
      const r = parseExtract(JSON.stringify({ episodic: [{ content: 'c', importance: 5, tags: [] }] }));
      expect(r.episodic[0]!.content).toBe('c');
      expect(r.episodic[0]!.source_name).toBeUndefined();
      expect(r.prospective).toEqual([]);
      expect(r.resolved).toEqual([]);
    });

    it('returns empty result on malformed JSON', () => {
      expect(parseExtract('not json')).toEqual({ episodic: [], prospective: [], resolved: [] });
    });
  });
  ```

- [ ] **9.2 Run — expect FAIL.** `parseExtract` is not exported from `adapters.ts`.
  ```
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npx vitest run test/provider.test.ts -t "parseExtract"
  ```

- [ ] **9.3 Implement — `engine/provider/adapters.ts`.** Add an exported pure `parseExtract`, widen the prompt, and add a `nameFor` join. Replace the whole `extract` method:
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
          '{"episodic":[{"content","importance"(1-10),"tags":[],"source_name","subject","said_by"}],' +
          '"prospective":[{"intent","priority"(1-5),"contextClue"}],"resolved":["id"]}. ' +
          'contextClue is a short phrase naming the topic/situation that should make this intent resurface later.\n' +
          'For every durable fact also return: ' +
          '"source_name" = who SAID or OBSERVED it (a person name, or null if the assistant/system itself); ' +
          '"said_by" = "user" if a human said it, "self" if the assistant said it; ' +
          '"subject" = who/what it is ABOUT: the string "world" for places/weather/the shop, ' +
          'the string "self" ONLY if the ASSISTANT is describing/asserting ITSELF (its own traits/opinions), ' +
          'or {"person_name":"..."} if about a specific person. ' +
          'A world OBSERVATION the assistant makes is still "world", not "self". ' +
          'Names are for readability; do not invent ids.\n\n' +
          recent.map(m => `${m.role}${m.speaker ? ' [speaker]' : ''}: ${m.text}`).join('\n') + pendingBlock;
        const out = await collect(chatStream(cfg, { messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' } }, fetchImpl));
        return parseExtract(out);
      },
  ```

  Then add the exported pure helper at module scope (place it directly after the `collect` helper, before `makeChatPort`):
  ```ts
  // Pure parse of the extract LLM response → ExtractResult. Exported for deterministic unit tests.
  // Back-compat: a legacy response (no 1A fields) yields undefined source_name/subject/said_by;
  // ?? guards every top-level array exactly as before.
  export function parseExtract(out: string): ExtractResult {
    try {
      const j = JSON.parse(out);
      return { episodic: j.episodic ?? [], prospective: j.prospective ?? [], resolved: j.resolved ?? [] };
    } catch {
      return { episodic: [], prospective: [], resolved: [] };
    }
  }
  ```
  > The speaker label is emitted as a literal `[speaker]` marker when `m.speaker` is set; resolving an id→display name (`nameFor`) is deferred to 1B (the adapter is stateless and has no registry — exactly as the spec notes resolution lives in the engine). In 1A the web leaves `speaker` null, so this branch is dormant; the marker only documents the intended 1B seam without coupling the adapter to the registry. The parsed `said_by`/`subject`/`source_name` pass straight through to `tick()`, which owns name→id resolution.

- [ ] **9.4 Run — expect PASS.**
  ```
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npx vitest run test/provider.test.ts -t "parseExtract"
  ```

- [ ] **9.5 Build + typecheck + full suite — GREEN** (the build gate proves the widened adapter compiles against `ExtractResult`; `provider.test.ts`'s existing `safeUrl`/`embedOnce` blocks stay green).
  ```
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npm run build
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npx tsc --noEmit
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npm test
  ```

- [ ] **9.6 Commit.**
  ```
  git -C /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat add engine/provider/adapters.ts engine/test/provider.test.ts
  git -C /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat commit -m "$(cat <<'EOF'
feat(engine): widen extract prompt+parse for source_name/subject/said_by (signature unchanged)

Prompt asks the LLM for provenance + subject + utterance role; parseExtract passes them through
with back-compat defaults (legacy responses yield undefined 1A fields). Name→id resolution stays
in the engine (adapter is stateless). Exposed parseExtract for deterministic unit tests.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
  ```

---

## Task 10 — Final gate: engine green, typecheck clean, NO web file changed (engine-only proof)

- [ ] **10.1 Build + full suite + typecheck — all GREEN.**
  ```
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npm run build
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npm test
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/engine && npx tsc --noEmit
  ```
  Confirm the regression files report passing: `respond.test.ts`, `behaviors.test.ts`, `prospective.test.ts`, `consolidation.test.ts`, `patterns.test.ts`, `provider.test.ts`, `rewind.test.ts`, `policy.test.ts`, `random.test.ts`, `vector.test.ts`.

- [ ] **10.2 Assert NO web file changed — the engine-only proof.** The diff across the whole feature must touch **only** `engine/`. Verify nothing under `web/` is modified (and `web/src/lib/labrespond.ts` / `assembleInject` / the `InjectionContext`-consuming code is untouched):
  ```
  git -C /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat diff --name-only main -- web/
  ```
  Expect **empty output**. (If non-empty, a web file was touched — 1A is violated; revert that change.)

- [ ] **10.3 Sanity-list the full feature diff is engine-scoped.**
  ```
  git -C /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat diff --name-only main
  ```
  Expect only paths under `engine/` (`engine/src/types.ts`, `engine/src/ports.ts`, `engine/src/attribution.ts`, `engine/src/index.ts`, `engine/src/engine.ts`, `engine/provider/adapters.ts`, and the three new `engine/test/*.ts` files).

- [ ] **10.4 (Optional) Confirm the web app still builds against the rebuilt engine dist** — only if a web smoke is desired; this changes no files. The engine's `dist/` was rebuilt in 10.1; `web/` links `file:../engine`, so:
  ```
  cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/web && npx tsc --noEmit
  ```
  Expect 0 errors — the widened (optional-only) engine types are transparent to web. (No web file edited; this is read-only verification.)

- [ ] **10.5 Final commit (if any uncommitted gate artifacts remain) — otherwise the feature is already a clean series of per-task commits.** No code change here; this step is the verification checkpoint, not a new commit unless 10.1–10.4 produced edits.

---

## Success-criteria checklist (maps to the spec's §"Success criteria")

- [ ] 1. `attribution.test.ts` green — placement + resolvePerson mint/no-split/variant-merge + deriveVisibility. *(Task 2)*
- [ ] 2. `attributed.test.ts` green — subject=person→person tier only; subject=world→entity; subject=self→no episodic + one Interaction. *(Tasks 4–5)*
- [ ] 3. Echo-chamber regression — no selfFacet from subject=self; world positive control crystallizes. *(Task 5)*
- [ ] 4. `source_type` is user/self/ambient per origin; `source` null only when speaker unknown. *(Tasks 4–6)*
- [ ] 5. Transitional retrieval — pool = entity ∪ all-person; picked person memory survives save/reload; `InjectionContext` byte-identical. *(Task 8)*
- [ ] 6. Consolidation symmetry across advanced days. *(Task 7)*
- [ ] 7. Backward-compat — v0 snapshot loads + ticks clean; existing episodic stays entity-tier, no data loss. *(Tasks 1, 3)*
- [ ] 8. Regression suite GREEN unchanged (prospective + self-state + crystallize). *(every task's full-suite gate)*
- [ ] 9. `npm run build` + `npm test` green, `tsc --noEmit` clean, NO web file edited. *(Task 10)*
