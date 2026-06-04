# neural-chat — NEXT SESSION (warp point)

> Read THIS first to resume. Side project (not HomeLog). Last big session: 2026-06-03 (self-state grounding built + merged to main). Prior: 2026-06-02 (the web pivot + ambient oracle).
> One-line: a personal **living-memory chat** — talk forever; a TS memory engine decays/consolidates/crystallizes instead of stuffing context. Now a **plain web app** whose star is **เชียงใหม่**, a province-entity that observes the real world (Open-Meteo) and greets you first. Runs fully local on Ollama.

## ✅ DONE + VERIFIED LIVE 2026-06-02 — web pivot, Phase 1 + Phase 2

Pivoted the frontend from Expo → **plain web** (Vite vanilla, no React) + **uicp** drawer + the existing engine (`file:../engine`). **Mobile/Expo is FROZEN** (not deleted; don't touch). Old root React prototype removed.

- **Phase 1 (foundation):** IndexedDB `StoragePort` · `ModelProfile` config (Ollama default; chat+embed switch together) · personas (เชียงใหม่ seed) · engine factory · chat UI (stream/persist/persona-reactive) · drawer (persona / profile / **model dropdown discovered from `/v1/models`**) · theme. **20 unit tests green, tsc 0.**
- **Memory debug pane** (🧠 top-right): live Snapshot view (self/episodic/prospective + strength/tags/emb) + **Injection Tap** (type a query → `engine.retrieve` → real `formatInjection` string the LLM gets).
- **Phase 2 (ambient soul):** `lib/data/chiangmai.ts` (8 อำเภอ + FIELD_LEGEND text + METRIC_KEYS) · `world.ts` (Open-Meteo air+weather, no key, CORS-ok, multi-district 1 array) · `ambient.ts` (diurnal-aware z-score salience → oracle interpret → `addEpisodic` → `maybeGreet`) · boot+interval tick in chat.ts.
- **Lab Mode (tuning instrument — เชียงใหม่ tuning is the project's PRIMARY focus):** in the 🧠 pane — toggles for what's fed to the LLM each turn (⏱ time + position top/end · 🧬 self · 📎 episodic · 🎯 prospective · 💬 tail) via `labRespond` (mirrors `engine.respond()`, engine untouched; default = identical) · **📤 "last fed"** shows the exact assembled prompt · 🧹 per-persona brain-wipe (re-run experiments from blank) · inline **custom-system-prompt new-friend form** (a system prompt anchors an entity against drift — founder's finding; spawn ground-level entities like a botanist from birth). **24 web tests green.** Time-position 'end' is the temporal-tuning knob for the [Current time] hallucination.
- **Verified on Ollama via Playwright:** chat streams in เชียงใหม่'s voice; persists across reload; persona+profile+model switch work; memory engine writes episodic (extract + 768-dim embeds) + retrieval works (Injection Tap surfaces relevant memory); **เชียงใหม่ proactively greets on open, grounded in the real observed air** ("...บางมุมต้องระวังฝุ่นนิดหน่อย เหมือนมีอะไรกำลังเปลี่ยนไป").

**State:** **MERGED to main** (PR #2 `fcdef4b`, 42 commits) and pushed — 2026-06-03. `labrespond.ts` in `src/lib/`. Adversarial code-review done (3 findings fixed: memory-dup-on-stream-error, persona-switch repaint race, shared `ui/dom.ts`); two engine fixes landed post-merge (prepare hook builds `dist/` on fresh install; `addEpisodic` embeds before loading snapshot to avoid clobbering concurrent writes).

## ✅ DONE + VERIFIED LIVE 2026-06-03 — self-state grounding (the core direction, now built)

The 2026-06-02 "concept only" core direction is **implemented and live**. 5-signal interoception (`online · llm local/remote · embeddings · world_feed fresh/stale · memory age`) injected as a `[Self-state]` block at the top of every turn via `labRespond`, gated by the 🪞 lab toggle (default ON). Facts always; a `(ปรับท่าที: …)` self-directive only when a signal is off-nominal. Code: `lib/selfstate.ts` (`gatherSelfState` + pure `formatSelfState`), **34 tests** (63 web tests total green, tsc 0). Spec/plan condensed (7 TDD tasks) under `docs/superpowers/`. Also added: **devlog file sink** (`lib/devlog.ts` → `web/.debug/dev.log`, dev-only) to read the real prompt fed to the LLM.

## Resume in 30 seconds
```bash
# Ollama must be running with models pulled:
ollama pull gemma4:e2b && ollama pull embeddinggemma   # chat + embed (default "Local (Ollama)" profile)
cd web && npm install && npm run dev                   # http://localhost:5173
cd web && npm test                                     # 63 tests green
cd web && npx tsc --noEmit                              # 0 errors
```
- Default model profile = **Local (Ollama)** `localhost:11434/v1`. Switch profile/model in the ☰ drawer (LM Studio / OpenRouter+local-embed / OpenAI Direct). Other machine (4070ti) = LM Studio.
- gemma4:e2b is slow on Mac (~20–40s per turn incl. the tick/extract LLM call). Be patient; the greeting/observe are background.

## Architecture (`web/`)
- `src/lib/` — `storage.ts` (IndexedDB StoragePort + kv) · `config.ts` (ModelProfile presets + AMBIENT knobs: ambientRefreshMs/salienceK/baselineWindow/worldlogCap) · `models.ts` (fetch /v1/models) · `personas.ts` (CHIANGMAI seed, ambient+prompts) · `engine.ts` (getEngine→{engine,storage,chatPort}, resetEngines) · `theme.ts` · `world.ts` · `ambient.ts` · `data/chiangmai.ts`.
- `src/ui/` — `chat.ts` (thread/composer/stream + ambient tick) · `drawer.ts` (left nav) · `debug.ts` (right memory pane) · `dom.ts` (shared `el()`).
- Engine consumed via `file:../engine` (exports map → prebuilt `dist/`). **After editing `engine/src`, run `cd engine && npm run build`.** Provider ports from the `…/provider` subpath; browser fetch streams natively (no expo/fetch).
- Spec: `docs/superpowers/specs/2026-06-02-neural-chat-web-ambient-oracle-design.md`. Foundation plan: `docs/superpowers/plans/2026-06-02-neural-chat-web-foundation.md`.

## Decision when you return
prospective-resolution **SHIPPED** 2026-06-04 (engine 58 tests, web verified live on legacy data). Next-ripe: **intent-completion UI surface** ("เพื่อนกำลังรออะไรอยู่") or **background continuity** (service worker).

## Backlog (next rounds)
- **prospective-resolution — DONE 2026-06-04** (engine Tasks 1-8 + adversarial-review fixes): cue-triggered lifecycle (dormant→trigger→reinforce→resolve→decay→abandon→**archive-cap**); `consolidation.ts` gains `decayProspective`/`abandonWeakProspective`/`capProspective`; `retrieve()` triggers on clue-embedding cosine match (cooldown + reinforce-on-trigger); `extract()` reports `resolved[]`; debug pane splits pending(live)/archive(count); **legacy rows auto-migrate on first tick** (verified live: chiangmai had 14). Plan: `docs/superpowers/plans/2026-06-02-prospective-resolution.md`. **Next depth:** intent-completion UI ("เพื่อนกำลังรออะไรอยู่"), priority-modulated trigger threshold.
- UI polish: **stream the proactive greeting** (currently appears whole via ingestModel) · timestamps/date-badges · message actions (copy/edit/rewind/retry) · favicon.
- Ambient depth: deeper/seasonal salience baselines beyond diurnal · **background continuity** (service worker/cron so the city "lives on while you're away" — turns it from "checks weather on open" into a real life).
- **Self-state grounding — DONE 2026-06-03** (see the verified-live section above). Next depth on it: act on the `(ปรับท่าที: …)` directive beyond text (e.g. behavioral calibration), and wire it toward the layer-4 MDS substance (confidence/temporal-certainty/sensory-integrity/identity-stability).
- **Layer 4 (MDS affect)**: swap `cityMood()` for real PAD/needs state (the seam is in place). Big, separate — converges with self-state grounding (now built).
- Multi-province; image/vision.

## Gotchas (hard-won this session)
- **cwd drift**: git commands `cd <root> && git…` move the shell cwd → later `npx vitest` from root globs the engine's tests with the wrong (node) env. Use `git -C <root> …` for git and `cd web && …` explicitly for vitest/tsc.
- **vitest env**: `web/vite.config.ts` MUST `import { defineConfig } from 'vitest/config'` (not `'vite'`) for `test.environment: 'happy-dom'` to apply — tests use `localStorage`; storage/engine tests also `import 'fake-indexeddb/auto'`.
- **Ollama**: CORS is open for `localhost:5173` by default (no OLLAMA_ORIGINS needed). OpenRouter has **zero embedding models** — never use it for embed; pair it with a local embedder.
- **Playwright refs** rotate every snapshot — capture and act in consecutive calls.
- Engine unchanged (still 36 tests green in `engine/`); all Phase-1/2 work is in `web/` with zero engine edits.
