# Spec 1A — Attributed Multi-Person Memory (design)

> **Status:** approved (founder + CTO, 2026-06-05) — ready for `writing-plans`.
> **Scope:** engine-only. ~1–2 day TDD plan. Web untouched.
> **Part of:** the *Social Reality Model* — one entity that talks to many people, remembers each, and attributes provenance. This is the **foundation slice (1A)**; 1B and Spec 2 build on it.

## Why this exists

Today the memory is **flat and source-less**. `extract()` runs over *both* the user's and the entity's own messages and stores undifferentiated "durable facts" with `sourceMsgIds: []`. The consequence (observed live on เชียงใหม่): ~60% of the 61 episodic memories are **the entity's own replies** played back to itself (history monologues, comfort platitudes), often at importance 8–10, and the self-tier (`[Who you are]`) crystallized into **4 near-duplicate weather-platitudes**. The entity remembers its own voice more than it remembers the person it's talking to — an echo chamber.

The fix is not "filter junk." It is **provenance**: a human remembering someone's story first reverse-parses *who said it*, then indexes the fact under its source. `1A lays the bone of attribution` so that every memory carries where it came from and who it is about.

### What 1A is — and is not

**1A success = "there is no longer any memory without a source."** It is **attributed placement, not smart recall.**

- 1A only **places labels** (source / source_type / subject). **1B respects labels** (privacy-scoped retrieval).
- `source: null` means **"unknown speaker," never "no provenance"** — `source_type` is always present.

**Scope lock (explicit non-goals for 1A):**

- ❌ no semantic **clustering** / dedup (Spec 2 — it is an optimization layer, not foundational)
- ❌ no **corroboration** counting, no **confidence** computation, no confidence→phrasing (Spec 2)
- ❌ no **privacy-scoped retrieval** (1B) — 1A retrieval is an *unscoped* union across tiers
- ❌ no **alias merge** of split person ids (1B) — split-before-merge is accepted
- ❌ no **relationship-display** / **emergent naming** flows (1B)
- ❌ no **web UI**, no **speaker picker**, no per-person selfFacets/prospective (1B)
- ❌ no auth / accounts / CRM (future infra)

## The provenance model

Four orthogonal facets, three stored, one derived:

| facet | stored? | values | meaning |
|---|---|---|---|
| `source` | yes | `person-id \| null` | **who** said/observed it; `null` = unknown speaker (NOT no-provenance) |
| `source_type` | yes | `'user' \| 'ambient' \| 'self' \| 'system'` | **kind** of source — always present |
| `subject` | yes | `'world' \| 'self' \| person-id` | **who/what it is about**; absent ⇒ `'world'` (back-compat) |
| `visibility` | **derived** | `'public' \| 'private' \| 'internal'` | computed from `subject` by `deriveVisibility()`; 1A never stores or gates on it |

`source` × `source_type` disambiguates the four real situations:

| `source` | `source_type` | situation |
|---|---|---|
| `null` | `user` | a human said it, we don't yet know who (anonymous speaker) |
| `person-42` | `user` | a known person said it |
| `null` | `ambient` | the world feed observed it |
| `null` | `self` | the entity asserted it itself (its own talk) |
| `null` | `system` | system-generated (greeting/system event) |

**Two orthogonal axes** (do not conflate):
- **`subject` → tier + visibility** (where it lands, who may see it)
- **`source` + `source_type` → provenance** (where it came from; feeds Spec 2 confidence)

`confidence` is **not stored in 1A**. `source_type` is the raw provenance signal; the *derived* confidence value (from `source_type` + corroboration) is Spec 2. Storing a stub now is dead data, mirroring the `visibility`-derive discipline.

## Data shapes

The `Snapshot` stays a **superset** of today — the five existing fields keep their exact current meaning (they *are* the **entity tier**, fed forever by ambient `addEpisodic`). Three new fields are **optional**, so v0 snapshots deserialize untouched and the web layer (which reads `snap.episodic/selfFacets/prospective/messages/lastTick` at root) needs **zero changes**.

