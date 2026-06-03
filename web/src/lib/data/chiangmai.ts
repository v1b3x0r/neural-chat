// Reference data ONLY. Two separate exports so the legend text can never leak into branching logic:
//  - DISTRICTS: coords for world.ts to fetch.
//  - FIELD_LEGEND: a verbatim text block handed to the oracle as context (NEVER imported for if/else).
// METRIC_KEYS lists the numeric senses we compute statistical drift on.

export interface District { name: string; lat: number; lon: number }

export const DISTRICTS: District[] = [
  { name: 'เมือง', lat: 18.7883, lon: 98.9853 },
  { name: 'แม่ริม', lat: 18.9166, lon: 98.8957 },
  { name: 'หางดง', lat: 18.6880, lon: 98.9214 },
  { name: 'สันทราย', lat: 18.8590, lon: 99.0470 },
  { name: 'ดอยสะเก็ด', lat: 18.8670, lon: 99.1340 },
  { name: 'สะเมิง', lat: 18.8360, lon: 98.7290 },
  { name: 'จอมทอง', lat: 18.4190, lon: 98.6710 },
  { name: 'ฝาง', lat: 19.9210, lon: 99.2120 },
];

// Numeric metrics drift is computed over (relative z-score, never absolute thresholds).
export const METRIC_KEYS = ['pm2_5', 'temperature_2m', 'precipitation', 'wind_speed_10m', 'cloud_cover', 'relative_humidity_2m'] as const;
export type MetricKey = typeof METRIC_KEYS[number];

// Handed to the oracle as a plain context string so it can phrase meaning itself.
// (Open-Meteo field semantics + WMO weather codes. Text only — not a code→phrase table in logic.)
export const FIELD_LEGEND = `Field meanings (Open-Meteo, Chiang Mai districts):
- pm2_5, pm10: fine particulate matter, µg/m³ (higher = worse air; Chiang Mai's burning season Feb–Apr spikes this).
- us_aqi: US Air Quality Index.
- temperature_2m: air temperature, °C. relative_humidity_2m: %, wind_speed_10m: km/h. cloud_cover: %.
- precipitation: mm in the last interval (>0 = raining). is_day: 1 day, 0 night.
- weather_code (WMO): 0 clear; 1-3 mainly clear→overcast; 45/48 fog; 51-57 drizzle; 61-67 rain; 80-82 rain showers; 95-99 thunderstorm.`;
