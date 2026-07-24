# BLUEPRINT — Memory-First Chat Surface

> **Working name:** neural-chat / Chronos surface
> **Status:** Artifact — not implementation
> **Last refined:** 2026-05-12
> **Purpose:** ให้ตัวเองหลัง 6 เดือนกลับมาเริ่มทำได้ โดยไม่ต้องคิด architecture ใหม่ทั้งหมด

---

## Prime Directive

> **Chronos is not the world.**
> **Chronos is a conversation surface that can read world context**
> **and may later write back only through deliberate, gated, traceable actions.**
>
> **Read is cheap. Write is sacred.**

ทุก architectural decision ในเอกสารนี้ต้อง trace กลับมาสองประโยคนี้ได้
ถ้าตอน implement เจอ decision ที่ trace กลับมาไม่ได้ → กลับมาอ่านส่วนนี้ใหม่

---

## 1. Vision & Non-Goals

### 1.1 What we want

แอป chat บน iPhone ที่:

- **Memory-first** — จำได้จริง ข้าม session, ข้าม provider, ข้ามเดือน
- **LLM-agnostic** — plug Gemini / Claude / OpenAI / Ollama / LM Studio / LiteRT ตัวไหนก็ได้ memory เดิม
- **Local-first** — memory + embedding อยู่ในเครื่อง ส่งออก network แค่ context ที่ "เลือกแล้ว"
- **Continuity-focused** — มี prospective memory (มองไปข้างหน้า) ไม่ใช่แค่ recall อดีต
- **Personal use** — ไม่ใช่ product, ไม่ scale, ไม่ multi-user

### 1.2 What we are explicitly NOT building

| ไม่ทำ | เหตุผล |
|---|---|
| Image generation | ไม่ใช่โจทย์ |
| RAG บนเอกสาร | scope creep, ไม่ใช่ memory จริง |
| Agentic / tool use | จะกลายเป็น Devin clone — คนละโจทย์ |
| MCP / plugin ecosystem | over-engineering สำหรับ personal use |
| Multi-user / sharing | ไม่มี server side |
| Voice / TTS | ทำทีหลังถ้าอยาก |
| Real-time collaboration | ไม่ make sense |
| Web version | iPhone-only by design |
| Source-of-truth สำหรับ world | นั่นคืองานของ MDS / Homelog ไม่ใช่ Chronos |

---

## 2. Why Now (2026 Context)

- **LiteRT + Gemma 3n e2b** รันบน iPhone 14 Pro Max ได้จริงแล้ว, e4b ใกล้ความเป็นจริง → on-device LLM ที่ "ใช้งานได้" เริ่ม viable
- **Market gap** — ChatGPT memory, Claude projects, Gemini memory แต่ละตัว vendor-locked คุยกันไม่ได้ → "memory portability" เป็นโจทย์ที่ตลาดไม่แก้
- **2026 wrappers ยังเป็น 2023** — chat history ยัด context window, ไม่มี active retrieval, ไม่มี prospective memory, ไม่มี cognitive insight pre-step
- **รอมา 2 ปี ไม่มีใครทำ** → ทำเองดีกว่า

---

## 3. Architectural Hierarchy (Critical)

Chronos นั่งอยู่ตรงไหนใน Viibe World OS:

```
World layers (engines):
  MDS         — ontology / entity / semantic bus engine
  Homelog     — physical-world memory + home event narrative
  DreamLink   — sensory / body layer (ESP32 → meaning)
  DreamFlow   — language / rule layer (declarative DSL)

Surface layers (interaction):
  Garden      — visual / spatial surface
  Chronos     — conversation / time-reflection surface  ← THIS PROJECT
  ... other surfaces ...
```

- **Chronos role** — หน้าต่างคุยกับ world ที่มีอยู่แล้ว ไม่ใช่ world ใหม่
- **Chronos boundary** — ห้าม implement logic ของ world เอง ใช้ adapter เสียบเท่านั้น
- **Chronos standalone** — ต้องทำงานได้แม้ไม่มี world ใดๆ run อยู่ (NullWorldAdapter)

---

## 4. Core Principles

### 4.1 Read is cheap. Write is sacred.

- **Read / subscribe context จาก world** = default, ทำได้อิสระ
- **Write / emit กลับเข้า world** = opt-in, gated, ต้อง trace ได้, ต้อง user-confirmed
- เหตุผล: chat message ไม่เท่ากับ world event — ส่วนใหญ่คือ vent / draft / fantasy / debugging / simulation → ถ้า default emit ขึ้น world.log จะ pollute purity ของ memory layer

### 4.2 Memory ≠ LLM

