import { MemoryEngine } from '../src/engine.js';
import { SeededRandom } from '../src/random.js';
import { fixedK, randomK } from '../src/policy.js';
import { FakeClock, InMemoryStorage, FakeEmbed, FakeChat } from './fakes.js';

// Start the clock at a positive epoch so createdAt > 0 (avoids t=0 timing collisions
// where a freshly-created memory's timestamps tie with the initial lastTick of 0).
const BASE = Date.UTC(2026, 0, 1);

export class TimeMachine {
  clock = new FakeClock(BASE);
  storage = new InMemoryStorage();
  embed = new FakeEmbed();
  chat = new FakeChat();
  engine: MemoryEngine;

  constructor(opts: { seed: number; policy?: 'fixed' | 'random' }) {
    const policy = opts.policy === 'fixed' ? fixedK(3) : randomK(3, 7);
    this.engine = new MemoryEngine({
      storage: this.storage, embed: this.embed, chat: this.chat,
      clock: this.clock, random: new SeededRandom(opts.seed), policy,
    });
  }

  async ingestUser(text: string) { await this.engine.ingestUser(text); }
  async seedEpisodic(items: { content: string; importance: number; tags: string[] }[]) {
    for (const it of items) await this.engine.addEpisodic(it);
  }
  async retrieve(q: string) { return this.engine.retrieve(q); }
  async advanceAndTick(days: number) { this.clock.advanceDays(days); await this.engine.tick(); }

  async respond(text: string) {
    let out = '';
    for await (const c of this.engine.respond(text)) out += c;
    return out;
  }

  episodic() { return this.storage.snap.episodic; }
  selfTier() { return this.storage.snap.selfFacets; }
  messages() { return this.storage.snap.messages; }
}
