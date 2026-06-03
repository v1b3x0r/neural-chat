import { cosineSimilarity } from './vector.js';
import type { EngineConfig, EpisodicMemory, PatternEvidence } from './types.js';

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
