/**
 * Pakistan Monitor desk data. Air quality and rupee rates come straight from
 * keyless, CORS-open public APIs; KSE-100 and the AI brief go through /api/pk-*
 * because PSX sends no CORS headers and LLM keys must stay server-side.
 */
import type { NewsItem } from '@/types';

export const AQ_CITIES = [
  { name: 'Lahore', lat: 31.5497, lon: 74.3436 },
  { name: 'Karachi', lat: 24.8607, lon: 67.0011 },
  { name: 'Islamabad', lat: 33.6844, lon: 73.0479 },
  { name: 'Faisalabad', lat: 31.4504, lon: 73.135 },
  { name: 'Multan', lat: 30.1575, lon: 71.5249 },
  { name: 'Peshawar', lat: 34.0151, lon: 71.5249 },
  { name: 'Hyderabad', lat: 25.396, lon: 68.3578 },
  { name: 'Quetta', lat: 30.1798, lon: 66.975 },
] as const;

/** US EPA AQI bands; `level` maps to the .pk-aqi-N colour classes. */
const AQI_BANDS = [
  { max: 50, level: 0, label: 'Good' },
  { max: 100, level: 1, label: 'Moderate' },
  { max: 150, level: 2, label: 'Unhealthy for sensitive groups' },
  { max: 200, level: 3, label: 'Unhealthy' },
  { max: 300, level: 4, label: 'Very unhealthy' },
  { max: Infinity, level: 5, label: 'Hazardous' },
] as const;

export type AqiBand = (typeof AQI_BANDS)[number];

export function aqiBand(aqi: number): AqiBand {
  for (const band of AQI_BANDS) if (aqi <= band.max) return band;
  return AQI_BANDS[5];
}

export interface CityAirQuality {
  name: string;
  aqi: number | null;
  pm25: number | null;
}

const finiteOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export async function fetchAirQuality(signal?: AbortSignal): Promise<{ cities: CityAirQuality[]; observedAt: string | null }> {
  const params = new URLSearchParams({
    latitude: AQ_CITIES.map((c) => c.lat).join(','),
    longitude: AQ_CITIES.map((c) => c.lon).join(','),
    current: 'pm2_5,us_aqi',
    timezone: 'Asia/Karachi',
  });
  const res = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${params}`, { signal, credentials: 'omit' });
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  const body: unknown = await res.json();
  // One location answers with an object, several with an array in request order.
  const rows = (Array.isArray(body) ? body : [body]) as Array<{ current?: { time?: string; us_aqi?: unknown; pm2_5?: unknown } }>;
  const cities = AQ_CITIES.map((city, i) => ({
    name: city.name,
    aqi: finiteOrNull(rows[i]?.current?.us_aqi),
    pm25: finiteOrNull(rows[i]?.current?.pm2_5),
  }));
  return { cities, observedAt: rows[0]?.current?.time ?? null };
}

export const PKR_CROSSES = ['EUR', 'GBP', 'SAR', 'AED', 'CNY'] as const;

export interface PkrRates {
  usd: number;
  crosses: Array<{ code: string; pkr: number }>;
}

/** open.er-api.com quotes units per USD, so PKR per X = (PKR per USD) / (X per USD). */
export function pkrRates(rates: Record<string, unknown>): PkrRates | null {
  const pkr = rates.PKR;
  if (typeof pkr !== 'number' || !(pkr > 0)) return null;
  const crosses = PKR_CROSSES.flatMap((code) => {
    const perUsd = rates[code];
    return typeof perUsd === 'number' && perUsd > 0 ? [{ code, pkr: pkr / perUsd }] : [];
  });
  return { usd: pkr, crosses };
}

export async function fetchPkrRates(signal?: AbortSignal): Promise<PkrRates & { updated: string | null }> {
  const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal, credentials: 'omit' });
  if (!res.ok) throw new Error(`ExchangeRate-API HTTP ${res.status}`);
  const body = (await res.json()) as { result?: string; rates?: Record<string, unknown>; time_last_update_utc?: string };
  const rates = body.result === 'success' && body.rates ? pkrRates(body.rates) : null;
  if (!rates) throw new Error('ExchangeRate-API returned no PKR rate');
  return { ...rates, updated: body.time_last_update_utc ?? null };
}

export interface PsxIndexQuote {
  code: string;
  value: number;
  change: number;
  changePct: number;
}

export interface Kse100Quote {
  value: number;
  change: number;
  changePct: number;
  asOf: string | null;
  fetchedAt: string;
  stale: boolean;
  /** Filled by api/pk-kse100.js once Track B's B5 lands. */
  indices?: PsxIndexQuote[];
}

export async function fetchKse100(signal?: AbortSignal): Promise<Kse100Quote> {
  const res = await fetch('/api/pk-kse100', { signal });
  const body = (await res.json().catch(() => null)) as (Kse100Quote & { error?: string }) | null;
  if (!res.ok || typeof body?.value !== 'number') throw new Error(body?.error ?? `KSE-100 HTTP ${res.status}`);
  return body;
}

export interface PakistanBrief {
  bullets: string[];
  provider: string;
  model: string;
  generatedAt: string;
}

export async function requestBrief(headlines: string[], signal?: AbortSignal): Promise<PakistanBrief> {
  const res = await fetch('/api/pk-brief', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ headlines }),
    signal,
  });
  const body = (await res.json().catch(() => null)) as (PakistanBrief & { error?: string }) | null;
  if (!res.ok || !Array.isArray(body?.bullets) || body.bullets.length === 0) {
    throw new Error(body?.error ?? `Brief HTTP ${res.status}`);
  }
  return body;
}

/** Newest first, one item per title. */
export function briefHeadlines(items: NewsItem[], limit = 12): NewsItem[] {
  const seen = new Set<string>();
  return [...items]
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
    .filter((item) => {
      const key = item.title.trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

export const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const PK_WATCHLIST_TOPICS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'IMF / Economy', pattern: /\b(imf|adb|world bank|tax|budget|fiscal|debt|inflation|tariff)\b/i },
  { label: 'SBP / PKR', pattern: /\b(sbp|state bank|rupee|pkr|forex|reserves|policy rate|kse-?100|psx)\b/i },
  { label: 'CPEC / Gwadar', pattern: /\b(cpec|gwadar|karakoram|kkh|ml-?1|china|belt and road)\b/i },
  { label: 'Energy / POL', pattern: /\b(petrol|diesel|lng|oil|gas|power|tarbela|mangla|nepra|ogra|hormuz)\b/i },
  { label: 'Security / Border', pattern: /\b(ispr|ttp|loc|border|afghan|baloch|blast|operation|militant|attack|security)\b/i },
  { label: 'Climate / Flood', pattern: /\b(flood|monsoon|smog|aqi|quake|earthquake|heatwave|pdma|ndma)\b/i },
];

export function detectPakistanTopics(text: string): string[] {
  const tags: string[] = [];
  for (const topic of PK_WATCHLIST_TOPICS) {
    if (topic.pattern.test(text)) tags.push(topic.label);
  }
  return tags;
}

export function formatPakistanBriefMarkdown(opts: {
  bullets?: string[];
  items: NewsItem[];
  provider?: string;
  model?: string;
  generatedAt?: string;
}): string {
  const stamp = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(opts.generatedAt ? new Date(opts.generatedAt) : new Date());
  const lines: string[] = [`# Pakistan Monitor — Situation Brief (${stamp} PKT)`, ''];
  if (opts.bullets?.length) {
    lines.push(`## AI Summary (${opts.provider ?? 'LLM'} · ${opts.model ?? 'local'})`);
    for (const b of opts.bullets) lines.push(`- ${b}`);
    lines.push('');
  }
  lines.push('## Watchlist Headlines');
  for (const item of opts.items.slice(0, 8)) {
    const tags = detectPakistanTopics(item.title);
    const prefix = tags.length ? `[${tags.join(', ')}] ` : '';
    lines.push(`- ${prefix}${item.title} (${item.source}) — ${item.link}`);
  }
  return lines.join('\n');
}
