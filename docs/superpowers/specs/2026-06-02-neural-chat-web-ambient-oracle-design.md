# neural-chat web — Living-Memory Chat + เชียงใหม่ Ambient Oracle (Design)

> Brainstormed 2026-06-02; hardened against an adversarial 3-lens critique (completeness / feasibility-vs-real-code / LOW-hardcode discipline). **Personal / for-fun side project — not for sale.** Scope = layers 0–3: a plain-web chat frontend on the existing living-memory engine, plus a "เชียงใหม่" ambient-oracle persona that observes the real world and pops in to say hi. MDS affect = deferred **layer 4** (seam only). Supersedes the prior Expo direction for this project's *frontend* (mobile is frozen, not deleted).

## North star

Open the app and **เชียงใหม่** — a province that has a sense of itself — greets you with something true about the world right now ("ฝนเพิ่งหยุดแถวแม่ริม ฟ้าเปิดละ ออกไปเดินมั้ย"). You can talk back forever; it remembers across days because the memory engine decays/reinforces/crystallizes instead of stuffing a context window. Ask it "ไปไหนดีวันนี้ / อำเภอไหนฝนตก" and it reasons over live multi-district data + what it knows about you.

## Design principles (in priority order)

1. **LOW hardcode — emergence > hardcode.** Meaning is produced by the LLM oracle and the engine, never by baked `if/else` rules or `threshold→phrase` tables. Salience is *relative/statistical* (learns the local normal), not absolute thresholds. Personality *crystallizes* from memory; seed prompts are minimal. Domain constants live in **one isolated data/config module each** — reference data, not scattered magic numbers.
2. **Zero engine changes for the MVP.** The engine (`@nature-labs/living-memory-engine`, 36 tests green) is the brain as-is. Everything new lives in the web app. Proactive greeting uses only existing public methods (`ingestModel`, `addEpisodic`, `tick`) — no core edit.
3. **Lean.** Vite vanilla (no React), minimal deps, KISS. Not for sale → no GPLv3/distribution scaffolding.
4. **Isolation.** Each module has one purpose, a small interface, and is understandable/testable alone.

### LOW-hardcode enforcement (concrete rules — these PREVENT hardcode, not just discourage it)

