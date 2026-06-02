import { formatInjection } from '@nature-labs/living-memory-engine';
import { drawerWithGestures } from '@nature-labs/uicp-adapter-vanilla';
import { getEngine } from '../lib/engine';
import { getActivePersona } from '../lib/personas';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, kids: (Node | string)[] = []): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  Object.assign(n, props);
  n.append(...kids);
  return n;
}

const trunc = (s: string, n = 90) => (s.length > n ? s.slice(0, n) + '…' : s);
function bar(v: number): HTMLElement { const d = el('div', { className: 'mem-bar' }); d.style.width = `${Math.min(100, Math.max(0, v * 100))}%`; return d; }

function card(...kids: (Node | string)[]): HTMLElement { return el('div', { className: 'mem-card' }, kids); }
function section(title: string, n: number, kids: Node[]): HTMLElement {
  return el('div', { className: 'drawer-section' }, [el('h3', { textContent: `${title} (${n})` }), ...kids]);
}

export function mountMemoryPane(host: HTMLElement): { open: () => void } {
  const sheet = drawerWithGestures('#mem-drawer', { position: 'right' });
  document.querySelector('[data-backdrop-for="mem-drawer"]')!.addEventListener('click', () => sheet.close());

  async function render(): Promise<void> {
    const persona = getActivePersona();
    const { engine, storage } = await getEngine(persona.id, persona.systemPrompt);
    const snap = await storage.load();
    host.replaceChildren();

    // header + counts
    const refresh = el('button', { className: 'drawer-row', textContent: '↻ refresh' });
    refresh.addEventListener('click', () => void render());
    host.append(el('div', { className: 'drawer-section' }, [
      el('h3', { textContent: `🧠 ${persona.name}` }),
      el('div', { className: 'mem-stat', textContent: `messages ${snap.messages.length} · episodic ${snap.episodic.length} · self ${snap.selfFacets.length} · prospective ${snap.prospective.length} · lastTick ${snap.lastTick}` }),
      refresh,
    ]));

    // self-facets (the "who am I" tier)
    host.append(section('Self', snap.selfFacets.length, snap.selfFacets
      .slice().sort((a, b) => b.strength - a.strength)
      .map(f => card(
        el('div', { textContent: `[${f.kind}] ${f.statement}` }),
        bar(f.strength),
      ))));

    // episodic, strongest first
    host.append(section('Episodic', snap.episodic.length, snap.episodic
      .slice().sort((a, b) => b.strength - a.strength)
      .map(m => card(
        el('div', { textContent: trunc(m.content) }),
        el('div', { className: 'mem-stat', textContent: `imp ${m.importance} · str ${m.strength.toFixed(2)} · ${m.tags.join(', ') || 'no-tags'} · ${m.lastRecalledAt >= 0 ? 'recalled' : 'never'} · emb ${m.embedding ? '✓' : '✗'}` }),
        bar(m.strength),
      ))));

    // prospective intents
    host.append(section('Prospective', snap.prospective.length, snap.prospective
      .map(p => card(
        el('div', { textContent: p.intent }),
        el('div', { className: 'mem-stat', textContent: `${p.status} · prio ${p.priority} · clue: ${p.contextClue || '—'}` }),
      ))));

    // injection tap — show the EXACT string the LLM receives for a query
    const tapInput = el('input', { type: 'text', placeholder: 'พิมพ์ query แล้วดู injection จริง...' });
    const tapOut = el('pre', { className: 'mem-tap', textContent: '(ผลลัพธ์ formatInjection จะขึ้นที่นี่)' });
    const tapBtn = el('button', { className: 'drawer-row', textContent: '🔬 retrieve + ดู injection' });
    tapBtn.addEventListener('click', async () => {
      const q = tapInput.value.trim();
      if (!q) return;
      tapOut.textContent = '…';
      const ctx = await engine.retrieve(q);                 // NOTE: mild side-effect (bumps lastRecalledAt) — faithful to real retrieval
      tapOut.textContent = formatInjection(ctx) || '(ว่าง — ไม่มี memory ผ่าน threshold)';
    });
    host.append(el('div', { className: 'drawer-section' }, [
      el('h3', { textContent: '🔬 Injection Tap' }),
      el('div', { className: 'mem-stat', textContent: 'เรียก engine.retrieve(query) จริง → formatInjection (มี side-effect เบาๆ: อัป lastRecalledAt)' }),
      tapInput, tapBtn, tapOut,
    ]));
  }

  return { open: () => { void render(); sheet.open(); } };
}
