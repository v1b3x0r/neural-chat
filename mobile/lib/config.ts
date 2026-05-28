import 'expo-sqlite/localStorage/install';
import * as SecureStore from 'expo-secure-store';

export interface EndpointCfg { baseURL: string; model: string; }

const DEFAULT_CHAT: EndpointCfg = { baseURL: 'https://openrouter.ai/api/v1', model: 'google/gemma-4-26b-a4b-it:free' };
// Embeddings via OpenRouter too (same key) — one-key setup. Local/LM Studio later.
const DEFAULT_EMBED: EndpointCfg = { baseURL: 'https://openrouter.ai/api/v1', model: 'openai/text-embedding-3-small' };

function readCfg(key: string, fallback: EndpointCfg): EndpointCfg {
  try { return { ...fallback, ...JSON.parse(localStorage.getItem(key) ?? '{}') }; }
  catch { return fallback; }
}

export const getChatCfg = () => readCfg('chatCfg', DEFAULT_CHAT);
export const setChatCfg = (c: EndpointCfg) => localStorage.setItem('chatCfg', JSON.stringify(c));

export const getActiveModel = () => getChatCfg().model;
export const setActiveModel = (id: string) => setChatCfg({ ...getChatCfg(), model: id });
export const getStarredModels = (): string[] => {
  try { return JSON.parse(localStorage.getItem('starredModels') ?? '[]'); } catch { return []; }
};
export const setStarredModels = (ids: string[]) => localStorage.setItem('starredModels', JSON.stringify(ids));
export const getEmbedCfg = () => readCfg('embedCfg', DEFAULT_EMBED);
export const setEmbedCfg = (c: EndpointCfg) => localStorage.setItem('embedCfg', JSON.stringify(c));

// Dev convenience: set EXPO_PUBLIC_OPENROUTER_API_KEY in mobile/.env so you don't
// type a long key on the phone. Falls back to the OS keychain (secure-store) if unset.
// NOTE: EXPO_PUBLIC_* vars are embedded in the JS bundle — fine for personal/dev use,
// not for a distributed build (then use secure-store only).
const ENV_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY ?? '';
export const getChatKey = async () => ENV_KEY || (await SecureStore.getItemAsync('chat_key')) || '';
export const setChatKey = (k: string) => SecureStore.setItemAsync('chat_key', k);
