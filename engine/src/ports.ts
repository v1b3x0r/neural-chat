import type {
  Message, SelfFacet, EpisodicMemory, ProspectiveMemory, PatternEvidence,
  Person, PersonMemory, Interaction,
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
  // --- 1A additions (all optional ⇒ v0 snapshots load untouched) ---
  persons?: Record<string, PersonMemory>;   // PERSON tier, keyed by OPAQUE person.id
  personRegistry?: Record<string, Person>;  // person.id → identity (names are attributes)
  interactions?: Interaction[];             // who-said-what-when ledger (beside messages[])
}

export interface StoragePort {
  load(): Promise<Snapshot>;
  save(s: Snapshot): Promise<void>;
}

export interface EmbedPort {
  embed(text: string): Promise<number[] | null>; // null on failure -> backfill later
}

export interface ExtractResult {
  episodic: {
    content: string; importance: number; tags: string[];
    source_name?: string | null;                                 // who SAID/OBSERVED it (a name, or null = assistant/system)
    subject?: 'world' | 'self' | { person_name: string } | null; // who/what it is ABOUT
    said_by?: 'user' | 'self';                                    // role of the utterance → source_type (default 'user')
  }[];
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
