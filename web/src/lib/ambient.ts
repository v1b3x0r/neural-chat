import type { Message, ChatPort, MemoryEngine } from '@nature-labs/living-memory-engine';
import { fetchWorld, type WorldSnapshot } from './world';
import { DISTRICTS, FIELD_LEGEND, METRIC_KEYS } from './data/chiangmai';
import { AMBIENT } from './config';
import { getRaw, setRaw } from './storage';
import { devlog } from './devlog';
import type { Persona } from './personas';

export type Mood = { valence: number; arousal: number };
export interface Observation { observation: string; salience: number }

const EPS = 1e-6;

// Max relative z-score of `current` vs same-phase `baseline`, over every metric × district.
// No absolute thresholds — the city learns its own normal. Empty/tiny baseline ⇒ everything is novel.
export function computeSalience(current: WorldSnapshot, baseline: WorldSnapshot[], k: number): { score: number; notable: string[] } {
  if (baseline.length < 2) return { score: Infinity, notable: [...METRIC_KEYS] };
  let score = 0;
  const notable = new Set<string>();
  for (const metric of METRIC_KEYS) {
    for (let i = 0; i < current.perDistrict.length; i++) {
      const x = current.perDistrict[i]?.[metric];
      if (typeof x !== 'number') continue;
      const series = baseline.map(b => b.perDistrict[i]?.[metric]).filter((v): v is number => typeof v === 'number');
      if (series.length < 2) continue;
      const mean = series.reduce((a, b) => a + b, 0) / series.length;
      const variance = series.reduce((a, b) => a + (b - mean) ** 2, 0) / series.length;
      const z = Math.abs(x - mean) / (Math.sqrt(variance) + EPS);
      if (z > score) score = z;
      if (z >= k) notable.add(metric);
    }
  }
  return { score, notable: [...notable] };
}

// z → engine importance (1..10). Monotonic squash anchored on the SAME k knob; no extra literal.
export function scaleFromSalience(z: number, k: number): number {
  const t = z === Infinity ? 1 : z / (z + k);
  return Math.min(10, Math.max(1, Math.round(10 * t)));
}

// MDS seam: layer-4 swaps this body for real PAD/needs state. MVP derives arousal from relative salience only;
// the LLM names the actual feeling — cityMood only nudges the prompt.
export function cityMood(score: number, k: number): Mood {
  const arousal = score === Infinity ? 1 : Math.min(1, score / (k * 2));
  return { valence: 0, arousal };
}
function moodHint(m: Mood): string {
  return m.arousal >= 0.5 ? '\n\n(ตอนนี้รู้สึกว่ามีบางอย่างผิดไปจากปกติของเมือง)' : '';
}

const worldKey = (ns: string) => `worldlog:${ns}`;
const loadWorldlog = async (ns: string): Promise<WorldSnapshot[]> => (await getRaw<WorldSnapshot[]>(worldKey(ns))) ?? [];
const userMsg = (text: string): Message => ({ id: 'amb', role: 'user', text, ts: Date.now() });

async function collect(stream: AsyncIterable<string>): Promise<string> {
  let out = '';
  for await (const c of stream) out += c;
  return out;
}

let greetedThisOpen = false; // module-scope; resets on page load → at most one proactive greet per app-open

// Brain-wipe support: clear a persona's raw worldlog and re-arm the proactive greet (caller also wipes the Snapshot).
export async function wipeWorld(ns: string): Promise<void> {
  await setRaw(worldKey(ns), []);
  greetedThisOpen = false;
}

// Observe the world: throttle → fetch → diurnal-aware drift → if notable, oracle-interpret → addEpisodic. Returns the obs (or null).
export async function observe(engine: MemoryEngine, chatPort: ChatPort, ns: string, persona: Persona): Promise<Observation | null> {
  const log = await loadWorldlog(ns);
  const newest = log[log.length - 1];
  if (newest && Date.now() - newest.ts < AMBIENT.ambientRefreshMs) return null; // throttle by newest worldlog ts, NOT engine lastTick

  const world = await fetchWorld(DISTRICTS);
  if (!world) return null;

  const isDay = world.perDistrict[0]?.is_day ?? 1;
  const baseline = log.filter(w => (w.perDistrict[0]?.is_day ?? 1) === isDay); // compare nights-to-nights, days-to-days
  const { score, notable } = computeSalience(world, baseline, AMBIENT.salienceK);

  await setRaw(worldKey(ns), [...log, world].slice(-AMBIENT.worldlogCap)); // append raw senses to the capped ring

  if (score < AMBIENT.salienceK) return null; // nothing notable enough to remember or say

  const ctx = `${FIELD_LEGEND}\n\nNow:\n${JSON.stringify(world.perDistrict)}`;
  const sys = (persona.systemPrompt ?? '') + moodHint(cityMood(score, AMBIENT.salienceK));
  const observation = (await collect(chatPort.stream([userMsg(persona.prompts?.observe ?? 'Note what is notable about the world right now, in 1-2 sentences.')], sys, ctx))).trim();
  if (!observation) return null;

  await engine.addEpisodic({ content: observation, importance: scaleFromSalience(score, AMBIENT.salienceK), tags: ['world', ...notable] });
  devlog('observe', { ns, salience: score, notable, observation });
  return { observation, salience: score };
}

// Proactive greeting (no engine change): generate from the fresh obs → ingestModel only.
// Deliberately bypasses retrieve/inject — a hello is ungrounded; grounding happens when the user replies via respond().
// We do NOT tick() here: tick() holds a snapshot across its extract LLM call (~15s); if the user sent a turn during
// that window the two read-modify-write cycles would collide and lose a message. The greeting is consolidated on the
// next user turn's tick instead (extract sees it in snap.messages).
export async function maybeGreet(engine: MemoryEngine, chatPort: ChatPort, persona: Persona, obs: Observation | null): Promise<boolean> {
  if (!obs || greetedThisOpen) return false;
  greetedThisOpen = true;
  const sys = (persona.systemPrompt ?? '') + moodHint(cityMood(obs.salience, AMBIENT.salienceK));
  const greeting = (await collect(chatPort.stream([userMsg(persona.prompts?.greet ?? 'Greet your friend briefly about what you just noticed.')], sys, obs.observation))).trim();
  if (!greeting) return false;
  await engine.ingestModel(greeting);
  devlog('greet', { persona: persona.id, salience: obs.salience, observation: obs.observation, greeting });
  return true;
}
