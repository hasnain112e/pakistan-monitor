/**
 * Disasters touching Pakistan: GDACS (floods, cyclones, droughts, wildfires,
 * earthquakes) and recent USGS quakes in and around Pakistan. Both are free,
 * keyless and CORS-open.
 */
export interface DisasterEvent {
  id: string;
  kind: 'flood' | 'cyclone' | 'drought' | 'wildfire' | 'earthquake';
  title: string;
  alert: string; // GDACS Green / Orange / Red; '' for USGS
  startedAt: string; // ISO
  url: string;
  source: 'GDACS' | 'USGS';
  magnitude?: number;
}

const GDACS_TYPES = { FL: 'flood', TC: 'cyclone', DR: 'drought', WF: 'wildfire', EQ: 'earthquake' } as const;
type GdacsType = keyof typeof GDACS_TYPES;

export function gdacsForPakistan(body: unknown, type: GdacsType): DisasterEvent[] {
  const features = (body as { features?: unknown[] } | null)?.features;
  if (!Array.isArray(features)) return [];
  return features.flatMap((raw) => {
    const p = (raw as { properties?: Record<string, unknown> }).properties ?? {};
    const affected = Array.isArray(p.affectedcountries) ? (p.affectedcountries as Array<{ iso3?: unknown }>) : [];
    if (p.iso3 !== 'PAK' && !affected.some((c) => c.iso3 === 'PAK')) return [];
    const report = (p.url as { report?: unknown } | undefined)?.report;
    return [{
      id: `gdacs-${type}-${String(p.eventid)}`,
      kind: GDACS_TYPES[type],
      title: typeof p.name === 'string' ? p.name : GDACS_TYPES[type],
      alert: typeof p.alertlevel === 'string' ? p.alertlevel : '',
      startedAt: typeof p.fromdate === 'string' ? p.fromdate : '',
      url: typeof report === 'string' ? report : 'https://www.gdacs.org/',
      source: 'GDACS' as const,
    }];
  });
}

export function usgsNearPakistan(body: unknown): DisasterEvent[] {
  const features = (body as { features?: unknown[] } | null)?.features;
  if (!Array.isArray(features)) return [];
  return features.flatMap((raw) => {
    const f = raw as { id?: string; properties?: { mag?: unknown; place?: unknown; time?: unknown; url?: unknown } };
    const mag = f.properties?.mag;
    const time = f.properties?.time;
    if (!f.id || typeof mag !== 'number' || typeof time !== 'number') return [];
    const place = typeof f.properties?.place === 'string' ? f.properties.place : 'near Pakistan';
    return [{
      id: `usgs-${f.id}`,
      kind: 'earthquake' as const,
      title: `M${mag.toFixed(1)} · ${place}`,
      alert: '',
      startedAt: new Date(time).toISOString(),
      url: typeof f.properties?.url === 'string' ? f.properties.url : 'https://earthquake.usgs.gov/',
      source: 'USGS' as const,
      magnitude: mag,
    }];
  });
}

export async function fetchPakistanDisasters(signal?: AbortSignal, now = Date.now()): Promise<DisasterEvent[]> {
  const gdacs = (Object.keys(GDACS_TYPES) as GdacsType[]).map(async (type) => {
    const res = await fetch(`https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP?eventtype=${type}`, { signal, credentials: 'omit' });
    if (res.status === 204) return [];
    return res.ok ? gdacsForPakistan(await res.json(), type) : [];
  });
  const usgsParams = new URLSearchParams({
    format: 'geojson', orderby: 'time', limit: '50', minmagnitude: '4',
    starttime: new Date(now - 7 * 86_400_000).toISOString().slice(0, 10),
    minlatitude: '23.5', maxlatitude: '37.5', minlongitude: '60.5', maxlongitude: '77.9',
  });
  const usgs = fetch(`https://earthquake.usgs.gov/fdsnws/event/1/query?${usgsParams}`, { signal, credentials: 'omit' })
    .then(async (res) => (res.ok ? usgsNearPakistan(await res.json()) : []));
  const settled = await Promise.allSettled([...gdacs, usgs]);
  if (settled.every((r) => r.status === 'rejected')) throw new Error('GDACS and USGS unreachable');
  return settled
    .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
