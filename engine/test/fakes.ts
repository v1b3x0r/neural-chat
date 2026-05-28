import type { Clock, StoragePort, EmbedPort, ChatPort, Snapshot, ExtractResult } from '../src/ports.js';
import type { EpisodicMemory, SelfFacet } from '../src/types.js';

export class FakeClock implements Clock {
  constructor(public t = 0) {}
  now() { return this.t; }
  advanceDays(d: number) { this.t += d * 86_400_000; }
}

export class InMemoryStorage implements StoragePort {
  snap: Snapshot = { messages: [], episodic: [], selfFacets: [], prospective: [], lastTick: 0 };
  async load() { return this.snap; }
  async save(s: Snapshot) { this.snap = s; }
}

// Deterministic bag-of-words embedding over a 64-dim space (collisions rare for short text).
export class FakeEmbed implements EmbedPort {
  fail = false;
  async embed(text: string): Promise<number[] | null> {
    if (this.fail) return null;
    const v = new Array(64).fill(0);
    for (const w of text.toLowerCase().split(/\W+/).filter(Boolean)) {
      let h = 0;
      for (const ch of w) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      v[h % 64] += 1;
    }
    return v;
  }
}

// Scripted chat: extract/summarize are programmable per test.
export class FakeChat implements ChatPort {
  extractQueue: ExtractResult[] = [];
  summary: { statement: string; kind: SelfFacet['kind'] } = { statement: 'pattern', kind: 'value' };
  async *stream(): AsyncIterable<string> { yield 'ok'; }
  async describeImage() { return 'an image'; }
  async extract(): Promise<ExtractResult> {
    return this.extractQueue.shift() ?? { episodic: [], prospective: [] };
  }
  async summarizePattern(members: EpisodicMemory[]) {
    return { ...this.summary, statement: `${this.summary.statement}:${members.length}` };
  }
}
