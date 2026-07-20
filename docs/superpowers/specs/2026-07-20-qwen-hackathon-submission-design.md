# Qwen Cloud Hackathon Submission — "Living Memory Engine" (Design)

**Date:** 2026-07-20 · **Deadline:** 2026-07-20 14:00 PDT = 2026-07-21 04:00 ICT (~15h from design time)
**Event:** Global AI Hackathon Series with Qwen Cloud (Devpost) · **Track:** MemoryAgent
**Status of prerequisites:** Devpost registered ✓ · Qwen Cloud account + free credit requested ✓

## 1. Positioning

- **Submission name:** Living Memory Engine — *memory that decays, consolidates, and crystallizes*
- **One-liner:** A TypeScript memory substrate for agents that remember like a mind, not a log — proven by เชียงใหม่ (Chiang Mai), a city-entity that senses the real world, remembers you across sessions, and knows its own state. Runs on Qwen Cloud.
- **Judging map:** engine mechanics (decay/consolidate/crystallize/MMR retrieve, 92 engine + 63 web tests) → technical depth 30% · เชียงใหม่ ambient + self-state senses → innovation 30% · provider-agnostic "add human-like memory to any agent" + live deployed entity → real-world value 25% · video/diagram/README → presentation 15%.
- **Demo language:** Thai (authentic) with English subtitles. The entire demo runs on the Qwen profile.

## 2. Qwen integration (web-only; zero engine edits)

New ModelProfile preset **Qwen Cloud** in `web/src/lib/config.ts`:

