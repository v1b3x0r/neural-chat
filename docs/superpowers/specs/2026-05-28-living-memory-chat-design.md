# neural-chat v2 — Living-Memory Chat (Expo)

> Design spec · 2026-05-28 · side project (personal, single-user, not for distribution)
> Status: design locked, pending implementation plan

## 1. Purpose

A personal mobile chat app where you talk to an AI in **one thread forever** — no "new chat" ritual, no manually asking the LLM to summarize context into a "warp point" to paste into the system prompt. Long-running continuity comes from a **living memory engine** that decays, consolidates, and crystallizes memory over time, instead of stuffing the whole context window every turn.

The prototype at the repo root (`App.tsx`, `services/geminiService.ts`, `components/`) already proved the hard half — MMR retrieval, embeddings, time-decay scoring, episodic + prospective memory, and "send retrieved context, not the full window." It is kept as a **reference implementation** (read for algorithms; do not extend in place). This spec defines the v2 rebuild on Expo with two new pillars the prototype lacks: **emergent identity from an empty system prompt**, and **real storage-level consolidation** (memories actually fade and merge, not just rank lower).

### Non-goals (YAGNI)
- No multi-thread per persona (one living thread per persona).
- No account, no cloud sync, no UICP/protocol layer.
- No background daemon — ticks run on app foreground + after each exchange.
- No on-device LLM (quality insufficient for long conversation). On-device embeddings are optional via LM Studio, not required.

## 2. Core concept

- **Empty system prompt by default.** The `default` friend ships with no persona declaration. Identity is *not* hardcoded — it emerges from accumulated, crystallized memory.
- **Identity = a Tier-0 self-model** that slowly crystallizes from conversation (always injected, bounded, can also fade). This keeps identity stable instead of flickering with each query's retrieval.
- **Decay is real.** Memory in storage actually weakens, merges, and is pruned over simulated/real time — modeled on Ebbinghaus decay (consistent with the MDS ecosystem) and the `.remember` topology (now → today → recent → archive → core).
- **system prompt = cheat code / warp-to-checkpoint.** A persona's system prompt is not a cage and not a contradiction of "empty prompt." Normally identity must be *played through* many conversations before the self-tier crystallizes. A system prompt lets you **warp straight to a checkpoint** — skipping the journey. Two modes (see §7): `constitution` (warp stays fixed) and `seed` (warp, then drift — experimental).

## 3. Architecture (module boundaries)

The engine knows nothing about Expo, OpenRouter/LM Studio, or SQLite. It talks to **ports** (interfaces). This makes it testable headless with a fast-forwardable clock, and reusable (e.g. could later move into the `chronos/` Expo app).

```
EXPO UI (thin)  ── single-thread messenger · Gemini-clean · image upload
      │ calls
MEMORY ENGINE (pure TS)  ── ingest() · retrieve() · tick()
      │ depends on 4 ports only:
      ├─ StoragePort   load/save memories            → SQLite (expo-sqlite) + FileSystem
      ├─ EmbedPort     text → number[]               → OpenAI-compat /v1/embeddings (LM Studio)
      ├─ ChatPort      messages → stream (multimodal) → OpenAI-compat /v1/chat (OpenRouter)
      └─ Clock + Random  now() / seeded rng          → real (prod) | fake+seeded (test & in-app time-travel)
```

Each unit answers: what it does, how you use it, what it depends on. The engine is the only place with interesting logic; everything else is a thin adapter behind a well-defined interface.

## 4. Memory engine

### 4.1 Data model — 3 tiers

