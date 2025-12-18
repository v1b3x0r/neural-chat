
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Message, EpisodicMemory, VectorMatch, ProspectiveMemory } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const DEFAULT_SYSTEM_INSTRUCTION = `You are Chronos, a high-intelligence AI with Long-term Temporal Memory and Visual Perception.
You use "Diverse Semantic Retrieval" to recall both raw conversations and distilled facts from your local Episodic Memory store.

Current Time: ${new Date().toLocaleString()}

Guidelines:
1. Prioritize "Retrieved Facts" (distilled knowledge) for factual recall.
2. Use "Recalled Context" (raw messages) to maintain conversational continuity.
3. Use "Prospective Intents" to follow up on previous plans or unresolved topics.
4. Your recall is strictly local; you do not have web access.
5. If an image is provided, integrate its details into your episodic reasoning.`;

/**
 * Describe an image to get a text representation for semantic embedding
 */
export const getImageDescription = async (image: { data: string, mimeType: string }): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{
        parts: [
          { inlineData: image },
          { text: "Describe this image in detail for semantic indexing. Focus on objects, setting, and mood." }
        ]
      }]
    });
    return response.text || "";
  } catch (error) {
    console.error("Image description failed:", error);
    return "";
  }
};

/**
 * Neural Retrieval Utilities
 */
export const getEmbedding = async (text: string): Promise<number[]> => {
  if (!text.trim()) return [];
  try {
    const result = await ai.models.embedContent({
      model: "text-embedding-004",
      contents: { parts: [{ text }] },
    });
    // Fix: In @google/genai SDK, EmbedContentResponse uses the property name 'embeddings' for the ContentEmbedding object
    if (result.embeddings && result.embeddings.values) {
      return result.embeddings.values;
    }
    return [];
  } catch (error: any) {
    console.error("Embedding failed:", error);
    return [];
  }
};

const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
  let dotProduct = 0;
  let mA = 0;
  let mB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    mA += vecA[i] * vecA[i];
    mB += vecB[i] * vecB[i];
  }
  mA = Math.sqrt(mA);
  mB = Math.sqrt(mB);
  if (mA === 0 || mB === 0) return 0;
  return dotProduct / (mA * mB);
};

export const mmrSearch = <T extends { embedding?: number[]; timestamp: number; relevanceRating?: number }>(
  queryEmbedding: number[],
  items: T[],
  topK: number = 3,
  lambda: number = 0.5,
  decayRate: number = 1.0
): VectorMatch<T>[] => {
  const candidates = items.filter(item => item.embedding && item.embedding.length > 0);
  if (candidates.length === 0) return [];

  const initialScores = candidates.map(item => {
    const similarity = cosineSimilarity(queryEmbedding, item.embedding!);
    const timeDiffDays = (Date.now() - item.timestamp) / (1000 * 60 * 60 * 24);
    const decay = Math.exp(-timeDiffDays * decayRate);
    
    // Incorporate user feedback: boost if rated 1, penalize if rated -1
    const ratingMultiplier = item.relevanceRating === 1 ? 1.2 : (item.relevanceRating === -1 ? 0.5 : 1.0);
    
    return { item, score: similarity * (0.8 + 0.2 * decay) * ratingMultiplier, similarity };
  });

  const selected: { item: T; similarity: number }[] = [];
  const remaining = [...initialScores];

  while (selected.length < topK && remaining.length > 0) {
    let bestScore = -Infinity;
    let bestIndex = -1;
    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      let maxDiversitySim = 0;
      for (const s of selected) {
        const sim = cosineSimilarity(candidate.item.embedding!, s.item.embedding!);
        if (sim > maxDiversitySim) maxDiversitySim = sim;
      }
      const mmrScore = lambda * candidate.score - (1 - lambda) * maxDiversitySim;
      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIndex = i;
      }
    }
    if (bestIndex !== -1) {
      const winner = remaining.splice(bestIndex, 1)[0];
      if (winner.similarity > 0.4) {
        selected.push({ item: winner.item, similarity: winner.similarity });
      } else { break; }
    } else { break; }
  }
  return selected;
};

