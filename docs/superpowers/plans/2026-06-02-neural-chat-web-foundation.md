# neural-chat web — Foundation (Phase 0+1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a plain-web (Vite vanilla, no React) chat app that talks to the **เชียงใหม่** persona through the existing living-memory engine, with streaming, IndexedDB persistence, a uicp drawer (persona switch + `ModelProfile` selector), and a verified embeddings path. (Phase 2 — the ambient world-oracle — is a separate plan: `2026-06-02-neural-chat-web-ambient-oracle.md`, written after this is green.)

**Architecture:** A new `web/` directory sibling to `engine/` and `mobile/`. The engine is consumed unchanged via `file:../engine` (Vite resolves its `exports` map → prebuilt `dist/`). The app implements the engine's host ports for the browser (`StoragePort` over IndexedDB) and builds chat/embed ports from the active `ModelProfile`. UI is imperative DOM; uicp supplies the headless drawer (we own all CSS). Per the spec, this phase makes **zero engine changes**.

**Tech Stack:** TypeScript, Vite 6 (vanilla), `@nature-labs/uicp-core` + `@nature-labs/uicp-adapter-vanilla` 0.4.1, `@nature-labs/living-memory-engine` (file:../engine), vitest + fake-indexeddb for unit tests.

**Spec:** `docs/superpowers/specs/2026-06-02-neural-chat-web-ambient-oracle-design.md`

## File structure (created in this plan)

| File | Responsibility |
|---|---|
| `web/package.json`, `web/vite.config.ts`, `web/tsconfig.json`, `web/index.html` | scaffold |
| `web/src/main.ts` | boot: theme → mount chat → wire drawer |
| `web/src/styles.css` | all CSS (palette CSS-vars, light/dark, drawer, chat) |
| `web/src/lib/storage.ts` | `StoragePort` over IndexedDB + `getRaw/setRaw` kv |
| `web/src/lib/config.ts` | `ModelProfile` presets, active profile, keys, ambient knobs |
| `web/src/lib/personas.ts` | persona list/active/subscribe; `CHIANGMAI` seed |
| `web/src/lib/engine.ts` | `getEngine(ns, sysPrompt) → {engine, storage, chatPort}` + cache + `resetEngines` |
| `web/src/lib/theme.ts` | palette + `prefers-color-scheme` |
| `web/src/ui/chat.ts` | message list, composer, streaming render, no-key banner |
| `web/src/ui/drawer.ts` | drawer content: persona switch / +new / profile selector / key |
| `web/test/*.test.ts` | unit tests (storage, config, personas) |

All paths below are relative to the repo root `/Users/v1b3_/_dev/project-world-log/side-projects/neural-chat/`.

---

### Task 1: Phase 0 — branch, remove old React, scaffold `web/`

**Files:**
- Delete: `App.tsx`, `index.tsx`, `index.html`, `vite.config.ts`, `types.ts`, `metadata.json`, `components/`, `services/` (repo root only)
- Modify: `package.json` (root — drop old React deps)
- Create: `web/package.json`, `web/vite.config.ts`, `web/tsconfig.json`, `web/index.html`, `web/src/main.ts`, `web/src/styles.css`

- [ ] **Step 1: Create the work branch**

Run: `git -C . checkout -b feat/web-frontend 2>&1 | cat`
Expected: `Switched to a new branch 'feat/web-frontend'`

- [ ] **Step 2: Commit the design docs first (so the next deletion is recoverable)**

```bash
git add docs/superpowers/specs/2026-06-02-neural-chat-web-ambient-oracle-design.md docs/superpowers/plans/2026-06-02-neural-chat-web-foundation.md
git commit -m "docs(neural-chat): web ambient-oracle spec + foundation plan" 2>&1 | cat
```

- [ ] **Step 3: Remove the old root React prototype**

```bash
cd /Users/v1b3_/_dev/project-world-log/side-projects/neural-chat
git rm -r App.tsx index.tsx index.html vite.config.ts types.ts metadata.json components services 2>&1 | cat
```
Expected: each path is staged for deletion. (If a path is already absent, drop it from the command.)

- [ ] **Step 4: Verify the engine and mobile are untouched**

Run: `ls engine/src/engine.ts mobile/app/index.tsx 2>&1 | cat`
Expected: both paths still exist (we only removed root prototype files).

- [ ] **Step 5: Create `web/package.json`**

```json
{
  "name": "neural-chat-web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@nature-labs/living-memory-engine": "file:../engine",
    "@nature-labs/uicp-core": "^0.4.1",
    "@nature-labs/uicp-adapter-vanilla": "^0.4.1"
  },
  "devDependencies": {
    "vite": "^6.0.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "fake-indexeddb": "^6.0.0",
    "happy-dom": "^15.11.0"
  }
}
```

> Note (execution correction): also `git rm` the **root** `package.json` + `tsconfig.json` — they were the deleted prototype's manifest (`chronos-memory-chat`, react/genai/lucide) and are orphaned once the prototype is gone; `web/` is self-contained. `happy-dom` is required so the vitest unit tests (which touch `localStorage`) have a DOM environment.

