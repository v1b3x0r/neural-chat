import { describe, it, expect } from 'vitest';
import { computeSalience, scaleFromSalience, cityMood } from '../src/lib/ambient';
import type { WorldSnapshot } from '../src/lib/world';

// minimal one-district snapshot helper (only the fields salience reads need to be present)
function snap(pm: number, isDay = 1): WorldSnapshot {
  return { ts: 0, perDistrict: [{ name: 'A', pm2_5: pm, pm10: 0, us_aqi: 0, temperature_2m: 25, relative_humidity_2m: 50, weather_code: 0, precipitation: 0, cloud_cover: 0, wind_speed_10m: 0, is_day: isDay }] };
}

describe('computeSalience', () => {
  it('is Infinity (cold start) when baseline has < 2 points', () => {
    expect(computeSalience(snap(10), [], 2).score).toBe(Infinity);
    expect(computeSalience(snap(10), [snap(10)], 2).score).toBe(Infinity);
  });

  it('is low when current matches a stable baseline', () => {
    const base = [snap(10), snap(11), snap(9), snap(10)];
    expect(computeSalience(snap(10), base, 2).score).toBeLessThan(2);
  });

  it('spikes (and flags the metric) when current departs from a stable baseline', () => {
    const base = [snap(10), snap(11), snap(9), snap(10)];
    const { score, notable } = computeSalience(snap(150), base, 2);
    expect(score).toBeGreaterThanOrEqual(2);
    expect(notable).toContain('pm2_5');
  });
});

describe('scaleFromSalience', () => {
  it('maps z into the engine 1..10 importance range, monotonically', () => {
    expect(scaleFromSalience(0, 2)).toBe(1);          // clamped up from 0
    expect(scaleFromSalience(2, 2)).toBe(5);          // z=k → 0.5 → 5
    expect(scaleFromSalience(Infinity, 2)).toBe(10);  // cold start → max
    expect(scaleFromSalience(8, 2)).toBeGreaterThan(scaleFromSalience(2, 2));
  });
});

describe('cityMood', () => {
  it('arousal rises with salience and is bounded [0,1]', () => {
    expect(cityMood(0, 2)).toEqual({ valence: 0, arousal: 0 });
    expect(cityMood(Infinity, 2).arousal).toBe(1);
    expect(cityMood(8, 2).arousal).toBeLessThanOrEqual(1);
    expect(cityMood(4, 2).arousal).toBeGreaterThan(cityMood(1, 2).arousal);
  });
});
