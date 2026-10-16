import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';
import { jsonResponse } from './_json-response.js';

export const config = { runtime: 'edge' };

// forex.pk's bullion page lists "Gold XAU <per 10 g> <per tola> <per ounce>" in PKR.
// It is a third-party page: credit it in the UI, cache 15 minutes, never hammer it.
const SOURCE_URL = 'https://www.forex.pk/bullion-rates-gold-xau-pkr.php';
let lastGood = null;

export function parseGoldTola(html) {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  const m = text.match(/Gold XAU ([\d,]+) ([\d,]+) ([\d,]+)/);
  if (!m) return null;
  const n = (s) => Number(s.replace(/,/g, ''));
  const rate = { per10g: n(m[1]), perTola: n(m[2]), perOunce: n(m[3]) };
  return rate.perTola > 0 ? rate : null;
}

export default async function handler(req) {
  const cors = getCorsHeaders(req);
  if (isDisallowedOrigin(req)) return jsonResponse({ error: 'Origin not allowed' }, 403, cors);
  try {
    const res = await fetch(SOURCE_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PakistanMonitor/1.0)', Accept: 'text/html' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`forex.pk HTTP ${res.status}`);
    const rate = parseGoldTola(await res.text());
    if (!rate) throw new Error('gold row not found on forex.pk');
    lastGood = { ...rate, source: 'forex.pk', fetchedAt: new Date().toISOString() };
    return jsonResponse({ ...lastGood, stale: false }, 200, { ...cors, 'Cache-Control': 'public, max-age=900, s-maxage=900' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (lastGood) return jsonResponse({ ...lastGood, stale: true, error: message }, 200, { ...cors, 'Cache-Control': 'no-store' });
    return jsonResponse({ error: `Gold rate unavailable: ${message}` }, 502, { ...cors, 'Cache-Control': 'no-store' });
  }
}
