import type { InjectionContext } from './types.js';

// Format the retrieved memory into the system-side context string injected each turn.
// With an empty system prompt + empty self-tier (a brand-new "default" friend),
// this is mostly empty — identity emerges as memories accumulate and crystallize.
export function formatInjection(ctx: InjectionContext): string {
  const parts: string[] = [];
  if (ctx.selfTier.length) {
    parts.push('[Who you are]\n' + ctx.selfTier.map(f => `- ${f.statement}`).join('\n'));
  }
  if (ctx.episodic.length) {
    parts.push('[Relevant memories]\n' + ctx.episodic.map(m => `- ${m.content}`).join('\n'));
  }
  if (ctx.prospective.length) {
    parts.push('[You are anticipating]\n' + ctx.prospective.map(p => `- ${p.intent}`).join('\n'));
  }
  return parts.join('\n\n');
}
