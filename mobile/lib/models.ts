export interface ModelInfo { id: string; name: string; }

let cache: ModelInfo[] | null = null;

// Fetch the real OpenRouter catalogue (no auth needed) so the picker only ever
// offers models that actually exist — avoids the 404 from guessing IDs.
export async function fetchModels(force = false): Promise<ModelInfo[]> {
  if (cache && !force) return cache;
  const res = await fetch('https://openrouter.ai/api/v1/models');
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const json = await res.json();
  cache = ((json?.data ?? []) as { id: string; name?: string }[])
    .map((m) => ({ id: m.id, name: m.name ?? m.id }));
  return cache;
}

export function shortModel(id: string): string {
  return (id.split('/').pop() ?? id).replace(':free', '');
}
