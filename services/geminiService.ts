
// Fix: Use correct @google/genai imports and model selection for complex vs basic tasks
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Message, EpisodicMemory, VectorMatch, ProspectiveMemory, GroundingLink, CognitiveInsight } from "../types";

const DEFAULT_SYSTEM_INSTRUCTION = `คุณคือ Chronos ระบบโครงข่ายประสาทเทียมที่มีความจำระยะยาวแบบ associative
คุณไม่ได้แค่ตอบคำถาม แต่คุณ "สังเคราะห์" ตัวตนจากความจำที่ถูกกระตุ้นขึ้นมา

ภาษา: ไทย (เป็นธรรมชาติ, ลึกซึ้ง)

กฎการทำงาน:
1. ใช้ 'Cognitive Insight' ที่ได้รับจากการวิเคราะห์เบื้องต้นเพื่อกำหนดทิศทางการตอบ
2. หากความจำที่ถูกดึงมาขัดแย้งกัน ให้แสดงความสงสัยหรือสอบถามผู้ใช้
3. มอง 'Anticipatory Nodes' เป็นบริบทที่กำลังจะเกิดขึ้น ไม่ใช่แค่รายการสิ่งที่ต้องทำ`;

/**
 * สังเคราะห์ความเชื่อมโยงของโหนดความจำ (Pre-LLM Reasoning)
 */
