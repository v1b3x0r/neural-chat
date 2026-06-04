import { describe, it, expect, vi } from 'vitest';
import { embedOnce } from '../provider/openaiCompat.js';
import { safeUrl } from '../provider/adapters.js';
import { parseExtract } from '../provider/adapters.js';

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

describe('parseExtract (back-compat defaults + passthrough of 1A fields)', () => {
  it('passes source_name/subject/said_by straight through', () => {
    const r = parseExtract(JSON.stringify({
      episodic: [{ content: 'วี ชอบตลาด', importance: 7, tags: ['m'], source_name: 'วี', subject: { person_name: 'วี' }, said_by: 'user' }],
      prospective: [], resolved: [],
    }));
    expect(r.episodic[0]!.source_name).toBe('วี');
    expect(r.episodic[0]!.subject).toEqual({ person_name: 'วี' });
    expect(r.episodic[0]!.said_by).toBe('user');
  });

  it('defaults a legacy response (no 1A fields) to empty arrays / undefined fields — back-compat', () => {
    const r = parseExtract(JSON.stringify({ episodic: [{ content: 'c', importance: 5, tags: [] }] }));
    expect(r.episodic[0]!.content).toBe('c');
    expect(r.episodic[0]!.source_name).toBeUndefined();
    expect(r.prospective).toEqual([]);
    expect(r.resolved).toEqual([]);
  });

  it('returns empty result on malformed JSON', () => {
    expect(parseExtract('not json')).toEqual({ episodic: [], prospective: [], resolved: [] });
  });
});
