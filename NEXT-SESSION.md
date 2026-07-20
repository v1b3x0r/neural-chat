# living-memory-engine — NEXT SESSION (warp point)

> Read THIS first to resume. Side project (not HomeLog). Last big session: **2026-07-20 (Qwen Cloud hackathon — shipped a live submission)**. Prior: 2026-06-05 (prospective-resolution + Spec 1A attributed multi-person memory), 2026-06-03 (self-state grounding), 2026-06-02 (web pivot + ambient oracle).
> One-line: a **living-memory engine** — talk forever; a TS engine decays/consolidates/crystallizes instead of stuffing context. Star is **เชียงใหม่**, a Chiang-Mai entity that senses the real world (Open-Meteo) and remembers across sessions. **Default profile = Qwen Cloud; deployed live on Alibaba Cloud.** Local Ollama still an option.

## ✅ 2026-07-20 — Qwen Cloud hackathon (MemoryAgent track) — SHIPPED a live submission
Repo **renamed `neural-chat` → `living-memory-engine`** (public, Apache-2.0; GitHub redirects old links). All hackathon assets in one bucket: **`docs/superpowers/hackathon/`** — start at `codex-brief.md`. What landed (all pushed to main, engine 92 + web 74 tests green, tsc 0, zero engine edits):
- **Qwen Cloud integration** — new default profile via key-safe proxy: pure rules `web/src/lib/qwenproxy.ts` (path/model allowlist, 768-dim, max_tokens cap) wired as Vite dev middleware + `web/server.mjs` (prod). Key in `web/.env.local` (`QWEN_API_KEY`), never in client.
- **Live deploy on Alibaba Cloud** — `server.mjs` (zero-dep Node) under systemd `memory-engine` behind nginx on an Alibaba Simple Application Server, Cloudflare TLS → **https://cm.viibe.to** (+ `http://47.79.255.217`). Runbook: `docs/superpowers/hackathon/DEPLOY.md`.
- **L2 "why this answer"** explainability (`web/src/lib/why.ts` + `ui/debug.ts`) — Used context vs Available, source badges (Memory/Live/Plan); raw tiers under Advanced. Pane inverted to product-first per advisor.
- **English UI chrome + reply-mirrors-language** — เชียงใหม่ replies Thai to Thai, English to English. `[Self-state]` block now English (`(adjust stance: …)`).
- **Restyle** — warm-editorial (clay accent, serif masthead, haze). **Dark = clean near-black, Light = beige.** White-canvas bug fixed at root (`html { background }` + `color-scheme`).
- **Evaluation** — deterministic `engine/eval/run.ts` (`npm run eval`), H1–H4 vs full-history baseline (H3: 1 of 31 @ ~23 vs ~428 tokens; H2 honest "both retrieved" finding).
- **Demo video 2:25** (`docs/superpowers/hackathon/media/demo.mp4`) — burned-in EN subs + OpenAI-TTS (sage) VO, built from live-app captures via chrome-devtools + ffmpeg.
- **Repo tidy** — loose root PNGs moved out (`.assets-scratch/`, gitignored); `.gitignore` hardened.
- **Advisor ledger** `advisor-inbox.md` — 5 GPT rounds triaged (A1–A27).

**Remaining founder actions before Submit (deadline 2026-07-20 14:00 PDT):** upload `media/demo.mp4` → YouTube → paste link into `devpost-draft.md` → paste into Devpost (MemoryAgent) → **Submit**. Codex does a final review pass (`codex-brief.md`).

**Known-deferred (post-hackathon, non-blocking):** proxy mid-stream 502 guard (`if(!res.headersSent)` — dev middleware only; `server.mjs` already has it); Spec 1B privacy-scoped retrieval + persons viz; contradiction-aware consolidation (the H2 gap).

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

## ✅ SHIPPED 2026-06-05 — prospective-resolution + Spec 1A (both engine, merged to main)

**prospective-resolution:** cue-triggered lifecycle (dormant→trigger→reinforce→resolve→decay→abandon→archive-cap). See the earlier backlog entry; `consolidation.ts` helpers + debug-pane pending/archive split.

**Spec 1A — Attributed Multi-Person Memory** (the **Social Reality Model** foundation; `memory/social-reality-model-direction.md` + `docs/superpowers/specs/2026-06-05-attributed-multi-person-memory-design.md` + plan `…/plans/2026-06-05-attributed-memory-1a.md`). **Engine-only** (web untouched = the deliberate "engine-only proof"): every episodic memory carries `source` / `source_type`('user'|'ambient'|'self'|'system') / `subject`('world'|'self'|person-id); placement routes by subject into **entity / per-person / interaction** tiers; the **echo-chamber kill is structural** (subject='self' → interaction log → never an episodic → never a SelfFacet); person identity = stable synthetic `person-id`, names are appended `known_names[]` never keys. New `engine/src/attribution.ts` (placeMemory/resolvePerson/deriveVisibility) + interaction ledger + transitional unified-pool retrieve (the 1B privacy-filter seam). **engine 36→92 tests**, build clean, tsc 0. Live-verified on real chiangmai data (back-compat: 63 old memories load through new engine, 0 errors; interaction ledger user+model with correct source_type). Built via full superpowers flow (brainstorm→spec→plan→subagent-driven TDD 10 tasks→adversarial reviews). **MERGED to main** (ff `79390a9`), NOT pushed.

**Known limits (by design):** 1A does NOT surface in the web UI and does NOT retroactively clean OLD polluted memory (forward-looking) — chiangmai's pre-1A Self-tier/episodic still hold echo-chamber junk. 🧹 ล้างสมอง for a clean sample.

## ▶ NEXT: Spec 1B — Retrieval & Identity (founder-requested start = debug-pane viz)
The visible half: **privacy-scoped retrieval** (insert the viewer/visibility filter at the `retrieve()` pool-union seam — already pre-built), **relationship-derived display** ("คนที่ชอบเดินตลาด"), **emergent naming** (infer+confirm / ask-after-relationship / alias-merge of split person-ids). **Founder-requested starting point:** a `web/src/ui/debug.ts` viz surfacing the new 1A structures — 👥 Persons (id + known_names + facts), 🔗 Interactions ledger, source/subject attribution badges on episodic cards — so 1A becomes visible. Then **Spec 2** (semantic clustering / corroboration / confidence→phrasing + self-facet dedup).

## Resume in 30 seconds
```bash
# Ollama must be running with models pulled:
ollama pull gemma4:e4b-mlx && ollama pull embeddinggemma   # chat + embed (MLX is faster on Apple Silicon; e2b deleted)
cd web && npm install && npm run dev                   # http://localhost:5173
cd web && npm test                                     # 63 web tests green; engine: cd engine && npm test → 92
cd web && npx tsc --noEmit                              # 0 errors
```
- Default model profile = **Local (Ollama)** `localhost:11434/v1`. Switch profile/model in the ☰ drawer (LM Studio / OpenRouter+local-embed / OpenAI Direct). Other machine (4070ti) = LM Studio.
- **gemma4:e4b-mlx** (current on M3 Air 16GB; founder swapped from gguf e2b) is still slow (~20–40s chat + a SEPARATE ~30–120s tick/extract call). The extract is the slow tail — attribution lands seconds-to-minutes after the visible reply. Greeting/observe run in the background.

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
