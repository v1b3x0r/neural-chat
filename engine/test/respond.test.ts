import { describe, it, expect } from 'vitest';
import { TimeMachine } from './timeMachine.js';
import { formatInjection } from '../src/index.js';

describe('respond (full turn)', () => {
  it('streams the reply and stores both user and model messages', async () => {
    const tm = new TimeMachine({ seed: 1 });
    const reply = await tm.respond('hello');
    expect(reply).toBe('ok'); // FakeChat streams "ok"
    const roles = tm.messages().map(m => m.role);
    expect(roles).toEqual(['user', 'model']);
    expect(tm.messages()[0]!.text).toBe('hello');
    expect(tm.messages()[1]!.text).toBe('ok');
  });

  it('runs a consolidation tick as part of the turn', async () => {
    const tm = new TimeMachine({ seed: 1 });
    expect(tm.storage.snap.lastTick).toBe(0);
    await tm.respond('hi');
    expect(tm.storage.snap.lastTick).toBeGreaterThan(0);
  });
});

describe('formatInjection', () => {
  it('is empty for a brand-new self (empty system prompt, no memory)', () => {
    expect(formatInjection({ selfTier: [], episodic: [], prospective: [], tail: [] })).toBe('');
  });

  it('labels each tier when present', () => {
    const out = formatInjection({
      selfTier: [{ id: 's', statement: 'replies tersely', kind: 'voice', strength: 1, updatedAt: 0 }],
      episodic: [{ id: 'e', content: 'user builds MDS', embedding: [1], importance: 8, strength: 1, createdAt: 0, lastRecalledAt: 0, tags: [], crystallizeAt: 4, sourceMsgIds: [] }],
      prospective: [{ id: 'p', intent: 'ship the engine', status: 'pending', priority: 3, contextClue: '', createdAt: 0 }],
      tail: [],
    });
    expect(out).toContain('[Who you are]');
    expect(out).toContain('replies tersely');
    expect(out).toContain('[Relevant memories]');
    expect(out).toContain('user builds MDS');
    expect(out).toContain('[You are anticipating]');
  });
});
