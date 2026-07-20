# Living Memory Engine — Devpost submission draft

> Paste into the Devpost fields. Track: **MemoryAgent**.

**Submission links (for judges):**
- ▶️ **Try it live:** https://cm.viibe.to  (deployed on Alibaba Cloud — no setup, just open and talk)
- 📦 **Repo (open source, Apache-2.0):** https://github.com/v1b3x0r/living-memory-engine
- 🎬 **Demo video (< 3 min):** _paste YouTube link after upload_
- 🧪 **Reproduce the evaluation:** `cd engine && npm run eval`

## Elevator pitch (one line)

A TypeScript **context-composition engine** for agents: it decays, consolidates, and crystallizes memories, then composes a small **working context** each turn from memory + live signals + plans — so the model never receives the whole conversation. **Conversation length and model context are no longer proportional.** Proven by เชียงใหม่ (Chiang Mai), a city-entity that senses the real world and remembers you across sessions. Runs on Qwen Cloud.

## Inspiration

Chat agents don't actually have memory — they have a context window. When the window fills, you either truncate (and the agent forgets) or resend everything (and cost/latency explode while the model drowns in irrelevance). We wanted an entity you could talk to *forever*: one that keeps what matters, lets go of what doesn't, and forms a durable sense of who it is and who you are — the way a mind does, not the way a log does.

## What it does

A framework-agnostic memory engine sits between you and the LLM. Every turn:

- **Retrieve** — an MMR (relevance + diversity) search pulls the top-K relevant episodic memories, plus a self-tier, anticipated intents, and a short recent tail. The full history is **never** resent.
- **Respond** — only that small working set is injected into the Qwen model.
- **Consolidate (tick)** — the engine extracts new episodic memories and embeds them, **decays** old ones (Ebbinghaus-style), **reinforces** recalled ones, **merges** near-duplicates, **prunes** the faded, and **crystallizes** recurring patterns into stable self-facets.

The star persona, **เชียงใหม่**, is the city itself. Two senses feed it:
- **Exteroception** — it reads Chiang Mai's real live weather and air quality (Open-Meteo, no key), scores how unusual "now" is against the city's own learned normal (a diurnal z-score — no hardcoded thresholds), remembers it, and may greet you first about it.
- **Interoception** — a self-state block tells the entity its own runtime condition (online, local vs remote model, embeddings health, world-feed freshness, memory age) so it speaks honestly when a sense is degraded instead of hallucinating.

A memory-lifecycle chip surfaces the otherwise-invisible mechanics live (🔍 recalling → 🧠 consolidating), and a Lab pane shows the exact prompt fed to the model each turn.

## How we built it

- **Ports & adapters.** The engine (`@nature-labs/living-memory-engine`) contains no IO or framework code — it takes a `StoragePort`, `ChatPort`, `EmbedPort` plus clock/random/policy. A new frontend just supplies adapters, which is exactly how the web app exists with **zero engine edits**.
- **Qwen Cloud, key-safe.** The "Qwen Cloud" profile reaches Qwen through a same-origin proxy so the API key never touches the browser: `browser → /api/qwen/v1 → server-side key injection → Alibaba Cloud Model Studio (DashScope intl)`. The proxy enforces a path allowlist, a model allowlist, a `max_tokens` cap, and forces `dimensions: 768` on embeddings so the engine's vector space is unchanged. Chat: `qwen3.7-plus`. Embeddings: `text-embedding-v4` (768-dim).
  - Proof files: [`web/src/lib/qwenproxy.ts`](https://github.com/v1b3x0r/living-memory-engine/blob/main/web/src/lib/qwenproxy.ts), [`web/vite.config.ts`](https://github.com/v1b3x0r/living-memory-engine/blob/main/web/vite.config.ts), [`web/src/lib/config.ts`](https://github.com/v1b3x0r/living-memory-engine/blob/main/web/src/lib/config.ts).
- **Local-first storage.** IndexedDB per-persona snapshots; personas are namespaces, each with its own engine instance, memory store, and ambient worldlog.
- **Tested.** 92 engine tests + 71 web tests (163 total), TypeScript strict, 0 type errors.

## Evaluation — measured, not asserted

A deterministic script (`engine/eval/run.ts`, reproduce with `cd engine && npm run eval`) drives the real engine through four hypotheses against a naive "resend full history" baseline. It's a measurement, not a pass/fail suite — each row reports what actually happened. The offline harness uses a deterministic *lexical* fake-embedder, so scenarios share vocabulary with their queries to measure retrieval/decay/MMR/token mechanics reproducibly; semantic paraphrase is handled by the real Qwen `text-embedding-v4` in the live app.

| Hypothesis | Relevant recalled | Stale recalled | Memories injected | Engine tokens | Full-history tokens |
|---|---|---|---|---|---|
| H1 cross-session preference | yes | n/a | 5 | ~42 | ~143 |
| H2 updated preference | yes | YES | 2 | ~25 | ~24 |
| H3 critical fact in noise | yes | n/a | 2 | ~23 | ~428 |
| H4 expired memory | forgotten | no | 0 | ~0 | ~12 |

**Read:** H1/H3/H4 land as hypothesized — cross-session recall, surfacing one critical fact out of 31 candidates at ~23 vs ~428 tokens, and prune-based forgetting after ~12 weeks. H2 is the honest finding: the engine retrieves *both* the old and new preference, documenting that consolidation has no contradiction-aware supersession yet — a real, useful gap, not a script bug.

## Alibaba Cloud deployment

**Deployed and running on Alibaba Cloud.** The app is live on an Alibaba Cloud Simple Application Server — a zero-dependency Node service ([`web/server.mjs`](https://github.com/v1b3x0r/living-memory-engine/blob/main/web/server.mjs)) that serves the static build and proxies to Qwen, running under systemd behind nginx. Try it live at **https://cm.viibe.to** (also `http://47.79.255.217`). All chat and embedding inference runs on **Qwen Cloud / Alibaba Cloud Model Studio** (`dashscope-intl.aliyuncs.com/compatible-mode/v1`), verified end-to-end through the deployed server (model listing, streamed chat, 768-dim embeddings). So both the backend host and the model inference are on Alibaba Cloud. A live-deploy screenshot is in [`docs/superpowers/hackathon/evidence/`](https://github.com/v1b3x0r/living-memory-engine/tree/main/docs/superpowers/hackathon/evidence).

## Significantly updated since the submission period opened (May 26, 2026)

This project was extended substantially after May 26:
- **2026-06-02..05:** web pivot (Vite + vanilla TS), ambient oracle (real weather/air → salience → proactive greet), 5-signal self-state grounding, prospective-memory resolution lifecycle, and Spec 1A attributed multi-person memory (PR #2 + merges).
- **2026-07-20 (this submission):** Qwen Cloud integration via key-safe proxy, deterministic evaluation vs baseline, the memory-lifecycle chip, and an engine-first documentation + architecture pass.

## What's next

- A canonical, single server-side entity that lives 24/7 (engine hosted in Node, shared memory) with background continuity — the city keeps living while you're away.
- Privacy-scoped retrieval (Spec 1B): per-viewer visibility filtering over the attributed multi-person memory tiers.
- Contradiction-aware consolidation, so an updated preference supersedes the old one (the H2 finding above).

## Built with

TypeScript · Vite · vanilla JS (no framework) · IndexedDB · Qwen Cloud (Alibaba Cloud Model Studio: `qwen3.7-plus`, `text-embedding-v4`) · Open-Meteo · vitest.