- Memory layer = standalone package (Phase 0)
- LLM provider = swappable adapter
- เปลี่ยน LLM = ไม่กระทบ memory
- Export memory = ได้ทุกเมื่อ ไม่ติด vendor

### 4.3 Local-first, cloud-optional

- Embedding + memory storage = local (SQLite + on-device model ถ้าทำได้)
- LLM call ลำดับ preference: local (LiteRT) → LAN (Ollama/LM Studio via Tailscale) → cloud (Anthropic/Gemini/OpenAI)
- Network outage ≠ app dead

### 4.4 Asymmetric coupling

- World → Chronos: easy (adapter implement read methods ก็พอ)
- Chronos → World: hard (ต้องผ่าน proposal → confirmation → audit trail)

### 4.5 Don't pin down what we can't see

- Schema ของ world (MDS / Homelog / DreamLink) ยังไม่ final
- Blueprint นี้เขียนแค่ "ที่เสียบ" ไม่เขียน "ของที่จะเสียบ"
- ถ้าเดา schema จะ couple กับสมมุติฐานที่ผิดในอนาคต

---

## 5. World Adapter Layer (Semantic Bus Connection)

### 5.1 Position

- Chronos ไม่คุยกับ world โดยตรง → คุยผ่าน adapter
- Adapter รู้จัก world schema, Chronos ไม่รู้
- Chronos รู้จักแต่ `WorldAdapter` interface และ `WorldContext` projection

### 5.2 Interface (conceptual)

```ts
interface WorldAdapter {
  // Liveness — adapter ที่ไม่ available ต้องตอบ false ไม่ throw
  isAvailable(): Promise<boolean>

  // Read path — projected context, ไม่ใช่ raw log
  getContext(input: ContextRequest): Promise<WorldContext>

  // Write path — OPTIONAL, default ไม่มี
  // ทุก adapter ที่ implement สองตัวล่างต้องอ่าน section 4.1 ก่อน
  proposeEmit?(event: ProposedWorldEvent): Promise<EmitProposalResult>
  emit?(event: ConfirmedWorldEvent): Promise<EmitResult>
}
```

### 5.3 WorldContext shape (read projection)

```ts
type WorldContext = {
  available: boolean
  timeContext?: {
    localTime: string
    dayPhase: "morning" | "afternoon" | "evening" | "night"
  }
  homeContext?: {
    presence?: string
    recentEvents?: ContextEvent[]
    activeAnomalies?: ContextSignal[]
  }
  humanContext?: {
    energyHint?: "low" | "normal" | "high"
    toneHint?: "gentle" | "neutral" | "direct"
  }
  memoryContext?: {
    relevantNotes?: ContextMemory[]
  }
}
```

- **Key insight** — Chronos consume *meaning* (projection) ไม่ใช่ consume *database* (raw log)
- **Reason** — raw log ดิบ → prompt pollution, hallucination risk, schema coupling
- **Implication** — adapter เป็นคน "interpret" raw world data → projection ก่อนส่งให้ Chronos

### 5.4 Phase 1 implementation: NullWorldAdapter

```ts
class NullWorldAdapter implements WorldAdapter {
  async isAvailable() { return false }
  async getContext() {
    return { available: false }
  }
  // ไม่มี proposeEmit / emit
}
```

- App ต้องทำงานครบทุก feature โดยใช้ NullWorldAdapter
- ถ้า feature ใด require world → feature นั้นเป็น Phase 4+, ไม่ใช่ Phase 1
- Test: ลบ adapter อื่นทั้งหมดออก → app ยัง chat ได้ปกติ

### 5.5 Future adapters (Phase 4+)

- `MDSAdapter` — เสียบ `entity.state`, `world.log` (read), `broadcastContext` (emit, gated)
- `HomelogAdapter` — เสียบ physical-world memory + recent home events
- `DreamLinkAdapter` — เสียบ sensory drift / mood signals
- **Schema ของแต่ละตัว → DEFER จนกว่าจะถึง phase นั้น (ห้ามเดา)**

---

## 6. Memory Model (Chronos-Internal)

Memory นี้คือ **memory ของ Chronos เอง** — แยกจาก world memory (Homelog / MDS)
Source of truth ของ Chronos memory = SQLite ในเครื่อง iPhone

### 6.1 Core types (keep from old project)

