# Self-State Grounding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give เชียงใหม่ an interoceptive `[Self-state]` text block at the top of every LLM injection — online / local-vs-remote brain / embeddings health / world-feed freshness / memory age — so the entity self-calibrates its claims (text-only, no behavioral gates).

**Architecture:** New pure-first module `web/src/lib/selfstate.ts` (mirrors the `world.ts` IO / `ambient.ts` pure split): pure classifiers + `formatSelfState` produce the block; the single IO fn `gatherSelfState(ns)` reads existing runtime state. `labRespond` gathers+formats and passes the string into the pure `assembleInject`, which prepends it above `[Current time]`. One lab toggle `selfState` (default ON) gates it. **The engine is never edited.**

**Tech Stack:** TypeScript (Vite vanilla, no framework), vitest + happy-dom + fake-indexeddb, IndexedDB storage, OpenAI-compatible local LLM (Ollama).

**Spec:** `docs/superpowers/specs/2026-06-03-neural-chat-self-state-grounding-design.md`

---

## File structure

| File | Responsibility |
|---|---|
| `web/src/lib/selfstate.ts` (NEW) | `SelfState` type + unions + `DAY_MS`; pure `llmKind`/`classifyEmbeddings`/`classifyWorldFeed`/`isMemoryOld`/`fmtAge`/`formatSelfState`; IO `gatherSelfState(ns)` |
| `web/test/selfstate.test.ts` (NEW) | Unit tests for the pure functions |
| `web/src/lib/config.ts` | `LabToggles.selfState` + `DEFAULT_TOGGLES.selfState = true` |
| `web/src/lib/labrespond.ts` | `assembleInject` 4th param + top-prepend; `labRespond` gathers/formats the block |
| `web/test/labrespond.test.ts` | `ALL` fixture + `assembleInject` self-state ordering cases |
| `web/test/config.test.ts` | default-ON assertion |
| `web/src/ui/debug.ts` | one `🪞 self-state` toggle |

**Run commands** (cwd matters — see spec gotchas): tests `cd web && npm test`; single file `cd web && npx vitest run test/selfstate.test.ts`; typecheck `cd web && npx tsc --noEmit`.

---

### Task 1: Pure classifiers + `fmtAge` in `selfstate.ts`

**Files:**
- Create: `web/src/lib/selfstate.ts`
- Create (test): `web/test/selfstate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/test/selfstate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { AMBIENT } from '../src/lib/config';
import {
  llmKind, classifyEmbeddings, classifyWorldFeed, isMemoryOld, fmtAge, DAY_MS,
} from '../src/lib/selfstate';

const NOW = 1_000_000_000;

describe('llmKind', () => {
  it('local for localhost', () => expect(llmKind('http://localhost:11434/v1')).toBe('local'));
  it('local for 127.0.0.1', () => expect(llmKind('http://127.0.0.1:11434/v1')).toBe('local'));
  it('local for ::1', () => expect(llmKind('http://[::1]:11434/v1')).toBe('local'));
  it('remote for public https', () => expect(llmKind('https://api.openai.com/v1')).toBe('remote'));
  it('remote for unparseable (conservative)', () => expect(llmKind('')).toBe('remote'));
});

describe('classifyEmbeddings', () => {
  it('ready for a non-null vector', () => expect(classifyEmbeddings([0.1, 0.2])).toBe('ready'));
  it('degraded when latest embedding is null', () => expect(classifyEmbeddings(null)).toBe('degraded'));
  it('unavailable when no episodic at all', () => expect(classifyEmbeddings(undefined)).toBe('unavailable'));
});

describe('classifyWorldFeed', () => {
  it('fresh below boundary', () => expect(classifyWorldFeed(NOW - (AMBIENT.ambientRefreshMs - 1), NOW)).toBe('fresh'));
  it('fresh exactly at boundary', () => expect(classifyWorldFeed(NOW - AMBIENT.ambientRefreshMs, NOW)).toBe('fresh'));
  it('stale above boundary', () => expect(classifyWorldFeed(NOW - (AMBIENT.ambientRefreshMs + 1), NOW)).toBe('stale'));
  it('unavailable when null', () => expect(classifyWorldFeed(null, NOW)).toBe('unavailable'));
});

describe('isMemoryOld', () => {
  it('false when null (newborn)', () => expect(isMemoryOld(null)).toBe(false));
  it('false at one day boundary', () => expect(isMemoryOld(DAY_MS - 1)).toBe(false));
  it('true past one day', () => expect(isMemoryOld(DAY_MS + 1)).toBe(true));
});

describe('fmtAge', () => {
  it('null sentinel', () => expect(fmtAge(null)).toBe('ยังไม่มี'));
  it('minutes bucket', () => expect(fmtAge(12 * 60_000)).toBe('12 นาที'));
  it('hours bucket', () => expect(fmtAge(3 * 60 * 60_000)).toBe('3 ชั่วโมง'));
  it('days bucket', () => expect(fmtAge(2 * DAY_MS)).toBe('2 วัน'));
  it('floors negative at 0', () => expect(fmtAge(-5)).toBe('0 นาที'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run test/selfstate.test.ts`
