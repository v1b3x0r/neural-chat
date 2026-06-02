import type { Message, StoragePort } from '@nature-labs/living-memory-engine';
import { getEngine } from '../lib/engine';
import { getActivePersona, subscribeActivePersona } from '../lib/personas';
import { getActiveProfile, getKey } from '../lib/config';

export function mountChat(root: HTMLElement, openDrawer: () => void, openMemory: () => void): void {
  root.innerHTML = `
    <header class="topbar"><button id="menu" class="icon" aria-label="menu">☰</button><span class="title"></span><button id="mem" class="icon" aria-label="memory">🧠</button></header>
    <main id="thread" class="thread"></main>
    <div id="banner" class="banner" hidden>ต้องใส่ API key ก่อน — แตะเพื่อตั้งค่า</div>
    <form id="composer" class="composer">
      <textarea id="input" rows="1" placeholder="พิมพ์หาเชียงใหม่..."></textarea>
      <button id="send" class="send" type="submit" aria-label="send">↑</button>
    </form>`;

  const q = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
  const thread = q('#thread'), title = q('.title'), banner = q<HTMLElement>('#banner');
  const input = q<HTMLTextAreaElement>('#input'), send = q<HTMLButtonElement>('#send');
  const composer = q<HTMLFormElement>('#composer');
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
    const { engine, storage } = await getEngine(persona.id, persona.systemPrompt);
    thread.querySelector('.empty')?.remove();
    bubble('user', text);
    const reply = bubble('model', '');
    try {
      for await (const chunk of engine.respond(text)) { if (stillHere()) { reply.textContent += chunk; thread.scrollTop = thread.scrollHeight; } }
      if (stillHere()) await paint(storage);             // resync ids/ts; skip if user switched persona mid-stream
    } catch {
      // stream dropped (e.g. local model unloaded): undo the orphaned user turn so a resend won't duplicate it in memory
      const snap = await storage.load();
      const last = snap.messages[snap.messages.length - 1];
      if (last && last.role === 'user') await engine.rewindTo(last.id);
      if (stillHere()) { input.value = text; await paint(storage); }
    } finally { busy = false; send.disabled = false; }
  }

  composer.addEventListener('submit', e => { e.preventDefault(); const t = input.value; input.value = ''; input.style.height = 'auto'; void submit(t); });
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); composer.requestSubmit(); } });
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 140) + 'px'; });

  subscribeActivePersona(() => void render());
  void render();
}
