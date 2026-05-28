import { describe, it, expect, vi } from 'vitest';
import { embedOnce } from '../provider/openaiCompat.js';
import { safeUrl } from '../provider/adapters.js';

describe('safeUrl', () => {
  it('accepts http(s), rejects other schemes', () => {
    expect(safeUrl('https://x.com')).toBe(true);
    expect(safeUrl('http://localhost:1234')).toBe(true);
    expect(safeUrl('javascript:alert(1)')).toBe(false);
    expect(safeUrl('file:///etc/passwd')).toBe(false);
  });
});

describe('embedOnce', () => {
  it('posts to /v1/embeddings and returns the vector', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true, json: async () => ({ data: [{ embedding: [0.1, 0.2, 0.3] }] }),
    })) as unknown as typeof fetch;
    const v = await embedOnce(
      { baseURL: 'http://localhost:1234/v1', apiKey: '', model: 'nomic-embed-text' },
      'hello', fetchMock,
    );
    expect(v).toEqual([0.1, 0.2, 0.3]);
    expect((fetchMock as any).mock.calls[0][0]).toContain('/v1/embeddings');
  });

  it('returns null on non-ok response (triggers backfill)', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 500 })) as unknown as typeof fetch;
    const v = await embedOnce({ baseURL: 'http://x/v1', apiKey: '', model: 'm' }, 'hi', fetchMock);
    expect(v).toBeNull();
  });

  it('returns null on network throw', async () => {
    const fetchMock = vi.fn(async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    const v = await embedOnce({ baseURL: 'http://x/v1', apiKey: '', model: 'm' }, 'hi', fetchMock);
    expect(v).toBeNull();
  });
});
