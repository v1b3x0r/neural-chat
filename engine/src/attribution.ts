import type { Person } from './types.js';

export type Placement =
  | { tier: 'entity' }
  | { tier: 'person'; personId: string }
  | { tier: 'interaction' };

// Subject decides the tier. The ONLY router; tick() never pushes an episodic any other way.
export function placeMemory(subject: string | null | undefined): Placement {
  if (!subject || subject === 'world') return { tier: 'entity' };     // legacy/world ⇒ entity (today's path)
  if (subject === 'self')              return { tier: 'interaction' }; // echo-chamber kill: NO episodic push
  return { tier: 'person', personId: subject };
}

// Name → stable opaque id. The engine owns id minting; the LLM never sees an id.
// Matching is exact (case/whitespace-insensitive) against known_names; fuzzy/alias-merge is 1B.
export function resolvePerson(
  name: string | null | undefined,
  registry: Record<string, Person>,
  now: number,
  mintId: () => string,                  // === uid('person')
): { personId: string | null; registry: Record<string, Person> } {
  const surface = name?.trim();
  if (!surface) return { personId: null, registry };
  const norm = surface.toLowerCase();
  const hit = Object.values(registry).find(p => p.known_names.some(n => n.toLowerCase() === norm));
  if (hit) {
    hit.lastSeenAt = now;
    hit.interactionCount += 1;
    if (!hit.known_names.some(n => n === surface)) hit.known_names.push(surface);
    return { personId: hit.id, registry };
  }
  const id = mintId();                    // id is NEVER derived from the name
  registry[id] = { id, known_names: [surface], createdAt: now, lastSeenAt: now, interactionCount: 1 };
  return { personId: id, registry };
}

// Derived, never stored. Defined HERE so 1B has one place to plug the privacy filter.
export function deriveVisibility(m: { subject?: string | null }): 'public' | 'private' | 'internal' {
  const s = m.subject;
  if (!s || s === 'world') return 'public';   // shared entity knowledge
  if (s === 'self')        return 'internal'; // entity self-talk — interaction-only
  return 'private';                           // tied to a specific person
}
