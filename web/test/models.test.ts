import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchModels } from '../src/lib/models';

afterEach(() => vi.unstubAllGlobals());

describe('fetchModels', () => {
  it('maps /v1/models data[].id', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: [{ id: 'gemma4:e2b' }, { id: 'embeddinggemma:latest' }] }) })));
    expect(await fetchModels('http://localhost:11434/v1')).toEqual(['gemma4:e2b', 'embeddinggemma:latest']);
  });

  it('throws on non-200', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })));
    await expect(fetchModels('http://x/v1')).rejects.toThrow('models 500');
  });
});
