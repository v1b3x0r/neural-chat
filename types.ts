
export interface MessageImage {
  data: string; // base64
  mimeType: string;
}

export interface GroundingLink {
  uri: string;
  title: string;
}

export interface CognitiveInsight {
  reasoning: string; // การวิเคราะห์ว่าทำไมถึงเลือกความจำเหล่านี้มา
  connections: string[]; // เส้นใยความเชื่อมโยงที่ตรวจพบ
  anticipation: string; // สิ่งที่ระบบคาดการณ์จากบริบท (Non-linear future)
}

export interface Message {
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  embedding?: number[]; 
  image?: MessageImage;
  relevanceRating?: number;
  groundingLinks?: GroundingLink[];
  insight?: CognitiveInsight; // ผลการคิดก่อนตอบ
}

export interface EpisodicMemory {
  id: string;
  content: string;
  importance: number; 
  timestamp: number;
  tags: string[];
  embedding?: number[];
  relevanceRating?: number;
  image?: MessageImage;
}

export interface ProspectiveMemory {
  id: string;
  intent: string;
  status: 'pending' | 'resolved' | 'abandoned';
  priority: number;
  timestamp: number;
  context_clue: string;
}

export interface VectorMatch<T> {
  item: T;
  similarity: number;
}

export interface OntologySettings {
  importanceThreshold: number;
  decayRate: number;
  mmrLambda: number; 
  similarityThreshold: number; 
  focusEntities: string[];
  customConstraint: string;
  systemPrompt: string;
}

export interface ChatSession {
  messages: Message[];
  memories: EpisodicMemory[];
  prospective: ProspectiveMemory[];
}