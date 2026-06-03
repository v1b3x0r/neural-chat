import { describe, it, expect } from 'vitest';
import { TimeMachine } from './timeMachine.js';

describe('rewindTo', () => {
  it('removes the target message and everything after it', async () => {
    const tm = new TimeMachine({ seed: 1 });
    await tm.engine.ingestUser('a');
    await tm.engine.ingestModel('reply a');
    await tm.engine.ingestUser('b');
    await tm.engine.ingestModel('reply b');

    const bId = tm.messages()[2]!.id; // the 'b' user message
    await tm.engine.rewindTo(bId);

    expect(tm.messages().map((m) => m.text)).toEqual(['a', 'reply a']);
  });

  it('is a no-op for an unknown id', async () => {
    const tm = new TimeMachine({ seed: 1 });
    await tm.engine.ingestUser('a');
    await tm.engine.rewindTo('nope');
    expect(tm.messages().map((m) => m.text)).toEqual(['a']);
  });
});
