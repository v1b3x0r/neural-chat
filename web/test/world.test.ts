import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchWorld } from '../src/lib/world';
import type { District } from '../src/lib/data/chiangmai';

afterEach(() => vi.unstubAllGlobals());
const D: District[] = [{ name: 'A', lat: 1, lon: 1 }, { name: 'B', lat: 2, lon: 2 }];

describe('fetchWorld', () => {
  it('merges air-quality + weather per district positionally (name reattached by index)', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('air-quality'))
        return { ok: true, json: async () => [{ current: { pm2_5: 10 } }, { current: { pm2_5: 80 } }] };
      return { ok: true, json: async () => [{ current: { temperature_2m: 29, is_day: 1 } }, { current: { temperature_2m: 28, is_day: 0 } }] };
    }));
    const w = await fetchWorld(D);
    expect(w).not.toBeNull();
    expect(w!.perDistrict).toHaveLength(2);
    expect(w!.perDistrict[0]).toMatchObject({ name: 'A', pm2_5: 10, temperature_2m: 29, is_day: 1 });
    expect(w!.perDistrict[1]).toMatchObject({ name: 'B', pm2_5: 80, is_day: 0 });
  });

  it('returns null if either endpoint fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      url.includes('air-quality') ? { ok: false, status: 500 } : { ok: true, json: async () => [] }));
    expect(await fetchWorld(D)).toBeNull();
  });
});
