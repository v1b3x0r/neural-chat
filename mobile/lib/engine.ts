import { fetch as expoFetch } from 'expo/fetch';
import { MemoryEngine, SeededRandom, randomK, type StoragePort } from '@nature-labs/living-memory-engine';
import { makeChatPort, makeEmbedPort } from '@nature-labs/living-memory-engine/provider';
import { makeSqliteStorage } from './storage';
import { getChatCfg, getEmbedCfg, getChatKey } from './config';

// React Native's global fetch can't stream response bodies; expo/fetch can.
const rnFetch = expoFetch as unknown as typeof fetch;

type Instance = { engine: MemoryEngine; storage: StoragePort };
const cache = new Map<string, Instance>();

export async function getEngine(namespace = 'default', systemPrompt = ''): Promise<Instance> {
  const existing = cache.get(namespace);
  if (existing) return existing;

  const storage = await makeSqliteStorage(namespace);
  const key = await getChatKey();
  const chat = makeChatPort({ ...getChatCfg(), apiKey: key }, rnFetch);
  const embed = makeEmbedPort({ ...getEmbedCfg(), apiKey: key }, rnFetch);
  const engine = new MemoryEngine({
    storage, chat, embed,
    clock: { now: () => Date.now() },
    random: new SeededRandom(1337),
    policy: randomK(3, 7),
    systemPrompt,
  });
  const instance = { engine, storage };
  cache.set(namespace, instance);
  return instance;
}

// Call after changing provider config so the next getEngine() rebuilds with new endpoints/keys.
export function resetEngines() { cache.clear(); }