```ts
// engine/src/ports.ts
export interface Snapshot {
  messages: Message[];
  episodic: EpisodicMemory[];        // ENTITY tier (world/place) — UNCHANGED path
  selfFacets: SelfFacet[];           // ENTITY identity — crystallized from entity episodic ONLY
  prospective: ProspectiveMemory[];  // ENTITY intents — UNCHANGED (per-person is 1B)
  lastTick: number;
  // --- 1A additions (all optional ⇒ v0 snapshots load untouched) ---
  persons?: Record<string, PersonMemory>;   // PERSON tier, keyed by OPAQUE person.id
  personRegistry?: Record<string, Person>;  // person.id → identity (names are attributes)
  interactions?: Interaction[];             // who-said-what-when ledger (beside messages[])
}
```

```ts
// engine/src/types.ts — EpisodicMemory gains 3 optional fields (existing rows & ambient deserialize unchanged)
export interface EpisodicMemory {
  /* ...all existing fields unchanged... */
  sourceMsgIds: string[];
  source?: string | null;        // person.id who said/observed it; null = unknown speaker
  source_type?: 'user' | 'ambient' | 'self' | 'system';
  subject?: string | null;       // 'world' | 'self' | a person.id ; absent ⇒ 'world'
}

// Message gains the speaker (a person.id); null in 1A until the 1B speaker-picker exists
export interface Message { /* ...existing... */ ts: number; speaker?: string | null; }

// New shapes
export interface Person {
  id: string;            // STABLE synthetic opaque id (uid('person')); NEVER derived from a name
  known_names: string[]; // appended on each sighting; an attribute, never a key
  createdAt: number;
  lastSeenAt: number;
  interactionCount: number;
}
export interface PersonMemory { episodic: EpisodicMemory[]; } // pure episodic; NO per-person selfFacets/prospective in 1A
export interface Interaction { id: string; msgId: string; source: string | null; source_type: 'user' | 'self' | 'system'; role: 'user' | 'model'; ts: number; }
```

```ts
// engine/src/ports.ts — ExtractResult per-item attribution (LLM emits NAMES, never ids); all optional
export interface ExtractResult {
  episodic: {
    content: string; importance: number; tags: string[];
    source_name?: string | null;                                // who SAID/OBSERVED it (a name, or null = assistant/system)
    subject?: 'world' | 'self' | { person_name: string } | null; // who/what it is ABOUT
  }[];
  prospective: { intent: string; priority: number; contextClue: string }[]; // UNCHANGED in 1A
  resolved?: string[];                                                       // UNCHANGED (prospective lifecycle)
}
```

`ChatPort.extract`'s **signature is unchanged** — only the prompt string and the parsed shape widen, both back-compat-defaulted (`j.episodic ?? []` already guards old responses).

## Attribution module (pure, new)

A new **pure** module `engine/src/attribution.ts` holds the three load-bearing functions, all unit-testable with no engine/IO (the `uid` minter is injected for determinism):

```ts
export type Placement = { tier: 'entity' } | { tier: 'person'; personId: string } | { tier: 'interaction' };

// Subject decides the tier. The ONLY router; tick() never pushes an episodic any other way.
export function placeMemory(subject: string | null | undefined): Placement {
  if (!subject || subject === 'world') return { tier: 'entity' };      // legacy/world ⇒ entity (today's path)
  if (subject === 'self')              return { tier: 'interaction' };  // echo-chamber kill: NO episodic push
  return { tier: 'person', personId: subject };
}

// Name → stable opaque id. The engine owns id minting; the LLM never sees an id.
export function resolvePerson(
  name: string | null | undefined,
  registry: Record<string, Person>,
  now: number,
  mintId: () => string,                  // === uid('person')
): { personId: string | null; registry: Record<string, Person> } {
  if (!name) return { personId: null, registry };
  const norm = name.trim().toLowerCase();
  const hit = Object.values(registry).find(p => p.known_names.some(n => n.toLowerCase() === norm));
  if (hit) { /* bump lastSeenAt/interactionCount; append surface form if new */ return { personId: hit.id, registry }; }
  const id = mintId();                    // id is NEVER derived from the name
  return { personId: id, registry: { ...registry, [id]: { id, known_names: [name.trim()], createdAt: now, lastSeenAt: now, interactionCount: 1 } } };
}

// Derived, never stored. Defined HERE so 1B has one place to plug the privacy filter.
export function deriveVisibility(m: { subject?: string | null }): 'public' | 'private' | 'internal' {
  const s = m.subject;
  if (!s || s === 'world') return 'public';   // shared entity knowledge — any speaker may recall (1B attributes it)
  if (s === 'self')        return 'internal'; // entity self-talk — interaction-only, not a recallable fact
  return 'private';                            // tied to a specific person — 1B decides cross-person sharing
}
```

