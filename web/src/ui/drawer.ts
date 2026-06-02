import { drawerWithGestures } from '@nature-labs/uicp-adapter-vanilla';
import { listPersonas, getActivePersona, setActivePersona, addPersona } from '../lib/personas';
import {
  PROFILES, getActiveProfile, setActiveProfile, getKey, setKey,
  getChatModel, setChatModel, getEmbedModel, setEmbedModel, getChatCfg, getEmbedCfg,
} from '../lib/config';
import { fetchModels } from '../lib/models';
import { resetEngines } from '../lib/engine';
import { el } from './dom';

function option(value: string, label: string, selected: boolean): HTMLOptionElement {
  return el('option', { value, textContent: label, selected });
}

export function mountDrawer(host: HTMLElement): { open: () => void } {
  const sheet = drawerWithGestures('#drawer', { position: 'left' });
  document.querySelector('[data-backdrop-for="drawer"]')!.addEventListener('click', () => sheet.close());
  let adding = false; // new-friend form open?

  function fillModels(sel: HTMLSelectElement, ids: string[], current: string): void {
    sel.replaceChildren();
    if (!ids.includes(current)) sel.append(option(current, current + ' (current)', true));
    for (const id of ids) sel.append(option(id, id, id === current));
  }

  async function render(): Promise<void> {
    const active = getActivePersona();
    const profile = getActiveProfile();
    host.replaceChildren();

    // --- personas ---
    const friends = el('div', { className: 'drawer-section' }, [el('h3', { textContent: 'เพื่อน' })]);
    for (const p of listPersonas()) {
      const b = el('button', { className: 'drawer-row' + (p.id === active.id ? ' active' : ''), textContent: p.name });
      b.addEventListener('click', () => { setActivePersona(p.id); sheet.close(); void render(); });
      friends.append(b);
    }
    if (!adding) {
      const add = el('button', { className: 'drawer-row', textContent: '+ เพื่อนใหม่' });
      add.addEventListener('click', () => { adding = true; void render(); });
      friends.append(add);
    } else {
      const nameIn = el('input', { type: 'text', placeholder: 'ชื่อ (เช่น นักพฤกษาศาสตร์)' });
      const promptIn = el('textarea', { placeholder: 'system prompt ที่ค้ำตัวตน (เว้นว่าง = ปล่อย emerge เอง)', rows: 4 });
      const create = el('button', { className: 'drawer-row', textContent: 'สร้าง' });
      create.addEventListener('click', () => {
        const name = nameIn.value.trim(); if (!name) return;
        const np = addPersona(name, promptIn.value); adding = false; setActivePersona(np.id); sheet.close(); void render();
      });
      const cancel = el('button', { className: 'drawer-row', textContent: 'ยกเลิก' });
      cancel.addEventListener('click', () => { adding = false; void render(); });
      friends.append(nameIn, promptIn, create, cancel);
    }
    host.append(friends);

    // --- model profile + discovered models ---
    const profileSel = el('select');
    for (const p of PROFILES) profileSel.append(option(p.id, p.label, p.id === profile.id));
    profileSel.addEventListener('change', () => { setActiveProfile(profileSel.value); resetEngines(); void render(); });

    const keyInput = el('input', { type: 'password', placeholder: 'API key', value: profile.needsKey ? getKey(profile.id) : '' });
    keyInput.hidden = !profile.needsKey;
    keyInput.addEventListener('change', () => { setKey(keyInput.value, profile.id); resetEngines(); });

    const chatSel = el('select');
    const embedSel = el('select');
    fillModels(chatSel, [], getChatModel(profile.id));   // start with the current model; fetch fills the rest
    fillModels(embedSel, [], getEmbedModel(profile.id));
    chatSel.addEventListener('change', () => { setChatModel(chatSel.value, profile.id); resetEngines(); });
    embedSel.addEventListener('change', () => { setEmbedModel(embedSel.value, profile.id); resetEngines(); });

    host.append(el('div', { className: 'drawer-section' }, [
      el('h3', { textContent: 'โมเดล' }),
      profileSel, keyInput,
      el('label', { className: 'drawer-label', textContent: 'chat' }), chatSel,
      el('label', { className: 'drawer-label', textContent: 'embed' }), embedSel,
    ]));

    // discover available model names from each provider (never hardcoded)
    const chatCfg = getChatCfg(), embedCfg = getEmbedCfg();
    const [chatIds, embedIds] = await Promise.all([
      fetchModels(chatCfg.baseURL, chatCfg.apiKey).catch(() => [] as string[]),
      fetchModels(embedCfg.baseURL, embedCfg.apiKey).catch(() => [] as string[]),
    ]);
    if (chatIds.length) fillModels(chatSel, chatIds, getChatModel(profile.id));
    if (embedIds.length) fillModels(embedSel, embedIds, getEmbedModel(profile.id));
  }

  void render();
  return { open: () => sheet.open() };
}
