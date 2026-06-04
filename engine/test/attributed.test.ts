import { describe, it, expect } from 'vitest';
import { TimeMachine } from './timeMachine.js';
import type { Snapshot } from '../src/ports.js';

describe('1A migration (v0 snapshot loads + ticks clean)', () => {
  it('normalizes a v0 snapshot (no persons/personRegistry/interactions) on tick', async () => {
    const tm = new TimeMachine({ seed: 1 });
    // Hand it a snapshot that PREDATES 1A: the three tiers are literally absent.
    const v0 = { messages: [], episodic: [], selfFacets: [], prospective: [], lastTick: 0 } as Snapshot;
    tm.storage.snap = v0;
    // advanceAndTick(0) exercises tick()'s normalize in ISOLATION (no ingest). Do NOT use respond()
    // here: from Task 4 on, respond() appends user+model Interactions, which would make the
    // `interactions).toEqual([])` assertion fail at later tasks' regression gates.
    await tm.advanceAndTick(0);                          // tick alone normalizes the three tiers, no crash
    expect(tm.storage.snap.persons).toEqual({});
    expect(tm.storage.snap.personRegistry).toEqual({});
    expect(tm.storage.snap.interactions).toEqual([]);
  });

  it('retrieve() also tolerates a v0 snapshot (defensive normalize)', async () => {
    const tm = new TimeMachine({ seed: 1 });
    tm.storage.snap = { messages: [], episodic: [], selfFacets: [], prospective: [], lastTick: 0 } as Snapshot;
    const ctx = await tm.retrieve('anything');          // must not throw on snap.persons undefined
    expect(ctx.episodic).toEqual([]);
  });
});

describe('1A interaction ledger + Message.speaker', () => {
  it('ingestUser stamps msg.speaker and appends an Interaction(role user)', async () => {
    const tm = new TimeMachine({ seed: 1 });
    await tm.engine.ingestUser('hi there', undefined, 'person_7');
    const msg = tm.storage.snap.messages.at(-1)!;
    expect(msg.speaker).toBe('person_7');
    const ix = tm.storage.snap.interactions!.at(-1)!;
    expect(ix.msgId).toBe(msg.id);
    expect(ix.role).toBe('user');
    expect(ix.source).toBe('person_7');
    expect(ix.source_type).toBe('user');
    expect(ix.ts).toBe(tm.clock.now());
  });

  it('ingestUser with no speaker → speaker null, Interaction.source null (unknown speaker, still source_type user)', async () => {
    const tm = new TimeMachine({ seed: 1 });
    await tm.engine.ingestUser('hi');
    const msg = tm.storage.snap.messages.at(-1)!;
    expect(msg.speaker ?? null).toBeNull();
    const ix = tm.storage.snap.interactions!.at(-1)!;
    expect(ix.source).toBeNull();
    expect(ix.source_type).toBe('user');
  });

  it('ingestModel appends an Interaction(role model, source_type self, source null)', async () => {
    const tm = new TimeMachine({ seed: 1 });
    await tm.engine.ingestModel('a reply');
    const ix = tm.storage.snap.interactions!.at(-1)!;
    expect(ix.role).toBe('model');
    expect(ix.source_type).toBe('self');
    expect(ix.source).toBeNull();
    expect(ix.msgId).toBe(tm.storage.snap.messages.at(-1)!.id);
  });
});

