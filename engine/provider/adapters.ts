import type { EmbedPort, ChatPort, ExtractResult } from '../src/ports.js';
import type { Message, SelfFacet, EpisodicMemory } from '../src/types.js';
import { embedOnce, chatStream, type EndpointConfig } from './openaiCompat.js';

export function safeUrl(u: string): boolean { return /^https?:\/\//i.test(u); }

// fetchImpl is injectable because React Native's global fetch does NOT support
// streaming response bodies — pass Expo's streaming fetch (`expo/fetch`) on device.
export function makeEmbedPort(cfg: EndpointConfig, fetchImpl: typeof fetch = fetch): EmbedPort {
  return { embed: (text) => embedOnce(cfg, text, fetchImpl) };
}

const toContent = (m: Message) => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.text });

async function collect(it: AsyncIterable<string>): Promise<string> {
  let out = '';
  for await (const c of it) out += c;
  return out;
}

// Pure parse of the extract LLM response → ExtractResult. Exported for deterministic unit tests.
// Back-compat: a legacy response (no 1A fields) yields undefined source_name/subject/said_by;
// ?? guards every top-level array exactly as before.
export function parseExtract(out: string): ExtractResult {
  try {
    const j = JSON.parse(out);
    return { episodic: j.episodic ?? [], prospective: j.prospective ?? [], resolved: j.resolved ?? [] };
  } catch {
    return { episodic: [], prospective: [], resolved: [] };
  }
}

export function makeChatPort(cfg: EndpointConfig, fetchImpl: typeof fetch = fetch): ChatPort {
  return {
    async *stream(messages, systemPrompt, inject) {
      const sys = [systemPrompt, inject].filter(Boolean).join('\n\n');
      const body = { messages: [...(sys ? [{ role: 'system', content: sys }] : []), ...messages.map(toContent)] };
      yield* chatStream(cfg, body, fetchImpl);
    },

    async describeImage(dataUrl) {
      const body = { messages: [{ role: 'user', content: [
        { type: 'text', text: 'Describe this image for semantic indexing (one line).' },
        { type: 'image_url', image_url: { url: dataUrl } },
      ] }] };
      return (await collect(chatStream(cfg, body, fetchImpl))).trim();
    },

    async extract(recent: Message[], pending: { id: string; intent: string }[] = []): Promise<ExtractResult> {
      const pendingBlock = pending.length
        ? '\n\nIntents you previously formed but have not yet acted on (id: intent). ' +
          'For any the exchange above has now addressed, fulfilled, or made irrelevant, put its id in "resolved":\n' +
          pending.map(p => `${p.id}: ${p.intent}`).join('\n')
        : '';
      const prompt =
        'Extract durable facts and anticipatory intents from this chat as JSON ' +
        '{"episodic":[{"content","importance"(1-10),"tags":[],"source_name","subject","said_by"}],' +
        '"prospective":[{"intent","priority"(1-5),"contextClue"}],"resolved":["id"]}. ' +
        'contextClue is a short phrase naming the topic/situation that should make this intent resurface later.\n' +
        'For every durable fact also return: ' +
        '"source_name" = who SAID or OBSERVED it (a person name, or null if the assistant/system itself); ' +
        '"said_by" = "user" if a human said it, "self" if the assistant said it; ' +
        '"subject" = who/what it is ABOUT: the string "world" for places/weather/the shop, ' +
        'the string "self" ONLY if the ASSISTANT is describing/asserting ITSELF (its own traits/opinions), ' +
        'or {"person_name":"..."} if about a specific person. ' +
        'A world OBSERVATION the assistant makes is still "world", not "self". ' +
        'Names are for readability; do not invent ids.\n\n' +
        recent.map(m => `${m.role}${m.speaker ? ' [speaker]' : ''}: ${m.text}`).join('\n') + pendingBlock;
      const out = await collect(chatStream(cfg, { messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' } }, fetchImpl));
      return parseExtract(out);
    },

    async summarizePattern(members: EpisodicMemory[]): Promise<{ statement: string; kind: SelfFacet['kind'] }> {
      const prompt =
        'These recurring memories suggest one trait. Reply JSON {"statement","kind":"voice"|"value"|"relationship"}.\n' +
        members.map(m => `- ${m.content}`).join('\n');
      const out = await collect(chatStream(cfg, { messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' } }, fetchImpl));
      try { const j = JSON.parse(out); return { statement: j.statement ?? (members[0]?.content ?? 'trait'), kind: j.kind ?? 'value' }; }
      catch { return { statement: members[0]?.content ?? 'trait', kind: 'value' }; }
    },
  };
}
