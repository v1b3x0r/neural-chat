import type { Message, StoragePort } from '@nature-labs/living-memory-engine';
import { getEngine } from '../lib/engine';
import { getActivePersona, subscribeActivePersona } from '../lib/personas';
import { getActiveProfile, getKey, AMBIENT } from '../lib/config';
import { observe, maybeGreet } from '../lib/ambient';
import { labRespond, type TurnPhase } from '../lib/labrespond';

export function mountChat(root: HTMLElement, openDrawer: () => void, openMemory: () => void): void {
  root.innerHTML = `
    <header class="topbar"><button id="menu" class="icon" aria-label="menu">☰</button><span class="title"></span><button id="mem" class="icon" aria-label="memory">🧠</button></header>
    <main id="thread" class="thread"></main>
    <div id="banner" class="banner" hidden>ต้องใส่ API key ก่อน — แตะเพื่อตั้งค่า</div>
    <div id="phase" class="phase" hidden></div>
    <form id="composer" class="composer">
      <textarea id="input" rows="1" placeholder="พิมพ์หาเชียงใหม่..."></textarea>
      <button id="send" class="send" type="submit" aria-label="send">↑</button>
    </form>`;

  const q = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
  const thread = q('#thread'), title = q('.title'), banner = q<HTMLElement>('#banner');
  const input = q<HTMLTextAreaElement>('#input'), send = q<HTMLButtonElement>('#send');
  const composer = q<HTMLFormElement>('#composer');
  const phase = q<HTMLElement>('#phase');
  let busy = false;

  q('#menu').addEventListener('click', openDrawer);
  q('#mem').addEventListener('click', openMemory);
  banner.addEventListener('click', openDrawer);

  function needsKey(): boolean { const p = getActiveProfile(); return !!p.needsKey && !getKey(p.id); }

  function bubble(role: Message['role'], text: string): HTMLElement {
    const el = document.createElement('div');
    el.className = `bubble ${role}`;
    el.textContent = text;                 // textContent, never innerHTML — safe for LLM/user text
    thread.appendChild(el);
    thread.scrollTop = thread.scrollHeight;
    return el;
  }

  async function paint(storage: StoragePort): Promise<void> {
    const snap = await storage.load();
    thread.replaceChildren();
    if (!snap.messages.length) {
      const e = document.createElement('div'); e.className = 'empty'; e.textContent = 'คุยอะไรดี';
      thread.appendChild(e);
    } else for (const m of snap.messages) bubble(m.role, m.text);
  }

  async function render(): Promise<void> {
    const persona = getActivePersona();
    title.textContent = persona.name;
    banner.hidden = !needsKey();
    const { storage } = await getEngine(persona.id, persona.systemPrompt);
    await paint(storage);
  }

  async function submit(text: string): Promise<void> {
    if (busy || !text.trim()) return;
    if (needsKey()) { openDrawer(); return; }
    busy = true; send.disabled = true;
    const startId = getActivePersona().id;               // pin the persona for this turn
    const stillHere = () => getActivePersona().id === startId;
    const persona = getActivePersona();
    const { engine, storage, chatPort } = await getEngine(persona.id, persona.systemPrompt);
    thread.querySelector('.empty')?.remove();
    bubble('user', text);
    const reply = bubble('model', '');
    try {
      // labRespond mirrors engine.respond() but feeds the LLM per the lab toggles (tunable from the 🧠 pane)
      const PHASE_TEXT: Record<TurnPhase, string> = { recall: '🔍 กำลังนึกความจำ…', stream: '', consolidate: '🧠 กำลังตกตะกอนความจำ…', idle: '' };
      const onPhase = (p: TurnPhase) => { if (!stillHere()) return; phase.textContent = PHASE_TEXT[p]; phase.hidden = !PHASE_TEXT[p]; };
      for await (const chunk of labRespond(engine, chatPort, persona.id, persona.systemPrompt ?? '', text, onPhase)) { if (stillHere()) { reply.textContent += chunk; thread.scrollTop = thread.scrollHeight; } }
      if (stillHere()) await paint(storage);             // resync ids/ts; skip if user switched persona mid-stream
    } catch {
      // stream dropped (e.g. local model unloaded): undo the orphaned user turn so a resend won't duplicate it in memory
      const snap = await storage.load();
      const last = snap.messages[snap.messages.length - 1];
      if (last && last.role === 'user') await engine.rewindTo(last.id);
      if (stillHere()) { input.value = text; await paint(storage); }
    } finally { busy = false; send.disabled = false; phase.hidden = true; }
  }

  composer.addEventListener('submit', e => { e.preventDefault(); const t = input.value; input.value = ''; input.style.height = 'auto'; void submit(t); });
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); composer.requestSubmit(); } });
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 140) + 'px'; });

  // Ambient: an ambient persona observes the world and may greet first. Non-blocking; skipped while a user turn is in flight.
  async function tickAmbient(): Promise<void> {
    const persona = getActivePersona();
    if (busy || !persona.ambient || needsKey()) return;
    const startId = persona.id;
    const { engine, chatPort, storage } = await getEngine(persona.id, persona.systemPrompt);
    const obs = await observe(engine, chatPort, persona.id, persona).catch(() => null);
    const greeted = await maybeGreet(engine, chatPort, persona, obs).catch(() => false);
    if (greeted && getActivePersona().id === startId && !busy) await paint(storage);
  }

  subscribeActivePersona(() => { void render(); void tickAmbient(); });
  void render();
  void tickAmbient();
  setInterval(() => void tickAmbient(), AMBIENT.ambientRefreshMs);
}