```ts
// TIER 0 — self-model: identity, always injected, bounded (cap ~12 facets)
interface SelfFacet {
  id: string;
  statement: string;                      // "user เรียกตัวเองว่าพี่ · ชอบให้ดันกลับเมื่อคิดต่าง"
  kind: 'voice' | 'value' | 'relationship';
  strength: number;                       // decays slowly; reinforced when pattern recurs; < floor → drop
  updatedAt: number;
}

// TIER 1 — episodic: events/facts, retrieved by MMR, decays + consolidates
interface EpisodicMemory {
  id: string;
  content: string;                        // for an image: the vision description (this is what is embedded/retrieved)
  embedding: number[] | null;             // null = pending embed (backfilled on a later tick)
  importance: number;                     // 1–10 base salience at extraction
  strength: number;                       // f(importance, decay, recall); updated each tick
  createdAt: number;
  lastRecalledAt: number;
  tags: string[];
  image?: { uri: string; mimeType: string };  // ref to file on device (NOT base64 in DB)
  crystallizeAt: number;                  // per-memory threshold (used by the per-memory random policy variant)
  sourceMsgIds: string[];
}

// TIER 2 — prospective: anticipatory intents (carried from prototype)
interface ProspectiveMemory {
  id: string; intent: string;
  status: 'pending' | 'resolved' | 'abandoned';
  priority: number; contextClue: string; createdAt: number;
}
```

Images need no separate logic: vision converts the image to `content`, the file uri is stored alongside, and the memory then decays / merges / is retrieved exactly like a text memory. On recall, the uri re-renders the image or re-attaches it to the multimodal model.

### 4.2 Lifecycle

```
ingest(message)   store raw message; if image → ChatPort vision-describe → attach description
retrieve(query)   assemble the injection context (NOT the whole window):
                    inject = [ all self-tier facets ]                 // identity, never flickers
                           + [ episodic top-K via MMR, strength-weighted ]
                           + [ prospective where status = pending ]
                           + messages.slice(-N)                       // short conversation tail
tick(now)         consolidation pass (the heart):
                    1. DECAY       every episodic + self-facet: strength *= exp(-Δt / tau)
                    2. REINFORCE   anything recalled this session: strength += boost, lastRecalledAt = now
                    3. EXTRACT     from new messages (LLM): → new episodic + new prospective
                    4. MERGE       near-duplicate weak episodic (cosine > threshold): consolidate into one
                    5. PRUNE       strength < floor: delete (or archive cold)
                    6. CRYSTALLIZE recurring pattern across episodic → upsert SelfFacet (+strength);
                                   unreinforced self-facets fade and drop; cap top-12
```

Flow of identity (bottom-up): `message → episodic (can fade) → [repeated] → crystallize → self-facet (identity, more stable) → [unreinforced] → fade → drop`.

### 4.3 Crystallize policy (pluggable port + seeded randomness)

Crystallization threshold is **not a fixed constant**. It is decided by a swappable policy, so behavior can be experimented with live without touching the engine. This is the DreamFlow `gamble` idea applied to identity formation.

```ts
interface PatternEvidence { recurrence: number; avgImportance: number; spanDays: number; }
interface CrystallizePolicy { shouldCrystallize(e: PatternEvidence, rng: Random): boolean; }

// shipped policies (swap live from Settings → Developer):
fixedK(k)         → e.recurrence >= k
randomK(min,max)  → e.recurrence >= rng.int(min, max)     // DEFAULT: randomK(3,7)
gamble(p)         → rng.float() < p   // scalable by importance: p = base_p * (avgImportance/10)
```

- **Default policy: `randomK(3,7)`.** Still requires repetition before crystallizing, but how many times is non-constant.
- **`Random` is a seeded port** (like `Clock`). Production seeds from time (wild); tests seed with a fixed value (stochastic but reproducible). This is what keeps simulated-time tests deterministic.
- A `crystallizeAt` field exists on each episodic to also support a per-memory variant ("stubbornness": each memory is born with its own threshold) if explored later.

### 4.4 Open risks (call out in implementation)
- EXTRACT/CRYSTALLIZE use an LLM → can crystallize from coincidence. Mitigation: require pattern `recurrence ≥ threshold` **and** sufficient `avgImportance` **and** `spanDays > 0` (not all within one burst) before promotion to self-tier.

