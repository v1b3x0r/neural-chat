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

  it('a re-tick with no new messages does not re-extract already-ticked messages', async () => {
    const tm = new TimeMachine({ seed: 1 });
    // Two scripted extract results; the turn's single tick must consume exactly the first.
    tm.chat.extractQueue.push(
      { episodic: [{ content: 'user likes mds', importance: 8, tags: ['mds'] }], prospective: [] },
      { episodic: [{ content: 'must-not-be-consumed', importance: 8, tags: ['x'] }], prospective: [] },
    );
    await tm.respond('hi');                       // ingestModel(ts=BASE) → tick(lastTick=BASE), extracts #1
    expect(tm.chat.extractQueue.length).toBe(1);
    await tm.engine.tick();                        // same clock, no new messages: ts > lastTick is empty
    expect(tm.chat.extractQueue.length).toBe(1);   // extract NOT called again (would be 0 under the `>=` bug)
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
      prospective: [{ id: 'p', intent: 'ship the engine', status: 'pending', priority: 3, contextClue: '', createdAt: 0, clueEmbedding: null, strength: 0.6, lastTriggeredAt: -1 }],
      tail: [],
    });
    expect(out).toContain('[Who you are]');
    expect(out).toContain('replies tersely');
    expect(out).toContain('[Relevant memories]');
    expect(out).toContain('user builds MDS');
    expect(out).toContain('[You are anticipating]');
  });
});
