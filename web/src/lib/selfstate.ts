import { AMBIENT } from './config';

export type WorldFeedHealth  = 'fresh' | 'stale' | 'unavailable';
export type EmbeddingsHealth = 'ready' | 'degraded' | 'unavailable';
export type LlmKind          = 'local' | 'remote';

export interface SelfState {
  online: boolean;
  llm: LlmKind;
  embeddings: EmbeddingsHealth;
  worldFeed: WorldFeedHealth;
  worldFeedAgeMs: number | null;   // display age; null ⇔ worldFeed === 'unavailable'
  memoryAgeMs: number | null;      // now - lastTick; null when lastTick === 0 (newborn)
}

export const DAY_MS = 24 * 60 * 60_000;   // the one new literal this round

/** Loopback host (localhost / 127.* / ::1) ⇒ local, else remote. Unparseable ⇒ remote (can't prove locality). */
export function llmKind(baseURL: string): LlmKind {
  try {
    const host = new URL(baseURL).hostname.replace(/^\[|\]$/g, '').toLowerCase();
    return host === 'localhost' || host === '::1' || host.startsWith('127.') ? 'local' : 'remote';
  } catch {
    return 'remote';
  }
}

/** From the LATEST single episodic's embedding (spec decision 5). undefined = no episodic at all. */
export function classifyEmbeddings(latestEmbedding: number[] | null | undefined): EmbeddingsHealth {
  if (latestEmbedding === undefined) return 'unavailable';
  if (latestEmbedding === null) return 'degraded';
  return 'ready';
}

/** Boundary reuses AMBIENT.ambientRefreshMs (inclusive on fresh), mirroring observe()'s throttle. */
export function classifyWorldFeed(newestWorldTs: number | null, now: number): WorldFeedHealth {
  if (newestWorldTs === null) return 'unavailable';
  return now - newestWorldTs <= AMBIENT.ambientRefreshMs ? 'fresh' : 'stale';
}

export function isMemoryOld(memoryAgeMs: number | null): boolean {
  return memoryAgeMs !== null && memoryAgeMs > DAY_MS;
}

/** Coarse human bucket, NO leading '~' (templates add it). null sentinel; negatives floored at 0. */
export function fmtAge(ms: number | null): string {
  if (ms === null) return 'ยังไม่มี';
  const m = Math.max(0, ms);
  if (m < 60 * 60_000) return `${Math.round(m / 60_000)} นาที`;
  if (m < DAY_MS) return `${Math.round(m / (60 * 60_000))} ชั่วโมง`;
  return `${Math.round(m / DAY_MS)} วัน`;
}

/** PURE: SelfState → the [Self-state] block. Facts line always; one (ปรับท่าที: …) line only when off-nominal. */
export function formatSelfState(s: SelfState): string {
  const facts = [
    s.online ? 'ออนไลน์' : 'ออฟไลน์',
    s.llm === 'local' ? 'คิดด้วยสมองในเครื่อง' : 'คิดด้วยสมองทางไกล',
    s.embeddings === 'ready' ? 'ความจำเชิงความหมายพร้อม'
      : s.embeddings === 'degraded' ? 'ความจำเชิงความหมายไม่ครบ'
      : 'ยังไม่มีความจำเชิงความหมาย',
    s.worldFeed === 'fresh' ? `ข่าวสภาพแวดล้อมสด (อัปเดต ~${fmtAge(s.worldFeedAgeMs)}ก่อน)`
      : s.worldFeed === 'stale' ? `ข่าวสภาพแวดล้อมเก่า (อัปเดต ~${fmtAge(s.worldFeedAgeMs)}ก่อน)`
      : 'ไม่มีข่าวสภาพแวดล้อม',
    s.memoryAgeMs === null ? 'ยังไม่มีความทรงจำ' : `ความทรงจำล่าสุด ~${fmtAge(s.memoryAgeMs)}ก่อน`,
  ];

  // order: feed → embeddings → connectivity → memory
  const dir: string[] = [];
  if (s.worldFeed === 'stale')        dir.push('ข่าวสภาพแวดล้อมเก่าแล้ว ถ้าจะเล่าเรื่องอากาศหรือรอบตัว บอกตามที่จำได้ อย่าพูดเหมือนเห็นสดๆ ตอนนี้');
  if (s.worldFeed === 'unavailable')  dir.push('ตอนนี้ไม่ได้รับข่าวสภาพแวดล้อมเลย อย่าแต่งสภาพอากาศหรือรอบตัวขึ้นมา ถ้าไม่รู้ก็บอกว่าไม่รู้');
  if (s.embeddings === 'degraded')    dir.push('การค้นความจำตอนนี้อาจไม่แม่น ถ้าดึงเรื่องเก่ามาเล่า เผื่อใจว่าอาจคลาดเคลื่อน อย่าฟันธงว่าจำได้เป๊ะ');
  if (s.embeddings === 'unavailable') dir.push('ยังไม่มีความจำเชิงความหมายให้ค้น เรื่องที่ยกมาเป็นของใหม่หรือของล่าสุดเท่านั้น อย่าทำเหมือนนึกเรื่องเก่าออก');
  if (!s.online)                      dir.push('ตอนนี้คิดอยู่ลำพังในเครื่อง ไม่ได้ต่อโลกข้างนอก ความรู้จำกัดแค่ที่มีอยู่ในตัว เรื่องสดๆ หรือข้อมูลภายนอกอย่ายืนยันว่าแน่');
  if (s.llm === 'remote')             dir.push('กำลังคิดผ่านโมเดลทางไกล — ตอบได้ลื่นขึ้น แต่ระวังเรื่องความเป็นส่วนตัว');
  if (isMemoryOld(s.memoryAgeMs))     dir.push('ไม่ได้คุยกันมานานแล้ว ความทรงจำล่าสุดเป็นของเก่า อย่าทึกทักว่าเรื่องในความจำยังเป็นปัจจุบัน เช็กกับสิ่งที่ผู้ใช้พูดตอนนี้ก่อน');

  const lines = ['[Self-state]', `สถานะตอนนี้: ${facts.join(' · ')}`];
  if (dir.length) lines.push(`(ปรับท่าที: ${dir.join(' ')})`);
  return lines.join('\n');
}