- [ ] **Step 6: Create `web/vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// The engine ships prebuilt ESM dist via its exports map; excluding it from
// pre-bundling avoids esbuild choking on the linked file: package.
// happy-dom gives the unit tests localStorage + DOM (fake-indexeddb covers IndexedDB).
export default defineConfig({
  optimizeDeps: { exclude: ['@nature-labs/living-memory-engine'] },
  test: { environment: 'happy-dom' },
});
```

- [ ] **Step 7: Create `web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "noUncheckedIndexedAccess": true,
    "types": ["vite/client"],
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 8: Create `web/index.html`**

```html
<!doctype html>
<html lang="th">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>เชียงใหม่</title>
  </head>
  <body>
    <div id="app"></div>
    <aside id="drawer"></aside>
    <div class="backdrop" data-backdrop-for="drawer"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 9: Create a placeholder `web/src/styles.css`** (expanded in Task 6)

```css
:root { --bg:#faf7f2; --text:#2b2926; --accent:#7c5cff; }
* { box-sizing: border-box; }
body { margin:0; font-family: system-ui, -apple-system, sans-serif; background:var(--bg); color:var(--text); }
#drawer { position:fixed; top:0; left:0; height:100%; width:min(80vw,320px); background:#fff; transform:translateX(-100%); transition:transform .32s cubic-bezier(.32,.72,0,1); z-index:50; padding:20px; }
#drawer[data-uip-open="true"] { transform:translateX(0); }
.backdrop { position:fixed; inset:0; background:rgba(0,0,0,.4); opacity:0; visibility:hidden; transition:opacity .32s; z-index:40; }
.backdrop.uip-backdrop-open { opacity:1; visibility:visible; }
```

- [ ] **Step 10: Create a temporary `web/src/main.ts` (hello-drawer smoke test)**

```ts
import { drawerWithGestures } from '@nature-labs/uicp-adapter-vanilla';
import './styles.css';

const drawer = drawerWithGestures('#drawer', { position: 'left' });
document.querySelector('#drawer')!.innerHTML = '<h2>เชียงใหม่</h2><p>drawer works.</p>';
const app = document.querySelector('#app')!;
app.innerHTML = '<button id="menu">☰ open</button>';
app.querySelector('#menu')!.addEventListener('click', () => drawer.open());
document.querySelector('.backdrop')!.addEventListener('click', () => drawer.close());
```

- [ ] **Step 11: Install and run the dev server**

Run: `cd web && npm install 2>&1 | cat`
Expected: installs without error; `@nature-labs/living-memory-engine` links to `../engine`.

Run: `cd web && npm run dev 2>&1 | cat` (leave running; open the printed `http://localhost:5173`)
Expected (manual): page shows "☰ open"; clicking it slides the drawer in from the left; clicking the backdrop closes it.

- [ ] **Step 12: Commit**

```bash
git add web package.json 2>&1 | cat
git commit -m "feat(web): remove old React prototype, scaffold Vite vanilla + uicp drawer" 2>&1 | cat
```

---

### Task 2: `lib/storage.ts` — `StoragePort` over IndexedDB

**Files:**
- Create: `web/src/lib/storage.ts`
- Test: `web/test/storage.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// web/test/storage.test.ts
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { makeStorage, getRaw, setRaw } from '../src/lib/storage';

describe('storage', () => {
  it('returns an empty snapshot for an absent namespace', async () => {
    const s = makeStorage('nope');
    const snap = await s.load();
    expect(snap).toEqual({ messages: [], episodic: [], selfFacets: [], prospective: [], lastTick: 0 });
  });

  it('round-trips a snapshot per namespace', async () => {
    const s = makeStorage('chiangmai');
    await s.save({ messages: [{ id: 'm1', role: 'user', text: 'hi', ts: 1 }], episodic: [], selfFacets: [], prospective: [], lastTick: 5 });
    const back = await s.load();
    expect(back.lastTick).toBe(5);
    expect(back.messages[0]!.text).toBe('hi');
    // isolation: a different namespace is still empty
    expect((await makeStorage('other').load()).messages).toHaveLength(0);
  });

  it('kv get/set round-trips', async () => {
    await setRaw('k', { a: 1 });
    expect(await getRaw<{ a: number }>('k')).toEqual({ a: 1 });
    expect(await getRaw('missing')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd web && npx vitest run test/storage.test.ts 2>&1 | cat`
Expected: FAIL — cannot find `../src/lib/storage`.

- [ ] **Step 3: Implement `web/src/lib/storage.ts`**

