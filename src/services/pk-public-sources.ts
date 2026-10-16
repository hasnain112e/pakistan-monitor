/**
 * Keyless, CORS-open public sources used when the upstream Redis-seeded RPCs
 * return nothing (Pakistan Monitor runs without that pipeline). Pure mappers
 * with no browser globals, so tests import this file directly.
 */
import type { Earthquake } from '@/generated/client/worldmonitor/seismology/v1/service_client';

/** Pakistan and its neighbourhood: Afghanistan, eastern Iran, north India, the Arabian Sea. */
export const PK_REGION_BBOX = { minLat: 20, maxLat: 42, minLon: 55, maxLon: 82 } as const;

export function usgsRegionUrl(days = 7, minMagnitude = 2.5, now = Date.now()): string {
  const { minLat, maxLat, minLon, maxLon } = PK_REGION_BBOX;
  const params = new URLSearchParams({
    format: 'geojson',
    orderby: 'time',
    limit: '300',
    minmagnitude: String(minMagnitude),
    starttime: new Date(now - days * 86_400_000).toISOString().slice(0, 10),
    minlatitude: String(minLat),
    maxlatitude: String(maxLat),
    minlongitude: String(minLon),
    maxlongitude: String(maxLon),
  });
  return `https://earthquake.usgs.gov/fdsnws/event/1/query?${params}`;
}

export function usgsToEarthquakes(body: unknown): Earthquake[] {
  const features = (body as { features?: unknown[] } | null)?.features;
  if (!Array.isArray(features)) return [];
  return features.flatMap((raw) => {
    const f = raw as { id?: string; properties?: { mag?: unknown; place?: unknown; time?: unknown; url?: unknown }; geometry?: { coordinates?: unknown[] } };
    const [lon, lat, depth] = f.geometry?.coordinates ?? [];
    const magnitude = f.properties?.mag;
    if (!f.id || typeof lat !== 'number' || typeof lon !== 'number' || typeof magnitude !== 'number') return [];
    return [{
      id: f.id,
      place: typeof f.properties?.place === 'string' ? f.properties.place : '',
      magnitude,
      depthKm: typeof depth === 'number' ? depth : 0,
      location: { latitude: lat, longitude: lon },
      occurredAt: typeof f.properties?.time === 'number' ? f.properties.time : 0,
      sourceUrl: typeof f.properties?.url === 'string' ? f.properties.url : '',
      source: 'usgs',
      category: 'earthquake',
    }];
  });
}

export function eonetRegionUrl(days = 30): string {
  const { minLat, maxLat, minLon, maxLon } = PK_REGION_BBOX;
  // EONET's bbox order is minLon,maxLat,maxLon,minLat.
  return `https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=${days}&bbox=${minLon},${maxLat},${maxLon},${minLat}`;
}

/** The fields eonet.ts `toNaturalEvent` needs. */
export interface EonetMapEvent {
  id: string;
  title: string;
  category: string;
  categoryTitle: string;
  lat: number;
  lon: number;
  date: number;
  closed: boolean;
  sourceUrl: string;
}

export function eonetToMapEvents(body: unknown): EonetMapEvent[] {
  const events = (body as { events?: unknown[] } | null)?.events;
  if (!Array.isArray(events)) return [];
  return events.flatMap((raw) => {
    const e = raw as {
      id?: string; title?: string;
      categories?: Array<{ id?: string; title?: string }>;
      geometry?: Array<{ date?: string; coordinates?: unknown }>;
      sources?: Array<{ url?: string }>;
    };
    const latest = e.geometry?.[e.geometry.length - 1];
    const category = e.categories?.[0];
    const coords = Array.isArray(latest?.coordinates) ? (latest.coordinates as unknown[]) : [];
    const [lon, lat] = coords;
    if (!e.id || !e.title || !category?.id || typeof lat !== 'number' || typeof lon !== 'number') return [];
    return [{
      id: e.id,
      title: e.title,
      category: category.id,
      categoryTitle: category.title ?? category.id,
      lat,
      lon,
      date: Date.parse(latest?.date ?? '') || 0,
      closed: false,
      sourceUrl: e.sources?.[0]?.url ?? '',
    }];
  });
}