## 5. Provider adapter (OpenAI-compatible)

One adapter speaks the OpenAI-compatible REST API; both OpenRouter and LM Studio use it.

```
config (chat and embed are SEPARATELY configurable endpoints):
  chat  = { baseURL: <openrouter>, apiKey, model }   // cloud brain
  embed = { baseURL: <lmstudio>,   apiKey: '', model: 'nomic-embed-text' }  // local, offline-capable
```

- **Chat** streams via SSE; **multimodal** image input via `image_url` (data URL) for vision-describe on ingest and image re-attach on recall.
- **Embed and chat can target different endpoints** — smart cloud chat + free/offline local embeddings simultaneously — or both can point at one provider. Switching is a config change; the engine is untouched.

### 5.1 Security (addresses background-review findings on the prototype)
1. **API key must NOT be hardcoded or bundled** (prototype's `vite.config.ts` injected `GEMINI_API_KEY` into the client bundle — flagged HIGH). v2: the user enters the key at runtime; it is stored in `expo-secure-store` (OS keychain). Acceptable for personal use; if ever distributed, restrict at the provider console.
2. **Validate grounding/link URLs before render** (prototype's `App.tsx` rendered AI-supplied `href` directly — flagged MEDIUM). v2: only render links whose scheme matches `^https?://`, and add `rel="noopener noreferrer"`.

### 5.2 Resilience
- If the embed endpoint is down (e.g. LM Studio closed), store the memory with `embedding: null`, retrieve temporarily by keyword/recency, and **backfill the embedding on the next tick** when the endpoint returns. No new mechanism — reuses the existing tick.

## 6. UI (Gemini app as the visual reference)

Mainstream-clean, like the Gemini mobile app. Not a wrapper with many exposed knobs — configuration lives in the backend / Settings.

```
☰   [ model ▼ ]   ✎          header: model selector (Fast / Balanced / Smart);
                              "ระดับการคิด" (reasoning effort) tucked under the dropdown
        ✦  greeting           empty state: logo + personalized greeting
   [＋] type...      🎤        composer: ＋ = attach image (P0), mic, text

☰ drawer = friends (personas) list + ⚙ Settings
Settings → Developer = debug/playground (policy switch, seed, force tick, time-travel) — NOT on the chat screen
```

- **Single thread, no "new chat" button.** Continuity is the engine's job. Inverted FlatList, paged message loading.
- **Image upload is P0** (`expo-image-picker`) — higher priority than retrieval quality. ＋ → pick image → `ingest` → vision-describe → episodic memory.
- Knobs (max tokens, temperature, etc.) default in the backend and are not surfaced on the main UI.

### 6.1 In-app time travel (debug)
Because `Clock` is a port, the debug screen can inject a fake `now` and run a deep tick — `[+1d] [+7d] [+30d] [▶ deep tick]` — to watch memory fade / merge / crystallize **without waiting real days**. This is the same mechanism as the simulated-time test harness (§10).

## 7. Persona / multi-instance (P1 — seams built in P0, implementation deferred)

A persona ("spawn a friend") is just **another engine instance pointed at a separate DB namespace**. Memory is fully separated per instance — no cross-persona bleed, which is simpler than shared memory with scoping.

```
friends/
  default   → engine(db: default, seed: "")                  // empty prompt — pure emergence
  "หมอ"     → engine(db: doctor,  seed: <systemPrompt>)
  "เพื่อนซี้" → engine(db: buddy,   seed: <systemPrompt>)
```

- Create-persona form is minimal: **name + system prompt (the cheat code) + avatar**. Everything else defaults in the backend.
- The drawer lists friends (the "Messenger circa 200x, full of friends" feel).
- **system prompt = warp-to-checkpoint** (see §2). Two modes:
  - `constitution` — the prompt is injected every turn; the persona stays in-character (warp stays fixed). Safer.
  - `seed` — the prompt only bootstraps the first self-facets, then fades; the persona drifts away from its origin over time (warp, then drift). Experimental.
- **Staging:** P0 ships a single `default` friend (empty seed) to prove the core loop. The engine and storage are designed so adding multi-persona in P1 is additive (namespace per persona) — no rewrite.

## 8. Storage

```
SQLite (expo-sqlite), one namespace per persona:
  messages(id, role, text, image_uri, ts)
  episodic(id, content, embedding, importance, strength, image_uri, tags, crystallize_at, last_recalled_at, created_at, source_msg_ids)
  self_facets(id, statement, kind, strength, updated_at)
  prospective(id, intent, status, priority, context_clue, created_at)
  meta(seed, policy, last_tick, ...)        // engine + debug state

FileSystem (documentDirectory):
  images/<uuid>.<ext>                        // image bytes; DB stores only the uri (keeps DB small)
```

Embeddings stored as JSON/blob; cosine + MMR run in JS over loaded vectors (fine for the hundreds–low-thousands of memories a personal app accumulates).

## 9. Tick scheduling (KISS)

```
shallow tick  after each exchange (debounce ~2s): decay(touched) · reinforce · extract   // light
deep tick     on app open / long idle:           merge · crystallize · prune              // heavy (LLM)
```

Single user, single device → foreground + after-exchange ticks are sufficient. No headless background service.

## 10. Testing strategy (TDD)

The risk is the consolidation dynamics. The engine is pure TS with all side effects behind ports, so it is tested headless with a fast-forwardable clock.

```
TimeMachine harness (same mechanism as in-app time travel):
  fakeClock + seededRandom + inMemoryStorage + fakeEmbed (deterministic vectors) + fakeChat (canned extract)
  → feed scripted messages → clock.advance(+Nd) → tick → assert memory state

Behaviors to assert:
  1. DECAY        unrecalled memory → strength < floor → pruned
  2. REINFORCE    repeatedly recalled → survives
  3. MERGE        two similar weak memories → consolidate to one
  4. CRYSTALLIZE  pattern repeated ≥ randomK(fixed seed) → self-facet appears (reproducible)
  5. SELF-DECAY   unreinforced self-facet → fades → drops from top-12
  6. RETRIEVE     always emits self-tier + relevant episodic; never the full history (bounded injection)
  7. POLICY-SWAP  same seed, fixedK vs randomK → different crystallization timing (proves pluggability)
  8. BACKFILL     embed failure → embedding=null → next tick backfills
```

Engine behaviors are written test-first (per CLAUDE.md "test before commit"); the fixed seed keeps randomized policies reproducible.

## 11. Tech stack

- Expo (React Native), `expo-sqlite`, `expo-image-picker`, `expo-secure-store`, FileSystem.
- Memory engine: plain TypeScript, no RN/provider deps (so it runs under Node for tests).
- Inference: OpenAI-compatible HTTP — OpenRouter (chat) + LM Studio (chat and/or embeddings).

## 12. Staging & open questions

**P0 (this plan):** single `default` friend (empty seed) · memory engine (decay/consolidate/crystallize, `randomK(3,7)`, seeded Random) · image upload · Gemini-clean single-thread UI · OpenAI-compat provider (chat+embed split, secure-store key) · SQLite+FileSystem storage · tick scheduling · simulated-time tests · debug screen under Settings → Developer.

**P1 (deferred, seams built in P0):** multi-persona spawn + friends drawer + create-persona form; `constitution` vs `seed` persona modes.

**Open questions (decide at build time):**
- `tau` / `floor` / `boost` constants and `merge` cosine threshold — tune via the TimeMachine harness.
- Whether prune deletes outright or archives cold (start with delete; revisit if recall regret appears).
- Persona seed mode default (`constitution` recommended as safe default; `seed`/drift offered as experimental).
