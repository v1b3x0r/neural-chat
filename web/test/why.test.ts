import { describe, it, expect } from 'vitest';
import { buildWhy, bySource, estTokens, boundedContext, type WhySnapshot, type UsedIds } from '../src/lib/why';

const snap: WhySnapshot = {
  selfFacets: [
    { id: 'sf1', statement: 'likes oat-milk coffee' },
    { id: 'sf2', statement: 'dislikes small talk' },
  ],
  episodic: [
    { id: 'e1', content: 'user is planning a trip to the north', subject: { person_name: 'user' } },
    { id: 'e2', content: 'air quality was poor around San Sai this morning', subject: 'world', source_type: 'ambient' },
    { id: 'e3', content: 'user mentioned an old photography hobby' },
  ],
  prospective: [
    { id: 'p1', intent: 'ask how the trip went', status: 'pending' },
    { id: 'p2', intent: 'resolved intent', status: 'resolved' },
  ],
};

describe('buildWhy', () => {
  it('splits candidate context into used vs available by the retrieved ids', () => {
    const used: UsedIds = { self: ['sf1'], episodic: ['e2'], prospective: ['p1'] };
    const w = buildWhy('what coffee do I like?', used, snap);
    expect(w.query).toBe('what coffee do I like?');
    expect(w.used.map(i => i.id).sort()).toEqual(['e2', 'p1', 'sf1']);
    expect(w.available.map(i => i.id).sort()).toEqual(['e1', 'e3', 'sf2']);
    expect(w.usedCount).toBe(3);
    expect(w.totalCount).toBe(6); // 2 self + 3 episodic + 1 pending prospective; resolved p2 excluded
  });

  it('tags source: self=Memory, ambient/world=Live, other episodic=Memory, pending prospective=Plan', () => {
    const w = buildWhy('q', { self: [], episodic: [], prospective: [] }, snap);
    const byId = Object.fromEntries(w.available.map(i => [i.id, i.source]));
    expect(byId['sf1']).toBe('Memory');
    expect(byId['e2']).toBe('Live');    // subject:world + ambient
    expect(byId['e1']).toBe('Memory');  // person subject → durable memory
    expect(byId['e3']).toBe('Memory');  // no subject → durable memory
    expect(byId['p1']).toBe('Plan');
    expect(byId['p2']).toBeUndefined(); // resolved intents are not live plans
  });

  it('bySource groups in stable order (Memory, Live, Plan) and drops empty sources', () => {
    const w = buildWhy('q', { self: ['sf1'], episodic: ['e2'], prospective: [] }, snap);
    const groups = bySource(w.used);
    expect(groups.map(g => g.source)).toEqual(['Memory', 'Live']);
    expect(groups[0]!.items[0]!.id).toBe('sf1');
  });
});

describe('boundedContext', () => {
  it('estTokens ~ chars/4', () => {
    expect(estTokens('a'.repeat(40))).toBe(10);
    expect(estTokens('')).toBe(0);
  });
  it('working context sums its parts; conversation counts all messages; working stays bounded << conversation', () => {
    const msgs = Array.from({ length: 20 }, () => ({ text: 'x'.repeat(400) })); // long, growing conversation
    const b = boundedContext(msgs, ['y'.repeat(400)]);                          // small working context
    expect(b.messages).toBe(20);
    expect(b.workingTokens).toBe(100);
    expect(b.convoTokens).toBeGreaterThan(b.workingTokens * 15);                // bounded, not proportional
  });
});