1A **matching is exact** (case/whitespace-insensitive against `known_names`); fuzzy/alias-merge is 1B. A miss **mints a stub id** and creates the empty `snap.persons[id]` tier in the same step, so `place()` can never orphan a person memory.

## Placement & the echo-chamber kill

All placement flows through **one** call to `placeMemory(subject)` in `tick()`, exactly where `snap.episodic.push` lives today. Per extracted item:

1. `resolvePerson(source_name)` → source id (or null) + updated registry → set `source`, `source_type`.
2. Resolve `subject` (`{person_name}` → person.id via the **same** resolver; keep `'world'`/`'self'` sentinels).
3. Build the `EpisodicMemory` with `source` / `source_type` / `subject`.
4. Switch on `placeMemory(subject)`:
   - `entity` → `snap.episodic.push(...)` — **today's exact behavior**
   - `person` → `(snap.persons[id] ??= { episodic: [] }).episodic.push(...)`
   - `interaction` → push **nothing** to any episodic (already captured in `interactions[]`)

**The echo-chamber kill is structural, not heuristic.** `subject === 'self'` returns `{ tier: 'interaction' }`, so a self-utterance is **never pushed to any episodic array**. Crystallize (`detectPatterns` → `selfFacets`) reads **only** `snap.episodic` (entity), and `snap.persons` is excluded from crystallization in 1A — so a self-subject memory has **no path** to become a `SelfFacet`. Identity can crystallize only from world facts (ambient) and facts people told the entity. The self-utterance is preserved verbatim as an `Interaction` (audit + future 1B grounding) — *quarantined from the identity path, not lost*. No toggle or future retrieval change can bypass this.

## Attributing extraction

`extract()` reverse-parses each utterance into source + subject. Signature unchanged; only the prompt (`adapters.ts`) and the JSON parse change.

- **Prompt (additive, strict).** After the existing `{episodic, prospective, resolved}` schema, instruct: *"Each line is prefixed with who said it. For every durable fact also return `source_name` = who SAID or OBSERVED it (a person name, or null if the assistant/system itself), and `subject` = who/what it is ABOUT: the string `"world"` for places/weather/the shop, the string `"self"` only if the ASSISTANT is describing/asserting ITSELF (its own traits/opinions), or `{"person_name":"..."}` if about a specific person. A world OBSERVATION the assistant makes is still `"world"`, not `"self"`. Names are for readability; do not invent ids."*
- **Speaker context.** The message join gains the speaker name when known: `${m.role}${m.speaker ? ' [' + nameFor(m.speaker) + ']' : ''}: ${m.text}` (`nameFor` resolves id→display via a small lookup; omitted if absent).
- **Parse.** Pass `source_name`/`subject` straight through; missing ⇒ `undefined`.
- **Resolution happens in the engine (`tick`), not the adapter** — the adapter is stateless and has no registry. Names → ids via the pure `resolvePerson` against `snap.personRegistry`.
- **`source_type`** is set from the attributed message's role: `user` message ⇒ `'user'`, model message ⇒ `'self'`. Ambient memories set `'ambient'` at `addEpisodic` (see below).

> **self-vs-world is the LLM's call** — the one real correctness soft-spot. A world observation mis-labeled `'self'` would be dropped (no episodic). Accepted for 1A as a *prompt-quality* issue: the **mechanism** is correct given the label; label quality is iterative tuning, guarded by an explicit test that entity world-observations still land in the entity tier.

## Person registry & resolution

`snap.personRegistry: Record<personId, Person>` lives **inside** the `Snapshot` (travels atomically with the `persons` tier it indexes; one IndexedDB key per *entity/persona*; `web/storage.ts` untouched). It is **not** `web/personas.ts` — a *Persona* is a whole **entity/namespace** (เชียงใหม่ / Hackerman); the person registry is an **orthogonal** axis (many speakers *within* one entity). It is owned by the engine so the stable-id invariant is enforced at the single mint point.

