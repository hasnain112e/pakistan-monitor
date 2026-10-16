import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';
import { jsonResponse } from './_json-response.js';
import { readJsonFromUpstash, setCachedData } from './_upstash-json.js';

export const config = { runtime: 'edge' };

// PSX publishes no public JSON API and Yahoo's ^KSE is delisted, so the index
// is read from the Data Portal's indices table. A markup change breaks the
// parse; the last good quote is then served marked stale, never invented.
const SOURCE_URL = 'https://dps.psx.com.pk/indices';
const LAST_GOOD_KEY = 'pk:kse100:last-good:v1';
const LAST_GOOD_TTL_SECONDS = 7 * 86400;
// ponytail: per-isolate memory; Upstash, when configured, is the durable copy.
let lastGood = null;

/** KSE-100 row of the indices table. Columns: High, Low, Current, Change, % Change. */
export function parseKse100(html) {
  const start = html.indexOf('data-code="KSE100"');
  const end = start === -1 ? -1 : html.indexOf('</tr>', start);
  if (end === -1) return null;
  const nums = [...html.slice(start, end).matchAll(/data-order="(-?\d+(?:\.\d+)?)"/g)].map((m) => Number(m[1]));
  if (nums.length < 5 || !(nums[2] > 0)) return null;
  const [high, low, value, change, changePct] = nums;
  const asOf = html.match(/As of\s+([^<]+)</)?.[1].replace(/\s+/g, ' ').trim() ?? null;
  return { value, change, changePct, high, low, asOf };
}

export default async function handler(req) {
  const cors = getCorsHeaders(req);
  if (isDisallowedOrigin(req)) return jsonResponse({ error: 'Origin not allowed' }, 403, cors);
  try {
    const response = await fetch(SOURCE_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PakistanMonitor/1.0)', Accept: 'text/html' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`PSX HTTP ${response.status}`);
    const html = await response.text();
    if (html.length > 2_000_000) throw new Error('PSX page exceeds size limit');
    const quote = parseKse100(html);
    if (!quote) throw new Error('KSE-100 row not found on the PSX page');
    lastGood = { ...quote, fetchedAt: new Date().toISOString() };
    try { await setCachedData(LAST_GOOD_KEY, lastGood, LAST_GOOD_TTL_SECONDS); } catch { /* best-effort */ }
    return jsonResponse({ ...lastGood, stale: false }, 200, { ...cors, 'Cache-Control': 'public, max-age=60, s-maxage=60' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const fallback = lastGood ?? await readJsonFromUpstash(LAST_GOOD_KEY).catch(() => null);
    if (fallback) return jsonResponse({ ...fallback, stale: true, error: message }, 200, { ...cors, 'Cache-Control': 'no-store' });
    return jsonResponse({ error: `KSE-100 unavailable: ${message}` }, 502, { ...cors, 'Cache-Control': 'no-store' });
  }
}
