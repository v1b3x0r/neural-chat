// L2 explainability: turn the engine's SELECTION into a human-readable "why did it answer this way".
// Pure + structural types (no engine import) so it stays trivially testable. The story is context
// COMPOSITION, not storage: the engine assembles a working context from several sources (long-term
// memory, live world observations, plans) and feeds the model only the items relevant to this turn.

export type Source = 'Memory' | 'Live' | 'Plan';
export const SOURCE_ORDER: Source[] = ['Memory', 'Live', 'Plan'];

export interface WhyItem { id: string; text: string; source: Source; }
export interface WhyView { query: string; used: WhyItem[]; available: WhyItem[]; usedCount: number; totalCount: number; }

/** ids the retrieve step actually selected for the last turn (from InjectionContext). */
export interface UsedIds { self: string[]; episodic: string[]; prospective: string[]; }

/** The subset of a Snapshot this view reads. Structural so tests need no engine fixtures. */
export interface WhySnapshot {
  selfFacets: { id: string; statement: string }[];
  episodic: { id: string; content: string; subject?: unknown; source_type?: unknown }[];
  prospective: { id: string; intent: string; status: string }[];
}

// A world/ambient observation is a LIVE reading of the outside world; anything else the entity recorded
// is genuine long-term MEMORY. (Plans come from the prospective tier, tagged separately below.)
function episodicSource(m: { subject?: unknown; source_type?: unknown }): Source {
  if (m.source_type === 'ambient' || m.subject === 'world') return 'Live';
  return 'Memory';
}

/**
 * Split every candidate context item into what THIS turn used vs. what was available but not selected,
 * tagged by SOURCE so it's clear the engine composes context from more than just memory.
 * `used` ids come from the retrieved InjectionContext; everything else in the snapshot is `available`.
 * Only pending prospective intents count (resolved/abandoned ones aren't live plans).
 */
export function buildWhy(query: string, used: UsedIds, snap: WhySnapshot): WhyView {
  const uSelf = new Set(used.self), uEp = new Set(used.episodic), uPro = new Set(used.prospective);
  const usedItems: WhyItem[] = [], available: WhyItem[] = [];
  const put = (isUsed: boolean, item: WhyItem) => (isUsed ? usedItems : available).push(item);

  for (const f of snap.selfFacets) put(uSelf.has(f.id), { id: f.id, text: f.statement, source: 'Memory' });
  for (const m of snap.episodic) put(uEp.has(m.id), { id: m.id, text: m.content, source: episodicSource(m) });
  for (const p of snap.prospective) {
    if (p.status !== 'pending') continue;
    put(uPro.has(p.id), { id: p.id, text: p.intent, source: 'Plan' });
  }
  return { query, used: usedItems, available, usedCount: usedItems.length, totalCount: usedItems.length + available.length };
}

/** Group items under their source in a stable display order, dropping empty sources. */
export function bySource(items: WhyItem[]): { source: Source; items: WhyItem[] }[] {
  return SOURCE_ORDER
    .map(source => ({ source, items: items.filter(i => i.source === source) }))
    .filter(g => g.items.length > 0);
}
