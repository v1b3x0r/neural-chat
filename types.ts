
export interface MessageImage {
  data: string; // base64
  mimeType: string;
}

export interface Message {
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  embedding?: number[]; // Semantic vector
  image?: MessageImage; // Optional image data
  relevanceRating?: number; // User feedback: 1 for accurate/useful, -1 for irrelevant/wrong, 0 for neutral
}

export interface EpisodicMemory {
  id: string;
  content: string;
  importance: number; // 1-10
  timestamp: number;
  tags: string[];
  embedding?: number[]; // Semantic vector for the fact
  relevanceRating?: number; // User feedback: 1 for accurate/useful, -1 for irrelevant/wrong, 0 for neutral
}

export interface ProspectiveMemory {
  id: string;
  intent: string;
  status: 'pending' | 'resolved' | 'abandoned';
  priority: number;
  timestamp: number;
  context_clue: string; // Keywords that trigger this intent
}

export interface VectorMatch<T> {
  item: T;
  similarity: number;
}

export interface OntologySettings {
  importanceThreshold: number;
  decayRate: number;
  mmrLambda: number; // MMR diversity parameter: 0 for max diversity, 1 for max relevance
  similarityThreshold: number; // Minimum cosine similarity for retrieval
  focusEntities: string[];
  customConstraint: string;
  systemPrompt: string;
}

export interface ChatSession {
  messages: Message[];
  memories: EpisodicMemory[];
  prospective: ProspectiveMemory[];
}
