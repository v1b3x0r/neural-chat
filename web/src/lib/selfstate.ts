import { AMBIENT, getActiveProfile } from './config';
import { makeStorage, getRaw } from './storage';
import type { WorldSnapshot } from './world';

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
  if (ms === null) return 'none';
  const m = Math.max(0, ms);
  if (m < 60 * 60_000) return `${Math.round(m / 60_000)} min`;
  if (m < DAY_MS) return `${Math.round(m / (60 * 60_000))} hr`;
  return `${Math.round(m / DAY_MS)} days`;
}

/** PURE: SelfState → the [Self-state] block. Facts line always; one (adjust stance: …) line only when off-nominal. */
export function formatSelfState(s: SelfState): string {
  const facts = [
    s.online ? 'online' : 'offline',
    s.llm === 'local' ? 'thinking on a local model' : 'thinking on a remote model',
    s.embeddings === 'ready' ? 'semantic memory ready'
      : s.embeddings === 'degraded' ? 'semantic memory incomplete'
      : 'no semantic memory yet',
    s.worldFeed === 'fresh' ? `live surroundings feed (updated ~${fmtAge(s.worldFeedAgeMs)} ago)`
      : s.worldFeed === 'stale' ? `surroundings feed is stale (updated ~${fmtAge(s.worldFeedAgeMs)} ago)`
      : 'no surroundings feed',
    s.memoryAgeMs === null ? 'no memories yet' : `last memory ~${fmtAge(s.memoryAgeMs)} ago`,
  ];

  // order: feed → embeddings → connectivity → memory. (No stance change for remote vs local — same behaviour either way.)
  const dir: string[] = [];
  if (s.worldFeed === 'stale')        dir.push('The surroundings feed is stale; speak about the weather or your surroundings from memory, not as if you can see it live right now.');
  if (s.worldFeed === 'unavailable')  dir.push('You have no surroundings feed right now; do not invent weather or surroundings — if you do not know, say so.');
  if (s.embeddings === 'degraded')    dir.push('Memory search may be imprecise right now; if you bring up something old, allow that it may be off and do not insist you remember it exactly.');
  if (s.embeddings === 'unavailable') dir.push('There is no semantic memory to search yet; anything you raise is new or most recent only, so do not act like you are recalling something old.');
  if (!s.online)                      dir.push('You are thinking alone on-device, not connected to the outside world; keep to what is within you and do not assert live or external facts as certain.');
  if (isMemoryOld(s.memoryAgeMs))     dir.push('You have not talked in a while; your latest memory is old, so do not assume it is still current — check with what the user says now first.');

  const lines = ['[Self-state]', `Right now: ${facts.join(' · ')}`];
  if (dir.length) lines.push(`(adjust stance: ${dir.join(' ')})`);
  return lines.join('\n');
}

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
