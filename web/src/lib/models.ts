// Fetch the model ids the active provider actually has (OpenAI-compatible /v1/models).
// Ollama, LM Studio, and OpenAI all serve this — so we discover names instead of hardcoding them.
export async function fetchModels(baseURL: string, apiKey = ''): Promise<string[]> {
  const res = await fetch(`${baseURL}/models`, apiKey ? { headers: { Authorization: `Bearer ${apiKey}` } } : undefined);
  if (!res.ok) throw new Error(`models ${res.status}`);
  const j = await res.json();
  return (j.data ?? []).map((m: { id: string }) => m.id).filter(Boolean);
}