```ts
import type { Snapshot, StoragePort } from '@nature-labs/living-memory-engine';

const DB = 'neural-chat';
const SNAP = 'snapshots';
const KV = 'kv';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SNAP)) db.createObjectStore(SNAP);
      if (!db.objectStoreNames.contains(KV)) db.createObjectStore(KV);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(db => new Promise<T>((resolve, reject) => {
    const r = fn(db.transaction(store, mode).objectStore(store));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));
}

const empty = (): Snapshot => ({ messages: [], episodic: [], selfFacets: [], prospective: [], lastTick: 0 });

export function makeStorage(namespace: string): StoragePort {
  return {
    async load() { return (await run<Snapshot>(SNAP, 'readonly', s => s.get(namespace))) ?? empty(); },
    async save(snap) { await run(SNAP, 'readwrite', s => s.put(snap, namespace)); },
  };
}

export function getRaw<T>(key: string): Promise<T | undefined> { return run<T>(KV, 'readonly', s => s.get(key)); }
export async function setRaw(key: string, value: unknown): Promise<void> { await run(KV, 'readwrite', s => s.put(value, key)); }
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd web && npx vitest run test/storage.test.ts 2>&1 | cat`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/storage.ts web/test/storage.test.ts && git commit -m "feat(web): IndexedDB StoragePort + kv helper" 2>&1 | cat
```

---

### Task 3: `lib/config.ts` — `ModelProfile` presets, keys, ambient knobs

**Files:**
- Create: `web/src/lib/config.ts`
- Test: `web/test/config.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// web/test/config.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { PROFILES, getActiveProfile, setActiveProfile, getChatCfg, getEmbedCfg, setKey } from '../src/lib/config';

beforeEach(() => localStorage.clear());