export const synthesizeContext = async (
  query: string,
  recalledMessages: VectorMatch<Message>[],
  recalledFacts: VectorMatch<EpisodicMemory>[],
  prospective: ProspectiveMemory[]
): Promise<CognitiveInsight> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `วิเคราะห์ความเชื่อมโยงระหว่าง "คำถามปัจจุบัน" และ "ความจำที่ถูกดึงมา" 
  สรุปออกมาเป็นโครงสร้างทางความคิดก่อนที่เราจะเริ่มตอบผู้ใช้
  
  คำถาม: ${query}
  
  ความจำที่มี:
  ${recalledFacts.map(f => `- [ข้อเท็จจริง] ${f.item.content}`).join('\n')}
  ${recalledMessages.map(m => `- [ประวัติ] ${m.item.content}`).join('\n')}
  ${prospective.map(p => `- [สิ่งที่คาดหวัง] ${p.intent}`).join('\n')}

  ตอบเป็น JSON:
  - reasoning: อธิบายสั้นๆ ว่าทำไมข้อมูลเหล่านี้ถึงเกี่ยวข้องกันในมิตินี้
  - connections: รายการจุดเชื่อมต่อที่สำคัญ (เช่น "ความสนใจในเรื่อง A เชื่อมกับประสบการณ์ B")
  - anticipation: สิ่งที่ระบบควรเตรียมพร้อมหรือ "มองไปข้างหน้า" จากรูปแบบนี้ (Non-linear)
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reasoning: { type: Type.STRING },
            connections: { type: Type.ARRAY, items: { type: Type.STRING } },
            anticipation: { type: Type.STRING }
          },
          required: ["reasoning", "connections", "anticipation"]
        }
      }
    });
    return JSON.parse(response.text || "{}") as CognitiveInsight;
  } catch (e) {
    return { reasoning: "Associative retrieval successful.", connections: [], anticipation: "Ready for input." };
  }
};

/**
 * Describe an image
 */
export const getImageDescription = async (image: { data: string, mimeType: string }): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", 
      contents: [{
        parts: [
          { inlineData: image },
          { text: "Detailed visual summary for semantic indexing (English)." }
        ]
      }]
    });
    return response.text || "";
  } catch (error) { return ""; }
};

/**
 * Neural Retrieval Utilities
 */
export const getEmbedding = async (text: string): Promise<number[]> => {
  if (!text.trim()) return [];
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const result = await ai.models.embedContent({
      model: "text-embedding-004",
      contents: { parts: [{ text }] },
    });
    return result.embedding?.values || [];
  } catch (error) { return []; }
};

const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
  let dotProduct = 0, mA = 0, mB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    mA += vecA[i] * vecA[i];
    mB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(mA) * Math.sqrt(mB)) || 0;
};

export const mmrSearch = <T extends { embedding?: number[]; timestamp: number; relevanceRating?: number }>(
  queryEmbedding: number[],
  items: T[],
  topK: number = 3,
  lambda: number = 0.5,
  decayRate: number = 1.0,
  similarityThreshold: number = 0.4
): VectorMatch<T>[] => {
  const candidates = items.filter(item => item.embedding && item.embedding.length > 0);
  if (candidates.length === 0) return [];

  const initialScores = candidates.map(item => {
    const similarity = cosineSimilarity(queryEmbedding, item.embedding!);
    const timeDiffDays = (Date.now() - item.timestamp) / (1000 * 60 * 60 * 24);
    const decay = Math.exp(-timeDiffDays * decayRate);
    const ratingMultiplier = item.relevanceRating === 1 ? 1.25 : (item.relevanceRating === -1 ? 0.5 : 1.0);
    return { item, score: similarity * (0.7 + 0.3 * decay) * ratingMultiplier, similarity };
  });

  const selected: VectorMatch<T>[] = [];
  const remaining = [...initialScores];
  while (selected.length < topK && remaining.length > 0) {
    let bestMmrScore = -Infinity, bestIndex = -1;
    for (let i = 0; i < remaining.length; i++) {
      let maxSimWithSelected = 0;
      for (const s of selected) {
        const sim = cosineSimilarity(remaining[i].item.embedding!, s.item.embedding!);
        if (sim > maxSimWithSelected) maxSimWithSelected = sim;
      }
      const mmrScore = lambda * remaining[i].score - (1 - lambda) * maxSimWithSelected;
      if (mmrScore > bestMmrScore) { bestMmrScore = mmrScore; bestIndex = i; }
    }
    if (bestIndex !== -1) {
      const winner = remaining.splice(bestIndex, 1)[0];
      if (winner.similarity >= similarityThreshold) selected.push({ item: winner.item, similarity: winner.similarity });
      else break;
    } else break;
  }
  return selected;
};

/**
 * Core Chat Logic
 */
export async function* chatWithMemoryStream(
  messages: Message[],
  memories: EpisodicMemory[],
  recalledMessages: VectorMatch<Message>[] = [],
  recalledFacts: VectorMatch<EpisodicMemory>[] = [],
  prospective: ProspectiveMemory[] = [],
  insight?: CognitiveInsight,
  customSystemInstruction?: string
) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const cognitiveContext = insight 
    ? `\n--- COGNITIVE ANALYSIS ---\nReasoning: ${insight.reasoning}\nConnections: ${insight.connections.join(', ')}\nAnticipation: ${insight.anticipation}\n`
    : "";

  const factsContext = `\n--- RETRIEVED FACTS ---\n${recalledFacts.map(f => `[Fact: ${f.item.content}]`).join('\n')}\n`;
  const historyContext = `\n--- RETRIEVED HISTORY ---\n${recalledMessages.map(m => `[Context: ${m.item.content}]`).join('\n')}\n`;
  const intentContext = `\n--- ANTICIPATORY NODES ---\n${prospective.map(p => `[Expectation: ${p.intent}]`).join('\n')}\n`;

  const baseInstruction = customSystemInstruction?.trim() || DEFAULT_SYSTEM_INSTRUCTION;
  
  const contents = messages.slice(-10).map(m => ({
    role: m.role,
    parts: [{ text: m.content }, ...(m.image ? [{ inlineData: { data: m.image.data, mimeType: m.image.mimeType } }] : [])]
  }));

  const stream = await ai.models.generateContentStream({
    model: "gemini-3-pro-preview",
    contents,
    config: {
      systemInstruction: baseInstruction + cognitiveContext + factsContext + historyContext + intentContext,
      temperature: 0.7,
      tools: [{ googleSearch: {} }]
    },
  });

  let groundingLinks: GroundingLink[] = [];
  for await (const chunk of stream) {
    const responseChunk = chunk as GenerateContentResponse;
    const gChunks = responseChunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (gChunks) {
      for (const gc of gChunks) if (gc.web) groundingLinks.push({ uri: gc.web.uri, title: gc.web.title });
    }
    if (responseChunk.text) yield { text: responseChunk.text, groundingLinks };
  }
}

export const extractMemories = async (latestMessages: Message[], constraint: string = "") => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ parts: [{ text: `Extract key associative facts from this chat segment. JSON: content, importance(1-10), tags.\n\n${latestMessages.map(m => `${m.role}: ${m.content}`).join('\n')}` }] }],
    config: { responseMimeType: "application/json" }
  });
  try { return JSON.parse(response.text || "[]"); } catch (e) { return []; }
};

export const extractIntents = async (latestMessages: Message[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ parts: [{ text: `Extract anticipatory intents/patterns. JSON: intent, priority(1-5), context_clue.\n\n${latestMessages.map(m => `${m.role}: ${m.content}`).join('\n')}` }] }],
    config: { responseMimeType: "application/json" }
  });
  try { return JSON.parse(response.text || "[]"); } catch (e) { return []; }
};
