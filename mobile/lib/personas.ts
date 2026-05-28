import 'expo-sqlite/localStorage/install';

export interface Persona {
  id: string;        // also the SQLite DB namespace + engine cache key
  name: string;
  systemPrompt: string; // "" for the default friend = pure emergence
  createdAt: number;
}

const DEFAULT: Persona = { id: 'default', name: 'default', systemPrompt: '', createdAt: 0 };

function readStored(): Persona[] {
  try { return JSON.parse(localStorage.getItem('personas') ?? '[]'); } catch { return []; }
}

// The default friend is always first and cannot be removed.
export function listPersonas(): Persona[] {
  return [DEFAULT, ...readStored()];
}

export function addPersona(name: string, systemPrompt: string): Persona {
  const p: Persona = { id: 'p_' + Date.now().toString(36), name: name.trim() || 'friend', systemPrompt, createdAt: Date.now() };
  localStorage.setItem('personas', JSON.stringify([...readStored(), p]));
  return p;
}

export function getActivePersonaId(): string {
  return localStorage.getItem('activePersona') ?? 'default';
}

export function getActivePersona(): Persona {
  return listPersonas().find((p) => p.id === getActivePersonaId()) ?? DEFAULT;
}

// Reactive: switching persona from the drawer doesn't re-focus the chat screen,
// so the chat subscribes to this to reload the right thread.
const listeners = new Set<() => void>();
export function setActivePersona(id: string): void {
  localStorage.setItem('activePersona', id);
  listeners.forEach((l) => l());
}
export function subscribeActivePersona(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