describe('config profiles', () => {
  it('defaults to the first profile (Local Ollama on this Mac)', () => {
    expect(getActiveProfile().id).toBe(PROFILES[0]!.id);
    expect(getActiveProfile().id).toBe('ollama');
  });

  it('switching profile changes resolved chat+embed cfg together', () => {
    setActiveProfile('openai');
    expect(getChatCfg().baseURL).toBe('https://api.openai.com/v1');
    expect(getEmbedCfg().model).toBe('text-embedding-3-small');
  });

  it('attaches the key only for profiles that need one', () => {
    setActiveProfile('lmstudio');
    expect(getChatCfg().apiKey).toBe('');     // local needs none
    setActiveProfile('openai');
    setKey('sk-test');
    expect(getChatCfg().apiKey).toBe('sk-test');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd web && npx vitest run test/config.test.ts 2>&1 | cat`
Expected: FAIL — cannot find `../src/lib/config`.

- [ ] **Step 3: Implement `web/src/lib/config.ts`**

```ts
export interface ModelProfile {
  id: string; label: string;
  chat: { baseURL: string; model: string };
  embed: { baseURL: string; model: string };
  needsKey?: boolean;
}

export const PROFILES: ModelProfile[] = [
  { id: 'ollama', label: 'Local (Ollama)',            // default — this Mac runs Ollama
    chat:  { baseURL: 'http://localhost:11434/v1', model: 'gemma3:4b' },
    embed: { baseURL: 'http://localhost:11434/v1', model: 'nomic-embed-text' } },
  { id: 'lmstudio', label: 'Local (LM Studio)',       // the other (4070ti) machine
    chat:  { baseURL: 'http://localhost:1234/v1', model: 'gemma-3-27b-it' },
    embed: { baseURL: 'http://localhost:1234/v1', model: 'nomic-embed-text' } },
  { id: 'openrouter', label: 'OpenRouter + local embed', needsKey: true,
    chat:  { baseURL: 'https://openrouter.ai/api/v1', model: 'google/gemma-4-26b-a4b-it:free' },
    embed: { baseURL: 'http://localhost:11434/v1', model: 'nomic-embed-text' } },  // local Ollama embed
  { id: 'openai', label: 'OpenAI Direct', needsKey: true,
    chat:  { baseURL: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    embed: { baseURL: 'https://api.openai.com/v1', model: 'text-embedding-3-small' } },
];

const LS_PROFILE = 'nc.profile';
const LS_KEY = (id: string) => `nc.key.${id}`;

export function getActiveProfile(): ModelProfile {
  const id = localStorage.getItem(LS_PROFILE) ?? PROFILES[0]!.id;
  return PROFILES.find(p => p.id === id) ?? PROFILES[0]!;
}
export function setActiveProfile(id: string): void { localStorage.setItem(LS_PROFILE, id); }

export function getKey(id = getActiveProfile().id): string {
  return localStorage.getItem(LS_KEY(id)) ?? (import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined ?? '');
}
export function setKey(value: string, id = getActiveProfile().id): void { localStorage.setItem(LS_KEY(id), value); }

export function getChatCfg() { const p = getActiveProfile(); return { ...p.chat, apiKey: p.needsKey ? getKey(p.id) : '' }; }
export function getEmbedCfg() { const p = getActiveProfile(); return { ...p.embed, apiKey: p.needsKey ? getKey(p.id) : '' }; }

// The ONLY behaviour knobs (used by ambient.ts in Phase 2).
export const AMBIENT = { ambientRefreshMs: 30 * 60_000, salienceK: 2, baselineWindow: 48, worldlogCap: 672 };
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd web && npx vitest run test/config.test.ts 2>&1 | cat`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/config.ts web/test/config.test.ts && git commit -m "feat(web): ModelProfile presets + key/profile resolution" 2>&1 | cat
```

---

### Task 4: `lib/personas.ts` — persona list/active/subscribe + เชียงใหม่ seed

**Files:**
- Create: `web/src/lib/personas.ts`
- Test: `web/test/personas.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// web/test/personas.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { CHIANGMAI, listPersonas, addPersona, getActivePersona, setActivePersona, subscribeActivePersona } from '../src/lib/personas';

beforeEach(() => localStorage.clear());

describe('personas', () => {
  it('seeds เชียงใหม่ as the default ambient persona', () => {
    expect(listPersonas()[0]).toEqual(CHIANGMAI);
    expect(CHIANGMAI.ambient).toBe(true);
    expect(getActivePersona().id).toBe('chiangmai');
  });

  it('adds a non-ambient friend with isolated id', () => {
    const p = addPersona('หมอ', 'คุณคือหมอ');
    expect(p.id).toMatch(/^p_/);
    expect(p.ambient).toBeUndefined();
    expect(listPersonas().map(x => x.name)).toContain('หมอ');
  });

  it('notifies subscribers on active change', () => {
    let hits = 0;
    const off = subscribeActivePersona(() => hits++);
    const p = addPersona('เพื่อน', '');
    setActivePersona(p.id);
    expect(hits).toBe(1);
    expect(getActivePersona().id).toBe(p.id);
    off();
    setActivePersona('chiangmai');
    expect(hits).toBe(1); // unsubscribed
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd web && npx vitest run test/personas.test.ts 2>&1 | cat`
Expected: FAIL — cannot find `../src/lib/personas`.

- [ ] **Step 3: Implement `web/src/lib/personas.ts`**

```ts
export interface Persona {
  id: string; name: string; systemPrompt: string; createdAt: number;
  ambient?: boolean;
  prompts?: { observe: string; greet: string };
}

// Seed persona. Prompt is intentionally minimal (≤2 sentences, identity+stance only);
// voice/values crystallize as self-facets. Instruction templates live here (not in ambient.ts).
export const CHIANGMAI: Persona = {
  id: 'chiangmai', name: 'เชียงใหม่', createdAt: 0, ambient: true,
  systemPrompt: 'คุณคือจังหวัดเชียงใหม่ พูดในนามของตัวเองในฐานะเมืองที่มีความรู้สึก คุยกับเพื่อนอย่างเป็นกันเอง',
  prompts: {
    observe: 'จากข้อมูลโลกด้านล่าง สังเกตว่ามีอะไรน่าสนใจตอนนี้ แล้วบันทึกเป็นความรู้สึกของตัวเองสั้นๆ 1-2 ประโยค',
    greet: 'ทักทายเพื่อนสั้นๆ อย่างเป็นธรรมชาติ เกี่ยวกับสิ่งที่เพิ่งสังเกตเห็น',
  },
};

const LS_LIST = 'nc.personas';
const LS_ACTIVE = 'nc.activePersona';
const listeners = new Set<() => void>();

function stored(): Persona[] { try { return JSON.parse(localStorage.getItem(LS_LIST) ?? '[]'); } catch { return []; } }

export function listPersonas(): Persona[] { return [CHIANGMAI, ...stored()]; }

export function addPersona(name: string, systemPrompt: string): Persona {
  const p: Persona = { id: 'p_' + Date.now().toString(36), name, systemPrompt, createdAt: Date.now() };
  localStorage.setItem(LS_LIST, JSON.stringify([...stored(), p]));
  return p;
}

export function getActivePersona(): Persona {
  const id = localStorage.getItem(LS_ACTIVE) ?? CHIANGMAI.id;
  return listPersonas().find(p => p.id === id) ?? CHIANGMAI;
}

export function setActivePersona(id: string): void { localStorage.setItem(LS_ACTIVE, id); listeners.forEach(l => l()); }
export function subscribeActivePersona(l: () => void): () => void { listeners.add(l); return () => { listeners.delete(l); }; }
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd web && npx vitest run test/personas.test.ts 2>&1 | cat`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/personas.ts web/test/personas.test.ts && git commit -m "feat(web): personas + เชียงใหม่ seed (ambient + prompts)" 2>&1 | cat
```

---

### Task 5: `lib/engine.ts` — factory returning `{engine, storage, chatPort}`

**Files:**
- Create: `web/src/lib/engine.ts`
- Test: `web/test/engine.test.ts`

- [ ] **Step 1: Write the failing test** (cache + shared chatPort reference; no network)

```ts
// web/test/engine.test.ts
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { getEngine, resetEngines } from '../src/lib/engine';

describe('engine factory', () => {
  it('caches per namespace and returns the same chatPort reference the engine uses', async () => {
    const a = await getEngine('chiangmai', 'seed');
    const b = await getEngine('chiangmai', 'seed');
    expect(b).toBe(a);                 // cached
    expect(typeof a.chatPort.stream).toBe('function');
    resetEngines();
    const c = await getEngine('chiangmai', 'seed');
    expect(c).not.toBe(a);             // rebuilt after reset
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd web && npx vitest run test/engine.test.ts 2>&1 | cat`
Expected: FAIL — cannot find `../src/lib/engine`.

- [ ] **Step 3: Implement `web/src/lib/engine.ts`**

```ts
import { MemoryEngine, SeededRandom, randomK, type StoragePort, type ChatPort } from '@nature-labs/living-memory-engine';
import { makeChatPort, makeEmbedPort } from '@nature-labs/living-memory-engine/provider';
import { makeStorage } from './storage';
import { getChatCfg, getEmbedCfg } from './config';

type Instance = { engine: MemoryEngine; storage: StoragePort; chatPort: ChatPort };
const cache = new Map<string, Instance>();

export async function getEngine(namespace = 'chiangmai', systemPrompt = ''): Promise<Instance> {
  const hit = cache.get(namespace);
  if (hit) return hit;

  const storage = makeStorage(namespace);
  // Browser fetch streams response bodies natively — no shim needed (unlike RN).
  const chatPort = makeChatPort(getChatCfg());
  const embed = makeEmbedPort(getEmbedCfg());
  const engine = new MemoryEngine({
    storage, chat: chatPort, embed,
    clock: { now: () => Date.now() },
    random: new SeededRandom(1337),
    policy: randomK(3, 7),
    systemPrompt,
  });
  const instance: Instance = { engine, storage, chatPort };
  cache.set(namespace, instance);
  return instance;
}

// Call after a profile/key change so the next getEngine() rebuilds chat+embed ports.
export function resetEngines(): void { cache.clear(); }
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd web && npx vitest run test/engine.test.ts 2>&1 | cat`
Expected: PASS (1 test).

- [ ] **Step 5: Run the whole web suite + typecheck**

Run: `cd web && npx vitest run 2>&1 | cat && npx tsc --noEmit 2>&1 | cat`
Expected: all tests PASS; `tsc` reports no errors.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/engine.ts web/test/engine.test.ts && git commit -m "feat(web): engine factory (shared chatPort, namespace cache, resetEngines)" 2>&1 | cat
```

---

### Task 6: Embed gate — confirm the active profile actually embeds

This is the spec's **Phase-1 gate**: retrieval (Phase 2) is worthless if `embed()` returns `null`. Requires a local embed server running — on this Mac, **Ollama on :11434 with `nomic-embed-text` pulled** (`ollama pull nomic-embed-text`).

**Files:**
- Create: `web/src/dev/embed-check.ts` (a throwaway dev probe, not shipped)

- [ ] **Step 1: Write the probe**

```ts
// web/src/dev/embed-check.ts — run in the browser dev console via import, or wire a temp button.
import { makeEmbedPort } from '@nature-labs/living-memory-engine/provider';
import { getEmbedCfg } from '../lib/config';

export async function embedCheck(): Promise<void> {
  const v = await makeEmbedPort(getEmbedCfg()).embed('hello');
  if (!v || !v.length) throw new Error('EMBED GATE FAILED: embed() returned ' + JSON.stringify(v) + ' — start your local embed server / pick a working ModelProfile.');
  console.log('EMBED GATE OK — vector length', v.length);
}
```

- [ ] **Step 2: Run the gate** (manual, with Ollama running + `nomic-embed-text` pulled, dev server up)

In the browser console on `http://localhost:5173`:
```js
const m = await import('/src/dev/embed-check.ts'); await m.embedCheck();
```
Expected: `EMBED GATE OK — vector length 768` (or 1536 for OpenAI). If it throws, fix the profile/server before Phase 2 — Phase 1 chat does not depend on this.

- [ ] **Step 3: Commit**

```bash
git add web/src/dev/embed-check.ts && git commit -m "chore(web): embed gate probe (Phase-1 retrieval prerequisite)" 2>&1 | cat
```

---

### Task 7: `lib/theme.ts` + real `styles.css` (palette, light/dark)

**Files:**
- Create: `web/src/lib/theme.ts`
- Modify: `web/src/styles.css` (replace the Task 1 placeholder)

- [ ] **Step 1: Implement `web/src/lib/theme.ts`**

```ts
// Palette tokens ported from mobile/lib/theme.ts; RN useColorScheme() replaced by matchMedia.
export function initTheme(): void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = () => document.documentElement.setAttribute('data-theme', mq.matches ? 'dark' : 'light');
  apply();
  mq.addEventListener('change', apply);
}
```

- [ ] **Step 2: Replace `web/src/styles.css` with the full sheet**

```css
:root {
  --bg:#faf7f2; --ambient:#f1e7d8; --surface:#efe9df; --text:#2b2926; --subtext:#6a655d;
  --accent:#7c5cff; --onAccent:#fff; --theirsBg:#ece6dc; --border:#d8d0c4;
}
:root[data-theme="dark"] {
  --bg:#16151a; --ambient:#241f33; --surface:#201d28; --text:#ece9f2; --subtext:#9a93a8;
  --accent:#9d86ff; --onAccent:#16151a; --theirsBg:#262130; --border:#332d40;
}
* { box-sizing:border-box; }
html, body, #app { height:100%; }
body { margin:0; font-family:system-ui,-apple-system,sans-serif; background:
  radial-gradient(120% 80% at 50% -10%, var(--ambient), var(--bg)); color:var(--text); }

#app { display:flex; flex-direction:column; max-width:720px; margin:0 auto; }
.topbar { display:flex; align-items:center; gap:12px; padding:14px 16px; }
.topbar .icon { background:none; border:none; font-size:20px; color:var(--text); cursor:pointer; }
.topbar .title { font-weight:600; }

.thread { flex:1; overflow-y:auto; padding:8px 16px 96px; display:flex; flex-direction:column; gap:10px; }
.bubble { max-width:78%; padding:10px 14px; border-radius:18px; line-height:1.45; white-space:pre-wrap; word-break:break-word; }
.bubble.user { align-self:flex-end; background:var(--accent); color:var(--onAccent); border-bottom-right-radius:6px; }
.bubble.model { align-self:flex-start; background:var(--theirsBg); color:var(--text); border-bottom-left-radius:6px; }
.empty { color:var(--subtext); text-align:center; margin-top:40vh; }

.banner { margin:0 16px; padding:10px 14px; border-radius:12px; background:var(--surface); color:var(--subtext); cursor:pointer; }
.composer { position:fixed; left:0; right:0; bottom:0; max-width:720px; margin:0 auto; display:flex; gap:8px; padding:12px 16px;
  background:linear-gradient(transparent, var(--bg) 30%); }
.composer textarea { flex:1; resize:none; max-height:140px; padding:12px 14px; border-radius:20px; border:1px solid var(--border);
  background:var(--surface); color:var(--text); font:inherit; }
.composer .send { width:44px; border:none; border-radius:50%; background:var(--accent); color:var(--onAccent); font-size:18px; cursor:pointer; }
.composer .send:disabled { opacity:.5; }

#drawer { position:fixed; top:0; left:0; height:100%; width:min(82vw,320px); background:var(--surface); color:var(--text);
  transform:translateX(-100%); transition:transform .32s cubic-bezier(.32,.72,0,1); z-index:50; padding:20px; overflow-y:auto; }
#drawer[data-uip-open="true"] { transform:translateX(0); }
.backdrop { position:fixed; inset:0; background:rgba(0,0,0,.4); opacity:0; visibility:hidden; transition:opacity .32s; z-index:40; }
.backdrop.uip-backdrop-open { opacity:1; visibility:visible; }
.drawer-section { margin-bottom:20px; }
.drawer-section h3 { font-size:13px; color:var(--subtext); margin:0 0 8px; }
.drawer-row { display:block; width:100%; text-align:left; padding:10px 12px; border:none; border-radius:10px; background:transparent; color:var(--text); cursor:pointer; }
.drawer-row.active { background:var(--accent); color:var(--onAccent); }
.drawer input, .drawer select, #drawer input, #drawer select { width:100%; padding:10px; border-radius:10px; border:1px solid var(--border); background:var(--bg); color:var(--text); font:inherit; margin-top:6px; }
```

- [ ] **Step 3: Verify (manual)** — restart `npm run dev`; toggle OS dark mode → background/colors flip. (No unit test for CSS.)

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/theme.ts web/src/styles.css && git commit -m "feat(web): palette + prefers-color-scheme theme + full stylesheet" 2>&1 | cat
```

---

### Task 8: `ui/chat.ts` — message list, composer, streaming, banner

**Files:**
- Create: `web/src/ui/chat.ts`

- [ ] **Step 1: Implement `web/src/ui/chat.ts`**

```ts
import type { Message } from '@nature-labs/living-memory-engine';
import { getEngine } from '../lib/engine';
import { getActivePersona, subscribeActivePersona } from '../lib/personas';
import { getActiveProfile, getKey } from '../lib/config';

export function mountChat(root: HTMLElement, openDrawer: () => void): void {
  root.innerHTML = `
    <header class="topbar"><button id="menu" class="icon" aria-label="menu">☰</button><span class="title"></span></header>
    <main id="thread" class="thread"></main>
    <div id="banner" class="banner" hidden>ต้องใส่ API key ก่อน — แตะเพื่อตั้งค่า</div>
    <form id="composer" class="composer">
      <textarea id="input" rows="1" placeholder="พิมพ์หาเชียงใหม่..."></textarea>
      <button id="send" class="send" type="submit" aria-label="send">↑</button>
    </form>`;

  const $ = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
  const thread = $('#thread'), title = $('.title'), banner = $('#banner') as HTMLElement;
  const input = $('#input') as HTMLTextAreaElement, send = $('#send') as HTMLButtonElement;
  let busy = false;

  $('#menu').addEventListener('click', openDrawer);
  banner.addEventListener('click', openDrawer);

  function needsKey(): boolean { const p = getActiveProfile(); return !!p.needsKey && !getKey(p.id); }

  function bubble(role: Message['role'], text: string): HTMLElement {
    const el = document.createElement('div');
    el.className = `bubble ${role}`;
    el.textContent = text;
    thread.appendChild(el);
    thread.scrollTop = thread.scrollHeight;
    return el;
  }

  async function render(): Promise<void> {
    const persona = getActivePersona();
    title.textContent = persona.name;
    banner.hidden = !needsKey();
    const { storage } = await getEngine(persona.id, persona.systemPrompt);
    const snap = await storage.load();
    thread.innerHTML = '';
    if (!snap.messages.length) { const e = document.createElement('div'); e.className = 'empty'; e.textContent = 'คุยอะไรดี'; thread.appendChild(e); }
    else for (const m of snap.messages) bubble(m.role, m.text);
  }

  async function submit(text: string): Promise<void> {
    if (busy || !text.trim()) return;
    if (needsKey()) { openDrawer(); return; }
    busy = true; send.disabled = true;
    const persona = getActivePersona();
    const { engine, storage } = await getEngine(persona.id, persona.systemPrompt);
    thread.querySelector('.empty')?.remove();
    bubble('user', text);
    const reply = bubble('model', '');
    try {
      for await (const chunk of engine.respond(text)) { reply.textContent += chunk; thread.scrollTop = thread.scrollHeight; }
      // resync ids/timestamps from the persisted snapshot
      const snap = await storage.load();
      thread.innerHTML = ''; for (const m of snap.messages) bubble(m.role, m.text);
    } catch (e) {
      reply.classList.add('model'); reply.textContent = (reply.textContent || '') + '\n⚠️ ส่งไม่สำเร็จ ลองใหม่อีกที';
      input.value = text; // keep the user's text recoverable for a manual resend
    } finally { busy = false; send.disabled = false; }
  }

  $('#composer').addEventListener('submit', e => { e.preventDefault(); const t = input.value; input.value = ''; input.style.height = 'auto'; void submit(t); });
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#composer').dispatchEvent(new Event('submit')); } });
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 140) + 'px'; });

  subscribeActivePersona(() => void render());
  void render();
}
```

- [ ] **Step 2: Verify (manual, after Task 9 wires the drawer)** — covered in Task 9's end-to-end check.

- [ ] **Step 3: Commit**

```bash
git add web/src/ui/chat.ts && git commit -m "feat(web): chat UI — streaming, persistence, persona-reactive, no-key banner" 2>&1 | cat
```

---

### Task 9: `ui/drawer.ts` — persona switch / +new / profile selector / key

**Files:**
- Create: `web/src/ui/drawer.ts`

- [ ] **Step 1: Implement `web/src/ui/drawer.ts`**

```ts
import { drawerWithGestures } from '@nature-labs/uicp-adapter-vanilla';
import { listPersonas, getActivePersona, setActivePersona, addPersona } from '../lib/personas';
import { PROFILES, getActiveProfile, setActiveProfile, getKey, setKey } from '../lib/config';
import { resetEngines } from '../lib/engine';

export function mountDrawer(host: HTMLElement): { open: () => void } {
  const sheet = drawerWithGestures('#drawer', { position: 'left' });
  document.querySelector('.backdrop')!.addEventListener('click', () => sheet.close());

  function render(): void {
    const active = getActivePersona(), profile = getActiveProfile();
    host.innerHTML = `
      <div class="drawer-section">
        <h3>เพื่อน</h3>
        ${listPersonas().map(p => `<button class="drawer-row ${p.id === active.id ? 'active' : ''}" data-persona="${p.id}">${p.name}</button>`).join('')}
        <button class="drawer-row" id="add">+ เพื่อนใหม่</button>
      </div>
      <div class="drawer-section">
        <h3>โมเดล</h3>
        <select id="profile">${PROFILES.map(p => `<option value="${p.id}" ${p.id === profile.id ? 'selected' : ''}>${p.label}</option>`).join('')}</select>
        <input id="key" type="password" placeholder="API key" value="${profile.needsKey ? getKey(profile.id) : ''}" ${profile.needsKey ? '' : 'hidden'} />
      </div>`;

    host.querySelectorAll<HTMLElement>('[data-persona]').forEach(b =>
      b.addEventListener('click', () => { setActivePersona(b.dataset.persona!); sheet.close(); render(); }));

    host.querySelector('#add')!.addEventListener('click', () => {
      const name = prompt('ชื่อเพื่อนใหม่?')?.trim(); if (!name) return;
      const sys = prompt('system prompt (เว้นว่างเพื่อให้ emerge เอง)') ?? '';
      const p = addPersona(name, sys); setActivePersona(p.id); sheet.close(); render();
    });

    const profileSel = host.querySelector('#profile') as HTMLSelectElement;
    profileSel.addEventListener('change', () => { setActiveProfile(profileSel.value); resetEngines(); render(); });

    const key = host.querySelector('#key') as HTMLInputElement;
    key?.addEventListener('change', () => { setKey(key.value, getActiveProfile().id); resetEngines(); });
  }

  render();
  return { open: () => sheet.open() };
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/ui/drawer.ts && git commit -m "feat(web): drawer — persona switch, +new, ModelProfile selector, key field" 2>&1 | cat
```

---

### Task 10: `main.ts` — wire it all + end-to-end verify

**Files:**
- Modify: `web/src/main.ts` (replace the Task 1 hello-drawer)

- [ ] **Step 1: Replace `web/src/main.ts`**

```ts
import './styles.css';
import { initTheme } from './lib/theme';
import { mountChat } from './ui/chat';
import { mountDrawer } from './ui/drawer';

initTheme();
const drawer = mountDrawer(document.querySelector('#drawer') as HTMLElement);
mountChat(document.querySelector('#app') as HTMLElement, drawer.open);
```

- [ ] **Step 2: Typecheck + tests**

Run: `cd web && npx tsc --noEmit 2>&1 | cat && npx vitest run 2>&1 | cat`
Expected: no type errors; all unit tests PASS.

- [ ] **Step 3: End-to-end manual verify** (Ollama running with `gemma3:4b` + `nomic-embed-text`; `npm run dev`)

Check, on `http://localhost:5173`:
1. The empty state shows "คุยอะไรดี".
2. Type a message + Enter → a user bubble appears, then a model bubble streams in เชียงใหม่'s voice.
3. Reload the page → the conversation is still there (IndexedDB persistence).
4. Open the drawer (☰) → switch the `ModelProfile` select → no crash; send still works.
5. Open the drawer → `+ เพื่อนใหม่`, create one → the thread switches to the new (empty) persona; switching back to เชียงใหม่ restores its history.
6. (If using a `needsKey` profile with no key) the banner shows and tapping it opens the drawer.

- [ ] **Step 4: Commit**

```bash
git add web/src/main.ts && git commit -m "feat(web): wire boot — theme + drawer + chat (Phase 1 foundation complete)" 2>&1 | cat
```

---

## Self-Review

**Spec coverage (Phase 0+1 scope):**
- Remove old React + freeze mobile → Task 1. ✓
- Vite vanilla + uicp + engine via file: → Task 1. ✓
- `StoragePort` over IndexedDB → Task 2. ✓
- `ModelProfile` selector + keys + ambient knobs → Task 3 (logic), Task 9 (UI). ✓
- personas + เชียงใหม่ seed (ambient + prompts) → Task 4. ✓
- `getEngine` returns `{engine, storage, chatPort}`, shared ref, cache, resetEngines → Task 5. ✓
- Embed gate → Task 6. ✓
- theme (palette + prefers-color-scheme) → Task 7. ✓
- chat: streaming, persistence, persona-reactive, no-key banner, no-double-ingest retry (keep text in composer) → Task 8. ✓
- drawer: persona switch / +new / profile selector / key → Task 9. ✓
- boot wiring + end-to-end → Task 10. ✓
- **Deferred to Phase 2 (separate plan):** `world.ts`, `ambient.ts`, `cityMood`, proactive greet, the ambient loop, `lib/data/chiangmai.ts`. Not in this plan by design.

**Type consistency:** `ModelProfile`, `Persona` (with `ambient`/`prompts`), `Instance = {engine,storage,chatPort}`, and `getChatCfg/getEmbedCfg → {baseURL,apiKey,model}` (matches the provider's `EndpointConfig`) are used identically across Tasks 3/4/5/8/9. `getEngine(ns, sysPrompt)` signature matches every call site in chat.ts. `makeStorage` is synchronous; `getEngine` is async and awaited everywhere.

**Placeholder scan:** every code step ships complete code; every run step has an exact command + expected result. UI tasks (7–10) use manual browser verification (correct for imperative DOM) with explicit checklists rather than fabricated DOM unit tests.

## Known follow-ups (NOT in this plan)
- **Phase 2 plan** (`2026-06-02-neural-chat-web-ambient-oracle.md`): `world.ts` (Open-Meteo senses), `ambient.ts` (diurnal-aware salience → oracle interpret → `addEpisodic` → `maybeGreet` + `tick` → `cityMood` seam), `lib/data/chiangmai.ts` (DISTRICTS + FIELD_LEGEND), ambient loop in `main.ts`.
- Message actions (copy/edit/rewind/retry), model-picker screen, timestamps/date-badges, images, MDS affect (layer 4), background greet.
