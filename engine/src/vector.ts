export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0, ma = 0, mb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!, y = b[i]!;
    dot += x * y; ma += x * x; mb += y * y;
  }
  const denom = Math.sqrt(ma) * Math.sqrt(mb);
  return denom === 0 ? 0 : dot / denom;
}

export interface MmrItem { id: string; embedding: number[] | null; }
export interface MmrPick<T> { item: T; similarity: number; }

export function mmrSearch<T extends MmrItem>(
  query: number[],
  items: T[],
  opts: { topK: number; lambda: number; minSimilarity?: number },
): MmrPick<T>[] {
  const minSim = opts.minSimilarity ?? 0;
  const candidates = items.filter((i): i is T & { embedding: number[] } => !!i.embedding?.length);
  const scored = candidates
    .map(item => ({ item, similarity: cosineSimilarity(query, item.embedding) }))
    .filter(s => s.similarity >= minSim);
  const selected: MmrPick<T>[] = [];
  const remaining = [...scored];
  while (selected.length < opts.topK && remaining.length) {
    let bestIdx = -1, best = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const cand = remaining[i]!;
      let maxSimSel = 0;
      for (const s of selected) {
        const sim = cosineSimilarity(cand.item.embedding!, (s.item as MmrItem).embedding!);
        if (sim > maxSimSel) maxSimSel = sim;
      }
      const mmr = opts.lambda * cand.similarity - (1 - opts.lambda) * maxSimSel;
      if (mmr > best) { best = mmr; bestIdx = i; }
    }
    if (bestIdx === -1) break;
    selected.push(remaining.splice(bestIdx, 1)[0]!);
  }
  return selected;
}
