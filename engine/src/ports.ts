import type {
  Message, SelfFacet, EpisodicMemory, ProspectiveMemory, PatternEvidence,
} from './types.js';

export interface Random {
  float(): number; // [0,1)
  int(minInclusive: number, maxInclusive: number): number;
}

export interface Clock { now(): number; }

export interface Snapshot {
  messages: Message[];
  episodic: EpisodicMemory[];
  selfFacets: SelfFacet[];
  prospective: ProspectiveMemory[];
  lastTick: number;
}

export interface StoragePort {
  load(): Promise<Snapshot>;
  save(s: Snapshot): Promise<void>;
}

export interface EmbedPort {
  embed(text: string): Promise<number[] | null>; // null on failure -> backfill later
}

export interface ExtractResult {
  episodic: { content: string; importance: number; tags: string[] }[];
  prospective: { intent: string; priority: number; contextClue: string }[];
  resolved?: string[]; // ids of previously-pending intents this exchange has addressed
}

export interface ChatPort {
  stream(messages: Message[], systemPrompt: string, inject: string): AsyncIterable<string>;
  describeImage(dataUrl: string): Promise<string>;
  extract(recent: Message[], pending?: { id: string; intent: string }[]): Promise<ExtractResult>;
  summarizePattern(members: EpisodicMemory[]): Promise<{ statement: string; kind: SelfFacet['kind'] }>;
}

export interface CrystallizePolicy {
  shouldCrystallize(e: PatternEvidence, rng: Random): boolean;
}
