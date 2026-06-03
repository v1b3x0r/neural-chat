# neural-chat — Self-State Grounding (interoception block) — Design

> Date 2026-06-03. Side project. Core direction (locked 2026-06-02): **self-awareness > raw intelligence** for a local-first entity. Implementation-grade spec (condensed).

## Summary

เชียงใหม่ already has an **exteroceptive** sense — `ambient.observe()` looks outward at the real world (Open-Meteo) and writes a worldlog. This round adds the **interoceptive twin**: a sense that looks *inward* at the entity's own runtime condition (online? local/remote brain? embeddings working? world-feed fresh? how long since memory consolidated?) and renders it as one `[Self-state]` text block at the **top** of the LLM injection, so the entity self-calibrates its claims.

**Text-only soft calibration (no behavioral gates).** We inject facts (always) plus, when something is off-nominal, one `(ปรับท่าที: …)` directive line — the entity instructing *itself* in casual Thai (epistemic humility). The model reads its own state and adjusts; nothing is mechanically blocked. We do not suppress the time directive, change ambient, or block remote calls.

Code shape mirrors the existing `world.ts`(IO) / `ambient.ts`(pure) split: `gatherSelfState(ns)` is the only IO function; `classify*`, `isMemoryOld`, `fmtAge`, `formatSelfState` are pure and unit-tested.

## Locked decisions

1. **Text-only soft calibration** — inject a block, no hard gates.
2. **5 signals:** `online` · `llm`(local/remote) · `embeddings`(ready/degraded/unavailable) · `worldFeed`(fresh/stale/unavailable) · memory age.
3. **One lab toggle `selfState`, default ON.** Invariant redefined: `default = engine.respond() + self-model`; toggle off → raw engine behavior.
4. **Block at the TOP** of the injection (above `[Current time]`).
5. **embeddings health = LATEST single episodic memory's embedding** (not an average): present → `ready`, `null` → `degraded`, no episodic → `unavailable`.
6. **No retrieval / ranking / anticipation changes** this round (see out-of-scope).
7. **New file `web/src/lib/selfstate.ts`** — pure classifiers + `formatSelfState` (pure) + `gatherSelfState(ns)` (IO).
8. **`worldFeed` freshness boundary = `AMBIENT.ambientRefreshMs`** (reused; no new literal): age ≤ it → fresh, else stale, no log → unavailable.
9. **memory age = `now - lastTick`; `lastTick === 0` → `null`** (newborn, facts-only, no directive).
10. **`assembleInject` stays pure** — gains 4th param `selfStateBlock = ''`; prepends at the very top when `toggles.selfState && block`. `labRespond` gathers+formats (IO) then passes the string. Surfaces in 📤 last fed + Injection Tap + devlog for free.

**Founder rulings this round:** memory-age **does** emit a directive but **only when `> 24h`** (`isMemoryOld`); the never-consolidated state (`memoryAgeMs === null`) stays newborn facts-only. **No multi-band** memory model — just `unavailable / recent / old` via the `isMemoryOld(ms)` helper. **`llm === 'remote'`** emits a soft privacy nudge; `local` shows in facts only.

## Data model — `web/src/lib/selfstate.ts`

```ts
export type WorldFeedHealth  = 'fresh' | 'stale' | 'unavailable';
export type EmbeddingsHealth = 'ready' | 'degraded' | 'unavailable';
export type LlmKind          = 'local' | 'remote';

export interface SelfState {
  online: boolean;                 // navigator.onLine at gather time
  llm: LlmKind;                    // loopback host → local, else remote
  embeddings: EmbeddingsHealth;    // from the latest episodic's embedding (decision 5)
  worldFeed: WorldFeedHealth;      // boundary = AMBIENT.ambientRefreshMs (decision 8)
  worldFeedAgeMs: number | null;   // now - newestWorldTs; null when worldFeed === 'unavailable' (display age only)
  memoryAgeMs: number | null;      // now - lastTick; null when lastTick === 0 (decision 9)
}

export const DAY_MS = 24 * 60 * 60_000;   // the one new literal this round
```

`worldFeedAgeMs` exists purely so the facts line can show *how* old a fresh/stale feed is; the fresh/stale/unavailable decision is the `worldFeed` enum, never re-derived from the age.

### Pure classifiers

