/**
 * Weather warnings from the Open-Meteo forecast (free, no key, CORS-open) for
 * the air-quality cities. Thresholds are this dashboard's heuristics, not
 * official PMD warnings, and the panel says so.
 */
import { AQ_CITIES } from './pakistan-desk';

export interface DayForecast {
  date: string;
  maxTempC: number | null;
  feelsLikeMaxC: number | null;
  rainMm: number | null;
  gustKmh: number | null;
  minVisibilityM: number | null;
}

export interface CityForecast {
  name: string;
  days: DayForecast[];
}

export type WarningKind = 'heat' | 'rain' | 'wind' | 'fog';

export interface WeatherWarning {
  kind: WarningKind;
  severe: boolean;
  text: string;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function weatherWarnings(day: DayForecast): WeatherWarning[] {
  const out: WeatherWarning[] = [];
  const heat = day.feelsLikeMaxC ?? day.maxTempC;
  if (heat !== null && heat >= 40) out.push({ kind: 'heat', severe: heat >= 45, text: `Feels like ${Math.round(heat)}°C` });
  if (day.rainMm !== null && day.rainMm >= 25) out.push({ kind: 'rain', severe: day.rainMm >= 50, text: `${Math.round(day.rainMm)} mm rain` });
  if (day.gustKmh !== null && day.gustKmh >= 50) out.push({ kind: 'wind', severe: day.gustKmh >= 75, text: `Gusts ${Math.round(day.gustKmh)} km/h` });
  if (day.minVisibilityM !== null && day.minVisibilityM < 1000) {
    out.push({ kind: 'fog', severe: day.minVisibilityM < 200, text: `Visibility ${Math.round(day.minVisibilityM)} m` });
  }
  return out;
}

export function parseForecast(body: unknown): CityForecast[] {
  const rows = (Array.isArray(body) ? body : [body]) as Array<{
    daily?: { time?: unknown[]; temperature_2m_max?: unknown[]; apparent_temperature_max?: unknown[]; precipitation_sum?: unknown[]; wind_gusts_10m_max?: unknown[] };
    hourly?: { time?: unknown[]; visibility?: unknown[] };
  }>;
  return AQ_CITIES.map((city, i) => {
    const daily = rows[i]?.daily;
    const hourly = rows[i]?.hourly;
    const dates = (daily?.time ?? []).filter((d): d is string => typeof d === 'string');
    const days = dates.map((date, d) => {
      const visibilities = (hourly?.time ?? [])
        .flatMap((t, h) => (typeof t === 'string' && t.startsWith(date) ? [num(hourly?.visibility?.[h])] : []))
        .filter((v): v is number => v !== null);
      return {
        date,
        maxTempC: num(daily?.temperature_2m_max?.[d]),
        feelsLikeMaxC: num(daily?.apparent_temperature_max?.[d]),
        rainMm: num(daily?.precipitation_sum?.[d]),
        gustKmh: num(daily?.wind_gusts_10m_max?.[d]),
        minVisibilityM: visibilities.length ? Math.min(...visibilities) : null,
      };
    });
    return { name: city.name, days };
  });
}

export async function fetchPakistanForecast(signal?: AbortSignal): Promise<CityForecast[]> {
  const params = new URLSearchParams({
    latitude: AQ_CITIES.map((c) => c.lat).join(','),
    longitude: AQ_CITIES.map((c) => c.lon).join(','),
    daily: 'temperature_2m_max,apparent_temperature_max,precipitation_sum,wind_gusts_10m_max',
    hourly: 'visibility',
    forecast_days: '2',
    timezone: 'Asia/Karachi',
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal, credentials: 'omit' });
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  return parseForecast(await res.json());
}
