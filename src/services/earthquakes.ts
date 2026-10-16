import { getRpcBaseUrl } from '@/services/rpc-client';
import type { Earthquake as ProtoEarthquake, ListEarthquakesResponse } from '@/generated/client/worldmonitor/seismology/v1/service_client';
import { createCircuitBreaker } from '@/utils/circuit-breaker';
import { getHydratedData } from '@/services/bootstrap';
import { SeismologyServiceClient } from '@/services/generated-rpc-clients';
import { usgsRegionUrl, usgsToEarthquakes } from '@/services/pk-public-sources';

// Proto Earthquake.source / .category (fields 12 / 13) carry USGS vs NRCan
// Attribution. Keep the union so dashboard/MCP can narrow 'usgs' | 'nrcan'.
export type Earthquake = ProtoEarthquake & {
  source?: 'usgs' | 'nrcan' | string;
  category?: string;
};

const client = new SeismologyServiceClient(getRpcBaseUrl(), { fetch: (...args) => globalThis.fetch(...args) });
const breaker = createCircuitBreaker<ListEarthquakesResponse>({ name: 'Seismology', cacheTtlMs: 30 * 60 * 1000, persistCache: true });

const emptyFallback: ListEarthquakesResponse = { earthquakes: [] };

export async function fetchEarthquakes(): Promise<Earthquake[]> {
  const hydrated = getHydratedData('earthquakes') as ListEarthquakesResponse | undefined;
  if (hydrated?.earthquakes?.length) {
    breaker.recordSuccess(hydrated);
    return hydrated.earthquakes as Earthquake[];
  }

  const response = await breaker.execute(async () => {
    return client.listEarthquakes({ minMagnitude: 0, start: 0, end: 0, pageSize: 0, cursor: '' });
  }, emptyFallback, { shouldCache: (r) => r.earthquakes.length > 0 });
  if (response.earthquakes.length > 0) return response.earthquakes as Earthquake[];
  return fetchUsgsFallback();
}

// Pakistan Monitor: the RPC reads a Redis seed this deployment does not run, so read USGS directly.
async function fetchUsgsFallback(): Promise<Earthquake[]> {
  try {
    const res = await fetch(usgsRegionUrl(), { credentials: 'omit' });
    return res.ok ? usgsToEarthquakes(await res.json()) : [];
  } catch {
    return [];
  }
}

