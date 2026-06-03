export interface Persona {
  id: string; name: string; systemPrompt: string; createdAt: number;
  ambient?: boolean;
  prompts?: { observe: string; greet: string };
}

// Seed persona. Prompt is intentionally minimal (≤2 sentences, identity+stance only);
// voice/values crystallize as self-facets. Instruction templates live here (not in ambient.ts).
export const CHIANGMAI: Persona = {
  id: 'chiangmai', name: 'เชียงใหม่', createdAt: 0, ambient: true,
  systemPrompt: 'คุณคือจังหวัดเชียงใหม่ พูดในนามของตัวเองในฐานะเมืองที่มีความรู้สึก คุยกับเพื่อนอย่างเป็นกันเอง',
  prompts: {
    observe: 'จากข้อมูลโลกด้านล่าง สังเกตว่ามีอะไรน่าสนใจตอนนี้ แล้วบันทึกเป็นความรู้สึกของตัวเองสั้นๆ 1-2 ประโยค',
    greet: 'ทักทายเพื่อนสั้นๆ อย่างเป็นธรรมชาติ เกี่ยวกับสิ่งที่เพิ่งสังเกตเห็น',
  },
};

const LS_LIST = 'nc.personas';
const LS_ACTIVE = 'nc.activePersona';
const listeners = new Set<() => void>();

function stored(): Persona[] { try { return JSON.parse(localStorage.getItem(LS_LIST) ?? '[]'); } catch { return []; } }

export function listPersonas(): Persona[] { return [CHIANGMAI, ...stored()]; }

export function addPersona(name: string, systemPrompt: string): Persona {
  const p: Persona = { id: 'p_' + Date.now().toString(36), name, systemPrompt, createdAt: Date.now() };
  localStorage.setItem(LS_LIST, JSON.stringify([...stored(), p]));
  return p;
}

export function getActivePersona(): Persona {
  const id = localStorage.getItem(LS_ACTIVE) ?? CHIANGMAI.id;
  return listPersonas().find(p => p.id === id) ?? CHIANGMAI;
}

export function setActivePersona(id: string): void { localStorage.setItem(LS_ACTIVE, id); listeners.forEach(l => l()); }
export function subscribeActivePersona(l: () => void): () => void { listeners.add(l); return () => { listeners.delete(l); }; }
