import { describe, it, expect } from 'vitest';
import { buildWhy, byConcept, type WhySnapshot, type UsedIds } from '../src/lib/why';

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
  it('splits stored memories into used vs ignored by the retrieved ids', () => {
    const used: UsedIds = { self: ['sf1'], episodic: ['e2'], prospective: ['p1'] };
    const w = buildWhy('what coffee do I like?', used, snap);
    expect(w.query).toBe('what coffee do I like?');
    expect(w.used.map(i => i.id).sort()).toEqual(['e2', 'p1', 'sf1']);
    expect(w.ignored.map(i => i.id).sort()).toEqual(['e1', 'e3', 'sf2']);
    expect(w.usedCount).toBe(3);
    expect(w.totalCount).toBe(6); // 2 self + 3 episodic + 1 pending prospective; resolved p2 excluded
  });

  it('tags concepts: self=Preferences, ambient/world=Current context, other episodic=Recent experiences, pending prospective=Plans', () => {
    const w = buildWhy('q', { self: [], episodic: [], prospective: [] }, snap);
    const byId = Object.fromEntries(w.ignored.map(i => [i.id, i.concept]));
    expect(byId['sf1']).toBe('Preferences');
    expect(byId['e2']).toBe('Current context');   // subject:world + ambient
    expect(byId['e1']).toBe('Recent experiences'); // person subject
    expect(byId['e3']).toBe('Recent experiences'); // no subject
    expect(byId['p1']).toBe('Plans');
    expect(byId['p2']).toBeUndefined();            // resolved intents are not live plans
  });

  it('byConcept groups in stable order and drops empty concepts', () => {
    const w = buildWhy('q', { self: ['sf1'], episodic: ['e2'], prospective: [] }, snap);
    const groups = byConcept(w.used);
    expect(groups.map(g => g.concept)).toEqual(['Preferences', 'Current context']);
    expect(groups[0]!.items[0]!.id).toBe('sf1');
  });
});