- **importance from salience** — exactly `scaleFromSalience(z) = clamp(round(10 * z / (z + salienceK)), 1, 10)`. A smooth, monotonic 0→1 squash of the already-relative z, anchored on the **same** `salienceK` knob, then mapped into the engine's required `1..10`. No extra literals inside it.
- **`cityMood` returns `{ valence, arousal } ∈ [-1,1]`** derived ONLY from relative quantities (rolling-mean salience + z of world-tagged memory strength vs the *city's own* history) — never from absolute metric values like "PM > X". The **LLM names the feeling**; `cityMood` only nudges the prompt. Layer-4 = swap this one function's body for MDS PAD state.
- **WMO/units legend is reference text, not a phrase table.** `lib/data/chiangmai.ts` exports two *separate* things: `DISTRICTS` (coords) and `FIELD_LEGEND` (verbatim Open-Meteo description strings + units). `FIELD_LEGEND` is handed to the oracle **as a context string only** — it MUST NOT be imported for branching or string selection. The only importers of `chiangmai.ts` are `world.ts` (coords) and the prompt-builder (legend as text).
- **Instruction templates live on the persona, not in logic.** `ambient.ts` assembles *context* (senses + legend + mood) but pulls the instruction text from `persona.prompts` — voice lives with the entity and can crystallize/override per-persona.
- **Seed prompt ceiling:** ≤ 2 sentences, identity + first-person stance only; MUST NOT enumerate traits, moods, catchphrases, or example lines (those emerge as self-facets).
- **Numeric-knob invariant:** the only behaviour knobs are in `config.ts` (`ambientRefreshMs`, `salienceK`, `baselineWindow`, `worldlogCap`). `ε` in the z-score is a math guard, not a knob; the engine's `randomK(3,7)` + seed are engine-domain. Intent: a numeric-literal grep of `ambient.ts`/`world.ts` returns nothing but array indices.

## Non-goals (explicitly out of this spec)

Message actions (copy/edit/rewind/**retry**) · model-picker screen · timestamps/date-badges · image upload/vision · **MDS affect substrate (layer 4)** · background/push greeting when app is closed · the prospective-resolution engine plan (`docs/superpowers/plans/2026-06-02-prospective-resolution.md` — separate; the oracle gives it a real use later) · multi-province (เชียงใหม่ only; the persona system makes more trivial later).

---

## Architecture

### Stack
- **Vite vanilla TS** (no framework). New `web/` directory, sibling to `engine/` and `mobile/`.
- **uicp** drawer: `@nature-labs/uicp-core` + `@nature-labs/uicp-adapter-vanilla` v0.4.1 (npm). Headless — the adapter only sets `data-uip-*` attrs/classes; **we write all CSS**.
- **engine** via `"@nature-labs/living-memory-engine": "file:../engine"`. Vite resolves its `exports` map → prebuilt `dist/` (real ESM `.js`; avoids the NodeNext `.js`-import / esbuild-`.ts` mismatch that aliasing `src/` would hit — **verified: `dist/src/index.js` and `dist/provider/adapters.js` exist**). The provider ports are NOT on the package root — import them from the **`@nature-labs/living-memory-engine/provider`** subpath (`makeChatPort`, `makeEmbedPort`), as `mobile/lib/engine.ts:3` does. `vite build` inlines the engine, but **`cd engine && npm run build` must run first** since web depends on the prebuilt `dist/`. If Vite pre-bundling complains: `optimizeDeps.exclude: ['@nature-labs/living-memory-engine']`.
- Provider ports use the browser's native `fetch` (streams fine — the `expo/fetch` shim was an RN-only workaround).
- **Reuse the engine's exported types** (`Snapshot`, `Message`, `EpisodicMemory`, ports). Do not redeclare them.

### Embeddings + provider switching — `ModelProfile` selector (in MVP)
**Verified live 2026-06-02:** OpenRouter exposes **zero** embedding models / no `/embeddings` route — so OpenRouter can serve *chat* but never *embeddings* (the mobile default `openai/text-embedding-3-small` on `openrouter.ai/api/v1` returns `null` → degraded retrieval, which mobile has likely run with all along). Rather than bake one provider into `.env`, the app ships a **`ModelProfile` selector in the drawer** (founder's call — "zen แต่จัดการเองได้ครบ, ไม่ต้องมา .env ประจำ"): one tap switches **both** chat and embed endpoints, then `resetEngines()` rebuilds the ports. A profile sets chat + embed independently, so a chat-only provider (OpenRouter) can pair with a local embedder.

Built-in profiles (see the `ModelProfile` contract):
- **Local (Ollama)** — *default on this Mac*; chat + embed both `http://localhost:11434/v1` (`gemma3:4b` / `nomic-embed-text`). Verified live: Ollama running + CORS-open for `localhost:5173`; embeddings work with no key, fully private.
- **Local (LM Studio)** — both `http://localhost:1234/v1` (`gemma-3-27b-it` / `nomic-embed-text`) — the founder's other (4070ti) machine.
- **OpenRouter + local embed** — chat = OpenRouter free `gemma-4-26b-a4b-it:free` (verified valid), embed = local Ollama (OpenRouter can't embed). Cloud chat, real memory.
- **OpenAI Direct** — both `https://api.openai.com/v1` (needs an OpenAI key).

Per-provider API keys live in `config.ts` (localStorage; `import.meta.env.VITE_*` dev fallback); local profiles need none. **Phase-1 gate:** an integration check confirms the active profile's `embed("hello")` returns a finite numeric vector before Phase 2 relies on retrieval (Phase 1 chat doesn't depend on embeddings). Provider-agnostic from MVP = the founder can exercise full UX/capability while testing.

### Module map (`web/src/`)

| Module | Purpose |
|---|---|
| `main.ts` | Boot: theme → render shell → mount chat → wire drawer → start ambient loop |
| `styles.css` | All CSS (palette as CSS vars, light/dark) |
| `lib/storage.ts` | `StoragePort` over IndexedDB (one record/namespace) + a tiny `kv` helper (for `worldlog`) |
| `lib/config.ts` | OpenRouter key + chat/embed `EndpointCfg` + the 3 ambient knobs (localStorage; `import.meta.env.VITE_*` dev fallback) |
| `lib/personas.ts` | Persona list / active / `subscribe` (logic ported from mobile, Expo deps removed). เชียงใหม่ = seed |
| `lib/engine.ts` | `getEngine(ns, sysPrompt) → { engine, storage, chatPort }` + cache + `resetEngines()` |
| `lib/theme.ts` | Palette object + `prefers-color-scheme` listener (logic ported, RN hook replaced) |
| `lib/data/chiangmai.ts` | `DISTRICTS` (อำเภอ + lat/lon) and `FIELD_LEGEND` (verbatim Open-Meteo strings) — two separate exports |
| `lib/world.ts` | `fetchWorld(districts)` → raw structured senses via Open-Meteo |
| `lib/ambient.ts` | `observe()` + `maybeGreet()` + `cityMood()` + the salience math |
| `ui/chat.ts` | Message list, composer, streaming render, proactive bubble, no-key banner |
| `ui/drawer.ts` | uicp drawer: persona switch / `+ เพื่อนใหม่` / OpenRouter key field / theme follows system |

### Two stores, deliberately separate
- **Engine `Snapshot`** (per namespace, IndexedDB store `snapshots`, key = namespace) — messages + *interpreted* memories. What the bot talks from. Owned by the engine via `StoragePort`.
- **`worldlog`** (one IndexedDB `kv` key, capped ring of the last `worldlogCap` **raw numeric** observations — kept long enough to span days/seasons, not just `baselineWindow`) — owned by `ambient.ts`, used only for drift math. Avoids re-parsing LLM prose into numbers. (Echoes World-OS `world.log`: append-only sensory truth.)

---

## Contracts (types & signatures — so nothing is left to guess)

```ts
// personas.ts — Persona gains `ambient` + `prompts` (instruction templates live here, not in ambient.ts)
interface Persona {
  id: string; name: string; systemPrompt: string; createdAt: number;
  ambient?: boolean;                       // only ambient personas get observed
  prompts?: { observe: string; greet: string };
}
// Seed (replaces mobile's 'default'); plain non-ambient friends still creatable alongside.
const CHIANGMAI: Persona = {
  id: 'chiangmai', name: 'เชียงใหม่', createdAt: 0, ambient: true,
  systemPrompt: 'คุณคือจังหวัดเชียงใหม่ พูดในนามของตัวเองในฐานะเมืองที่มีความรู้สึก คุยกับเพื่อนอย่างเป็นกันเอง',
  prompts: {
    observe: 'จากข้อมูลโลกด้านล่าง สังเกตว่ามีอะไรน่าสนใจตอนนี้ แล้วบันทึกเป็นความรู้สึกของตัวเองสั้นๆ 1-2 ประโยค',
    greet:   'ทักทายเพื่อนสั้นๆ อย่างเป็นธรรมชาติ เกี่ยวกับสิ่งที่เพิ่งสังเกตเห็น',
  },
};

// config.ts — one profile switches chat + embed together (independent endpoints)
interface ModelProfile {
  id: string; label: string;
  chat:  { baseURL: string; model: string };
  embed: { baseURL: string; model: string };
  needsKey?: boolean;                          // show the key field only for these
}

// world.ts
interface DistrictSenses {
  name: string; pm2_5: number; pm10: number; us_aqi: number;
  temperature_2m: number; relative_humidity_2m: number; weather_code: number;
  precipitation: number; cloud_cover: number; wind_speed_10m: number; is_day: number;
}
interface WorldSnapshot { ts: number; perDistrict: DistrictSenses[]; }
function fetchWorld(districts: typeof DISTRICTS): Promise<WorldSnapshot | null>;

// ambient.ts
type Mood = { valence: number; arousal: number };           // each in [-1, 1]
interface Observation { observation: string; salience: number }
function observe(engine, chatPort, persona): Promise<Observation | null>;
function maybeGreet(engine, chatPort, persona, obs: Observation | null): Promise<void>;
function cityMood(engine): Mood;
```

---

## Components

### `lib/storage.ts` — `StoragePort` over IndexedDB
`load(): Promise<Snapshot>` / `save(s): Promise<void>` per namespace; store `snapshots`, key = namespace, value = whole `Snapshot`. Absent key → the engine's empty snapshot `{ messages:[], episodic:[], selfFacets:[], prospective:[], lastTick:0 }` (matches `mobile/lib/storage.ts`). Also exports `getRaw/setRaw(key,value)` (the `kv` helper) reused by `worldlog`. ~40 lines raw IndexedDB, zero deps. **Why IndexedDB:** "talk forever" + 1536-dim embeddings blow past localStorage's ~5 MB cap.

### `lib/config.ts` — profiles, keys & the only tunable knobs
Holds the built-in `ModelProfile[]`, the active profile id, and per-provider API keys (localStorage; `import.meta.env.VITE_*` dev fallback). `getChatCfg()/getEmbedCfg()` resolve the active profile into the provider's `EndpointConfig { baseURL, apiKey, model }` (key merged at call time; local profiles need none). `setActiveProfile(id)` → caller runs `resetEngines()`.
- **Chat:** the OpenRouter profile uses `google/gemma-4-26b-a4b-it:free` — **verified valid** (in OpenRouter's 342-model catalogue, 2026-06-02). 429s on the free tier → retry (see error handling).
- **Default profile:** Local (Ollama) — this Mac; works end-to-end (chat + embed) with no key. (LM Studio profile is for the 4070ti machine.)
- **Ambient knobs (defaults, overridable, the ONLY behaviour numbers):** `ambientRefreshMs` (30 min), `salienceK` (z-threshold, 2), `baselineWindow` (same-diurnal-phase comparison count, 48), `worldlogCap` (raw-history ring, ~672 ≈ 2 weeks at 30-min refresh — kept longer than `baselineWindow` so daily/seasonal patterns stay distinguishable, per review).

### `lib/personas.ts` — entities = isolated memory
Logic ported from `mobile/lib/personas.ts` (plain TS + localStorage + `subscribe`); the Expo `expo-sqlite/.../localStorage` shim import is dropped (web has real `localStorage`). API: `listPersonas / addPersona / getActivePersona / setActivePersona / subscribeActivePersona`. Persona id = engine storage namespace.
- **Seed:** `CHIANGMAI` (above) is the default/seed persona, injected into `listPersonas` in mobile's old `DEFAULT` slot. The old empty `'default'` friend is **removed** (replaced by เชียงใหม่); plain non-ambient friends remain creatable via `addPersona` (they get `ambient` unset/false and no `prompts`, so they are never observed).

### `lib/engine.ts` — engine factory
`getEngine(ns, sysPrompt) → { engine, storage, chatPort }`. Builds an IndexedDB `StoragePort(ns)`; constructs `chatPort = makeChatPort(cfg)` and `embedPort = makeEmbedPort(cfg)` **once** (ports imported from `…/provider`); `clock = { now: () => Date.now() }`; a seeded `Random`; `policy = randomK(3,7)`. **Returns the very same `chatPort` reference the engine was constructed with** — so a single `resetEngines()` (called after key/model change) invalidates both the chat path and the ambient path. Caches by namespace. (New return shape vs mobile's `{ engine, storage }`.)

### `lib/theme.ts` — palette
Light/dark `Palette` (tokens ported from `mobile/lib/theme.ts`) — but the RN `useColorScheme()` hook is replaced by a `prefers-color-scheme` `matchMedia` subscription that toggles `data-theme` on `<html>`; CSS vars in `styles.css` read from it. (Logic ported, not the file.)

### `lib/world.ts` — senses (Open-Meteo)
`fetchWorld(DISTRICTS)` issues **two requests total** (one per endpoint), each batching ALL districts via comma-separated coordinates; merges per-district **positionally by `DISTRICTS` order** (Open-Meteo echoes no name; index = district), reattaching `name`. Returns `WorldSnapshot | null`.
- **Endpoints (no key, CORS `*` — verified live 2026-06-02, per-district array confirmed):**
  - `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=…&longitude=…&current=pm2_5,pm10,us_aqi&timezone=Asia/Bangkok`
  - `https://api.open-meteo.com/v1/forecast?latitude=…&longitude=…&current=temperature_2m,relative_humidity_2m,weather_code,precipitation,cloud_cover,wind_speed_10m,is_day&timezone=Asia/Bangkok`
- **Failure policy:** any HTTP/parse failure on **either** endpoint (or mismatched array lengths) → return `null` for the whole tick. No partial `worldlog` rows. No interpretation, no thresholds here.

### `lib/ambient.ts` — the soul (drift → interpret → remember → greet)

**`observe(engine, chatPort, persona): Promise<Observation | null>`**
1. **Throttle:** skip if the **newest `worldlog` ts** is < `ambientRefreshMs` ago. (World recency derives from `worldlog`, explicitly NOT from `Snapshot.lastTick`, which is the engine's consolidation clock.)
2. `world = fetchWorld(DISTRICTS)`; if `null`, return `null`.
3. Append raw senses to `worldlog` (ring capped at `baselineWindow`).
4. **Salience (statistical, no absolute thresholds, diurnal-aware):** baseline = the most recent `baselineWindow` `worldlog` points **sharing the current `is_day` phase** (so "ฝนตกทุกคืน" is compared against other nights, not against daytime — per review; falls back to all points if too few same-phase exist). For each metric × district, `z = |x − mean| / (std + ε)`; `salience = max z` over all metrics. **Cold start falls out of the math, not a flag:** with < 2 baseline points `std`→0 so any change yields a very large z — an empty/near-empty baseline is naturally maximally salient (the city's "first hello"); normal drift applies once history accrues. No separate cold-start threshold. *(Deeper season/era baselines are deferred — see follow-ups.)*
5. If `salience ≥ salienceK`: build the oracle call —
   `chatPort.stream([{ id: uid(), role: 'user', text: persona.prompts.observe, ts: now }], persona.systemPrompt + moodHint(cityMood(engine)), sensesContext)` where `sensesContext` = the raw `WorldSnapshot` JSON + `FIELD_LEGEND` as text. The caller **collects the AsyncIterable into a string** (the engine exposes no public `collect`). Then `engine.addEpisodic({ content: observation, importance: scaleFromSalience(z), tags: ['world', ...notableMetrics] })`, where **notableMetrics** = the metric keys (from a fixed `METRIC_KEYS` list in `chiangmai.ts`) whose own per-metric z ≥ `salienceK`. Return `{ observation, salience }`.
   - Below threshold → return `null` (no memory written, no greet).

**`maybeGreet(engine, chatPort, persona, obs)`** — proactive, **no engine change.** Takes `observe()`'s result as an argument (no re-derivation). Guard: a **module-scope `greetedThisOpen` boolean** (reset on page load) → greet at most once per app-open. If `obs` is non-null and not yet greeted: generate a greeting via `chatPort.stream([{…, text: persona.prompts.greet, …}], persona.systemPrompt + moodHint, obs.observation)`, collect to string, render it as a city bubble, then `engine.ingestModel(greeting)` **and** `engine.tick()` so the spoken line is consolidated immediately. **By design the greet bypasses `retrieve()`/`formatInjection`** — a hello is ungrounded; grounding happens when the user replies through `respond()`. (It is therefore NOT "a normal turn minus the user turn" — it also omits retrieve/inject; that is intentional.)

**`cityMood(engine): Mood`** — the **MDS seam.** Returns `{ valence, arousal } ∈ [-1,1]` from relative quantities only: rolling-mean salience (recomputed from `worldlog`) and the z of `world`-tagged episodic-memory strength vs that namespace's own history. Never reads absolute metric values. `moodHint(mood)` renders it as a short neutral phrase appended to the system prompt; **the LLM names the actual feeling.** Layer-4 = replace this body with MDS PAD/needs state; signature and all callers unchanged.

`uid()`, `ε`, and `METRIC_KEYS` are local constants (not knobs); everything tunable is in `config.ts`.

### `ui/chat.ts` & `ui/drawer.ts`
- **chat.ts:** render `storage.load().messages` as bubbles (user right / city left); composer (textarea, Enter=send, Shift+Enter=newline, busy state). On send → `const obs = await observe(...)` (throttled refresh so "now" questions are grounded) → `for await (chunk of engine.respond(text))` grow the city bubble → on done, reload messages to resync ids/ts. No-key → banner that opens the drawer. Renders greeting bubbles produced by `maybeGreet`.
- **drawer.ts:** `drawerWithGestures('#drawer', { position:'left' })`; content = current persona, persona list + switch (re-render chat from the new namespace), `+ เพื่อนใหม่` (name + optional prompt), a **`ModelProfile` selector** (Local LM Studio / Ollama / OpenRouter+local-embed / OpenAI Direct → `setActiveProfile` → `resetEngines`), an API-key field shown only when the active profile has `needsKey`, and theme-follows-system. All CSS ours (palette; backdrop + slide transition).

---

## Data flow

```
boot        main → theme.init → personas.active (chiangmai) → getEngine(ns, seed)
            → render storage.load().messages → obs = observe() → maybeGreet(obs)
send        user text → observe() (throttled; newest-worldlog-ts gates it) → engine.respond(text)
            → stream chunks into city bubble → reload messages (engine saved via respond/tick)
greet       observe() returns notable obs → chatPort greeting seeded by obs.observation
            → render bubble → engine.ingestModel(greeting) → engine.tick()   [no user turn, no engine change]
recommend   "ไปไหนดี/อำเภอไหนฝน" = a normal send; observe() just refreshed + addEpisodic'd the
            current conditions, so engine.retrieve() surfaces them in the injection (needs embeddings)
switch      drawer setActivePersona(id) → getEngine(id) → re-render from that namespace
profile/key drawer setActiveProfile/setKey → resetEngines() → next getEngine rebuilds chat + embed + ambient ports
loop        setInterval(ambientRefreshMs) while tab open → observe → maybeGreet
            [closed-app/background greet = deferred (service worker/server)]
```

## Error handling (fail soft for a toy; never corrupt/lose memory silently)
- **No API key (only for a profile with `needsKey`)** → persistent banner + drawer key field; send blocked with a hint; ambient skipped (no crash). Local profiles need no key.
- **`fetchWorld` fails / offline** → `null`; ambient tick is a no-op; chat still works from memory; optional quiet "เมืองเงียบอยู่" note, no error spam.
- **Oracle/greeting LLM fails** (e.g. 429 on the free model) → no observation/greet this tick; `console.warn`; retry next tick. Never blocks chat.
- **`engine.respond` stream error** → show the error inline; **keep the user's text recoverable in the composer** for a manual resend. We do NOT auto-retry by calling `respond()` again (it unconditionally re-runs `ingestUser()` → duplicate user message; there is no public regenerate-without-ingest). A real retry affordance is a deferred message-action.
- **IndexedDB quota/exception** → visible toast (do NOT swallow) — this is the one place silence would mean memory loss.

## Testing (light — it's for fun, but cover the pure logic)
- Engine untouched; its 36 vitest tests stay green (`cd engine && npm test`).
- Web pure functions get vitest: **z-score salience** (flat baseline → low; spike → high; <2 points → max), **`scaleFromSalience`** (z→[1,10], monotonic, clamped), **`world.ts` parse + positional merge** (sample two-array Open-Meteo JSON → `WorldSnapshot`; either-array-fails → null), **`cityMood`** (sample histories → `{valence,arousal}` in range).
- **`storage.ts` roundtrip** with `fake-indexeddb` (dev-dep): save/load a `Snapshot`, absent-key → empty snapshot.
- **Embed gate** (Phase-1, integration): `embed("hello")` returns a finite numeric vector before Phase 2 relies on retrieval.
- UI = manual in the browser (`npm run dev`). No e2e for a toy.

## Removed / frozen (Phase 0)
- **Remove** (root old-React prototype): `App.tsx, index.tsx, index.html, vite.config.ts, types.ts, metadata.json, components/, services/` + root deps `react, react-dom, @google/genai, lucide-react, @vitejs/plugin-react`.
- **Keep / do not touch:** `engine/`, `mobile/` (frozen), `docs/`, `.remember/`, `NEXT-SESSION.md`.
- Deletion happens after a commit so it's recoverable.

## Build phases (the implementation plan will expand these)
- **Phase 0 — cleanup + scaffold:** remove old root React; `npm create vite` vanilla-ts into `web/`; strip to essentials; wire engine `file:../engine` + uicp deps; "hello drawer" renders.
- **Phase 1 — foundation (talk to เชียงใหม่, no world yet):** `storage.ts`, `config.ts` (incl. `ModelProfile` presets), `personas.ts`, `engine.ts`, `theme.ts`, `ui/chat.ts`, `ui/drawer.ts` (incl. profile selector) + the **embed gate**. End state: streaming chat persists across reload; persona switch + **profile switch** work; the active profile's `embed()` returns a real vector.
- **Phase 2 — soul (the province wakes up):** `lib/data/chiangmai.ts`, `world.ts`, `ambient.ts` (salience + oracle + `addEpisodic` + `maybeGreet` + `cityMood` seam), ambient loop in `main.ts`. End state: open the app → เชียงใหม่ greets with something true; ask "อำเภอไหนฝน" → grounded answer.

## Deferred / follow-ups

- **★ Self-state grounding / calibration (CORE DIRECTION, locked 2026-06-02 — concept only):** for a local-first entity, **self-awareness/calibration > raw intelligence.** Give the entity *explicit* runtime self-state instead of letting the model guess — `online`, `llm` (local/remote/unavailable), `embeddings` (ready/degraded/unavailable), `world_feed` (fresh/stale/unavailable), `memory` (snapshot age) — and inject it as a `[Self-state]` calibration block (sibling of `cityMood`, so it surfaces in the Injection Tap). Behaviour: world_feed stale → speak from memory, don't claim realtime; embeddings down → know recall is degraded; offline → know it's isolated cognition. This is the entity's **interoception** (vs `observe()` = exteroception) and the real substance of the layer-4 MDS seam (confidence · sensory integrity · temporal certainty · identity stability) — "ระบบที่รู้ว่ามันคือระบบ". **Cheap when built: grounds existing signals** (worldlog ts, embed-null, `navigator.onLine`, ModelProfile baseURL, lastTick), not new infra. The lab time-position toggle is a first taste of temporal calibration.
- **Background continuity** — the city only observes while a tab is open (MVP). It "lives on while you're away" via a service worker or a tiny local cron later; this is what turns it from "a chatbot that checks weather on open" into "เมืองที่ใช้ชีวิตต่อแม้เราไม่อยู่" (per review).
- **Climate-identity crystallization** — raw→observation→episodic today; later, recurring `world`-tagged episodics should crystallize into season/era-level identity ("เชียงใหม่หน้าฝนปีนี้อึมครึมกว่าปกติ"). **The engine's existing crystallization (`detectPatterns`/`summarizePattern`/`policy` → self-facets) already provides the mechanism** — it partially emerges for free once retrieval works; a dedicated `climate` facet kind would be a small future engine touch.
- **Deeper salience baselines** — short-term + long-term/seasonal windows beyond the diurnal bucket.
- Message actions (incl. retry) · model-picker screen · timestamps/date-badges · images · **MDS affect (layer 4 — swap `cityMood`)** · prospective-resolution engine plan (separate; ambient is its motivating use case) · multi-province.
