export interface EndpointConfig { baseURL: string; apiKey: string; model: string; }

function authHeaders(cfg: EndpointConfig): Record<string, string> {
  return { 'Content-Type': 'application/json', ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}) };
}

export async function embedOnce(
  cfg: EndpointConfig, text: string, fetchImpl: typeof fetch = fetch,
): Promise<number[] | null> {
  try {
    const res = await fetchImpl(`${cfg.baseURL}/embeddings`, {
      method: 'POST', headers: authHeaders(cfg),
      body: JSON.stringify({ model: cfg.model, input: text }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.[0]?.embedding ?? null;
  } catch { return null; }
}

export async function* chatStream(
  cfg: EndpointConfig, body: unknown, fetchImpl: typeof fetch = fetch,
): AsyncIterable<string> {
  const res = await fetchImpl(`${cfg.baseURL}/chat/completions`, {
    method: 'POST', headers: authHeaders(cfg),
    body: JSON.stringify({ ...(body as object), model: cfg.model, stream: true }),
  });
  if (!res.ok || !res.body) throw new Error(`chat failed: ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      const payload = t.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
        if (delta) yield delta as string;
      } catch { /* skip keep-alive / partial */ }
    }
  }
}