Expected: FAIL — cannot resolve `../src/lib/selfstate` (file does not exist yet).

- [ ] **Step 3: Write the minimal implementation**

Create `web/src/lib/selfstate.ts`:

```ts
import { AMBIENT } from './config';

export type WorldFeedHealth  = 'fresh' | 'stale' | 'unavailable';
export type EmbeddingsHealth = 'ready' | 'degraded' | 'unavailable';
export type LlmKind          = 'local' | 'remote';

export interface SelfState {
  online: boolean;
  llm: LlmKind;
  embeddings: EmbeddingsHealth;
  worldFeed: WorldFeedHealth;
  worldFeedAgeMs: number | null;   // display age; null ⇔ worldFeed === 'unavailable'
  memoryAgeMs: number | null;      // now - lastTick; null when lastTick === 0 (newborn)
}

export const DAY_MS = 24 * 60 * 60_000;   // the one new literal this round

/** Loopback host (localhost / 127.* / ::1) ⇒ local, else remote. Unparseable ⇒ remote (can't prove locality). */
export function llmKind(baseURL: string): LlmKind {
  try {
    const host = new URL(baseURL).hostname.replace(/^\[|\]$/g, '').toLowerCase();
    return host === 'localhost' || host === '::1' || host.startsWith('127.') ? 'local' : 'remote';
  } catch {
    return 'remote';
  }
}

/** From the LATEST single episodic's embedding (spec decision 5). undefined = no episodic at all. */
export function classifyEmbeddings(latestEmbedding: number[] | null | undefined): EmbeddingsHealth {
  if (latestEmbedding === undefined) return 'unavailable';
  if (latestEmbedding === null) return 'degraded';
  return 'ready';
}

/** Boundary reuses AMBIENT.ambientRefreshMs (inclusive on fresh), mirroring observe()'s throttle. */
export function classifyWorldFeed(newestWorldTs: number | null, now: number): WorldFeedHealth {
  if (newestWorldTs === null) return 'unavailable';
  return now - newestWorldTs <= AMBIENT.ambientRefreshMs ? 'fresh' : 'stale';
}

export function isMemoryOld(memoryAgeMs: number | null): boolean {
  return memoryAgeMs !== null && memoryAgeMs > DAY_MS;
}

/** Coarse human bucket, NO leading '~' (templates add it). null sentinel; negatives floored at 0. */
export function fmtAge(ms: number | null): string {
  if (ms === null) return 'ยังไม่มี';
  const m = Math.max(0, ms);
  if (m < 60 * 60_000) return `${Math.round(m / 60_000)} นาที`;
  if (m < DAY_MS) return `${Math.round(m / (60 * 60_000))} ชั่วโมง`;
  return `${Math.round(m / DAY_MS)} วัน`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run test/selfstate.test.ts`
Expected: PASS (all `describe` blocks green).

- [ ] **Step 5: Commit**

```bash
git -C <repo-root> add web/src/lib/selfstate.ts web/test/selfstate.test.ts
git -C <repo-root> commit -m "feat(web): self-state pure classifiers + fmtAge"
```

---

### Task 2: `formatSelfState` — the `[Self-state]` block

**Files:**
- Modify: `web/src/lib/selfstate.ts` (append `formatSelfState`)
- Modify (test): `web/test/selfstate.test.ts` (append `formatSelfState` describe)

- [ ] **Step 1: Write the failing test**

Append to `web/test/selfstate.test.ts`:

```ts
import { formatSelfState } from '../src/lib/selfstate';
import type { SelfState } from '../src/lib/selfstate';

const NOMINAL: SelfState = {
  online: true, llm: 'local', embeddings: 'ready',
  worldFeed: 'fresh', worldFeedAgeMs: 12 * 60_000, memoryAgeMs: 3 * 60 * 60_000,
};

describe('formatSelfState', () => {
  it('always shows all 5 facts labels', () => {
    const b = formatSelfState(NOMINAL);
    for (const cue of ['ออนไลน์', 'คิดด้วยสมองในเครื่อง', 'ความจำเชิงความหมายพร้อม', 'ข่าวสภาพแวดล้อมสด', 'ความทรงจำล่าสุด']) {
      expect(b).toContain(cue);
    }
    expect(b.startsWith('[Self-state]')).toBe(true);
  });

  it('renders feed + memory ages via fmtAge', () => {
    const b = formatSelfState(NOMINAL);
    expect(b).toContain('อัปเดต ~12 นาทีก่อน');
    expect(b).toContain('ความทรงจำล่าสุด ~3 ชั่วโมงก่อน');
  });

  it('stale feed renders hours, never the broken "ชั่วโมง นาที"', () => {
    const b = formatSelfState({ ...NOMINAL, worldFeed: 'stale', worldFeedAgeMs: 3 * 60 * 60_000 });
    expect(b).toContain('ข่าวสภาพแวดล้อมเก่า (อัปเดต ~3 ชั่วโมงก่อน)');
    expect(b).not.toContain('ชั่วโมง นาที');
  });

  it('nominal → no directive line', () => {
    expect(formatSelfState(NOMINAL)).not.toContain('(ปรับท่าที:');
  });

  it('null memory age (newborn) is facts-only, not off-nominal', () => {
    const b = formatSelfState({ ...NOMINAL, memoryAgeMs: null });
    expect(b).toContain('ยังไม่มีความทรงจำ');
    expect(b).not.toContain('(ปรับท่าที:');
  });

  it.each([
    ['offline',            { online: false } as Partial<SelfState>,            'คิดอยู่ลำพังในเครื่อง'],
    ['remote llm',         { llm: 'remote' } as Partial<SelfState>,            'ความเป็นส่วนตัว'],
    ['degraded embeddings',{ embeddings: 'degraded' } as Partial<SelfState>,   'อย่าฟันธงว่าจำได้เป๊ะ'],
    ['no embeddings',      { embeddings: 'unavailable' } as Partial<SelfState>,'อย่าทำเหมือนนึกเรื่องเก่าออก'],
    ['stale feed',         { worldFeed: 'stale', worldFeedAgeMs: 3 * 60 * 60_000 } as Partial<SelfState>, 'อย่าพูดเหมือนเห็นสดๆ'],
    ['no feed',            { worldFeed: 'unavailable', worldFeedAgeMs: null } as Partial<SelfState>,      'อย่าแต่งสภาพอากาศ'],
    ['old memory',         { memoryAgeMs: DAY_MS + 1 } as Partial<SelfState>,  'อย่าทึกทักว่าเรื่องในความจำยังเป็นปัจจุบัน'],
  ])('off-nominal %s → directive present + its cue', (_name, patch, cue) => {
    const b = formatSelfState({ ...NOMINAL, ...patch });
    expect(b).toContain('(ปรับท่าที:');
    expect(b).toContain(cue);
  });

  it('multiple off-nominal signals share one directive line', () => {
    const b = formatSelfState({ ...NOMINAL, online: false, embeddings: 'degraded' });
    expect(b).toContain('คิดอยู่ลำพังในเครื่อง');
    expect(b).toContain('อย่าฟันธงว่าจำได้เป๊ะ');
    expect(b.match(/\(ปรับท่าที:/g)).toHaveLength(1);
  });

  it('newborn: feed+embeddings clauses fire, memory clause does NOT', () => {
    const NEWBORN: SelfState = {
      online: true, llm: 'local', embeddings: 'unavailable',
      worldFeed: 'unavailable', worldFeedAgeMs: null, memoryAgeMs: null,
    };
    const b = formatSelfState(NEWBORN);
    expect(b).toContain('ยังไม่มีความจำเชิงความหมาย');
    expect(b).toContain('ไม่มีข่าวสภาพแวดล้อม');
    expect(b).toContain('ยังไม่มีความทรงจำ');
    expect(b).toContain('(ปรับท่าที:');
    expect(b).toContain('อย่าแต่งสภาพอากาศ');
    expect(b).toContain('อย่าทำเหมือนนึกเรื่องเก่าออก');
    expect(b).not.toContain('อย่าทึกทักว่าเรื่องในความจำยังเป็นปัจจุบัน');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run test/selfstate.test.ts`
