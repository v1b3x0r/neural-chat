// Pure request rules for the /api/qwen proxy (dev middleware now, deploy function later).
// The proxy — not the browser — holds the API key; these rules keep the $40 credit safe:
// path allowlist, model allowlist, max_tokens cap, and server-side dimensions/thinking params
// so neither engine provider ports nor web adapters change (zero engine edits).
export const QWEN_UPSTREAM_DEFAULT = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';

const ALLOWED: Record<string, string> = {
  '/models': 'GET',
  '/chat/completions': 'POST',
  '/embeddings': 'POST',
};

export function allowPath(method: string, path: string): boolean {
  return ALLOWED[path] === method;
}

export function shapeBody(path: string, body: unknown): Record<string, unknown> | null {
  const b = (body ?? {}) as Record<string, unknown>;
  const model = String(b.model ?? '');
  if (path === '/chat/completions') {
    if (!/^qwen/i.test(model)) return null;
    return { ...b, max_tokens: Math.min(Number(b.max_tokens) || 2048, 2048), enable_thinking: false };
  }
  if (path === '/embeddings') {
    if (model !== 'text-embedding-v4') return null;
    return { ...b, dimensions: 768 };
  }
  return b;
}
