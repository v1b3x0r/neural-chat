import { formatInjection } from '@nature-labs/living-memory-engine';
import { drawerWithGestures } from '@nature-labs/uicp-adapter-vanilla';
import { getEngine, resetEngines } from '../lib/engine';
import { getActivePersona, setActivePersona } from '../lib/personas';
import { getLabToggles, setLabToggles, type LabToggles } from '../lib/config';
import { getLastFed } from '../lib/labrespond';
import { wipeWorld } from '../lib/ambient';
import { el } from './dom';

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
    const wipe = el('button', { className: 'drawer-row mem-wipe', textContent: '🧹 ล้างสมอง' });
    wipe.addEventListener('click', async () => {
      if (!confirm(`ล้างความทรงจำของ ${persona.name} ทั้งหมด? (เริ่มใหม่จากศูนย์)`)) return;
      await storage.save({ messages: [], episodic: [], selfFacets: [], prospective: [], lastTick: 0 });
      await wipeWorld(persona.id);
      resetEngines();
      setActivePersona(persona.id); // re-fire listeners → chat re-renders empty + ambient re-arms
      void render();
    });
    host.append(el('div', { className: 'drawer-section' }, [
      el('h3', { textContent: `🧠 ${persona.name}` }),
      el('div', { className: 'mem-stat', textContent: `messages ${snap.messages.length} · episodic ${snap.episodic.length} · self ${snap.selfFacets.length} · prospective ${snap.prospective.length} · lastTick ${snap.lastTick}` }),
      refresh, wipe,
    ]));

    // Lab — control what we feed the LLM next turn, and see what was fed last turn.
    const t = getLabToggles();
    const toggle = (key: 'time' | 'self' | 'episodic' | 'prospective' | 'tail', label: string): HTMLElement => {
      const cb = el('input', { type: 'checkbox', checked: t[key] });
      cb.addEventListener('change', () => setLabToggles({ ...getLabToggles(), [key]: cb.checked }));
      return el('label', { className: 'mem-toggle' }, [cb, ` ${label}`]);
    };
    const posSel = el('select');
    posSel.append(
      el('option', { value: 'top', textContent: 'time: บนสุด (passive)', selected: t.timePos === 'top' }),
      el('option', { value: 'end', textContent: 'time: directive ท้าย', selected: t.timePos === 'end' }),
    );
    posSel.addEventListener('change', () => setLabToggles({ ...getLabToggles(), timePos: posSel.value as LabToggles['timePos'] }));

    const fed = await getLastFed(persona.id);
    const fedBox = el('pre', { className: 'mem-tap' });
    fedBox.textContent = fed
      ? `system:\n${fed.system || '(ว่าง)'}\n\ninject:\n${fed.inject || '(ว่าง)'}\n\n(+ ${fed.tailCount} tail messages)`
      : '(ยังไม่มี turn — คุยก่อน)';

    host.append(el('div', { className: 'drawer-section' }, [
      el('h3', { textContent: '🔬 Lab — feed เข้า LLM (มีผล turn ถัดไป)' }),
      toggle('time', '⏱ time'), posSel,
      toggle('self', '🧬 self'), toggle('episodic', '📎 episodic'), toggle('prospective', '🎯 prospective'), toggle('tail', '💬 tail (ข้อความล่าสุด)'),
      el('div', { className: 'drawer-label', textContent: '📤 last fed (turn ล่าสุด)' }), fedBox,
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