Expected: FAIL — `formatSelfState is not a function` / not exported.

- [ ] **Step 3: Write the minimal implementation**

Append to `web/src/lib/selfstate.ts`:

```ts
/** PURE: SelfState → the [Self-state] block. Facts line always; one (ปรับท่าที: …) line only when off-nominal. */
export function formatSelfState(s: SelfState): string {
  const facts = [
    s.online ? 'ออนไลน์' : 'ออฟไลน์',
    s.llm === 'local' ? 'คิดด้วยสมองในเครื่อง' : 'คิดด้วยสมองทางไกล',
    s.embeddings === 'ready' ? 'ความจำเชิงความหมายพร้อม'
      : s.embeddings === 'degraded' ? 'ความจำเชิงความหมายไม่ครบ'
      : 'ยังไม่มีความจำเชิงความหมาย',
    s.worldFeed === 'fresh' ? `ข่าวสภาพแวดล้อมสด (อัปเดต ~${fmtAge(s.worldFeedAgeMs)}ก่อน)`
      : s.worldFeed === 'stale' ? `ข่าวสภาพแวดล้อมเก่า (อัปเดต ~${fmtAge(s.worldFeedAgeMs)}ก่อน)`
      : 'ไม่มีข่าวสภาพแวดล้อม',
    s.memoryAgeMs === null ? 'ยังไม่มีความทรงจำ' : `ความทรงจำล่าสุด ~${fmtAge(s.memoryAgeMs)}ก่อน`,
  ];

  // order: feed → embeddings → connectivity → memory
  const dir: string[] = [];
  if (s.worldFeed === 'stale')        dir.push('ข่าวสภาพแวดล้อมเก่าแล้ว ถ้าจะเล่าเรื่องอากาศหรือรอบตัว บอกตามที่จำได้ อย่าพูดเหมือนเห็นสดๆ ตอนนี้');
  if (s.worldFeed === 'unavailable')  dir.push('ตอนนี้ไม่ได้รับข่าวสภาพแวดล้อมเลย อย่าแต่งสภาพอากาศหรือรอบตัวขึ้นมา ถ้าไม่รู้ก็บอกว่าไม่รู้');
  if (s.embeddings === 'degraded')    dir.push('การค้นความจำตอนนี้อาจไม่แม่น ถ้าดึงเรื่องเก่ามาเล่า เผื่อใจว่าอาจคลาดเคลื่อน อย่าฟันธงว่าจำได้เป๊ะ');
  if (s.embeddings === 'unavailable') dir.push('ยังไม่มีความจำเชิงความหมายให้ค้น เรื่องที่ยกมาเป็นของใหม่หรือของล่าสุดเท่านั้น อย่าทำเหมือนนึกเรื่องเก่าออก');
  if (!s.online)                      dir.push('ตอนนี้คิดอยู่ลำพังในเครื่อง ไม่ได้ต่อโลกข้างนอก ความรู้จำกัดแค่ที่มีอยู่ในตัว เรื่องสดๆ หรือข้อมูลภายนอกอย่ายืนยันว่าแน่');
  if (s.llm === 'remote')             dir.push('กำลังคิดผ่านโมเดลทางไกล — ตอบได้ลื่นขึ้น แต่ระวังเรื่องความเป็นส่วนตัว');
  if (isMemoryOld(s.memoryAgeMs))     dir.push('ไม่ได้คุยกันมานานแล้ว ความทรงจำล่าสุดเป็นของเก่า อย่าทึกทักว่าเรื่องในความจำยังเป็นปัจจุบัน เช็กกับสิ่งที่ผู้ใช้พูดตอนนี้ก่อน');

  const lines = ['[Self-state]', `สถานะตอนนี้: ${facts.join(' · ')}`];
  if (dir.length) lines.push(`(ปรับท่าที: ${dir.join(' ')})`);
  return lines.join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run test/selfstate.test.ts`
