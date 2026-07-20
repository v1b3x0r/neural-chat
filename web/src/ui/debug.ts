import { formatInjection } from '@nature-labs/living-memory-engine';
import { drawerWithGestures } from '@nature-labs/uicp-adapter-vanilla';
import { getEngine, resetEngines } from '../lib/engine';
import { getActivePersona, setActivePersona } from '../lib/personas';
import { getLabToggles, setLabToggles, type LabToggles } from '../lib/config';
import { getLastFed, getLastWhy } from '../lib/labrespond';
import { buildWhy, byConcept, type WhyItem } from '../lib/why';
import { wipeWorld } from '../lib/ambient';
import { el } from './dom';

const trunc = (s: string, n = 90) => (s.length > n ? s.slice(0, n) + '…' : s);
function bar(v: number): HTMLElement { const d = el('div', { className: 'mem-bar' }); d.style.width = `${Math.min(100, Math.max(0, v * 100))}%`; return d; }

function card(...kids: (Node | string)[]): HTMLElement { return el('div', { className: 'mem-card' }, kids); }
function section(title: string, n: number, kids: Node[]): HTMLElement {
  return el('div', { className: 'drawer-section' }, [el('h3', { textContent: `${title} (${n})` }), ...kids]);
}

// L2: render a used/ignored memory list grouped under human concept headers.
function whyList(items: WhyItem[], used: boolean): HTMLElement[] {
  return byConcept(items).map(g => el('div', { className: 'why-group' }, [
    el('div', { className: 'why-concept', textContent: g.concept }),
    ...g.items.map(i => el('div', { className: `why-item ${used ? 'used' : 'ignored'}` }, [
      el('span', { className: 'why-mark', textContent: used ? '✓' : '○' }),
      el('span', { textContent: trunc(i.text, 84) }),
    ])),
  ]));
}