```ts
interface Message {
  role: 'user' | 'model'
  content: string
  timestamp: number
  embedding?: number[]
  image?: MessageImage
  relevanceRating?: number
  groundingLinks?: GroundingLink[]
  insight?: CognitiveInsight  // pre-LLM reasoning
}

interface EpisodicMemory {
  id: string
  content: string
  importance: number          // 0..1
  timestamp: number
  tags: string[]
  embedding?: number[]
  image?: MessageImage
}

interface ProspectiveMemory {
  id: string
  intent: string              // "อยากกลับมาคุยเรื่อง X"
  status: 'pending' | 'resolved' | 'abandoned'
  priority: number
  timestamp: number
  context_clue: string        // trigger ที่บอกว่าควร surface
}

interface CognitiveInsight {
  reasoning: string           // ทำไมเลือก memory เหล่านี้
  connections: string[]       // จุดเชื่อมที่ตรวจพบ
  anticipation: string        // มองไปข้างหน้า (non-linear future)
}
```

### 6.2 Retrieval pipeline

1. **Embed query** — local model ถ้าได้, cloud fallback
2. **Vector search** — SQLite cosine similarity → top-K candidates
3. **Apply decay** — Ebbinghaus-inspired exponential decay จาก timestamp
4. **Apply importance threshold** — filter ที่ importance < threshold ออก
5. **MMR re-rank** — Maximal Marginal Relevance, balance relevance vs diversity
6. **Synthesize CognitiveInsight** — LLM call แยก, ก่อน main response
7. **Build prompt** — insight + memories + world context (จาก WorldAdapter) + user query

### 6.3 Why MMR not raw cosine

- Cosine ตรงๆ → context เต็มไปด้วย memory ที่ใกล้กันมาก, lose diversity
- MMR balance — "relevant แต่ไม่ซ้ำ" → context มี breadth
- `mmrLambda` tunable — เริ่ม 0.5 ใน OntologySettings

### 6.4 Why Ebbinghaus decay

- Memory เก่าควรลด weight อัตโนมัติ
- "importance" override decay — เรื่องสำคัญไม่ลืม
- Formula draft:
  ```
  effective_score = relevance * exp(-decayRate * age_days) * (0.5 + 0.5 * importance)
  ```

### 6.5 Why ProspectiveMemory

- Wrapper ปกติแค่ recall อดีต → ไม่มี "เออเดี๋ยวกลับมาเรื่องนี้นะ"
- ProspectiveMemory = pending intent ที่ surface เมื่อ `context_clue` ตรง
- คือสิ่งที่ทำให้ "continuity" รู้สึกจริง ไม่ใช่แค่ "memory recall"
- คือ feature ที่ differentiates จาก wrapper ตลาดทั่วไป

### 6.6 Storage

- `expo-sqlite` — ทุก table อยู่ที่นี่
- Tables: `messages`, `episodic_memories`, `prospective_memories`
- Embedding stored as BLOB (Float32Array → Buffer)
- Image — base64 in column ถ้าเล็ก (<100KB), filesystem ref ถ้าใหญ่ (threshold ใน Phase 1 ค่อย tune)

### 6.7 Boundary: Chronos memory ≠ World memory

- Chronos memory = สิ่งที่เกิดในการคุยกัน ในมือถือเครื่องนี้
- World memory = สิ่งที่ world (MDS / Homelog) รู้ จากแหล่งอื่น
- ห้าม merge ทั้งสองเข้าด้วยกันจนแยกไม่ออก — UI ต้องแสดงต่างกัน, retrieval ต้องคิดแยก

---

## 7. LLM Adapter Layer

### 7.1 Interface

```ts
interface LLMAdapter {
  id: string                    // "anthropic", "ollama", "litert-gemma-3n-e2b"
  capabilities: {
    streaming: boolean
    images: boolean
    structuredOutput: boolean
    maxContextTokens: number
  }

  generate(req: GenerateRequest): Promise<GenerateResponse>
  generateStream(req: GenerateRequest): AsyncIterable<GenerateChunk>
}

interface GenerateRequest {
  systemPrompt?: string
  messages: ChatMessage[]
  responseSchema?: object       // structured output ถ้า adapter support
  tokenBudget?: number
}
```

### 7.2 Adapter roster

| Adapter | Endpoint | Notes |
|---|---|---|
| `AnthropicAdapter` | api.anthropic.com | native SDK |
| `GeminiAdapter` | @google/genai | native SDK |
| `OpenAICompatAdapter` | configurable baseURL | handles OpenAI, Ollama, LM Studio, vLLM, LocalAI |
| `LiteRTAdapter` | on-device | Gemma 3n e2b/e4b — Phase 3 |

### 7.3 OpenAICompatAdapter — first-class support for Ollama / LM Studio

```ts
const presets = {
  ollama:   { baseURL: 'http://HOST:11434/v1', requiresAuth: false },
  lmstudio: { baseURL: 'http://HOST:1234/v1',  requiresAuth: false },
  openai:   { baseURL: 'https://api.openai.com/v1', requiresAuth: true },
}
```

