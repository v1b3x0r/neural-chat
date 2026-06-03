import type { Message, ChatPort, MemoryEngine, InjectionContext } from '@nature-labs/living-memory-engine';
import { formatInjection } from '@nature-labs/living-memory-engine';
import { getLabToggles, type LabToggles } from './config';
import { getRaw, setRaw } from './storage';
import { devlog } from './devlog';

export interface LastFed { system: string; inject: string; tailCount: number; at: number }
const lastFedKey = (ns: string) => `lastfed:${ns}`;
export const getLastFed = (ns: string): Promise<LastFed | undefined> => getRaw<LastFed>(lastFedKey(ns));

const timeNoteTop = (now: number) => `[Current time: ${new Date(now).toString()}]`;
const timeDirective = (now: number) => `[It is now ${new Date(now).toString()}. Answer with this exact current time/date in mind — do not guess or assume otherwise.]`;

// PURE: assemble the injection string + tail from a retrieved ctx according to the lab toggles. Testable in isolation.
export function assembleInject(ctx: InjectionContext, t: LabToggles, now: number): { inject: string; tail: Message[] } {
  const filtered: InjectionContext = {
    selfTier: t.self ? ctx.selfTier : [],
    episodic: t.episodic ? ctx.episodic : [],
    prospective: t.prospective ? ctx.prospective : [],
    tail: ctx.tail,
  };
  const body = formatInjection(filtered); // never includes tail or time
  const parts: string[] = [];
  if (t.time && t.timePos === 'top') parts.push(timeNoteTop(now));
  if (body) parts.push(body);
  if (t.time && t.timePos === 'end') parts.push(timeDirective(now));
  return { inject: parts.join('\n\n'), tail: t.tail ? ctx.tail : [] };
}

// Mirrors engine.respond() at the orchestration level (ingestUser → retrieve → inject → stream → ingestModel → tick)
// but assembles the injection from the lab toggles, so the founder can tune exactly what the LLM receives.
// Engine internals are untouched; with all toggles default this is behaviourally identical to engine.respond().
export async function* labRespond(engine: MemoryEngine, chatPort: ChatPort, ns: string, systemPrompt: string, text: string): AsyncIterable<string> {
  await engine.ingestUser(text);
  const ctx = await engine.retrieve(text);
  const { inject, tail } = assembleInject(ctx, getLabToggles(), Date.now());
  await setRaw(lastFedKey(ns), { system: systemPrompt, inject, tailCount: tail.length, at: Date.now() } satisfies LastFed);
  devlog('last-fed', { ns, user: text, system: systemPrompt, inject, tail: tail.map(m => ({ role: m.role, text: m.text })) });
  let full = '';
  for await (const chunk of chatPort.stream(tail, systemPrompt, inject)) { full += chunk; yield chunk; }
  await engine.ingestModel(full);
  await engine.tick();
}
