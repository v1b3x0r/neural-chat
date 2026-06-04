import { describe, it, expect } from 'vitest';
import type {
  EpisodicMemory, Message, Person, PersonMemory, Interaction,
} from '../src/types.js';
import type { Snapshot, ExtractResult } from '../src/ports.js';

describe('1A schema (optional fields, new shapes)', () => {
  it('an episodic literal WITHOUT the new fields still satisfies EpisodicMemory (optionality)', () => {
    const e: EpisodicMemory = {
      id: 'e', content: 'c', embedding: [1], importance: 5, strength: 1,
      createdAt: 0, lastRecalledAt: -1, tags: [], crystallizeAt: 4, sourceMsgIds: [],
    };
    expect(e.source).toBeUndefined();
    expect(e.source_type).toBeUndefined();
    expect(e.subject).toBeUndefined();
  });

  it('an episodic literal WITH the new fields type-checks', () => {
    const e: EpisodicMemory = {
      id: 'e', content: 'c', embedding: [1], importance: 5, strength: 1,
      createdAt: 0, lastRecalledAt: -1, tags: [], crystallizeAt: 4, sourceMsgIds: [],
      source: 'person_x', source_type: 'user', subject: 'world',
    };
    expect(e.source_type).toBe('user');
  });

  it('a Message accepts an optional speaker', () => {
    const m: Message = { id: 'm', role: 'user', text: 'hi', ts: 0, speaker: null };
    expect(m.speaker).toBeNull();
  });

  it('Person / PersonMemory / Interaction shapes are constructible', () => {
    const p: Person = { id: 'person_1', known_names: ['วี'], createdAt: 0, lastSeenAt: 0, interactionCount: 1 };
    const pm: PersonMemory = { episodic: [] };
    const ix: Interaction = { id: 'i1', msgId: 'm1', source: null, source_type: 'user', role: 'user', ts: 0 };
    expect([p.id, pm.episodic.length, ix.role]).toEqual(['person_1', 0, 'user']);
  });

  it('Snapshot keeps loading with the three optional tiers absent, and accepts them present', () => {
    const v0: Snapshot = { messages: [], episodic: [], selfFacets: [], prospective: [], lastTick: 0 };
    expect(v0.persons).toBeUndefined();
    const v1: Snapshot = { ...v0, persons: {}, personRegistry: {}, interactions: [] };
    expect(v1.interactions).toEqual([]);
  });

  it('ExtractResult.episodic accepts optional source_name / subject / said_by', () => {
    const r: ExtractResult = {
      episodic: [{ content: 'c', importance: 5, tags: [], source_name: 'วี', subject: { person_name: 'วี' }, said_by: 'user' }],
      prospective: [],
    };
    expect(r.episodic[0]!.said_by).toBe('user');
  });
});
