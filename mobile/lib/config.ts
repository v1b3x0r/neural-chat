import 'expo-sqlite/localStorage/install';
import * as SecureStore from 'expo-secure-store';

export interface EndpointCfg { baseURL: string; model: string; }

const DEFAULT_CHAT: EndpointCfg = { baseURL: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-3.5-sonnet' };
const DEFAULT_EMBED: EndpointCfg = { baseURL: 'http://localhost:1234/v1', model: 'nomic-embed-text' };

function readCfg(key: string, fallback: EndpointCfg): EndpointCfg {
  try { return { ...fallback, ...JSON.parse(localStorage.getItem(key) ?? '{}') }; }
  catch { return fallback; }
}

export const getChatCfg = () => readCfg('chatCfg', DEFAULT_CHAT);
export const setChatCfg = (c: EndpointCfg) => localStorage.setItem('chatCfg', JSON.stringify(c));
export const getEmbedCfg = () => readCfg('embedCfg', DEFAULT_EMBED);
export const setEmbedCfg = (c: EndpointCfg) => localStorage.setItem('embedCfg', JSON.stringify(c));

// API keys live ONLY in the OS keychain (expo-secure-store), never bundled / never in plain storage.
export const getChatKey = async () => (await SecureStore.getItemAsync('chat_key')) ?? '';
export const setChatKey = (k: string) => SecureStore.setItemAsync('chat_key', k);
export const getEmbedKey = async () => (await SecureStore.getItemAsync('embed_key')) ?? '';
export const setEmbedKey = (k: string) => SecureStore.setItemAsync('embed_key', k);
