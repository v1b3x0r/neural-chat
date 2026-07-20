# Codex handoff brief — Living Memory Engine

> Context brief for a final review pass before Devpost submission. Everything hackathon-related lives in this folder (`docs/superpowers/hackathon/`). Read this first; you shouldn't need to hunt.

## TL;DR
A framework-agnostic **TypeScript memory engine** that decays / consolidates / crystallizes memories so an agent runs on a small bounded context instead of an ever-growing transcript. Proven by **เชียงใหม่**, a Chiang-Mai city-entity that senses the real world and remembers across sessions. Submitted to the **MemoryAgent** track of the Qwen Cloud hackathon. **The whole thing is deployed and running on Alibaba Cloud.**

## Submission links
- **Live (no setup, just open):** https://cm.viibe.to  (also `http://47.79.255.217`)
- **Repo (public, Apache-2.0):** https://github.com/v1b3x0r/living-memory-engine
- **Demo video (2:25, < 3 min):** `docs/superpowers/hackathon/media/demo.mp4`  → upload to YouTube, then paste the link into `devpost-draft.md`
- **Devpost text (ready to paste):** `docs/superpowers/hackathon/devpost-draft.md`
- **Deploy runbook:** `docs/superpowers/hackathon/DEPLOY.md`
- **Reproduce evaluation:** `cd engine && npm run eval`

## Requirements checklist (verify each before Submit)
| Requirement | Status | Evidence |
|---|---|---|
| Public repo + detectable OSS license | ✅ | Apache-2.0, GitHub-detected |
| **Proof it ran on Alibaba Cloud** (in repo **and** video) | ✅ | Backend = Node `web/server.mjs` under systemd+nginx on Alibaba **Simple Application Server** (47.79.255.217); inference on Qwen Cloud / Alibaba Model Studio. Code proof: `web/server.mjs`, `web/src/lib/qwenproxy.ts`, `web/src/lib/config.ts`. Screenshot: `evidence/deployed-alibaba-cloud.png`. Video close beat shows the live URL + stack. |
| Uses Qwen models on Qwen Cloud | ✅ | `qwen3.7-plus` (chat) + `text-embedding-v4` @768 (embed), verified live end-to-end |
| Demo video < 3:00, shows the project | ✅ 2:25 | burned-in English subs + OpenAI-TTS (sage) VO |
| Architecture diagram | ✅ | README mermaid + video architecture beat |
| Pre-existing project → significant update after 2026-05-26 | ✅ | dated list in README + devpost-draft (web pivot, ambient oracle, self-state, prospective resolution, Spec 1A, then the whole Qwen integration + deploy + eval this submission) |
| Tests green | ✅ | engine **92**, web **74**, `tsc` 0 errors, zero engine edits from web work |

## Repo map (where things are)
- `engine/` — the memory engine (`@nature-labs/living-memory-engine`), pure ports & adapters, no IO. `engine/eval/run.ts` = the baseline evaluation.
- `web/` — the app (Vite + vanilla TS, IndexedDB). Key files: `server.mjs` (prod server), `src/lib/qwenproxy.ts` (proxy rules), `src/lib/config.ts` (profiles; Qwen is default), `src/lib/why.ts` (L2 explainability), `src/ui/debug.ts` (memory pane).
- `docs/superpowers/specs/` + `plans/` — brainstorm→spec→plan history (kept public deliberately: shows process rigor).
- `advisor-inbox.md` — the multi-AI (GPT/Claude) decision ledger for this build.
- `docs/superpowers/hackathon/` — **this bucket**: brief, devpost draft, deploy runbook, video script, subtitles, `media/` (video + key screenshots), `evidence/` (deploy proof).

## What to scrutinize (highest-value review targets)
1. **Deployment-proof wording** in `devpost-draft.md` §"Alibaba Cloud deployment" — confirm it's *honest and sufficient*: the backend genuinely runs on an Alibaba SAS; we do NOT claim anything false. If the "Proof of Deployment 101" announcement wants a specific screenshot format, add matching captures to `evidence/`.
2. **Video**: confirm the uploaded YouTube version is < 3:00, subs legible, and it visibly shows (a) cross-session recall, (b) the "why this answer" context composition, (c) the live Alibaba deployment.
3. **Eval honesty**: H2 retrieves *both* old+new preference — framed as a documented finding (no contradiction-aware supersession yet), NOT hidden. Keep it that way.
4. **Devpost field mapping**: the draft is one doc; map its sections to Devpost's actual fields (inspiration / what it does / how built / challenges / accomplishments / what's next / built-with / links).

## Decisions already made — please DON'T re-litigate
- Repo renamed `neural-chat` → `living-memory-engine` (GitHub redirects old links). **IndexedDB db name stays `'neural-chat'`** on purpose — renaming it orphans every deployed user's memory.
- UI chrome is **English**; เชียงใหม่ **mirrors the user's language** (Thai in → Thai out, English in → English out). Footage keeps her Thai voice = authentic differentiation.
- **Qwen Cloud is the default profile** (works out of the box; the earlier "connection refused" was the old Ollama-local default).
- Dark = clean near-black, Light = beige; the white-canvas bug was fixed at the root (`html { background }` + `color-scheme`).
- **No inline per-message "used memory" chip** — the 🧠 pane's "why this answer" + the video carry the explainability (conversation-first, per design + advisor).
- Internal process docs are public on purpose (rigor is a positive signal).

## Remaining founder actions before Submit
1. Upload `media/demo.mp4` to YouTube (unlisted is fine) → paste link into `devpost-draft.md` (`_paste YouTube link_`).
2. Paste `devpost-draft.md` content into the Devpost fields; select track **MemoryAgent**.
3. (Optional) add more Qwen Cloud console usage screenshots to `evidence/`.
4. **Submit before 2026-07-20 14:00 PDT** (= 2026-07-21 04:00 ICT).

## Verify locally in 30 seconds
```bash
cd engine && npm test      # 92 green
cd ../web && npm test      # 74 green
cd web && npx tsc --noEmit # 0 errors
cd ../engine && npm run eval   # reproduces the baseline table
curl -sS -o /dev/null -w '%{http_code}\n' https://cm.viibe.to/   # 200 (live)
```
