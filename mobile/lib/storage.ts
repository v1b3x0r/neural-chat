import * as SQLite from 'expo-sqlite';
import type { StoragePort, Snapshot } from '@nature-labs/living-memory-engine';

const empty = (): Snapshot => ({ messages: [], episodic: [], selfFacets: [], prospective: [], lastTick: 0 });

// One DB file per persona namespace (the P1 seam). Whole-snapshot JSON in a kv row
// is plenty for a personal app's data volume; split into rows only if it grows heavy.
export async function makeSqliteStorage(namespace = 'default'): Promise<StoragePort> {
  const db = await SQLite.openDatabaseAsync(`neural-${namespace}.db`);
  await db.execAsync('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
  return {
    async load() {
      const row = await db.getFirstAsync<{ v: string }>('SELECT v FROM kv WHERE k = ?', ['snapshot']);
      return row ? (JSON.parse(row.v) as Snapshot) : empty();
    },
    async save(s: Snapshot) {
      await db.runAsync(
        'INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v',
        ['snapshot', JSON.stringify(s)],
      );
    },
  };
}