export function mountMemoryPane(host: HTMLElement): { open: () => void } {
  const sheet = drawerWithGestures('#mem-drawer', { position: 'right' });
  document.querySelector('[data-backdrop-for="mem-drawer"]')!.addEventListener('click', () => sheet.close());

  async function render(): Promise<void> {
    const persona = getActivePersona();
    const { engine, storage } = await getEngine(persona.id, persona.systemPrompt);
    const snap = await storage.load();
    host.replaceChildren();

    // --- header + counts ---
    const refresh = el('button', { className: 'drawer-row', textContent: '↻ Refresh' });
    refresh.addEventListener('click', () => void render());
    const wipe = el('button', { className: 'drawer-row mem-wipe', textContent: '🧹 Wipe memory' });
    wipe.addEventListener('click', async () => {
      if (!confirm(`Wipe all of ${persona.name}'s memory and start from zero?`)) return;
      await storage.save({ messages: [], episodic: [], selfFacets: [], prospective: [], lastTick: 0 });
      await wipeWorld(persona.id);
      resetEngines();
      setActivePersona(persona.id); // re-fire listeners → chat re-renders empty + ambient re-arms
      void render();
    });
    host.append(el('div', { className: 'drawer-section' }, [
      el('h3', { textContent: `🧠 ${persona.name}` }),
      el('div', { className: 'mem-stat', textContent: `${snap.messages.length} messages · ${snap.episodic.length} memories · ${snap.selfFacets.length} preferences · ${snap.prospective.filter(p => p.status === 'pending').length} plans` }),
      refresh, wipe,
    ]));

    // --- L2: WHY THIS ANSWER (the product story — selection, not storage) ---
    const why = await getLastWhy(persona.id);
    const whyKids: Node[] = [];
    if (!why) {
      whyKids.push(el('div', { className: 'why-empty', textContent: 'Chat first — then this shows which memories shaped the reply, and which were left out.' }));
    } else {
      const v = buildWhy(why.query, why.used, snap);
      whyKids.push(el('div', { className: 'why-query', textContent: `“${trunc(v.query, 90)}”` }));
      whyKids.push(el('div', { className: 'why-lead', textContent: `Selected ${v.usedCount} of ${v.totalCount} memories for this answer. Only the relevant ones reach the model.` }));
      whyKids.push(el('div', { className: 'why-head used', textContent: `Used (${v.usedCount})` }));
      whyKids.push(...(v.used.length ? whyList(v.used, true) : [el('div', { className: 'why-none', textContent: 'nothing retrieved this turn' })]));
      whyKids.push(el('div', { className: 'why-head ignored', textContent: `Available, not used (${v.ignored.length})` }));
      whyKids.push(...(v.ignored.length ? whyList(v.ignored, false) : [el('div', { className: 'why-none', textContent: '—' })]));
    }
    host.append(el('div', { className: 'drawer-section why-section' }, [
      el('h3', { textContent: '✨ Why this answer' }),
      ...whyKids,
    ]));

    // --- L3: ADVANCED / INSPECTOR (raw tiers + tuning, collapsed by default) ---
    const advanced = el('details', { className: 'advanced' });
    advanced.append(el('summary', { textContent: 'Advanced · inspector' }));

    // Lab — control what we feed the LLM next turn, and see what was fed last turn.
    const t = getLabToggles();
    const toggle = (key: 'time' | 'self' | 'episodic' | 'prospective' | 'tail' | 'selfState', label: string): HTMLElement => {
      const cb = el('input', { type: 'checkbox', checked: t[key] });
      cb.addEventListener('change', () => setLabToggles({ ...getLabToggles(), [key]: cb.checked }));
      return el('label', { className: 'mem-toggle' }, [cb, ` ${label}`]);
    };
    const posSel = el('select');
    posSel.append(
      el('option', { value: 'top', textContent: 'time: top (passive)', selected: t.timePos === 'top' }),
      el('option', { value: 'end', textContent: 'time: end directive', selected: t.timePos === 'end' }),
    );
    posSel.addEventListener('change', () => setLabToggles({ ...getLabToggles(), timePos: posSel.value as LabToggles['timePos'] }));

    const fed = await getLastFed(persona.id);
    const fedBox = el('pre', { className: 'mem-tap' });
    fedBox.textContent = fed
      ? `system:\n${fed.system || '(empty)'}\n\ninject:\n${fed.inject || '(empty)'}\n\n(+ ${fed.tailCount} tail messages)`
      : '(no turn yet — chat first)';

    advanced.append(el('div', { className: 'drawer-section' }, [
      el('h3', { textContent: '🔬 Lab — feed to the model (affects next turn)' }),
      toggle('selfState', '🪞 self-state (knows itself)'),
      toggle('time', '⏱ time'), posSel,
      toggle('self', '🧬 self'), toggle('episodic', '📎 episodic'), toggle('prospective', '🎯 prospective'), toggle('tail', '💬 tail (recent messages)'),
      el('div', { className: 'drawer-label', textContent: '📤 last fed (this turn)' }), fedBox,
    ]));

    // self-facets (the "who am I" tier)
    advanced.append(section('Self', snap.selfFacets.length, snap.selfFacets
      .slice().sort((a, b) => b.strength - a.strength)
      .map(f => card(
        el('div', { textContent: `[${f.kind}] ${f.statement}` }),
        bar(f.strength),
      ))));

    // episodic, strongest first
    advanced.append(section('Episodic', snap.episodic.length, snap.episodic
      .slice().sort((a, b) => b.strength - a.strength)
      .map(m => card(
        el('div', { textContent: trunc(m.content) }),
        el('div', { className: 'mem-stat', textContent: `imp ${m.importance} · str ${m.strength.toFixed(2)} · ${m.tags.join(', ') || 'no-tags'} · ${m.lastRecalledAt >= 0 ? 'recalled' : 'never'} · emb ${m.embedding ? '✓' : '✗'}` }),
        bar(m.strength),
      ))));

    // prospective — pending shown live (strength + dormant/triggered); archive collapsed to a count.
    const strengthOf = (p: { strength: number; priority: number }) => (typeof p.strength === 'number' ? p.strength : p.priority / 5);
    const pend = snap.prospective.filter(p => p.status === 'pending').sort((a, b) => strengthOf(b) - strengthOf(a));
    const resolved = snap.prospective.filter(p => p.status === 'resolved').length;
    const abandoned = snap.prospective.filter(p => p.status === 'abandoned').length;
    advanced.append(section('Prospective · pending', pend.length, [
      ...pend.map(p => card(
        el('div', { textContent: p.intent }),
        el('div', { className: 'mem-stat', textContent: `str ${strengthOf(p).toFixed(2)} · prio ${p.priority} · ${(typeof p.lastTriggeredAt === 'number' && p.lastTriggeredAt >= 0) ? 'triggered' : 'dormant'} · clue: ${p.contextClue || '—'}` }),
        bar(strengthOf(p)),
      )),
      el('div', { className: 'mem-stat', textContent: `archive — ${resolved} done · ${abandoned} faded` }),
    ]));

    // injection tap — show the EXACT string the LLM receives for a query
    const tapInput = el('input', { type: 'text', placeholder: 'Type a query to see the real injection…' });
    const tapOut = el('pre', { className: 'mem-tap', textContent: '(formatInjection output appears here)' });
    const tapBtn = el('button', { className: 'drawer-row', textContent: '🔬 Retrieve + view injection' });
    tapBtn.addEventListener('click', async () => {
      const q = tapInput.value.trim();
      if (!q) return;
      tapOut.textContent = '…';
      const ctx = await engine.retrieve(q);                 // NOTE: mild side-effect (bumps lastRecalledAt) — faithful to real retrieval
      tapOut.textContent = formatInjection(ctx) || '(empty — no memory passed the threshold)';
    });
    advanced.append(el('div', { className: 'drawer-section' }, [
      el('h3', { textContent: '🔬 Injection Tap' }),
      el('div', { className: 'mem-stat', textContent: 'Calls the real engine.retrieve(query) → formatInjection (mild side-effect: updates lastRecalledAt)' }),
      tapInput, tapBtn, tapOut,
    ]));

    host.append(advanced);
  }

  return { open: () => { void render(); sheet.open(); } };
}