- `baseURL: '/api/qwen/v1'` (same-origin proxy — key never reaches the browser).
- **Smoke-tested live 2026-07-20 ~14:00 (founder's real key, `sk-ws-…` workspace key):** `GET /v1/models` **works** (qwen3.7-max/plus families and more — normal model discovery applies), chat completion works (`qwen3.6-flash`; it returns `reasoning_content` — a thinking model — so the plan must ensure the stream parser tolerates/ignores reasoning deltas, or select a non-thinking mode/param), embeddings `text-embedding-v4` with `dimensions: 768` returns exactly 768. Fallback entries kept as safety only: `qwen3.7-plus` / `qwen3.6-flash`.
- Embed model `text-embedding-v4` at **768 dims** to match the engine's existing vector width. The **proxy injects `dimensions: 768`** into `/embeddings` requests server-side, so neither engine provider ports nor web adapters change.
- The existing client-side key path (drawer-entered keys for OpenAI/OpenRouter/direct profiles) is untouched; the proxy is additive.

**Embedding-space rule:** vectors from different embedders are not comparable even at equal dims. The demo therefore runs on a **fresh brain** (existing 🧹 per-persona brain-wipe) so every vector comes from text-embedding-v4. This doubles as the video's "watch memory form from zero" narrative.

## 3. Backend proxy (two layers, one shape)

```
dev:     browser ── /api/qwen/* ──▶ Vite middleware (QWEN_API_KEY from web/.env.local) ──▶ DashScope intl
deploy:  browser ── /api/qwen/* ──▶ Vercel function   (QWEN_API_KEY from project env)   ──▶ DashScope intl
```

- Upstream: `QWEN_BASE_URL` env (default `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` — **verified 2026-07-20**: docs.qwencloud.com quickstart uses exactly this URL; Qwen Cloud is DashScope intl re-branded).
- **Dev:** a `qwenProxy()` plugin in `web/vite.config.ts` following the existing `devlogSink()` middleware pattern. Env is loaded with Vite's `loadEnv(mode, root, '')` (no `VITE_` prefix — the key must never enter the client bundle). `web/.env.local` is gitignored (`*.local`) and already created with a `QWEN_API_KEY=` slot.
- **Deploy function: deferred** with hosting (§6b). When built, it mirrors the dev middleware and must pass SSE streaming through.
- **Proxy hardening (dev middleware now, function later — advisor A13):** restrict methods/paths to `/v1/chat/completions`, `/v1/embeddings`, `/v1/models`; **model allowlist** (qwen chat models + `text-embedding-v4` only); **cap `max_tokens`** server-side; per-IP limiter is best-effort only — the real backstop is the provider quota on the $40 credit.
- Forwarded headers: `Authorization: Bearer <key>` injected server-side; client `Authorization` (if any) is dropped on this route.

## 4. Repo publication (`v1b3x0r/neural-chat` → public)

1. Push local `main` (merged `79390a9` is currently unpushed).
2. Secrets scan over full history (keys/tokens/emails) before flipping visibility.
3. Add `LICENSE` (**Apache-2.0** — advisor A2; rules only require a detectable open-source license, Apache adds the patent grant that suits a library. Also set `"license": "Apache-2.0"` in `engine/package.json` + `web/package.json`).
4. README rewrite, engine-first: problem → engine mechanics diagram → เชียงใหม่ as proof → Qwen Cloud quick start (proxy + `.env.local`) → local-first Ollama mode → architecture diagram (mermaid, also exported as image for Devpost).
5. **No rename tonight** (advisor A8): the submission is titled "Living Memory Engine" while the repo stays `neural-chat` — rename adds link/redirect/deploy churn for zero score.
5b. **Significant-update clause** (rules, verified): pre-existing projects must be "significantly updated after May 26, 2026 8:00am PT". The Devpost description lists concrete post-cutoff work by date: 2026-06-02..05 (web pivot, ambient oracle, self-state grounding, prospective-resolution, Spec 1A attributed memory — PR #2 + merges) and tonight (Qwen Cloud deployment, evaluation baseline, lifecycle chip, live entity).
6. Untracked local noise (`.claude/`, `.playwright-mcp/`, session json, screenshots) stays uncommitted. `NEXT-SESSION.md` and `docs/superpowers/` history stay in — engineering-process evidence.
7. Alibaba Cloud deployment proof per rules = link to the proxy/profile code files that call the DashScope (Alibaba Cloud Model Studio) API.

## 5. Scope R + B — UI redesign & demo shine (timeboxed, strictly after A is submission-complete)

**R — UI restyle, single-theme (~2h hard timebox, before video recording; A7 arbitration).** **Gate (advisor A12): R must not start until ALL of** — public repo · live Qwen round-trip in the app · evaluation table · Devpost description draft · architecture image — **exist. If the gate is unmet by 18:00, R degrades to: B1 chip + CSS touch-ups on camera-visible viewport only, 45-minute cap.** Founder verdict: current UI reads "MVP" and the entity is going public — but scope E (evaluation) outranks cosmetic depth. Executed under the installed **`design-taste-frontend`** skill (the tasteskill.dev framework: brief → design direction → pre-flight anti-slop check), with one deliberate deviation: **single theme only** — the theme that reads best on camera; dual dark/light is deferred post-hackathon. Constraints:
- **Restyle, not restructure:** DOM shape and all logic in `chat.ts` / `drawer.ts` / `debug.ts` stay; changes are CSS/design-token/typography/layout-level so the 63 web tests and the turn lifecycle are untouched.
- Identity: เชียงใหม่'s own character (warm, atmospheric, modern-Thai) — borrows the Qwen mockup's clean spatial language and status-chip legibility, not its palette.
- B1 chip (below) is folded into the redesign as one visual system.
- Verified with a Playwright pass (greet, chat, pane, drawer) before recording.

**B1 — memory-phase chip (~1h, folded into R).** A small status chip in the main chat UI mirroring the organizers' own MemoryAgent mockup language ("Listening / Recalling memory"), but driven by the real engine lifecycle in `web/src/ui/chat.ts` / `labRespond` phases:
- retrieve running → "🔍 recalling…"
- streaming reply → hidden (stream is its own signal)
- post-turn `tick` (extract/consolidate) → "🧠 consolidating memory…"
Chip is presentational only; no engine or labRespond signature changes. Thai labels + Eng subtitle handled in video.

**B2 — 1B persons viz: DROPPED tonight (advisor A7).** The Spec 1B debug-pane viz (👥 persons, 🔗 ledger, attribution badges) returns to the normal roadmap after the hackathon.

R and B1 can each be dropped without touching submission completeness.

## 5.5 Scope E — evaluation baseline (P1, advisor A4)

A small deterministic evaluation *measuring* the memory mechanism against a naive baseline — the shift from "chat with pretty memory" to "memory substrate with evidence". **Scenarios are hypotheses, not pre-written results (advisor A11): the script reports whatever actually happens; a hypothesis that fails is a finding, not a submission failure** (e.g. if both old and new preference are retrieved, that documents which consolidation layer handles resolution today). 4 scripted scenarios driven through the engine with the fake-port/fake-clock harness the engine test suite already uses, with a **deterministic seed and fake clock** stated in the output:

1. **H1 — preference recall across sessions:** engine retrieves the relevant preference without resending history.
2. **H2 — preference updated later:** the decayed/older value loses to the newer one at retrieval.
3. **H3 — limited context window:** the injected working set stays small and relevant vs blunt truncation.
4. **H4 — expired memory:** a long-decayed memory is no longer retrieved.

Reported per scenario (measured, never asserted): relevant memory retrieved · stale memory retrieved · injected memory count · estimated injected tokens · **full-history token baseline**. Output = one table reused in README, Devpost description, and one video beat. Implementation as a standalone script (location decided in plan; no product-code changes).

## 6. Deployment evidence & (optional) live demo hosting

Two separate concerns, never conflated (advisor A13): **inference deployment evidence** (eligibility) vs **demo hosting** (convenience).

**6a. Eligibility evidence (P0).** The Devpost announcement "Proof of Deployment 101" (verified 2026-07-20) requires proving the project "actually ran on Alibaba Cloud — not just sketched in Figma, not just running locally"; "No proof = not eligible"; proof must appear in **both the code repo and the demo video**. Constraint: founder's Alibaba Cloud console access is stuck in ~3-day identity verification, past the deadline. Honest-evidence ladder, in order:
1. Search the active Qwen Cloud console (home.qwencloud.com) for any Workbench / Apps / Deployments / Playground surface. If anything can be deployed/run as a resource there, use it and screenshot it running.
2. Regardless: screenshot the Qwen Cloud API usage / request logs and the account page; capture live Qwen inference on screen in the video (the console usage dashboard is a video beat).
3. Repo side: the proxy/profile code files calling the Qwen Cloud (Alibaba Cloud Model Studio) API, linked prominently in README as deployment proof, plus the screenshots.
4. If verification remains pending at submit time, submit anyway with the evidence above and an explicit note of the pending state — acknowledged eligibility risk, **no claims beyond what is true** (a non-Alibaba-hosted web server is never presented as "backend on Alibaba Cloud").

**6b. Live demo hosting (deferred — founder decision 2026-07-20).** No Vercel work tonight until core scope is done; a live "Chiang Mai Entity" URL is a nice-to-have decided post-core. If done later: static Vite build + one serverless proxy function, per-visitor IndexedDB memory ("everyone gets their own relationship with the city"), ambient sense works as-is.

**6c. Roadmap (write-up only):** the canonical single server-side entity that lives 24/7 (engine hosted in Node, shared memory, background continuity) — not built tonight.

## 7. Video (**under 3:00 hard — target 2:40–2:50** per rules wording "less than three minutes"; recorded on the local Qwen profile, fresh brain — memory-first ordering per advisor A5)

| t | Scene |
|---|---|
| 0:00 | Open the app — it immediately recalls a preference told in a *previous session* (hook). Lifecycle chip shows real phases. |
| 0:20 | Problem: full history grows without bound; naive RAG remembers everything equally → "remember like a mind, not a log". |
| 0:45 | 🧠 pane: memory forms → decays → merges → crystallizes (strength values moving). |
| 1:25 | Injection Tap: the small working set actually injected into Qwen — not the whole log. |
| 1:55 | Evaluation beat: baseline-vs-engine table (stale preference corrected, tokens saved). |
| 2:20 | เชียงใหม่ sensing the real world (ambient greet about live weather/air) as the living proof + personality. |
| 2:40 | Architecture diagram + **deployment-proof beat: the live Qwen Cloud console usage/request dashboard on screen** (announcement requires proof *in the video*) + repo URL. |
| (only if time remains) | Interoception cut-network moment (different thesis — optional per A5). |

**Provider line (A3 fix — the old "brain swaps, memory stays" scene contradicted the embedding-space rule in §2 and is cut):** "The engine is provider-agnostic; this deployment uses one consistent Qwen embedding space." No live embedder hot-swap is shown.

Deliverables around it: shot-by-shot script + Eng subtitle `.srt` (Claude), recording + edit + upload (founder). **Subtitles are burned into the picture** (judges must read the mechanism in real time; don't rely on YouTube CC alone — advisor A10); the `.srt` doubles as CC bonus.

## 8. Submission package checklist (Devpost)

- [ ] Public repo URL + Apache-2.0 license (detectable on repo page)
- [ ] "Significantly updated after May 26" evidence list (dated commits/PRs) in the description
- [ ] Evaluation table (scope E) in README + description
- [ ] Deployment evidence (§6a): proxy/profile code files linked in README + Qwen Cloud console usage/log screenshots in repo + console beat in video
- [ ] Architecture diagram (image in README + shown in video)
- [ ] Video **under 3:00** (YouTube) with burned-in Eng subs
- [ ] Project description (Eng) — engine story, track fit, evaluation table, roadmap (canonical entity, background continuity)
- [ ] (Optional, post-core) live demo URL — hosting decision deferred per founder
- [ ] Blog post draft (scope C — Blog Post Award, 10 winners) for founder to publish (dev.to/Medium/X)

## 9. Timeline (from ~13:00 ICT)

| ICT | Founder | Claude |
|---|---|---|
| 14:00–15:00 | **Hunt Qwen Cloud console** (home.qwencloud.com) for Apps/Workbench/Deployments surface; screenshot usage/API-log + account pages (§6a) | Qwen preset + dev proxy (key smoke-tested ✓); Apache-2.0 LICENSE + package.json; README skeleton + diagram |
| 15:00–16:00 | — | Live Qwen round-trip in the app; secrets scan → push → repo public (**submission-complete core ~16:00**) |
| 16:00–17:30 | — | **Scope E evaluation** + results table into README/Devpost |
| 17:30–18:00 | — | Devpost description draft + architecture image final (**R-gate check**) |
| 18:00–20:00 | Review design direction mid-way | **R restyle (single-theme) + B1 chip** (hard stop 20:00; degraded 45-min mode if gate missed) → Playwright verify |
| 20:00–21:30 | Record + edit video (burn-in subs), upload | Video script + .srt; final Devpost description |
| 21:30–23:00 | **Submit on Devpost** | Checklist pass (verify skill) |
| 23:00–04:00 | Buffer | Buffer — blog (C) here; hosting decision if founder wants it |

## 10. Risks

- **Eligibility (deployment proof)** — the "Proof of Deployment 101" announcement demands proof the project "actually ran on Alibaba Cloud" in repo AND video, while Alibaba console KYC stays pending past the deadline. Mitigated by the §6a evidence ladder; submission proceeds with honest evidence and an explicit pending-verification note — never claiming a non-Alibaba host as Alibaba backend.
- ~~DashScope specifics~~ **RESOLVED 2026-07-20 ~14:00** — live smoke test passed all three endpoints (models list, chat, embeddings 768) on the founder's key. Remaining niggle: `reasoning_content` from thinking models must not break/stall the stream parser.
- ~~Free-credit activation~~ **RESOLVED** — key works.
- **Old memories under new embedder** — avoided by fresh-brain demo rule.
- **UI restyle on submission night** — the biggest self-inflicted risk. Mitigations: restyle-not-restructure rule, single theme only, hard 20:00 timebox, submission-complete deploy exists *before* restyle starts, Playwright verify before recording.
- **Time** — R/B scope is strictly droppable (gate + degraded mode); submission-complete core (public repo + live Qwen round-trip in the app) is reached by ~16:00.

## 11. Verification

- Existing suites stay green: `cd web && npm test` (63) · `cd engine && npm test` (92) · `cd web && npx tsc --noEmit` (0 errors). Engine `dist/` untouched (no engine edits).
- Live smoke test on Qwen profile before any recording: chat streams, embeds return 768-dim, memory extract/retrieve round-trips, ambient greet fires.
- Deployed entity verified from a clean browser profile (no localStorage/key): greet + chat + memory pane all functional.