- **Network reality** — iPhone ต่อ Ollama บน Mac บ้าน → ต้อง Tailscale / Cloudflare Tunnel ออกนอกบ้าน
- **Documented setup pattern** — มี doc แยกใน Phase 2 ไม่ใช่แค่ "ใส่ IP" เพราะ user (= ผมเอง) จะลืม
- **Use OpenAI-compat path เสมอ** — `/v1/chat/completions` ไม่ใช่ native `/api/chat` ของ Ollama เพราะ portability

### 7.4 Token budget strategy

- Each adapter รายงาน `maxContextTokens`
- Memory retrieval ต้องตัดให้พอดี budget — drop low-score memories ก่อน
- Reserve buffer 20% สำหรับ response
- Allocation draft:
  - System prompt: 5%
  - World context: 10%
  - Memory (episodic + prospective + insight): 50%
  - Conversation history: 35%
  - (Response = budget separate)

---

## 8. On-Device Path (LiteRT)

### 8.1 Why this matters

- **Privacy** — context ที่ส่งให้ LLM ไม่ออกเครื่อง
- **Offline** — ใช้บนเครื่องบิน, ไม่มี signal, ต่างประเทศไม่มี SIM
- **Cost** — zero per-token cost
- **Trust** — vendor rotation ไม่กระทบ

### 8.2 Model tiers

| Model | Effective size | Device baseline | Quality estimate |
|---|---|---|---|
| Gemma 3n e2b | ~2B | iPhone 14 Pro Max | usable สำหรับ chat ทั่วไป |
| Gemma 3n e4b | ~4B | iPhone 17+ (guess) | usable สำหรับ memory synthesis |
| Phi-4-mini | ~3.8B | iPhone 15+ | alt option ถ้า Gemma ไม่เวิร์ค |

### 8.3 When local vs cloud (rule of thumb)

- **Local เสมอ** — embedding (ถ้าได้), CognitiveInsight pre-step (cheap reasoning)
- **Cloud เสมอ** — main response เวลามี complex memory synthesis, image understanding หนักๆ
- **Configurable per user**:
  - "เน้น privacy" → all local
  - "เน้น quality" → all cloud
  - "balanced" → ตามกฎข้างบน (default)

### 8.4 Embedding strategy

- **Preferred** — on-device sentence-transformer (all-MiniLM-L6-v2 via MLC หรือ ONNX runtime)
- **Fallback** — cloud embedding API (Gemini text-embedding, OpenAI text-embedding-3-small)
- **Dimension fixed at 384** (MiniLM size) เพื่อ portability — cloud embeddings ที่ใหญ่กว่าต้อง project ลง
- ห้าม mix dimension ใน table เดียวกัน — re-embed ทั้ง table ถ้าเปลี่ยน model

---

## 9. Tech Stack (Phase 1)

| Layer | Choice | Why |
|---|---|---|
| Framework | Expo SDK latest | mature, OTA updates, dev client easy |
| Routing | Expo Router | file-based, type-safe |
| Styling | NativeWind v5 | Tailwind-like, universal |
| State | Zustand | simple, no boilerplate, persists easy |
| Storage (small) | AsyncStorage | config, preferences |
| Storage (large) | expo-sqlite | memories, embeddings, messages |
| Secure | expo-secure-store | API keys |
| Image picker | expo-image-picker | ส่งรูป |
| HTTP | fetch + custom retry | no axios needed |
| On-device LLM | TBD (`expo-litert` ถ้ามี, custom native module ถ้าไม่) | Phase 3 ค่อยตัดสิน |

**Version pinning policy** — ใน blueprint ไม่ pin version ตอน implement ใช้ latest stable ของแต่ละตัว ณ ตอนนั้น

---

## 10. Phase Plan

| Phase | Scope | Definition of Done |
|---|---|---|
| **0** | Memory layer = standalone npm package (TS) | `import { MemoryStore } from '@neural-chat/memory'` ได้, test coverage ครบ, ไม่มี UI dependency |
| **1** | Expo shell + 1 cloud LLM (Anthropic หรือ Gemini) + NullWorldAdapter | Chat end-to-end works, memory persists, ส่งรูปได้, no world |
| **2** | Multi-provider LLM + OpenAICompatAdapter (Ollama / LM Studio) | Switch provider in settings, memory unchanged across switch |
| **3** | On-device LLM via LiteRT (Gemma 3n e2b) | Offline mode works สำหรับ basic chat + insight synthesis |
| **4** | First WorldAdapter (Homelog หรือ MDS — TBD) — **READ ONLY** | Chat consume world context, ไม่ emit |
| **5+** | Emit path (gated, with user confirmation UI) | Only after pollution/rollback design (section 11.2) |
| **∞** | Sync ข้าม device | Maybe never. Sacred personal artifact. |