`extract()` **is allowed to propose a new person** — an unseen `subject.person_name` mints a stub id (chosen over silently dropping person-facts into the entity/shared tier, which would pollute shared knowledge). Registry noise from misspelled/hallucinated names is reconciled by 1B's merge flow.

**Speaker entry point.** `ingestUser(text, image?, speaker?)` gains an optional `speaker` (a person.id); the engine stamps `msg.speaker` and appends an `Interaction`. **In 1A the web leaves `speaker` null** (no speaker-picker yet) — `subject` attribution still delivers per-person memory and the echo-chamber kill; user-side `source` provenance arrives with the 1B picker. `source: null` here means *unknown speaker*, not *no provenance* (`source_type: 'user'` is still set).

## Transitional retrieval (no privacy gate)

`retrieve()` widens the MMR pool to the union of entity + all person episodic, with **no** visibility filter (that is 1B):

```ts
const pool = [...snap.episodic, ...Object.values(snap.persons ?? {}).flatMap(p => p.episodic)];
const picks = mmrSearch(qv, pool, { topK, lambda, minSimilarity });   // same params
const picked = picks.map(p => pool.find(e => e.id === p.item.id)!);
for (const m of picked) m.lastRecalledAt = now;                        // refs into live arrays ⇒ save persists
```

Everything else is unchanged: the prospective trigger/cooldown loop, `selfTier = snap.selfFacets` (entity-only), `tail = messages.slice(-tailN)`. **`InjectionContext` shape is byte-identical** — `episodic` is still `EpisodicMemory[]` (now possibly person-tier, carrying the new fields), `formatInjection` renders `- ${m.content}` identically, so web's `labRespond`/`assembleInject` see richer episodic and **ignore the new fields ⇒ zero web change**. The `pool` union is the single seam where 1B inserts the viewer/visibility filter.

## Consolidation symmetry

After placement, `tick()` runs the **same** `decay`/`reinforce`/`merge`/`prune` over each `snap.persons[id].episodic` that it runs over `snap.episodic` — a small loop reusing the existing `consolidation.ts` functions with the same `cfg`. **No new math.** `detectPatterns`/`crystallize` continues to read **only** `snap.episodic` (entity); per-person crystallization is explicitly 1B.

> **Correctness note:** because `retrieve()` now stamps `lastRecalledAt` on person episodic, the `tick()` reinforce/decay loop **must** iterate person tiers too — otherwise person memories decay without ever reinforcing. Covered by the symmetric loop.

## Ambient attribution (gotcha)

`addEpisodic` (the ambient `observe()` path) does **not** pass through `extract`/`place`. It must set `subject: 'world'`, `source: null`, `source_type: 'ambient'` **inline at the push**, or ambient facts arrive unattributed. One-line addition.

## Migration / back-compat

A v0 snapshot (no `persons`/`personRegistry`/`interactions`) loads clean: `tick()` (and defensively `retrieve()`) normalize at the top via `snap.persons ??= {}; snap.personRegistry ??= {}; snap.interactions ??= [];` — mirroring the existing prospective back-fill. Existing `episodic` rows stay in the entity tier (absent `subject` ⇒ `'world'`); **no data loss**.

## Test strategy

Engine-only, fully deterministic via the existing `FakeChat.extractQueue` + `InMemoryStorage` + `FakeEmbed` + `TimeMachine`. **No web tests needed** — that the `InjectionContext` shape is unchanged is exactly what proves 1A is independently specifiable.

**`engine/test/attribution.test.ts` (pure):**
- `placeMemory`: `'world'`/`null`/`undefined`→entity, `{person id}`→person, `'self'`→interaction.
- `resolvePerson`: unseen name **mints** a synthetic id (assert `id !== name`, matches `/^person_/`); same name again → **same** id (no split, `interactionCount` bumps); case/space variants (`'Wutty'` / `' wutty '`) → one id; null name → `{ personId: null }`. *Pins the load-bearing invariant.*
- `deriveVisibility`: world→public, person→private, self→internal.

