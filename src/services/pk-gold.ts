export interface GoldRate {
  per10g: number;
  perTola: number;
  perOunce: number;
  source: string;
  fetchedAt: string;
  stale: boolean;
}

export async function fetchGold(signal?: AbortSignal): Promise<GoldRate> {
  const res = await fetch('/api/pk-gold', { signal });
  const body = (await res.json().catch(() => null)) as (GoldRate & { error?: string }) | null;
  if (!res.ok || typeof body?.perTola !== 'number') throw new Error(body?.error ?? `Gold HTTP ${res.status}`);
  return body;
}