Expected: PASS (all cases incl. newborn + multi off-nominal).

- [ ] **Step 5: Commit**

```bash
git -C <repo-root> add web/src/lib/selfstate.ts web/test/selfstate.test.ts
git -C <repo-root> commit -m "feat(web): formatSelfState — facts line + conditional self-directive"
```

---

### Task 3: `gatherSelfState(ns)` — the IO read

**Files:**
- Modify: `web/src/lib/selfstate.ts` (append `gatherSelfState` + imports)

No unit test (IO fn — same rationale that leaves `world.ts`/`observe()` untested). Verified by `tsc` here and the live smoke in Task 7.

- [ ] **Step 1: Add imports at the top of `selfstate.ts`**

Change the import block at the top of `web/src/lib/selfstate.ts` from:

```ts
import { AMBIENT } from './config';
```
to:
```ts
import { AMBIENT, getActiveProfile } from './config';
import { makeStorage, getRaw } from './storage';
import type { WorldSnapshot } from './world';
```

- [ ] **Step 2: Append `gatherSelfState`**

```ts
/** The ONLY IO fn here (mirrors world.ts IO vs ambient.ts pure). Reads live runtime → SelfState. */
export async function gatherSelfState(ns: string): Promise<SelfState> {
  const now = Date.now();
  const online = navigator.onLine;
  const llm = llmKind(getActiveProfile().chat.baseURL);

  const snap = await makeStorage(ns).load();
  const latest = snap.episodic.length
    ? snap.episodic.reduce((a, b) => (b.createdAt > a.createdAt ? b : a))
    : undefined;
  const embeddings = classifyEmbeddings(latest?.embedding);

  const log = await getRaw<WorldSnapshot[]>('worldlog:' + ns);
  const newestWorldTs = log && log.length ? log[log.length - 1]!.ts : null;
  const worldFeed = classifyWorldFeed(newestWorldTs, now);
  const worldFeedAgeMs = newestWorldTs === null ? null : now - newestWorldTs;

  const memoryAgeMs = snap.lastTick === 0 ? null : now - snap.lastTick;

  return { online, llm, embeddings, worldFeed, worldFeedAgeMs, memoryAgeMs };
}
```

