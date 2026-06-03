# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A personal **living-memory chat**: talk forever to an entity (the star persona is **เชียงใหม่**, a province that senses the real world and greets you first). Instead of stuffing the context window, a TypeScript **memory engine** decays / consolidates / crystallizes memories so a single thread never overflows — each turn the LLM sees only a small retrieved working set. The thesis driving current work: for a local-first entity, **self-awareness (knowing its own state) > raw model intelligence**.

Side project of the Viibe World OS workspace (not the HomeLog sprint). Resume context lives in `NEXT-SESSION.md`; design specs and TDD plans live under `docs/superpowers/{specs,plans}/`.

## Three parts (one git repo)

| Dir | Status | What |
|---|---|---|
| `web/` | **ACTIVE** — all current work | Plain **Vite + vanilla TypeScript** app (no React/framework) + uicp drawer. The product. |
| `engine/` | Stable substrate | `@nature-labs/living-memory-engine` — framework-agnostic TS memory engine. Consumed by `web/` via `file:../engine` (its prebuilt `dist/`). |
| `mobile/` | **FROZEN — do not touch** | Old Expo/React Native app. Superseded by `web/`. Not deleted; not maintained. |

## Commands

**First-time setup** — the engine must be built before the web app can import it (`web/` links the engine's prebuilt `dist/` via `file:../engine`, and `dist/` is gitignored):
```bash
cd engine && npm install       # the `prepare` hook builds dist/ automatically on install
cd ../web && npm install && npm run dev   # → http://localhost:5173 (Vite)
```
Then, working in `web/` (the app):
```bash
cd web && npm test             # vitest (run once)
cd web && npx vitest run test/selfstate.test.ts   # a single test file
cd web && npx tsc --noEmit     # typecheck (expect 0 errors)
```
The engine has its own suite:
```bash
cd engine && npm test          # vitest
cd engine && npm run build     # tsc -p tsconfig.build.json → dist/   (REQUIRED after editing engine/src — see below)
```

**Local LLM** (default profile): Ollama must be running with models pulled — `ollama pull gemma4:e2b embeddinggemma` (chat + 768-dim embed). Switch profile/model in the ☰ drawer (LM Studio / OpenRouter+local-embed / OpenAI). gemma on a Mac is slow (~20–40s/turn including the `tick` extract call) — be patient; ambient observe/greet run in the background.

## Architecture (the big picture)

**Engine = ports & adapters.** `MemoryEngine` (`engine/src/engine.ts`) takes a `StoragePort`, `ChatPort`, `EmbedPort` plus `clock`/`random`/`policy` (`engine/src/ports.ts`). It contains *no* IO or framework code, so a new frontend just supplies adapters — which is exactly how `web/` works (IndexedDB storage + browser-`fetch` OpenAI-compatible ports). **This is why `web/` can exist with zero engine edits.**

**Turn lifecycle** (`engine.respond()`, mirrored by web's `labRespond`): `ingestUser` → `retrieve` (MMR top-K episodic by `retrieveTopK`/`retrieveMinSimilarity` + self-tier + prospective + a short message `tail`) → assemble injection → stream from the LLM → `ingestModel` → `tick`. `tick` is where memory *lives*: decay (Ebbinghaus), reinforce, extract new episodic + embed, merge near-duplicates, prune, crystallize self-facets, detect patterns (`engine/src/consolidation.ts`). The LLM never receives the whole history — only `retrieve`'s output + `tail`.

**`web/` owns prompt rhetoric; the engine owns memory mechanics.** The web app drives the engine through `web/src/lib/labrespond.ts`, **not** `engine.respond()`. `labRespond` mirrors the engine's orchestration but builds its own injection via the **pure** `assembleInject(ctx, toggles, now, selfStateBlock)`, so the founder can tune exactly what the LLM receives from the 🧠 "Lab" pane. Injection order: `[Self-state]` → `[Current time]` → `formatInjection(...)` body (`[Who you are]`/`[Relevant memories]`/`[You are anticipating]`, emitted **inside the engine**) → time-end directive. Lab toggles (`config.ts` `LabToggles`, persisted at `localStorage['nc.lab']`) gate each component; all-on + `selfState` on = the default "engine + self-model" behavior.

**Two senses feed the entity** (both inject a context block, neither is a behavioral gate):
- **Exteroception** — `lib/ambient.ts` `observe()`: fetches เชียงใหม่'s real weather/air (`lib/world.ts`, Open-Meteo, no key), scores novelty by **diurnal z-score** vs a per-persona worldlog (no hardcoded thresholds — the city learns its own normal), writes episodic memory, and may **proactively greet** on open.
- **Interoception** — `lib/selfstate.ts` `gatherSelfState()`: reads the entity's own runtime (online / local-vs-remote LLM / embeddings health / world-feed freshness / memory age), rendered by the pure `formatSelfState` as the `[Self-state]` block. Facts always; a `(ปรับท่าที: …)` self-directive line only when a signal is off-nominal.

**Personas** (`lib/personas.ts`) are namespaces: each has its own engine instance + IndexedDB snapshot (`lib/storage.ts`, keyed by persona id) + ambient worldlog (`worldlog:<ns>`). System prompt is intentionally minimal — identity emerges as self-facets crystallize.

## Hard rules & non-obvious gotchas

- **Never edit `engine/` from web work** unless explicitly intended. `web/` imports the engine's prebuilt `dist/`, so **after any `engine/src` change you MUST `cd engine && npm run build`** or the app/tests run stale code. The engine suite must stay green independently.
- **cwd drift is real:** use `git -C <repo-root> …` for git, and `cd web && …` (or `cd engine && …`) explicitly for vitest/tsc. Running vitest from the repo root globs the wrong tests with the wrong env.
- **`web/vite.config.ts` must `import { defineConfig } from 'vitest/config'`** (not `'vite'`) for `test.environment: 'happy-dom'` to apply — tests use `localStorage`; storage/engine tests also rely on `fake-indexeddb`.
- **Model names are discovered, never hardcoded** — `lib/models.ts` reads `/v1/models`; profile entries in `config.ts` are only fallbacks. Salience uses z-scores, not absolute thresholds. Keep this LOW-hardcode discipline.
- **OpenRouter has zero embedding models** — never embed there; pair it with a local embedder.
- **Ollama CORS** is open for `localhost:5173` by default (no `OLLAMA_ORIGINS` needed).
- **devlog**: in dev, `devlog(tag, data)` (`lib/devlog.ts`) POSTs to a Vite middleware that appends JSON lines to `web/.debug/dev.log` (gitignored, dev-only). Read that file to see the **real prompt fed to the LLM** (`tag: 'last-fed'`) plus `observe`/`greet` — faster than the on-screen pane. Restart `npm run dev` after editing `vite.config.ts`.

## Workflow conventions

- Git: commit only when asked. Commit trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- This project uses the Superpowers flow: brainstorm → spec (`docs/superpowers/specs/`) → plan (`docs/superpowers/plans/`) → TDD implement. Specs/plans are the source of truth for in-flight features.
- Responses to the founder are in Thai; code/comments in English.
