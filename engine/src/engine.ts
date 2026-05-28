import {
  DEFAULT_CONFIG, type EngineConfig, type Message, type InjectionContext,
} from './types.js';
import type {
  StoragePort, EmbedPort, ChatPort, Clock, Random, CrystallizePolicy,
} from './ports.js';
import { mmrSearch } from './vector.js';
import { decay, reinforce, merge, prune, detectPatterns } from './consolidation.js';
import { formatInjection } from './inject.js';

const DAY = 86_400_000;

export interface EngineDeps {
  storage: StoragePort; embed: EmbedPort; chat: ChatPort;
  clock: Clock; random: Random; policy: CrystallizePolicy;
  config?: Partial<EngineConfig>; systemPrompt?: string;
}

let counter = 0;
const uid = (p: string) => `${p}_${Date.now().toString(36)}_${(counter++).toString(36)}`;

export class MemoryEngine {
  private cfg: EngineConfig;
  constructor(private d: EngineDeps) { this.cfg = { ...DEFAULT_CONFIG, ...d.config }; }

  async ingestUser(text: string, image?: { dataUrl: string; mime: string }): Promise<void> {
    const snap = await this.d.storage.load();
    const now = this.d.clock.now();
    const msg: Message = { id: uid('m'), role: 'user', text, ts: now };
    if (image) {
      msg.imageMime = image.mime;
      const desc = await this.d.chat.describeImage(image.dataUrl);
      msg.text = text ? `${text}\n[image: ${desc}]` : `[image: ${desc}]`;
    }
    snap.messages.push(msg);
    await this.d.storage.save(snap);
  }

  // Directly add an episodic memory (used by extract and by tests).
  async addEpisodic(e: { content: string; importance: number; tags: string[]; imageUri?: string }): Promise<void> {
    const snap = await this.d.storage.load();
    const now = this.d.clock.now();
    snap.episodic.push({
      id: uid('e'), content: e.content, embedding: await this.d.embed.embed(e.content),
      importance: e.importance, strength: e.importance / 10, createdAt: now, lastRecalledAt: -1,
      tags: e.tags, imageUri: e.imageUri, crystallizeAt: this.d.random.int(3, 7), sourceMsgIds: [],
    });
    await this.d.storage.save(snap);
  }

  async retrieve(query: string): Promise<InjectionContext> {
    const snap = await this.d.storage.load();
    const now = this.d.clock.now();
    const qv = (await this.d.embed.embed(query)) ?? [];
    const picks = mmrSearch(qv, snap.episodic, {
      topK: this.cfg.retrieveTopK, lambda: this.cfg.mmrLambda, minSimilarity: this.cfg.retrieveMinSimilarity,
    });
    const picked = picks.map(p => snap.episodic.find(e => e.id === p.item.id)!);
    for (const m of picked) m.lastRecalledAt = now;
    await this.d.storage.save(snap);
    return {
      selfTier: snap.selfFacets,
      episodic: picked,
      prospective: snap.prospective.filter(p => p.status === 'pending'),
      tail: snap.messages.slice(-this.cfg.tailN),
    };
  }

  async ingestModel(text: string): Promise<void> {
    const snap = await this.d.storage.load();
    snap.messages.push({ id: uid('m'), role: 'model', text, ts: this.d.clock.now() });
    await this.d.storage.save(snap);
  }

  // Truncate the thread: remove the given message and everything after it.
  // Powers edit / rewind / retry. (Memory already consolidated from removed turns
  // is intentionally kept — rewinding the visible chat doesn't erase what was learned.)
  async rewindTo(messageId: string): Promise<void> {
    const snap = await this.d.storage.load();
    const idx = snap.messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return;
    snap.messages = snap.messages.slice(0, idx);
    await this.d.storage.save(snap);
  }

  // Full conversational turn: store user msg → retrieve relevant memory →
  // stream the model reply (yielded to the caller) → store reply → consolidate.
  // This is why a single thread never overflows: only retrieved memory + a short
  // tail is sent, never the full history.
  async *respond(userText: string, image?: { dataUrl: string; mime: string }): AsyncIterable<string> {
    await this.ingestUser(userText, image);
    const ctx = await this.retrieve(userText);
    const timeNote = `[Current time: ${new Date(this.d.clock.now()).toString()}]`;
    const inject = [timeNote, formatInjection(ctx)].filter(Boolean).join('\n\n');
    let full = '';
    for await (const chunk of this.d.chat.stream(ctx.tail, this.d.systemPrompt ?? '', inject)) {
      full += chunk;
      yield chunk;
    }
    await this.ingestModel(full);
    await this.tick();
  }

  async tick(): Promise<void> {
    const snap = await this.d.storage.load();
    const now = this.d.clock.now();

    decay(snap.episodic, { now, lastTick: snap.lastTick, tau: this.cfg.tau });
    reinforce(snap.episodic, { lastTick: snap.lastTick, boost: this.cfg.boost });

    // EXTRACT from messages since last tick
    const recent = snap.messages.filter(m => m.ts >= snap.lastTick);
    if (recent.length) {
      const ex = await this.d.chat.extract(recent);
      for (const e of ex.episodic) {
        snap.episodic.push({
          id: uid('e'), content: e.content, embedding: await this.d.embed.embed(e.content),
          importance: e.importance, strength: e.importance / 10, createdAt: now, lastRecalledAt: -1,
          tags: e.tags, crystallizeAt: this.d.random.int(3, 7), sourceMsgIds: [],
        });
      }
      for (const p of ex.prospective) {
        snap.prospective.push({ id: uid('p'), intent: p.intent, status: 'pending', priority: p.priority, contextClue: p.contextClue, createdAt: now });
      }
    }

    // BACKFILL embeddings that failed earlier
    for (const m of snap.episodic) if (!m.embedding) m.embedding = await this.d.embed.embed(m.content);

    snap.episodic = merge(snap.episodic, this.cfg);
    snap.episodic = prune(snap.episodic, this.cfg.floor);

    // Self-facet decay (slower than episodic), per-facet by its own age, before crystallize.
    const selfTau = this.cfg.tau * this.cfg.selfDecayTauMultiplier;
    for (const f of snap.selfFacets) {
      const dt = Math.max(0, (now - f.updatedAt) / DAY);
      f.strength *= Math.exp(-dt / selfTau);
      f.updatedAt = now;
    }

    // CRYSTALLIZE recurring patterns into the self-tier
    for (const ev of detectPatterns(snap.episodic)) {
      if (ev.avgImportance < this.cfg.minCrystallizeImportance) continue;
      if (!this.d.policy.shouldCrystallize(ev, this.d.random)) continue;
      const members = snap.episodic.filter(m => ev.memberIds.includes(m.id));
      const { statement, kind } = await this.d.chat.summarizePattern(members);
      const existing = snap.selfFacets.find(f => f.statement === statement);
      if (existing) { existing.strength += this.cfg.boost; existing.updatedAt = now; }
      else snap.selfFacets.push({ id: uid('s'), statement, kind, strength: 1, updatedAt: now });
    }

    snap.selfFacets = snap.selfFacets
      .filter(f => f.strength >= this.cfg.selfFloor)
      .sort((a, b) => b.strength - a.strength)
      .slice(0, this.cfg.selfTierCap);

    snap.lastTick = now;
    await this.d.storage.save(snap);
  }
}
