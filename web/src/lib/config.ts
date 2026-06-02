export interface ModelProfile {
  id: string; label: string;
  chat: { baseURL: string; model: string };
  embed: { baseURL: string; model: string };
  needsKey?: boolean;
}

export const PROFILES: ModelProfile[] = [
  { id: 'ollama', label: 'Local (Ollama)',            // default — this Mac; models are fetched + pickable, these are fallbacks
    chat:  { baseURL: 'http://localhost:11434/v1', model: 'gemma4:e2b' },
    embed: { baseURL: 'http://localhost:11434/v1', model: 'embeddinggemma:latest' } },
  { id: 'lmstudio', label: 'Local (LM Studio)',       // the other (4070ti) machine
    chat:  { baseURL: 'http://localhost:1234/v1', model: 'gemma-3-27b-it' },
    embed: { baseURL: 'http://localhost:1234/v1', model: 'nomic-embed-text' } },
  { id: 'openrouter', label: 'OpenRouter + local embed', needsKey: true,
    chat:  { baseURL: 'https://openrouter.ai/api/v1', model: 'google/gemma-4-26b-a4b-it:free' },
    embed: { baseURL: 'http://localhost:11434/v1', model: 'nomic-embed-text' } },  // local Ollama embed
  { id: 'openai', label: 'OpenAI Direct', needsKey: true,
    chat:  { baseURL: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    embed: { baseURL: 'https://api.openai.com/v1', model: 'text-embedding-3-small' } },
];

const LS_PROFILE = 'nc.profile';
const LS_KEY = (id: string) => `nc.key.${id}`;

export function getActiveProfile(): ModelProfile {
  const id = localStorage.getItem(LS_PROFILE) ?? PROFILES[0]!.id;
  return PROFILES.find(p => p.id === id) ?? PROFILES[0]!;
}
export function setActiveProfile(id: string): void { localStorage.setItem(LS_PROFILE, id); }

export function getKey(id = getActiveProfile().id): string {
  return localStorage.getItem(LS_KEY(id)) ?? (import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined ?? '');
}
export function setKey(value: string, id = getActiveProfile().id): void { localStorage.setItem(LS_KEY(id), value); }

// Model is a profile default + a per-profile override (set from the fetched /v1/models list — no hardcoded names win).
const LS_CHAT_MODEL = (id: string) => `nc.model.chat.${id}`;
const LS_EMBED_MODEL = (id: string) => `nc.model.embed.${id}`;
const profileById = (id: string) => PROFILES.find(p => p.id === id) ?? PROFILES[0]!;

export function getChatModel(id = getActiveProfile().id): string { return localStorage.getItem(LS_CHAT_MODEL(id)) ?? profileById(id).chat.model; }
export function setChatModel(model: string, id = getActiveProfile().id): void { localStorage.setItem(LS_CHAT_MODEL(id), model); }
export function getEmbedModel(id = getActiveProfile().id): string { return localStorage.getItem(LS_EMBED_MODEL(id)) ?? profileById(id).embed.model; }
export function setEmbedModel(model: string, id = getActiveProfile().id): void { localStorage.setItem(LS_EMBED_MODEL(id), model); }

export function getChatCfg() { const p = getActiveProfile(); return { baseURL: p.chat.baseURL, model: getChatModel(p.id), apiKey: p.needsKey ? getKey(p.id) : '' }; }
export function getEmbedCfg() { const p = getActiveProfile(); return { baseURL: p.embed.baseURL, model: getEmbedModel(p.id), apiKey: p.needsKey ? getKey(p.id) : '' }; }

// The ONLY behaviour knobs (used by ambient.ts in Phase 2).
export const AMBIENT = { ambientRefreshMs: 30 * 60_000, salienceK: 2, baselineWindow: 48, worldlogCap: 672 };

// Lab: which injection components are fed to the LLM each turn (tune from the 🧠 pane). All-on = same as engine.respond().
export interface LabToggles { time: boolean; timePos: 'top' | 'end'; self: boolean; episodic: boolean; prospective: boolean; tail: boolean }
const DEFAULT_TOGGLES: LabToggles = { time: true, timePos: 'top', self: true, episodic: true, prospective: true, tail: true };
const LS_LAB = 'nc.lab';
export function getLabToggles(): LabToggles {
  try { return { ...DEFAULT_TOGGLES, ...JSON.parse(localStorage.getItem(LS_LAB) ?? '{}') }; }
  catch { return { ...DEFAULT_TOGGLES }; }
}
export function setLabToggles(t: LabToggles): void { localStorage.setItem(LS_LAB, JSON.stringify(t)); }