**Phase 0 ทำก่อน 1 เสมอ** — อย่าใจร้อนเริ่มที่ UI shell — memory layer ที่ test แล้ว = foundation ที่ refactor น้อยกว่า 10 เท่า

---

## 11. Open Questions

### 11.1 Memory

- Memory sync ข้าม device — CRDT (Yjs / Automerge) หรือ last-write-wins?
- Embedding model dimension trade-off — 384 vs 768 vs 1536?
- Image — SQLite BLOB vs filesystem ref — threshold ที่ไหน?
- Conflict resolution ตอน LLM 2 ตัวให้ความเชื่อต่างกัน — UX แบบไหน?

### 11.2 Semantic Bus Consequences — DO NOT IMPLEMENT EMIT UNTIL ANSWERED

- chat message แบบไหนนับเป็น world event?
- ใครมีสิทธิ์ตัดสินว่า event ควรถูกบันทึก — user explicit / heuristic / LLM judge?
- save memory (Chronos-internal) กับ world.log emit ต่างกันยังไง?
- transient mood vs durable identity แยกอย่างไร?
- ถ้า LLM judge ผิดแล้วบันทึก noise → rollback mechanism?
- world.log ควรรับ "conversation-derived insight" หรือควรมี log แยก (`chronos.log`)?
- emit ต้องมี user confirmation เสมอไหม — เกณฑ์ skip confirmation?
- event จาก Chronos ควร tag `source: chronos` เสมอ?

### 11.3 LLM

- Token budget allocation ratio ระหว่าง memory vs world context vs system prompt — ตัวเลขใน 7.4 ใช่ไหม?
- On-device LLM ใช้สำหรับ insight synthesis เลย หรือ require cloud quality?
- Streaming UX เวลา switch provider กลางคันของ session?

### 11.4 Product

- Notification "เออคุยเรื่อง X กันเหรอ" — ใช้ ProspectiveMemory + background trigger ยังไงโดยไม่ creepy?
- Multi-conversation vs single endless thread?
- Export format สำหรับ memory portability — JSON-LD? plain JSON? custom?
- ภาษา default — auto-detect หรือ user fix?

---

## 12. Glossary (สำหรับตัวเองหลัง 6 เดือน)

- **Chronos** — surface นี้ (chat app), ไม่ใช่ world
- **World** — รวมๆ คือ MDS + Homelog + DreamLink + etc., ของจริงที่มี state
- **WorldAdapter** — สะพานเสียบ Chronos ↔ world (Null adapter ก็เป็น valid implementation)
- **WorldContext** — projection ของ world ที่ Chronos ใช้ได้ (read model, ไม่ใช่ raw log)
- **NullWorldAdapter** — adapter ที่ตอบว่าไม่มี world available — Phase 1 default
- **EpisodicMemory** — เหตุการณ์ที่จำได้ พร้อม importance + tags
- **ProspectiveMemory** — intent ที่จะ surface เมื่อ `context_clue` ตรง
- **CognitiveInsight** — pre-LLM reasoning ก่อนตอบ (reasoning + connections + anticipation)
- **MMR** — Maximal Marginal Relevance, balance relevance vs diversity ใน retrieval
- **Ebbinghaus decay** — memory เก่าลด weight ตามเวลา ยกเว้น importance สูง
- **Semantic bus** — pub/sub layer ของ Viibe World OS — Chronos แค่ subscribe (default)
- **LiteRT** — Google's on-device runtime สำหรับ ML models บน mobile
- **Gemma 3n** — Gemma variant optimize สำหรับ edge devices, "effective" param count ผ่าน MatFormer
- **Tailscale** — mesh VPN — วิธีต่อ iPhone → Ollama บน Mac บ้าน ตอนออกนอกบ้าน

---

## Coda

ถ้าตัวเองหลัง 6 เดือนกลับมาอ่านเอกสารนี้แล้วลืมว่าคิดอะไรอยู่ตอนเขียน — ขอให้จำได้ 3 อย่าง:

1. **Chronos is not the world. Chronos is a conversation surface.**
2. **Read is cheap. Write is sacred.**
3. **Memory ≠ LLM. ทั้งสองอย่างต้อง decouple ตั้งแต่ Phase 0.**

ที่เหลือ derive ได้

🧩 blueprint maintained. ready when you are.
