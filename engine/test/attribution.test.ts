import { describe, it, expect } from 'vitest';
import { placeMemory, resolvePerson, deriveVisibility } from '../src/attribution.js';
import type { Person } from '../src/types.js';

// Deterministic id minter for tests.
function minter() {
  let n = 0;
  return () => `person_${(n++).toString(36)}`;
}

describe('placeMemory (subject decides the tier)', () => {
  it('world / null / undefined → entity', () => {
    expect(placeMemory('world')).toEqual({ tier: 'entity' });
    expect(placeMemory(null)).toEqual({ tier: 'entity' });
    expect(placeMemory(undefined)).toEqual({ tier: 'entity' });
  });
  it('self → interaction (no episodic push)', () => {
    expect(placeMemory('self')).toEqual({ tier: 'interaction' });
  });
  it('a person id → person tier carrying that id', () => {
    expect(placeMemory('person_42')).toEqual({ tier: 'person', personId: 'person_42' });
  });
});

describe('resolvePerson (name → stable opaque id)', () => {
  it('null/empty name → no person, registry untouched', () => {
    const reg: Record<string, Person> = {};
    expect(resolvePerson(null, reg, 0, minter()).personId).toBeNull();
    expect(resolvePerson('', reg, 0, minter()).personId).toBeNull();
    expect(resolvePerson('   ', reg, 0, minter()).personId).toBeNull();
  });

  it('an unseen name MINTS a synthetic id that is NOT the name', () => {
    const { personId, registry } = resolvePerson('วี', {}, 100, minter());
    expect(personId).toBe('person_0');
    expect(personId).not.toBe('วี');
    expect(personId).toMatch(/^person_/);
    expect(registry[personId!]!.known_names).toEqual(['วี']);
    expect(registry[personId!]!.createdAt).toBe(100);
    expect(registry[personId!]!.interactionCount).toBe(1);
  });

  it('the SAME name again → the SAME id (no split) and bumps interactionCount/lastSeenAt', () => {
    const mint = minter();
    const first = resolvePerson('วี', {}, 100, mint);
    const second = resolvePerson('วี', first.registry, 200, mint);
    expect(second.personId).toBe(first.personId);              // no split
    expect(Object.keys(second.registry)).toHaveLength(1);      // no new id minted
    expect(second.registry[second.personId!]!.interactionCount).toBe(2);
    expect(second.registry[second.personId!]!.lastSeenAt).toBe(200);
  });

  it('case/whitespace variants resolve to ONE id; a new surface form is appended to known_names', () => {
    const mint = minter();
    const a = resolvePerson('Wutty', {}, 0, mint);
    const b = resolvePerson('  wutty ', a.registry, 1, mint);
    expect(b.personId).toBe(a.personId);                       // one id
    expect(Object.keys(b.registry)).toHaveLength(1);
    // exact surface form ' wutty ' is trimmed; differs from 'Wutty' ⇒ appended
    expect(b.registry[b.personId!]!.known_names).toEqual(['Wutty', 'wutty']);
  });

  it('does not duplicate a known_name that already matches exactly', () => {
    const mint = minter();
    const a = resolvePerson('Wutty', {}, 0, mint);
    const b = resolvePerson('Wutty', a.registry, 1, mint);
    expect(b.registry[b.personId!]!.known_names).toEqual(['Wutty']);
  });

  it('two distinct names mint two ids (split-before-merge is accepted in 1A)', () => {
    const mint = minter();
    const a = resolvePerson('วี', {}, 0, mint);
    const b = resolvePerson('Wutty', a.registry, 0, mint);
    expect(b.personId).not.toBe(a.personId);
    expect(Object.keys(b.registry).sort()).toEqual(['person_0', 'person_1']);
  });
});

describe('deriveVisibility (derived, never stored)', () => {
  it('world/absent → public, self → internal, person → private', () => {
    expect(deriveVisibility({ subject: 'world' })).toBe('public');
    expect(deriveVisibility({})).toBe('public');
    expect(deriveVisibility({ subject: null })).toBe('public');
    expect(deriveVisibility({ subject: 'self' })).toBe('internal');
    expect(deriveVisibility({ subject: 'person_9' })).toBe('private');
  });
});
