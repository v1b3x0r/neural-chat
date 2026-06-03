import { MemoryEngine, SeededRandom, randomK, type StoragePort, type ChatPort } from '@nature-labs/living-memory-engine';
import { makeChatPort, makeEmbedPort } from '@nature-labs/living-memory-engine/provider';
import { makeStorage } from './storage';
import { getChatCfg, getEmbedCfg } from './config';

type Instance = { engine: MemoryEngine; storage: StoragePort; chatPort: ChatPort };
const cache = new Map<string, Instance>();

export async function getEngine(namespace = 'chiangmai', systemPrompt = ''): Promise<Instance> {
  const hit = cache.get(namespace);
  if (hit) return hit;

  const storage = makeStorage(namespace);
  // Browser fetch streams response bodies natively — no shim needed (unlike RN).
  const chatPort = makeChatPort(getChatCfg());
  const embed = makeEmbedPort(getEmbedCfg());
  const engine = new MemoryEngine({
    storage, chat: chatPort, embed,
    clock: { now: () => Date.now() },
    random: new SeededRandom(1337),
    policy: randomK(3, 7),
    systemPrompt,
  });
  const instance: Instance = { engine, storage, chatPort };
  cache.set(namespace, instance);
  return instance;
}

// Call after a profile/key/model change so the next getEngine() rebuilds chat+embed ports.
export function resetEngines(): void { cache.clear(); }
