import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { getEngine, resetEngines } from '../src/lib/engine';

describe('engine factory', () => {
  it('caches per namespace and returns the same chatPort reference the engine uses', async () => {
    const a = await getEngine('chiangmai', 'seed');
    const b = await getEngine('chiangmai', 'seed');
    expect(b).toBe(a);                 // cached
    expect(typeof a.chatPort.stream).toBe('function');
    resetEngines();
    const c = await getEngine('chiangmai', 'seed');
    expect(c).not.toBe(a);             // rebuilt after reset
  });
});