/**
 * Core Chat Logic with Streaming
 */
export async function* chatWithMemoryStream(
  messages: Message[],
  memories: EpisodicMemory[],
  recalledMessages: VectorMatch<Message>[] = [],
  recalledFacts: VectorMatch<EpisodicMemory>[] = [],
  prospective: ProspectiveMemory[] = [],
  customSystemInstruction?: string
) {
  const factsContext = recalledFacts.length > 0
    ? `\n--- DISTILLED FACTS RECALLED ---\n${recalledFacts.map(f => `[FACT: ${f.item.content}]`).join('\n')}\n`
    : "";

  const historyContext = recalledMessages.length > 0
    ? `\n--- RAW HISTORY RECALLED ---\n${recalledMessages.map(m => `[DATE: ${new Date(m.item.timestamp).toLocaleDateString()}] ${m.item.role === 'user' ? 'User' : 'AI'}: ${m.item.content}`).join('\n')}\n`
    : "";

  const intentContext = prospective.filter(p => p.status === 'pending').length > 0
    ? `\n--- PROSPECTIVE INTENTS (FUTURE PLANS) ---\n${prospective.filter(p => p.status === 'pending').map(p => `[PLAN: ${p.intent}] (Priority: ${p.priority})`).join('\n')}\n`
    : "";

  const baseInstruction = customSystemInstruction?.trim() || DEFAULT_SYSTEM_INSTRUCTION;
  const activeWindow = messages.slice(-15);

  const contents = activeWindow.map(m => {
    const parts: any[] = [{ text: m.content }];
    if (m.image) {
      parts.push({
        inlineData: {
          data: m.image.data,
          mimeType: m.image.mimeType
        }
      });
    }
    return { role: m.role, parts };
  });

  const stream = await ai.models.generateContentStream({
    model: "gemini-3-flash-preview",
    contents,
    config: {
      systemInstruction: baseInstruction + factsContext + historyContext + intentContext,
      temperature: 0.7,
    },
  });

  for await (const chunk of stream) {
    const responseChunk = chunk as GenerateContentResponse;
    if (responseChunk.text) {
      yield responseChunk.text;
    }
  }
}

/**
 * Cognitive Distillation Layer
 */
export const extractMemories = async (
  latestMessages: Message[],
  customConstraint: string = ""
): Promise<Partial<EpisodicMemory>[]> => {
  if (latestMessages.length === 0) return [];
  const prompt = `Analyze this chat segment and extract key facts for long-term Episodic Memory.
  ${customConstraint ? `Constraint: ${customConstraint}` : ""}
  Return JSON list: content, importance (1-10), tags.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ parts: [{ text: prompt + "\n\nSegment:\n" + latestMessages.map(m => `${m.role}: ${m.content}`).join('\n') }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            content: { type: Type.STRING },
            importance: { type: Type.NUMBER },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["content", "importance", "tags"]
        }
      }
    }
  });

  try { return JSON.parse(response.text || "[]"); } catch (e) { return []; }
};

export const extractIntents = async (
  latestMessages: Message[]
): Promise<Partial<ProspectiveMemory>[]> => {
  if (latestMessages.length === 0) return [];
  const prompt = `Analyze the chat and identify "Prospective Intents".
  These are things mentioned that should be done LATER, questions to be answered LATER, or topics planned for FUTURE discussion.
  Ignore things already finished. Focus on "we should...", "remind me to...", "later let's...".

  Return JSON list: intent, priority (1-5), context_clue (one keyword).`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ parts: [{ text: prompt + "\n\nSegment:\n" + latestMessages.map(m => `${m.role}: ${m.content}`).join('\n') }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            intent: { type: Type.STRING },
            priority: { type: Type.NUMBER },
            context_clue: { type: Type.STRING }
          },
          required: ["intent", "priority", "context_clue"]
        }
      }
    }
  });

  try { return JSON.parse(response.text || "[]"); } catch (e) { return []; }
};
