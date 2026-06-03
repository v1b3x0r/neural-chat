import { AMBIENT } from './config';

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
  if (ms === null) return 'ยังไม่มี';
  const m = Math.max(0, ms);
  if (m < 60 * 60_000) return `${Math.round(m / 60_000)} นาที`;
  if (m < DAY_MS) return `${Math.round(m / (60 * 60_000))} ชั่วโมง`;
  return `${Math.round(m / DAY_MS)} วัน`;
}
