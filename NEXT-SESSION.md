# neural-chat — NEXT SESSION (warp point)

> Read THIS file first to resume instantly. Side project (not HomeLog). Last session: 2026-05-28.
> One-line: a personal **living-memory chat app** — talk in one thread forever; a TS memory engine decays/consolidates/crystallizes memory instead of stuffing the context window. Built end-to-end, runs on the founder's phone.

## Resume in 30 seconds
```bash
cd neural-chat/engine && npm test        # 36 tests should be green (the engine is solid)
cd ../mobile && npx expo start            # Metro; scan with App Store Expo Go (SDK 54)
```
- Everything is on branch **`feat/expo-app`** (NOT merged to main, NOT pushed — founder decides).
- The **engine** (pure TS) is merged to `main` separately and fully tested. The **Expo app** lives only on `feat/expo-app`.

## Architecture (where things are)
- `engine/` — framework-agnostic living-memory engine (pure TS, vitest). Built to `engine/dist/` via `npm run build`. **After editing `engine/src`, run `cd engine && npm run build`** or the app won't see changes (app imports the compiled `dist` via `file:../engine`).
  - `src/engine.ts` MemoryEngine: `ingestUser/ingestModel/respond()/retrieve/tick/rewindTo`. `respond()` = full turn (ingest→retrieve→stream→store→tick); injects current time so the LLM is time-aware.
  - `src/consolidation.ts` decay/reinforce/merge/prune/detectPatterns · `src/policy.ts` fixedK/randomK(default 3,7)/gamble · `src/random.ts` seeded PRNG · `src/vector.ts` cosine+MMR · `src/inject.ts` formatInjection.
  - `provider/` OpenAI-compatible chat (SSE) + embed; `makeChatPort/makeEmbedPort` take an injectable `fetchImpl`.
  - `test/timeMachine.ts` fast-forward harness + behavior tests.
- `mobile/` — Expo SDK 54 app (expo-router, `app/`).
  - `app/index.tsx` chat (single thread, floating frosted pill composer, ambient gradient, timestamps+date badges, long-press context menu, retry/edit/rewind, model chip).
  - `app/models.tsx` model picker (fetch OpenRouter `/models` + search + star). `app/settings.tsx` ONE field (OpenRouter key). `app/new-persona.tsx` create friend.
  - `lib/engine.ts` getEngine(namespace, systemPrompt) cache · `lib/storage.ts` SQLite StoragePort · `lib/config.ts` key/model (chat+embed both OpenRouter, one key) · `lib/personas.ts` per-DB personas (reactive) · `lib/theme.ts` palette (light/dark) · `lib/models.ts` fetch.
  - `components/` drawer-content, action-sheet (bottom-sheet menu), frosted (glass iOS/solid Android), icon (SF Symbols/Ionicons).
- Spec: `docs/superpowers/specs/2026-05-28-living-memory-chat-design.md`. Plans: `docs/superpowers/plans/`. Prototype at repo root (`App.tsx`) = reference only, don't extend.

## What works (verified on device)
chat e2e streaming · memory engine · model picker · persona spawn (separate memory) · conversation control (retry/edit/rewind, edit is cancelable) · copy (both sides) · dark mode (follows system) · timestamps+date badges · ambient gradient · floating composer · one-key settings (chat+embed via OpenRouter, `openai/text-embedding-3-small`). Default model `google/gemma-4-26b-a4b-it:free` (free, 429s sometimes → retry).

## Last edit (verify first next session)
Keyboard fix for the floating composer (iOS keyboard was covering it): now tracks keyboard height via `Keyboard` events → composer `bottom: kb`. **Typecheck-only — needs on-device check** that the composer sits above the keyboard on iOS. Also nudged placeholder to vertical-center + brighter.

## Device loop (input injection is BLOCKED on the founder's Xiaomi)
- SEE the screen: `adb exec-out screencap -p > /tmp/s.png` then Read it.
- Open a route: `adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081/--/<route>"` (e.g. `/--/models`). First: `adb reverse tcp:8081 tcp:8081`.
- Reload app: `adb shell am force-stop host.exp.exponent && adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081"`.
- Logs: `adb logcat -d -t 80 | grep ReactNativeJS`.
- **Taps/typing: founder does them** (MIUI blocks `adb shell input`). Founder also tests on iPhone.

## Gotchas (hard-won)
- **Expo Go SDK**: App Store Expo Go caps at **SDK 54**; SDK 55+ need `eas go`/TestFlight. Keep SDK 54.
- **Metro + engine**: `mobile/metro.config.js` has `watchFolders: ['../engine']` — REQUIRED or Metro can't resolve the linked engine.
- **git output crashes the Bash tool** ("H.replace") — always pipe: `git -C <path> ... 2>&1 | cat`.
- **RN fetch can't stream** → app passes `expo/fetch` to the engine provider.
- API key in `mobile/.env` (`EXPO_PUBLIC_OPENROUTER_API_KEY=...`, gitignored) so you don't type it on the phone; also overridable in Settings (secure-store).

## Backlog (next round → App Store)
unfreeze **image upload** (P0 frozen; engine already supports image→vision→episodic) · debug/time-travel screen (spec Phase F) · persona seed-drift mode · native context-menu (when Expo supports) · **App Store prep**: app icon/splash/name, EAS build + submit · local/LM-Studio embed pipe (optional).

## Decision when you return
Merge `feat/expo-app` → main and/or push to GitHub? (founder's call). Then pick a backlog item.
