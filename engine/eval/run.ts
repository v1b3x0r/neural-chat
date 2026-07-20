// Deterministic evaluation: Living Memory Engine vs a naive full-history baseline.
// Hypotheses (H1-H4) are MEASURED, not asserted — whatever happens is reported.
// Seed 1337, FakeClock epoch 0, FakeEmbed 64-dim bag-of-words. Reproduce: npm run eval
import { MemoryEngine, SeededRandom, randomK, formatInjection } from '../src/index.js';
import { FakeClock, InMemoryStorage, FakeEmbed, FakeChat } from '../test/fakes.js';

const est = (s: string) => Math.ceil(s.length / 4); // ~4 chars/token

function makeEngine() {
  const clock = new FakeClock(0);
  const storage = new InMemoryStorage();
  const chat = new FakeChat();
  const engine = new MemoryEngine({
    storage, chat, embed: new FakeEmbed(),
    clock, random: new SeededRandom(1337), policy: randomK(3, 7), systemPrompt: '',
  });
  return { engine, clock, chat, storage };
}

// One remembered exchange: user says `text`, model acks, extract yields `facts`.
// Nudge the clock forward a beat first: tick()'s extraction gate is `m.ts > snap.lastTick` (strict), and
// InMemoryStorage starts lastTick at 0 same as FakeClock's epoch — a burst of same-instant remember() calls
// would tie every message's ts to the prior tick's lastTick and get silently dropped (see engine's own
// test/timeMachine.ts: "avoids t=0 timing collisions where a freshly-created memory's timestamps tie with
// the initial lastTick of 0"). 60s/turn is negligible against tau=7 days.
async function remember(e: ReturnType<typeof makeEngine>, text: string, facts: string[], importance = 7) {
  e.clock.t += 60_000;
  await e.engine.ingestUser(text);
  await e.engine.ingestModel('noted.');
  e.chat.extractQueue.push({ episodic: facts.map(content => ({ content, importance, tags: [] })), prospective: [] });
  await e.engine.tick();
}

interface Row { h: string; relevant: string; stale: string; injected: number; engineTok: number; baselineTok: number }
const rows: Row[] = [];

async function measure(h: string, e: ReturnType<typeof makeEngine>, query: string, relevantNeedle: string, staleNeedle: string | null) {
  const ctx = await e.engine.retrieve(query);
  const inject = formatInjection(ctx);
  const contents = ctx.episodic.map(m => m.content);
  const baseline = e.storage.snap.messages.map(m => m.text).join('\n');
  rows.push({
    h,
    relevant: contents.some(c => c.includes(relevantNeedle)) ? 'yes' : 'NO',
    stale: staleNeedle === null ? 'n/a' : contents.some(c => c.includes(staleNeedle)) ? 'YES' : 'no',
    injected: ctx.episodic.length,
    engineTok: est(inject),
    baselineTok: est(baseline),
  });
  console.log(`\n${h} retrieved:`, contents.map((c, i) => `${c} (s=${ctx.episodic[i]!.strength.toFixed(2)})`));
}

// H1 — preference recall across sessions
{
  const e = makeEngine();
  await remember(e, 'By the way, my usual coffee order is an oat-milk flat white.', ["User's usual coffee order is an oat-milk flat white"]);
  for (let i = 0; i < 8; i++) await remember(e, `Filler chat about topic ${i}: markets, rain, trains, code.`, [`Talked about topic ${i}`], 4);
  e.clock.advanceDays(2); // new session
  await measure('H1 cross-session preference', e, "what is the user's usual coffee order?", 'oat-milk', null);
}
// H2 — preference updated later (old vs new at retrieval)
{
  const e = makeEngine();
  await remember(e, 'I always want a window seat.', ['User prefers window seat']);
  e.clock.advanceDays(10);
  await remember(e, 'Actually I changed my mind — aisle seat from now on.', ['User now prefers aisle seat (changed from window)']);
  e.clock.advanceDays(1);
  await measure('H2 updated preference', e, 'which seat do I want?', 'aisle', 'window seat');
}
// H3 — limited context: small working set out of many memories
{
  const e = makeEngine();
  for (let i = 0; i < 30; i++) await remember(e, `Note ${i}: ordinary day, groceries, weather fine.`, [`Ordinary note ${i}`], 3);
  await remember(e, 'CRITICAL: my medication is levothyroxine, 50mcg every morning.', ['User medication levothyroxine 50mcg each morning'], 10);
  e.clock.advanceDays(1);
  await measure('H3 critical in limited window', e, 'remind me about my medication', 'levothyroxine', null);
}
// H4 — expired memory decays out
{
  const e = makeEngine();
  await remember(e, 'Temporary wifi password is tulip-9931.', ['Temporary wifi password tulip-9931'], 2);
  for (let w = 0; w < 12; w++) { e.clock.advanceDays(7); await e.engine.tick(); }
  await measure('H4 expired memory forgotten', e, 'what is the wifi password?', 'tulip-9931', 'tulip-9931');
}

console.log('\n| Hypothesis | Relevant recalled | Stale recalled | Memories injected | Engine inject tokens | Full-history tokens |');
console.log('|---|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.h} | ${r.relevant} | ${r.stale} | ${r.injected} | ~${r.engineTok} | ~${r.baselineTok} |`);
console.log('\nDeterministic: seed 1337, FakeClock (epoch 0), FakeEmbed 64-dim bag-of-words. Findings are measured, not asserted.');
