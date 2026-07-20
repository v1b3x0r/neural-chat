// L2 explainability: turn the engine's SELECTION into a human-readable "why did it answer this way".
// Pure + structural types (no engine import) so it stays trivially testable. The story is selection,
// not storage: what the retrieve step actually fed the model vs. what it had available and left out.

export type Concept = 'Preferences' | 'Recent experiences' | 'Plans' | 'Current context';
export const CONCEPT_ORDER: Concept[] = ['Preferences', 'Recent experiences', 'Plans', 'Current context'];

export interface WhyItem { id: string; text: string; concept: Concept; }
export interface WhyView { query: string; used: WhyItem[]; ignored: WhyItem[]; usedCount: number; totalCount: number; }

/** ids the retrieve step actually selected for the last turn (from InjectionContext). */
export interface UsedIds { self: string[]; episodic: string[]; prospective: string[]; }

/** The subset of a Snapshot this view reads. Structural so tests need no engine fixtures. */
export interface WhySnapshot {
  selfFacets: { id: string; statement: string }[];
  episodic: { id: string; content: string; subject?: unknown; source_type?: unknown }[];
  prospective: { id: string; intent: string; status: string }[];
}

// A world/ambient observation is "current context"; anything else the entity recorded is a "recent experience".
function episodicConcept(m: { subject?: unknown; source_type?: unknown }): Concept {
  const worldSubject = m.subject === 'world';
  if (m.source_type === 'ambient' || worldSubject) return 'Current context';
  return 'Recent experiences';
}

/**
 * Split every stored memory into what THIS turn used vs. what it had but ignored, tagged by human concept.
 * `used` ids come from the retrieved InjectionContext; everything else in the snapshot is `ignored`.
 * Only pending prospective intents count (resolved/abandoned ones aren't live plans).
 */
export function buildWhy(query: string, used: UsedIds, snap: WhySnapshot): WhyView {
  const uSelf = new Set(used.self), uEp = new Set(used.episodic), uPro = new Set(used.prospective);
  const usedItems: WhyItem[] = [], ignored: WhyItem[] = [];
  const put = (isUsed: boolean, item: WhyItem) => (isUsed ? usedItems : ignored).push(item);

  for (const f of snap.selfFacets) put(uSelf.has(f.id), { id: f.id, text: f.statement, concept: 'Preferences' });
  for (const m of snap.episodic) put(uEp.has(m.id), { id: m.id, text: m.content, concept: episodicConcept(m) });
  for (const p of snap.prospective) {
    if (p.status !== 'pending') continue;
    put(uPro.has(p.id), { id: p.id, text: p.intent, concept: 'Plans' });
  }
  return { query, used: usedItems, ignored, usedCount: usedItems.length, totalCount: usedItems.length + ignored.length };
}

/** Group items under their concept in a stable display order, dropping empty concepts. */
export function byConcept(items: WhyItem[]): { concept: Concept; items: WhyItem[] }[] {
  return CONCEPT_ORDER
    .map(concept => ({ concept, items: items.filter(i => i.concept === concept) }))
    .filter(g => g.items.length > 0);
}