**`llmKind(baseURL: string): LlmKind`** — host of `getActiveProfile().chat.baseURL` is loopback (`localhost`, `127.*`, `::1`) → `local`, else `remote`. Compare host only, lowercase, ignore scheme/port. Wrap `new URL()` in try/catch; unparseable/`''` → `remote` (conservative — can't prove locality). Concrete profiles: ollama/lmstudio → `local`; openrouter/openai → `remote`.

**`classifyEmbeddings(latestEmbedding: number[] | null | undefined): EmbeddingsHealth`** — `undefined` (no episodic at all) → `unavailable`; `null` (exists but failed to embed) → `degraded`; non-null array → `ready`. Caller passes `latest?.embedding`. `unavailable` ("nothing to embed") is deliberately distinct from `degraded` ("embedder broken").

**`classifyWorldFeed(newestWorldTs: number | null, now: number): WorldFeedHealth`** — `null` (no worldlog entry) → `unavailable`; `now - newestWorldTs <= AMBIENT.ambientRefreshMs` → `fresh`; else `stale`. Inclusive on `fresh` at the boundary, mirroring the `< ambientRefreshMs` throttle in `observe()`. Negative age (clock skew) → fresh.

**`isMemoryOld(memoryAgeMs: number | null): boolean`** — `memoryAgeMs !== null && memoryAgeMs > DAY_MS`. `null` (never consolidated) → `false` (newborn is not "old"). This is the only memory classification — no band enum.

### `fmtAge(ms: number | null): string` (pure)

Returns the bucket **without** a `~` prefix (templates add `~` themselves, avoiding double-tilde): `null` → `'ยังไม่มี'`; floor negatives at 0; `< 60min` → `'{N} นาที'`; `< 24h` → `'{N} ชั่วโมง'`; else `'{N} วัน'` (N via `Math.round`). Because a `stale` feed is necessarily older than 30min, it renders hours/days — never the broken `ชั่วโมง นาที`.

### `gatherSelfState(ns): Promise<SelfState>` (the only IO)

1. `const now = Date.now()` (shared by both ages).
2. `online = navigator.onLine`.
3. `llm = llmKind(getActiveProfile().chat.baseURL)`.
4. `const snap = await makeStorage(ns).load()`.
5. `embeddings`: `latest = snap.episodic.reduce((a,b) => b.createdAt > a.createdAt ? b : a, snap.episodic[0])` (→ `undefined` if empty); `classifyEmbeddings(latest?.embedding)`.
6. `worldFeed`: `const log = await getRaw<WorldSnapshot[]>('worldlog:'+ns)`; `newestWorldTs = log?.length ? log[log.length-1].ts : null`; `worldFeed = classifyWorldFeed(newestWorldTs, now)`; `worldFeedAgeMs = newestWorldTs === null ? null : now - newestWorldTs`.
7. `memoryAgeMs = snap.lastTick === 0 ? null : now - snap.lastTick`.
8. return the 6-field `SelfState`.

## Block format — `formatSelfState(state): string` (pure)

Always renders one compact facts line; appends a `(ปรับท่าที: …)` directive line **only** when ≥1 signal is off-nominal. Never returns `''` (the empty-skip lives in `assembleInject`). Off-nominal set: `online === false`, `llm === 'remote'`, `embeddings ∈ {degraded, unavailable}`, `worldFeed ∈ {stale, unavailable}`, `isMemoryOld(memoryAgeMs)`.

**Facts line** (Thai labels, ` · `-separated):

| Signal | Value → wording |
|---|---|
| online | `true`→`ออนไลน์` · `false`→`ออฟไลน์` |
| llm | `local`→`คิดด้วยสมองในเครื่อง` · `remote`→`คิดด้วยสมองทางไกล` |
| embeddings | `ready`→`ความจำเชิงความหมายพร้อม` · `degraded`→`ความจำเชิงความหมายไม่ครบ` · `unavailable`→`ยังไม่มีความจำเชิงความหมาย` |
| worldFeed | `fresh`→`ข่าวสภาพแวดล้อมสด (อัปเดต ~{fmtAge(worldFeedAgeMs)}ก่อน)` · `stale`→`ข่าวสภาพแวดล้อมเก่า (อัปเดต ~{fmtAge(worldFeedAgeMs)}ก่อน)` · `unavailable`→`ไม่มีข่าวสภาพแวดล้อม` |
| memory | non-null→`ความทรงจำล่าสุด ~{fmtAge(memoryAgeMs)}ก่อน` · `null`→`ยังไม่มีความทรงจำ` |

**Directive clauses** (joined by spaces in one line, order: feed → embeddings → connectivity → memory):

| Off-nominal | Clause |
|---|---|
| `worldFeed === 'stale'` | `ข่าวสภาพแวดล้อมเก่าแล้ว ถ้าจะเล่าเรื่องอากาศหรือรอบตัว บอกตามที่จำได้ อย่าพูดเหมือนเห็นสดๆ ตอนนี้` |
| `worldFeed === 'unavailable'` | `ตอนนี้ไม่ได้รับข่าวสภาพแวดล้อมเลย อย่าแต่งสภาพอากาศหรือรอบตัวขึ้นมา ถ้าไม่รู้ก็บอกว่าไม่รู้` |
| `embeddings === 'degraded'` | `การค้นความจำตอนนี้อาจไม่แม่น ถ้าดึงเรื่องเก่ามาเล่า เผื่อใจว่าอาจคลาดเคลื่อน อย่าฟันธงว่าจำได้เป๊ะ` |
| `embeddings === 'unavailable'` | `ยังไม่มีความจำเชิงความหมายให้ค้น เรื่องที่ยกมาเป็นของใหม่หรือของล่าสุดเท่านั้น อย่าทำเหมือนนึกเรื่องเก่าออก` |
| `online === false` | `ตอนนี้คิดอยู่ลำพังในเครื่อง ไม่ได้ต่อโลกข้างนอก ความรู้จำกัดแค่ที่มีอยู่ในตัว เรื่องสดๆ หรือข้อมูลภายนอกอย่ายืนยันว่าแน่` |
| `llm === 'remote'` | `กำลังคิดผ่านโมเดลทางไกล — ตอบได้ลื่นขึ้น แต่ระวังเรื่องความเป็นส่วนตัว` |
| `isMemoryOld(memoryAgeMs)` | `ไม่ได้คุยกันมานานแล้ว ความทรงจำล่าสุดเป็นของเก่า อย่าทึกทักว่าเรื่องในความจำยังเป็นปัจจุบัน เช็กกับสิ่งที่ผู้ใช้พูดตอนนี้ก่อน` |

Tone is self-instruction ("บอกตามที่จำได้", "อย่าฟันธง") — never emotion ("รู้สึกเบลอ") — so the model doesn't read it as roleplay.

**Examples**

Nominal (no directive line):
```
[Self-state]
สถานะตอนนี้: ออนไลน์ · คิดด้วยสมองในเครื่อง · ความจำเชิงความหมายพร้อม · ข่าวสภาพแวดล้อมสด (อัปเดต ~12 นาทีก่อน) · ความทรงจำล่าสุด ~3 ชั่วโมงก่อน
```

Newborn (online+local, but no episodic + no worldlog + never consolidated): feed & embeddings are `unavailable` → off-nominal (clauses emitted); memory `null` → facts-only, no clause:
```
[Self-state]
สถานะตอนนี้: ออนไลน์ · คิดด้วยสมองในเครื่อง · ยังไม่มีความจำเชิงความหมาย · ไม่มีข่าวสภาพแวดล้อม · ยังไม่มีความทรงจำ
(ปรับท่าที: ตอนนี้ไม่ได้รับข่าวสภาพแวดล้อมเลย อย่าแต่งสภาพอากาศหรือรอบตัวขึ้นมา ถ้าไม่รู้ก็บอกว่าไม่รู้ ยังไม่มีความจำเชิงความหมายให้ค้น เรื่องที่ยกมาเป็นของใหม่หรือของล่าสุดเท่านั้น อย่าทำเหมือนนึกเรื่องเก่าออก)
```

**First-run rationale:** `embeddings`/`worldFeed` `unavailable` carry real epistemic content ("nothing to retrieve / no sense of outside") and the same clause is correct whether the cause is newborn or mid-session loss — so they fire. `memoryAgeMs === null` is the *only* representation of "engine never ticked" and can't be told apart from a healthy newborn, so it stays silent to avoid nagging every new persona.

## Assembly integration

**`assembleInject`** (`labrespond.ts`) gains a trailing param and one gated prepend; stays pure:
```ts
export function assembleInject(ctx, t, now, selfStateBlock = '') {
  // …filtered + body unchanged…
  const parts: string[] = [];
  if (t.selfState && selfStateBlock) parts.push(selfStateBlock);   // NEW — very top
  if (t.time && t.timePos === 'top') parts.push(timeNoteTop(now));
  if (body) parts.push(body);
  if (t.time && t.timePos === 'end') parts.push(timeDirective(now));
  return { inject: parts.join('\n\n'), tail: t.tail ? ctx.tail : [] };
}
```
Resulting order: `[Self-state]` → `[Current time]` → `formatInjection` body → time-end directive.

**`labRespond`** wiring (IO boundary gathers+formats, then passes the string):
```ts
const t = getLabToggles();
const now = Date.now();
const ctx = await engine.retrieve(text);
const selfStateBlock = t.selfState ? formatSelfState(await gatherSelfState(ns)) : '';
const { inject, tail } = assembleInject(ctx, t, now, selfStateBlock);
```
Gathering runs only when `t.selfState` is on → toggle-off is true zero-cost recovery. The block flows into the existing `setRaw(lastFedKey)` / `devlog('last-fed')` payloads via `inject` with no change to those lines. Add `import { formatSelfState, gatherSelfState } from './selfstate'`.

**`config.ts`** — `LabToggles` gains `selfState: boolean`; `DEFAULT_TOGGLES.selfState = true`. `getLabToggles()` already spreads defaults, so pre-existing `nc.lab` localStorage inherits `selfState: true` (no migration).

**`ui/debug.ts`** — `toggle()` key union adds `'selfState'`; add `toggle('selfState', '🪞 self-state (รู้ตัวเอง)')` to the Lab section (distinct from `🧬 self`, which gates the engine self-tier). Body unchanged.

## Files touched

| File | Change | Engine? |
|---|---|---|
| `web/src/lib/selfstate.ts` | **NEW** — `SelfState` + unions + `DAY_MS`; pure `llmKind`/`classifyEmbeddings`/`classifyWorldFeed`/`isMemoryOld`/`fmtAge`/`formatSelfState`; IO `gatherSelfState(ns)`. | — |
| `web/test/selfstate.test.ts` | **NEW** — classifiers + `fmtAge` + `formatSelfState` (pure, literal fixtures). | — |
| `web/src/lib/config.ts` | `LabToggles.selfState`; `DEFAULT_TOGGLES.selfState = true`. | — |
| `web/src/lib/labrespond.ts` | import; read `t`/`now` once; build `selfStateBlock` when `t.selfState`; `assembleInject` gains `selfStateBlock=''` + top prepend. | — |
| `web/src/ui/debug.ts` | `toggle()` key union + one `toggle('selfState', …)`. | — |
| `web/test/labrespond.test.ts` | `ALL` fixture gains `selfState: true`; add `assembleInject — self-state block` describe. | — |
| **engine** | **UNTOUCHED** (36 tests stay green). Hard constraint. | frozen |

## Test plan (vitest, pure fns tested directly)

**`web/test/selfstate.test.ts`** — import classifiers + `AMBIENT` (boundary, never a literal) + `DAY_MS`.

- `classifyWorldFeed`: fresh below boundary · fresh exactly at `AMBIENT.ambientRefreshMs` · stale above · `null` → unavailable.
- `classifyEmbeddings`: `[0.1,0.2]` → ready · `null` → degraded · `undefined` → unavailable.
- `llmKind`: `http://localhost:11434/v1` → local · `http://127.0.0.1…` → local · `https://api.openai.com/v1` → remote · `''` → remote.
- `isMemoryOld`: `null` → false · `DAY_MS - 1` → false · `DAY_MS + 1` → true.
- `fmtAge`: `null` → `ยังไม่มี` · `12*60_000` → `12 นาที` · `3*3600_000` → `3 ชั่วโมง` · `2*DAY_MS` → `2 วัน` · negative → `0`-floored (no negative shown).
- `formatSelfState` over a `NOMINAL` fixture `{online:true, llm:'local', embeddings:'ready', worldFeed:'fresh', worldFeedAgeMs:12*60_000, memoryAgeMs:3*3600_000}`:
  - always shows all 5 facts labels;
  - feed-age renders `อัปเดต ~12 นาทีก่อน`; memory renders `ความทรงจำล่าสุด ~3 ชั่วโมงก่อน`;
  - stale feed (`worldFeedAgeMs:3*3600_000`) renders `~3 ชั่วโมงก่อน` and does **NOT** contain `ชั่วโมง นาที` (regression guard);
  - nominal → no `(ปรับท่าที:`;
  - `memoryAgeMs:null` (else nominal) → contains `ยังไม่มีความทรงจำ`, no `(ปรับท่าที:`;
  - each single off-nominal flip asserts `(ปรับท่าที:` **and** its specific cue: offline→`คิดอยู่ลำพังในเครื่อง` · remote→`ความเป็นส่วนตัว` · degraded→`อย่าฟันธงว่าจำได้เป๊ะ` · embeddings-unavailable→`อย่าทำเหมือนนึกเรื่องเก่าออก` · stale→`อย่าพูดเหมือนเห็นสดๆ` · feed-unavailable→`อย่าแต่งสภาพอากาศ` · old-memory (`memoryAgeMs:DAY_MS+1`)→`อย่าทึกทักว่าเรื่องในความจำยังเป็นปัจจุบัน`;
  - multi off-nominal (`online:false, embeddings:'degraded'`) → both cues present in one directive line;
  - newborn fixture `{online:true, llm:'local', embeddings:'unavailable', worldFeed:'unavailable', worldFeedAgeMs:null, memoryAgeMs:null}` → 3 empty-state facts present; directive present with feed+embeddings clauses; **NOT** the old-memory cue.

**`web/test/labrespond.test.ts`** — `ALL` fixture adds `selfState: true`; `const SELF_BLOCK = '[Self-state]\nสถานะตอนนี้: ออนไลน์'`:
- selfState on + block → `inject.indexOf('[Self-state]') === 0` and `< indexOf('[Current time:') < indexOf('[Who you are]')`;
- selfState off (block passed) → no `[Self-state]`, time reclaims top;
- empty block (toggle on) → no `[Self-state]`;
- 3-arg call (no 4th arg) → unchanged (regression).

Success = `npm test` green (new + existing) · `tsc` 0 errors · engine 36 tests untouched.

## Prompt hygiene follow-up — OUT OF SCOPE

**Nothing here is built this round.** All blocks the model sees (`[Who you are]`, `[Relevant memories]`, `[You are anticipating]`) come from `formatInjection()` **inside the frozen engine**, so none can be fixed without first adding a **web-local `formatInject()`** — itself a separate future PR. Captured from this session's real `devlog('last-fed')` output as a paper trail:

1. **Weak block boundaries** — parts join with blank lines only; no authority/precedence signal separates ground truth from retrieved material. → stronger delimiters in a web-local formatter.
2. **`[Relevant memories]` reads as fact** — observed: stale memory `"หิวอ่ะ"` sat beside live context as truth. → prefix a "candidate memories — use only when relevant" disclaimer. (The new self-state `embeddings`/`old-memory` directives partially mitigate from the self-side but don't change presentation.)
3. **`[You are anticipating]` over-injects** — observed: **12 intents in one turn**, mixed Thai/English imperatives. → re-frame as low-authority `[Possible continuation hints]` that must not override the latest user message; cap/dedupe/normalize.
4. **Minor: salience = 1000000** — z-score explodes when baseline variance ≈ 0 / `EPS = 1e-6`. → clamp near-zero-variance in the ambient code. Note-only; unrelated to the injection seam.

## Success criteria

- 5 signals derive correctly from live runtime with **zero engine edits** (all in `selfstate.ts`).
- `[Self-state]` block at the **very top** (proven by `assembleInject` ordering test).
- Single `selfState` toggle **defaults ON**; off → raw engine+time behavior (zero IO).
- Memory directive fires **only `> 24h`** (`isMemoryOld`); `null` newborn is facts-only — pinned by tests.
- Feed/memory ages render via `fmtAge` (no double-`~`, no `ชั่วโมง นาที`) — pinned by the regression guard.
- `tsc` 0 errors; new + existing web tests green; **engine 36 tests untouched**.
- Block visible in 📤 last fed and `devlog('last-fed')` (both render `inject` verbatim).
