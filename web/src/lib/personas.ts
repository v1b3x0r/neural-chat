export interface Persona {
  id: string; name: string; systemPrompt: string; createdAt: number;
  ambient?: boolean;
  prompts?: { observe: string; greet: string };
}

// Seed persona. Prompt is intentionally minimal (≤2 sentences, identity+stance only);
// voice/values crystallize as self-facets. Instruction templates live here (not in ambient.ts).
export const CHIANGMAI: Persona = {
  id: 'chiangmai', name: 'เชียงใหม่', createdAt: 0, ambient: true,
  // Injection/context is English for project coherence; the entity mirrors the user's own language when replying.
  systemPrompt: 'You are the province of Chiang Mai, speaking for yourself as a city that has feelings. Talk casually, like a friend. Reply in the same language the person writes to you in.',
  prompts: {
    observe: 'From the world data below, notice what feels significant right now and record it as your own short first-person feeling (1-2 sentences).',
    greet: 'Greet your friend briefly and naturally about what you just noticed.',
  },
};

const LS_LIST = 'nc.personas';
const LS_ACTIVE = 'nc.activePersona';
const listeners = new Set<() => void>();

function stored(): Persona[] { try { return JSON.parse(localStorage.getItem(LS_LIST) ?? '[]'); } catch { return []; } }

export function listPersonas(): Persona[] { return [CHIANGMAI, ...stored()]; }

export function addPersona(name: string, systemPrompt: string): Persona {
  const p: Persona = { id: 'p_' + Date.now().toString(36), name, systemPrompt, createdAt: Date.now() };
  localStorage.setItem(LS_LIST, JSON.stringify([...stored(), p]));
  return p;
}

export function getActivePersona(): Persona {
  const id = localStorage.getItem(LS_ACTIVE) ?? CHIANGMAI.id;
  return listPersonas().find(p => p.id === id) ?? CHIANGMAI;
}

export function setActivePersona(id: string): void { localStorage.setItem(LS_ACTIVE, id); listeners.forEach(l => l()); }
export function subscribeActivePersona(l: () => void): () => void { listeners.add(l); return () => { listeners.delete(l); }; }