describe('1A placement (subject → tier; echo-chamber kill)', () => {
  it('subject={person_name} → lands ONLY in snap.persons[id].episodic, not snap.episodic; registry records the name', async () => {
    const tm = new TimeMachine({ seed: 1 });
    tm.chat.extractQueue.push({
      episodic: [{ content: 'วี ชอบเดินตลาดนัด', importance: 7, tags: ['market'],
        source_name: 'วี', subject: { person_name: 'วี' }, said_by: 'user' }],
      prospective: [],
    });
    await tm.respond('คุยกับวี');
    expect(tm.storage.snap.episodic).toHaveLength(0);                 // NOT in entity tier
    const persons = tm.storage.snap.persons!;
    const ids = Object.keys(persons);
    expect(ids).toHaveLength(1);
    const mem = persons[ids[0]!]!.episodic[0]!;
    expect(mem.content).toBe('วี ชอบเดินตลาดนัด');
    expect(mem.subject).toBe(ids[0]);                                 // subject is the resolved id, not the name
    expect(mem.source).toBe(ids[0]);                                  // วี both said it and is about it
    expect(mem.source_type).toBe('user');
    const reg = tm.storage.snap.personRegistry!;
    expect(reg[ids[0]!]!.known_names).toContain('วี');
  });

  it("subject='world' (and an omitted subject) → entity tier (parity with today)", async () => {
    const tm = new TimeMachine({ seed: 1 });
    tm.chat.extractQueue.push({
      episodic: [
        { content: 'ตลาดเช้าวันนี้คนเยอะ', importance: 6, tags: ['market'], source_name: 'วี', subject: 'world', said_by: 'user' },
        { content: 'a bare legacy fact', importance: 6, tags: ['x'] }, // no source_name/subject/said_by
      ],
      prospective: [],
    });
    await tm.respond('hi');
    const contents = tm.storage.snap.episodic.map(m => m.content);
    expect(contents).toContain('ตลาดเช้าวันนี้คนเยอะ');
    expect(contents).toContain('a bare legacy fact');                 // back-compat: absent subject ⇒ world ⇒ entity
    expect(Object.keys(tm.storage.snap.persons!)).toHaveLength(0);
    const worldMem = tm.storage.snap.episodic.find(m => m.content === 'ตลาดเช้าวันนี้คนเยอะ')!;
    expect(worldMem.subject).toBe('world');
    expect(worldMem.source_type).toBe('user');
    const bareMem = tm.storage.snap.episodic.find(m => m.content === 'a bare legacy fact')!;
    expect(bareMem.subject).toBe('world');                            // defaulted
    expect(bareMem.source).toBeNull();                               // no source_name ⇒ null
    expect(bareMem.source_type).toBe('user');                        // no said_by ⇒ default 'user'
  });

  it("subject='self' → pushes NOTHING to any episodic; ledger still has the model interaction", async () => {
    const tm = new TimeMachine({ seed: 1 });
    tm.chat.extractQueue.push({
      episodic: [{ content: 'ฉันชอบฝน', importance: 9, tags: ['self'], source_name: null, subject: 'self', said_by: 'self' }],
      prospective: [],
    });
    await tm.respond('คุยเล่น');
    expect(tm.storage.snap.episodic).toHaveLength(0);
    expect(Object.values(tm.storage.snap.persons!).flatMap(p => p.episodic)).toHaveLength(0);
    // the verbatim utterance is preserved as a model interaction (audit), not lost
    expect(tm.storage.snap.interactions!.some(i => i.role === 'model' && i.source_type === 'self')).toBe(true);
  });

  it('ECHO-CHAMBER regression: a self-subject utterance NEVER crystallizes; a world utterance DOES (positive control)', async () => {
    // Negative: repeated self-subject extracts must produce zero selfFacets.
    const neg = new TimeMachine({ seed: 2024, policy: 'fixed' });
    for (let i = 0; i < 8; i++) {
      neg.chat.extractQueue.push({
        episodic: [{ content: `ฉันชอบฝน ${i}`, importance: 9, tags: ['selftrait'], source_name: null, subject: 'self', said_by: 'self' }],
        prospective: [],
      });
      await neg.respond(`turn ${i}`);
      neg.clock.advanceDays(1);
    }
    expect(neg.storage.snap.episodic).toHaveLength(0);
    expect(neg.selfTier()).toHaveLength(0);                          // no path self→selfFacet

    // Positive control: repeated WORLD extracts with the same tag DO crystallize.
    const pos = new TimeMachine({ seed: 2024, policy: 'fixed' });
    for (let i = 0; i < 8; i++) {
      pos.chat.extractQueue.push({
        episodic: [{ content: `ตลาดคึกคัก ${i}`, importance: 9, tags: ['worldtrait'], source_name: null, subject: 'world', said_by: 'self' }],
        prospective: [],
      });
      await pos.respond(`turn ${i}`);
      pos.clock.advanceDays(1);
    }
    expect(pos.selfTier().length).toBeGreaterThan(0);                // world facts crystallize identity
  });
});

describe('1A ambient attribution', () => {
  it('addEpisodic stamps subject=world, source=null, source_type=ambient', async () => {
    const tm = new TimeMachine({ seed: 1 });
    await tm.engine.addEpisodic({ content: 'อากาศเย็นผิดปกติเช้านี้', importance: 6, tags: ['weather'] });
    const mem = tm.storage.snap.episodic.at(-1)!;
    expect(mem.subject).toBe('world');
    expect(mem.source).toBeNull();
    expect(mem.source_type).toBe('ambient');
    // and it stays in the entity tier (world → entity)
    expect(Object.keys(tm.storage.snap.persons ?? {})).toHaveLength(0);
  });
});