- [ ] **Step 3: Typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: 0 errors (confirms `WorldSnapshot`, `makeStorage`, `getRaw`, `getActiveProfile` all resolve and `latest?.embedding` matches `classifyEmbeddings`' param type).

- [ ] **Step 4: Commit**

```bash
git -C <repo-root> add web/src/lib/selfstate.ts
git -C <repo-root> commit -m "feat(web): gatherSelfState — interoceptive IO read"
```

---

### Task 4: `LabToggles.selfState` (default ON)

**Files:**
- Modify: `web/src/lib/config.ts`
- Modify (test): `web/test/config.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `web/test/config.test.ts`:

```ts
import { getLabToggles } from '../src/lib/config';

describe('LabToggles selfState default', () => {
  it('defaults selfState ON', () => {
    localStorage.removeItem('nc.lab');
    expect(getLabToggles().selfState).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run test/config.test.ts`
Expected: FAIL — `selfState` is `undefined` (not yet in `DEFAULT_TOGGLES`), so `toBe(true)` fails. (May also be a type error on `getLabToggles().selfState` — that is an acceptable red.)

- [ ] **Step 3: Implement — add the field + default**

In `web/src/lib/config.ts`, change the `LabToggles` interface:

```ts
export interface LabToggles { time: boolean; timePos: 'top' | 'end'; self: boolean; episodic: boolean; prospective: boolean; tail: boolean; selfState: boolean }
```

and the default:

```ts
const DEFAULT_TOGGLES: LabToggles = { time: true, timePos: 'top', self: true, episodic: true, prospective: true, tail: true, selfState: true };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run test/config.test.ts`
Expected: PASS. (`getLabToggles()` already spreads `{ ...DEFAULT_TOGGLES, ...stored }`, so old localStorage inherits `selfState: true` — no migration.)

- [ ] **Step 5: Commit**

```bash
git -C <repo-root> add web/src/lib/config.ts web/test/config.test.ts
git -C <repo-root> commit -m "feat(web): LabToggles.selfState (default ON)"
```

---

### Task 5: `assembleInject` 4th param + `labRespond` wiring

**Files:**
- Modify: `web/src/lib/labrespond.ts`
- Modify (test): `web/test/labrespond.test.ts`

- [ ] **Step 1: Write the failing test**

In `web/test/labrespond.test.ts`, first update the `ALL` fixture (add `selfState: true`):

```ts
const ALL: LabToggles = { time: true, timePos: 'top', self: true, episodic: true, prospective: true, tail: true, selfState: true };
```

Then append a new describe block:

```ts
const SELF_BLOCK = '[Self-state]\nสถานะตอนนี้: ออนไลน์';

describe('assembleInject — self-state block', () => {
  it('prepends the block at the very TOP when selfState on and block non-empty', () => {
    const { inject } = assembleInject(ctx, ALL, 1000, SELF_BLOCK);
    expect(inject.indexOf('[Self-state]')).toBe(0);
    expect(inject.indexOf('[Self-state]')).toBeLessThan(inject.indexOf('[Current time:'));
    expect(inject.indexOf('[Current time:')).toBeLessThan(inject.indexOf('[Who you are]'));
  });

  it('omits the block when selfState toggle is off (even if a block is passed)', () => {
    const { inject } = assembleInject(ctx, { ...ALL, selfState: false }, 1000, SELF_BLOCK);
    expect(inject).not.toContain('[Self-state]');
    expect(inject.indexOf('[Current time:')).toBe(0);
  });

  it('omits the block when the block string is empty', () => {
    const { inject } = assembleInject(ctx, ALL, 1000, '');
    expect(inject).not.toContain('[Self-state]');
  });

  it('3-arg call is unchanged (selfStateBlock defaults to "")', () => {
    const { inject } = assembleInject(ctx, ALL, 1000);
    expect(inject).not.toContain('[Self-state]');
    expect(inject.indexOf('[Current time:')).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run test/labrespond.test.ts`
Expected: FAIL — the self-state block is never prepended (`indexOf('[Self-state]')` is `-1`, not `0`).

- [ ] **Step 3: Implement — `assembleInject` signature + gate**

In `web/src/lib/labrespond.ts`, change the `assembleInject` signature and add the prepend as the FIRST part:

```ts
export function assembleInject(ctx: InjectionContext, t: LabToggles, now: number, selfStateBlock = ''): { inject: string; tail: Message[] } {
  const filtered: InjectionContext = {
    selfTier: t.self ? ctx.selfTier : [],
    episodic: t.episodic ? ctx.episodic : [],
    prospective: t.prospective ? ctx.prospective : [],
    tail: ctx.tail,
  };
  const body = formatInjection(filtered); // never includes tail or time
  const parts: string[] = [];
  if (t.selfState && selfStateBlock) parts.push(selfStateBlock); // [Self-state] — very top, above [Current time]
  if (t.time && t.timePos === 'top') parts.push(timeNoteTop(now));
  if (body) parts.push(body);
  if (t.time && t.timePos === 'end') parts.push(timeDirective(now));
  return { inject: parts.join('\n\n'), tail: t.tail ? ctx.tail : [] };
}
```

- [ ] **Step 4: Implement — `labRespond` gathers + passes the block**

Add the import near the top of `web/src/lib/labrespond.ts` (after the existing imports):

```ts
import { formatSelfState, gatherSelfState } from './selfstate';
```

Then change the start of `labRespond`'s body from:

```ts
  await engine.ingestUser(text);
  const ctx = await engine.retrieve(text);
  const { inject, tail } = assembleInject(ctx, getLabToggles(), Date.now());
  await setRaw(lastFedKey(ns), { system: systemPrompt, inject, tailCount: tail.length, at: Date.now() } satisfies LastFed);
```
to:
```ts
  await engine.ingestUser(text);
  const t = getLabToggles();
  const now = Date.now();
  const ctx = await engine.retrieve(text);
  const selfStateBlock = t.selfState ? formatSelfState(await gatherSelfState(ns)) : '';
  const { inject, tail } = assembleInject(ctx, t, now, selfStateBlock);
  await setRaw(lastFedKey(ns), { system: systemPrompt, inject, tailCount: tail.length, at: now } satisfies LastFed);
```

(The `devlog('last-fed', …)` line directly below is unchanged — it already serializes `inject`, so the block flows into the dev log for free.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd web && npx vitest run test/labrespond.test.ts`
Expected: PASS — new ordering cases green AND the 4 pre-existing `assembleInject` cases still green.

- [ ] **Step 6: Commit**

```bash
git -C <repo-root> add web/src/lib/labrespond.ts web/test/labrespond.test.ts
git -C <repo-root> commit -m "feat(web): inject [Self-state] block at top via labRespond"
```

---

### Task 6: `🪞 self-state` toggle in the memory pane

**Files:**
- Modify: `web/src/ui/debug.ts`

UI wiring; no unit test (consistent with the existing untested `debug.ts`). Verified by `tsc` + the Task 7 live check.

- [ ] **Step 1: Widen the `toggle()` key union**

In `web/src/ui/debug.ts`, change:

```ts
    const toggle = (key: 'time' | 'self' | 'episodic' | 'prospective' | 'tail', label: string): HTMLElement => {
```
to:
```ts
    const toggle = (key: 'time' | 'self' | 'episodic' | 'prospective' | 'tail' | 'selfState', label: string): HTMLElement => {
```

- [ ] **Step 2: Add the toggle to the Lab section (placed first, mirroring its top position)**

Change:

```ts
      toggle('time', '⏱ time'), posSel,
```
to:
```ts
      toggle('selfState', '🪞 self-state (รู้ตัวเอง)'),
      toggle('time', '⏱ time'), posSel,
```

- [ ] **Step 3: Typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git -C <repo-root> add web/src/ui/debug.ts
git -C <repo-root> commit -m "feat(web): 🪞 self-state lab toggle in memory pane"
```

---

### Task 7: Full verification + live smoke

**Files:** none (verification only).

- [ ] **Step 1: Full web test suite + typecheck**

Run: `cd web && npx tsc --noEmit && npm test`
Expected: `tsc` 0 errors; all web tests green (selfstate, labrespond, config, ambient, world, storage, models, personas, engine).

- [ ] **Step 2: Engine untouched check**

Run: `git -C <repo-root> status --porcelain engine/`
Expected: empty output (no engine files modified). Hard constraint.

- [ ] **Step 3: Live smoke via devlog (the real prompt)**

With Ollama running and `cd web && npm run dev` up, open `http://localhost:5173/`, send one message, then:

Run: `python3 -c "import json; [print(json.loads(l)['data'].get('inject','')[:400]) for l in open('web/.debug/dev.log') if json.loads(l)['tag']=='last-fed'][-1:]"`
Expected: the latest `last-fed` `inject` STARTS with `[Self-state]\nสถานะตอนนี้: …` above `[Current time: …]`. Confirms the block is fed to the LLM and lands in the dev log.

- [ ] **Step 4: Toggle-off recovery check**

In the 🧠 pane, uncheck `🪞 self-state`, send another message, re-run the Step-3 command.
Expected: the newest `last-fed` `inject` no longer contains `[Self-state]`; `[Current time:` is back at the top — proving toggle-off restores raw engine+time behavior.

- [ ] **Step 5: Final commit (if any verification tweaks were needed)**

```bash
git -C <repo-root> status   # expect clean working tree if no tweaks
```

---

## Self-review notes

- **Spec coverage:** 5 signals → Task 1 (`classify*`/`fmtAge`) + Task 3 (`gatherSelfState`); block format → Task 2; top placement + purity → Task 5; toggle default-ON → Task 4; UI surface → Task 6; engine-untouched + visibility-in-last-fed/devlog → Task 7. Out-of-scope hygiene items are intentionally NOT in this plan (deferred per spec).
- **No new literals beyond `DAY_MS`** (defined Task 1); the world-feed boundary reuses `AMBIENT.ambientRefreshMs`.
- **Type consistency:** `SelfState` (6 fields) defined Task 1, consumed identically in Tasks 2/3/5; `selfState` toggle name identical across Tasks 4/5/6; `selfStateBlock` param name identical across the assembleInject signature and the labRespond call.
- `<repo-root>` = `/Users/v1b3_/_dev/project-world-log/side-projects/neural-chat` (use `git -C` to avoid cwd drift; run vitest/tsc from `web/`).
