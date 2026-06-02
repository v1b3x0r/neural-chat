import type { Snapshot, StoragePort } from '@nature-labs/living-memory-engine';

const DB = 'neural-chat';
const SNAP = 'snapshots';
const KV = 'kv';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SNAP)) db.createObjectStore(SNAP);
      if (!db.objectStoreNames.contains(KV)) db.createObjectStore(KV);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(db => new Promise<T>((resolve, reject) => {
    const r = fn(db.transaction(store, mode).objectStore(store));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));
}

const empty = (): Snapshot => ({ messages: [], episodic: [], selfFacets: [], prospective: [], lastTick: 0 });

export function makeStorage(namespace: string): StoragePort {
  return {
    async load() { return (await run<Snapshot>(SNAP, 'readonly', s => s.get(namespace))) ?? empty(); },
    async save(snap) { await run(SNAP, 'readwrite', s => s.put(snap, namespace)); },
  };
}

export function getRaw<T>(key: string): Promise<T | undefined> { return run<T>(KV, 'readonly', s => s.get(key)); }
export async function setRaw(key: string, value: unknown): Promise<void> { await run(KV, 'readwrite', s => s.put(value, key)); }
