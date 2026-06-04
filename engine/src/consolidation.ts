import { cosineSimilarity } from './vector.js';
import type { EngineConfig, EpisodicMemory, PatternEvidence, ProspectiveMemory } from './types.js';

const DAY = 86_400_000;

export function decay(
  mems: EpisodicMemory[],
  o: { now: number; lastTick: number; tau: number },
): void {
  for (const m of mems) {
    const from = Math.max(m.createdAt, o.lastTick);
    const dtDays = Math.max(0, (o.now - from) / DAY);
    m.strength *= Math.exp(-dtDays / o.tau);
  }
}

export function reinforce(
  mems: EpisodicMemory[],
  o: { lastTick: number; boost: number },
): void {
  for (const m of mems) {
    if (m.lastRecalledAt >= 0 && m.lastRecalledAt >= o.lastTick) m.strength += o.boost;
  }
}

export function merge(mems: EpisodicMemory[], cfg: EngineConfig): EpisodicMemory[] {
  const out: EpisodicMemory[] = [];
  const consumed = new Set<string>();
  for (const m of mems) {
    if (consumed.has(m.id)) continue;
    if (m.strength >= cfg.mergeStrengthCeiling || !m.embedding) { out.push(m); continue; }
    let acc = m;
    for (const n of mems) {
      if (n.id === acc.id || consumed.has(n.id)) continue;
      if (n.strength >= cfg.mergeStrengthCeiling || !n.embedding) continue;
      if (cosineSimilarity(acc.embedding!, n.embedding) >= cfg.mergeThreshold) {
        const strong = acc.importance >= n.importance ? acc : n;
        acc = {
          ...strong,
          strength: acc.strength + n.strength,
          importance: Math.max(acc.importance, n.importance),
          content: strong.content,
          tags: [...new Set([...acc.tags, ...n.tags])],
          sourceMsgIds: [...new Set([...acc.sourceMsgIds, ...n.sourceMsgIds])],
        };
        consumed.add(n.id);
      }
    }
    consumed.add(m.id);
    out.push(acc);
  }
  return out;
}

export function prune(mems: EpisodicMemory[], floor: number): EpisodicMemory[] {
  return mems.filter(m => m.strength >= floor);
}

// Prospective intents decay on the same curve as episodic memory: an intent that
// never re-triggers fades. Reinforcement happens at trigger time (in retrieve), not here.
export function decayProspective(
  ps: ProspectiveMemory[],
  o: { now: number; lastTick: number; tau: number },
): void {
  for (const p of ps) {
    if (p.status !== 'pending') continue;
    const from = Math.max(p.createdAt, o.lastTick);
    const dtDays = Math.max(0, (o.now - from) / DAY);
    p.strength *= Math.exp(-dtDays / o.tau);
  }
}

// A faded intent is forgotten (the friend "lets it go") — status, not deletion,
// so the UI can still show "we never got around to this".
export function abandonWeakProspective(ps: ProspectiveMemory[], floor: number): void {
  for (const p of ps) {
    if (p.status === 'pending' && p.strength < floor) p.status = 'abandoned';
  }
}

// Bound the list so it never grows without limit (archive, not infinite ledger):
// keep the strongest `activeCap` pending intents and the most-recent `archiveCap`
// resolved/abandoned ones. The two tiers have separate budgets, so a full archive
// never evicts an active intent.
export function capProspective(
  ps: ProspectiveMemory[],
  o: { activeCap: number; archiveCap: number },
): ProspectiveMemory[] {
  const pending = ps.filter(p => p.status === 'pending').sort((a, b) => b.strength - a.strength);
  const dead = ps.filter(p => p.status !== 'pending').sort((a, b) => b.createdAt - a.createdAt);
  return [...pending.slice(0, o.activeCap), ...dead.slice(0, o.archiveCap)];
}

export function detectPatterns(mems: EpisodicMemory[]): PatternEvidence[] {
  const byTag = new Map<string, EpisodicMemory[]>();
  for (const m of mems) {
    for (const tag of m.tags) {
      const arr = byTag.get(tag) ?? [];
      arr.push(m);
      byTag.set(tag, arr);
    }
  }
  const out: PatternEvidence[] = [];
  for (const [key, group] of byTag) {
    const created = group.map(g => g.createdAt);
    out.push({
      key,
      recurrence: group.length,
      avgImportance: group.reduce((s, g) => s + g.importance, 0) / group.length,
      spanDays: (Math.max(...created) - Math.min(...created)) / DAY,
      memberIds: group.map(g => g.id),
    });
  }
  return out;
}