**`engine/test/attributed.test.ts` (integration, FakeChat):**
- `subject={person_name:'วี'}` → lands **only** in `snap.persons[id].episodic`, **not** `snap.episodic`; `personRegistry[id].known_names` contains `'วี'`.
- `subject='world'` (or omitted) → `snap.episodic` (parity with today). The existing `respond.test.ts` bare-extract path still routes to entity episodic (back-compat).
- `subject='self'` → **nothing** in any episodic; one `Interaction(role='model')`; advance/tick enough to crystallize and assert **no** selfFacet derives from it (echo-chamber regression), paired with a positive control (a world memory **does** crystallize).
- `source_type`: `'user'` for user-attributed, `'self'` for model-attributed, `'ambient'` via `addEpisodic`; `source` null when speaker unknown.
- transitional retrieval: seed entity + person episodic; query → MMR pool includes both; a picked person memory gets `lastRecalledAt` stamped and survives save/reload.
- consolidation symmetry: advance days; person episodic decays/prunes on the same curve as entity; reinforce fires on recalled person memories.
- migration: a v0 snapshot loads and ticks clean.

**Regression (must stay GREEN unchanged):** `respond.test.ts`, `prospective.test.ts`, `behaviors.test.ts`, `consolidation.test.ts`, `patterns.test.ts` — proves the prospective lifecycle, self-state path, and crystallize are untouched. Then `cd engine && npm run build` and confirm the engine suite is green **before** any web check (CLAUDE.md hard rule).

## Success criteria

1. `attribution.test.ts` (pure) green — placement + `resolvePerson` mint/no-split/variant-merge + `deriveVisibility`.
2. `attributed.test.ts` green — subject=person → person tier only; subject=world → entity; subject=self → no episodic + one Interaction.
3. **Echo-chamber regression:** after enough ticks, **no** selfFacet derives from a subject=self utterance; a subject=world utterance **does** crystallize (positive control passes).
4. `source_type` is `'user'`/`'self'`/`'ambient'` per origin; `source` is null only when the speaker is unknown.
5. Transitional retrieval: MMR pool = entity + all person episodic; picked person memory survives save/reload; `InjectionContext` shape byte-identical to today.
6. Consolidation symmetry holds across advanced days.
7. Backward-compat: a v0 snapshot loads and ticks clean; existing episodic stays in the entity tier with no data loss.
8. **Regression suite stays GREEN unchanged** (prospective + self-state + crystallize).
9. `cd engine && npm run build` succeeds, `cd engine && npm test` green, `npx tsc --noEmit` clean; **the web app runs unchanged (no web file edited)** — proving 1A is engine-only and the web layer is transparent.

## Decisions recorded (founder + CTO, 2026-06-05)

1. **User-side `source` = `null` in 1A.** No fake "primary visitor" (that becomes an implicit user-model to migrate). `subject` attribution still delivers multi-person memory.
2. **Split-before-merge accepted.** วี / Wutty / Natthawut become separate ids until a `known_names` match links them; alias-merge is 1B. The invariant (id opaque, never a name) holds.
3. **`visibility` derived, not stored** — but `deriveVisibility(memory)` is defined explicitly so 1B has one seam to plug the privacy filter.
4. **`extract()` auto-mints a new person** on an unseen `subject.person_name` — avoids orphaning person-facts into the entity/shared tier; name noise reconciled by 1B merge.
5. **self-vs-world via LLM label, accepted for 1A** with a strict prompt + a test guard. Mechanism must be correct: world→entity, person→person tier, self-talk→interaction only.

**CTO steering (binding):**
- 1A success = **attributed placement, not smart recall**. 1A only places labels; 1B respects labels.
- `source: null` must mean **unknown speaker, not no provenance** — `source_type` is always set (user/ambient/self/system).
- Scope lock: **no clustering, no alias merge, no privacy retrieval, no web UI, no speaker picker, no CRM.**

## Scope boundary

- **Spec 1B (deferred):** privacy-scoped retrieval (the viewer/visibility filter at the `pool` union seam), relationship-derived display ("คนที่ชอบเดินตลาด"), emergent naming (infer+confirm / ask-after-relationship / alias-merge of split ids), per-person selfFacets and per-person prospective, the who-is-typing speaker-selector UI.
- **Spec 2 (deferred):** semantic clustering, corroboration counting, confidence→phrasing, self-facet dedup. `detectPersonPatterns` is **not** built; `detectPatterns` stays entity-episodic-only.
- **Future infra:** real auth / accounts / multi-tenant identity. 1A's person identity is a per-entity in-snapshot registry, not an account system.
