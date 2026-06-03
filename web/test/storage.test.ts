import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { makeStorage, getRaw, setRaw } from '../src/lib/storage';

describe('storage', () => {
  it('returns an empty snapshot for an absent namespace', async () => {
    const s = makeStorage('nope');
    const snap = await s.load();
    expect(snap).toEqual({ messages: [], episodic: [], selfFacets: [], prospective: [], lastTick: 0 });
  });

  it('round-trips a snapshot per namespace', async () => {
    const s = makeStorage('chiangmai');
    await s.save({ messages: [{ id: 'm1', role: 'user', text: 'hi', ts: 1 }], episodic: [], selfFacets: [], prospective: [], lastTick: 5 });
    const back = await s.load();
    expect(back.lastTick).toBe(5);
    expect(back.messages[0]!.text).toBe('hi');
    expect((await makeStorage('other').load()).messages).toHaveLength(0);
  });

  it('kv get/set round-trips', async () => {
    await setRaw('k', { a: 1 });
    expect(await getRaw<{ a: number }>('k')).toEqual({ a: 1 });
    expect(await getRaw('missing')).toBeUndefined();
  });
});
