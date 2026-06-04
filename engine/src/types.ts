export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  imageUri?: string;
  imageMime?: string;
  ts: number;
}

export interface SelfFacet {
  id: string;
  statement: string;
  kind: 'voice' | 'value' | 'relationship';
  strength: number;
  updatedAt: number;
}

export interface EpisodicMemory {
  id: string;
  content: string;
  embedding: number[] | null;
  importance: number; // 1..10
  strength: number;
  createdAt: number;
  lastRecalledAt: number; // -1 = never recalled
  tags: string[];
  imageUri?: string;
  imageMime?: string;
  crystallizeAt: number; // per-memory threshold (for the per-memory random variant)
  sourceMsgIds: string[];
}

export interface ProspectiveMemory {
  id: string;
  intent: string;
  status: 'pending' | 'resolved' | 'abandoned';
  priority: number;
  contextClue: string;
  createdAt: number;
  clueEmbedding: number[] | null; // embed(contextClue); null = embed failed, backfilled in tick
  strength: number;               // decays like episodic; abandoned when it falls below the floor
  lastTriggeredAt: number;        // -1 = never triggered (used for cooldown)
}

export interface PatternEvidence {
  key: string; // the tag/cluster identity
  recurrence: number;
  avgImportance: number;
  spanDays: number;
  memberIds: string[];
}

export interface EngineConfig {
  tau: number; // decay time constant (days)
  floor: number; // prune below this strength
  boost: number; // reinforcement increment
  mergeThreshold: number; // cosine >= this AND both weak -> merge
  mergeStrengthCeiling: number; // only merge memories weaker than this
  selfTierCap: number; // max self-facets kept
  selfFloor: number; // prune self-facet below this strength
  selfDecayTauMultiplier: number; // self-facets decay slower than episodic
  retrieveTopK: number;
  retrieveMinSimilarity: number; // recall/inject only above this similarity
  mmrLambda: number;
  tailN: number; // recent raw messages included in injection
  minCrystallizeImportance: number; // pattern avgImportance gate
  prospectiveTriggerSim: number;   // cosine(query, clueEmbedding) >= this -> intent surfaces this turn
  prospectiveFloor: number;        // abandon a pending intent below this strength
  prospectiveCooldownDays: number; // after triggering, wait this long before it can trigger again
  prospectiveDedupeSim: number;    // a new intent whose clue is this similar to a pending one is merged in
  prospectiveActiveCap: number;    // max pending intents kept (strongest survive) — caps a burst of distinct intents
  prospectiveArchiveCap: number;   // max resolved+abandoned intents kept (newest survive) — bounds the "graveyard"
}

export const DEFAULT_CONFIG: EngineConfig = {
  tau: 7,
  floor: 0.05,
  boost: 0.5,
  mergeThreshold: 0.92,
  mergeStrengthCeiling: 0.5,
  selfTierCap: 12,
  selfFloor: 0.05,
  selfDecayTauMultiplier: 3,
  retrieveTopK: 5,
  retrieveMinSimilarity: 0.15,
  mmrLambda: 0.5,
  tailN: 8,
  minCrystallizeImportance: 5,
  prospectiveTriggerSim: 0.4,
  prospectiveFloor: 0.05,
  prospectiveCooldownDays: 1,
  prospectiveDedupeSim: 0.9,
  prospectiveActiveCap: 24,
  prospectiveArchiveCap: 50,
};

export interface InjectionContext {
  selfTier: SelfFacet[];
  episodic: EpisodicMemory[];
  prospective: ProspectiveMemory[];
  tail: Message[];
}
