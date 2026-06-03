import { DISTRICTS, type District } from './data/chiangmai';

export interface DistrictSenses {
  name: string;
  pm2_5: number; pm10: number; us_aqi: number;
  temperature_2m: number; relative_humidity_2m: number; weather_code: number;
  precipitation: number; cloud_cover: number; wind_speed_10m: number; is_day: number;
}
export interface WorldSnapshot { ts: number; perDistrict: DistrictSenses[] }

const AQ = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const WX = 'https://api.open-meteo.com/v1/forecast';

const num = (v: unknown): number => (typeof v === 'number' ? v : 0);

// Open-Meteo returns an array (one element per coord) for multi-coord calls; normalize to the `current` objects.
function currents(j: unknown): Record<string, number>[] {
  const arr = Array.isArray(j) ? j : [j];
  return arr.map(o => (o && typeof o === 'object' ? (o as { current?: Record<string, number> }).current ?? {} : {}));
}

// Two requests total (one per endpoint), each batching all districts. Merge is POSITIONAL by DISTRICTS order
// (Open-Meteo echoes no name). Any HTTP/parse failure on EITHER endpoint → null for the whole tick (no partial rows).
export async function fetchWorld(districts: District[] = DISTRICTS): Promise<WorldSnapshot | null> {
  const lat = districts.map(d => d.lat).join(',');
  const lon = districts.map(d => d.lon).join(',');
  try {
    const [aqRes, wxRes] = await Promise.all([
      fetch(`${AQ}?latitude=${lat}&longitude=${lon}&current=pm2_5,pm10,us_aqi&timezone=Asia/Bangkok`),
      fetch(`${WX}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,precipitation,cloud_cover,wind_speed_10m,is_day&timezone=Asia/Bangkok`),
    ]);
    if (!aqRes.ok || !wxRes.ok) return null;
    const aq = currents(await aqRes.json());
    const wx = currents(await wxRes.json());
    if (aq.length !== districts.length || wx.length !== districts.length) return null;
    const perDistrict = districts.map((d, i) => ({
      name: d.name,
      pm2_5: num(aq[i]?.pm2_5), pm10: num(aq[i]?.pm10), us_aqi: num(aq[i]?.us_aqi),
      temperature_2m: num(wx[i]?.temperature_2m), relative_humidity_2m: num(wx[i]?.relative_humidity_2m),
      weather_code: num(wx[i]?.weather_code), precipitation: num(wx[i]?.precipitation),
      cloud_cover: num(wx[i]?.cloud_cover), wind_speed_10m: num(wx[i]?.wind_speed_10m), is_day: num(wx[i]?.is_day),
    }));
    return { ts: Date.now(), perDistrict };
  } catch {
    return null;
  }
}
