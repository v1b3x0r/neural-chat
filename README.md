# neural-chat — living-memory chat

A personal chat where you talk to an entity that **remembers like a mind, not a log**.

Most chat apps stuff the whole conversation back into the prompt until it overflows. neural-chat instead runs a small TypeScript **memory engine** that *decays, consolidates, and crystallizes* memories over time — so you can talk forever and each turn the model only ever sees a small, relevant working set. Runs **fully local** on [Ollama](https://ollama.com) (no keys, no cloud required).

The star is **เชียงใหม่** — a persona that *is* the city. It senses the real world (live weather & air quality), notices when something feels off, and greets you first. And it knows its own state: whether it's online, thinking on a local or remote brain, whether its memory and senses are working — and it speaks more honestly when they aren't.

> Experimental side project. Local-first, single user, evolving fast.

## The idea in one picture

```
you ── talk ──▶  retrieve a few relevant memories + recent turns  ──▶  LLM
                        ▲                                               │
                        │                                          reply
              decay · merge · crystallize  ◀── consolidate (tick) ◀────┘
```

- **No context stuffing.** The full history is never re-sent. Each turn retrieves the top-K most relevant memories (semantic search + diversity) plus a short tail.
- **Memory that settles.** After each turn the engine extracts new episodic memories, embeds them, decays old ones (Ebbinghaus-style), merges duplicates, and crystallizes stable traits into a "self".
- **Senses, not just chat.**
  - *Exteroception* — an ambient loop reads เชียงใหม่'s real weather/air, scores how unusual it is against the city's own learned normal (diurnal z-score, no hardcoded thresholds), remembers it, and may greet you about it.
  - *Interoception* — a `[Self-state]` block tells the entity its own runtime condition (online · local/remote model · embeddings health · world-feed freshness · memory age) so it self-calibrates: speak from memory when the feed is stale, don't fake recall when embeddings are down, know when it's thinking alone.

## Quick start

**Prerequisites:** [Node.js](https://nodejs.org) and [Ollama](https://ollama.com) running locally.

```bash
ollama pull gemma4:e2b embeddinggemma    # a chat model + an embedding model
cd engine && npm install                 # builds the memory engine (web links it via file:../engine)
cd ../web && npm install && npm run dev   # → http://localhost:5173
```

Open the app, say hi to เชียงใหม่. Switch model/provider in the ☰ drawer (Ollama · LM Studio · OpenRouter · OpenAI). Open the 🧠 pane to inspect live memory and tune exactly what the model is fed.

```bash
cd web && npm test          # unit tests
cd web && npx tsc --noEmit  # typecheck
```

## What's inside

| Dir | Role |
|---|---|
| `web/` | The app — Vite + vanilla TypeScript (no framework), IndexedDB storage, the ambient & self-state senses, and a Lab pane to inspect/tune the prompt. |
| `engine/` | `@nature-labs/living-memory-engine` — the framework-agnostic memory engine (decay / consolidation / crystallization / retrieval). Pure ports & adapters; the web app just supplies a browser storage + an OpenAI-compatible LLM port. |
| `mobile/` | An earlier Expo prototype. Frozen — superseded by `web/`. |

The engine is provider-agnostic: any OpenAI-compatible endpoint works (Ollama, LM Studio, OpenRouter, OpenAI). Model names are **discovered** from `/v1/models`, never hardcoded.

## Lab mode

The 🧠 pane is a tuning instrument: a live view of the entity's memory (episodic / self / prospective, with strength and embeddings), the **exact prompt last fed to the model**, per-component toggles for what to inject, and a per-persona brain-wipe to re-run experiments from zero. You can also spin up new personas with a custom system prompt.

## Evaluation vs naive baseline

A deterministic script (`engine/eval/run.ts`) drives the real `MemoryEngine` through four hypothesis scenarios (H1–H4) and compares it against a naive "resend full history" baseline. It's a measurement, not a test suite — each row reports whatever actually happened, including scenarios where the hypothesis didn't hold. Reproduce with:

```bash
cd engine && npm run eval
```

Deterministic: seed `1337`, `FakeClock` starting at epoch 0, `FakeEmbed` (a 64-dim bag-of-words hash — lexical overlap only, no real semantics).

This offline harness uses that deterministic **lexical** fake-embedder, so each scenario's query deliberately shares vocabulary with its stored fact — this measures retrieval/decay/MMR/token mechanics reproducibly, not semantic understanding. Semantic paraphrase matching (recognizing an answer that shares no words with the question) is out of scope for this fixture; it's handled by the real embedding model (Qwen `text-embedding-v4`) in the live app.

| Hypothesis | Relevant recalled | Stale recalled | Memories injected | Engine inject tokens | Full-history tokens |
|---|---|---|---|---|---|
| H1 cross-session preference | yes | n/a | 5 | ~42 | ~143 |
| H2 updated preference | yes | YES | 2 | ~25 | ~24 |
| H3 critical in limited window | yes | n/a | 2 | ~23 | ~428 |
| H4 expired memory forgotten | NO | no | 0 | ~0 | ~12 |

**Honest read:** H1, H3, and H4 land as hypothesized — cross-session preference recall, critical-fact surfacing out of 31 candidates, and prune-based forgetting after ~12 weeks all check out at a fraction of full-history tokens. H2 is the more interesting finding, not a clean win: it retrieves *both* the old and new seat preference side-by-side, which documents that consolidation currently doesn't resolve superseded facts (no contradiction-aware merge) — a real product gap, not a script bug.

---

Built as part of the Viibe World OS — a system that knows it is a system.
