/**
 * Places Pakistani headlines, English or Urdu, on the generated gazetteer.
 * Separate from geo-hub-index because tokenizeForMatch drops non-Latin script,
 * so Urdu names are matched here as whole words. Relative imports keep this
 * file loadable by node tests.
 */
import { PK_PLACES, type PkPlace } from '../data/pk-gazetteer';
import { matchKeyword, tokenizeForMatch } from '../utils/keyword-match';

export type { PkPlace };

/** Feed names from Pakistani outlets: FULL_FEEDS.pakistan and FULL_FEEDS.urdu. Keep in sync. */
export const PAKISTANI_SOURCE_NAMES: ReadonlySet<string> = new Set([
  'Dawn', 'Geo News', 'Express Tribune', 'The News International', 'Business Recorder', 'ARY News',
  'APP News', 'ProPakistani', 'Daily Times',
  'BBC Urdu', 'Independent Urdu', 'Express Urdu', 'Jang', 'Dawn News Urdu',
]);

// English names that are also common words or places elsewhere. They count only
// when the headline or its source is clearly about Pakistan.
const NEEDS_CONTEXT = new Set(['tank', 'swat', 'dir', 'mirpur', 'hyderabad', 'kalat', 'punjab']);
const PAKISTAN_CONTEXT = /\b(pakistan|pakistani|sindh|balochistan|khyber|kp)\b/i;
// Urdu place names that are also everyday words ("دیر" means "late"). Never match them alone.
const URDU_COMMON_WORDS = new Set(['دیر']);
const KIND_RANK: Record<PkPlace['kind'], number> = { city: 0, district: 1, province: 2 };
const URDU_EDGE = '[\\s\\p{P}]';

const urduPatterns = new Map<string, RegExp>();
function urduPattern(name: string): RegExp {
  let re = urduPatterns.get(name);
  if (!re) {
    re = new RegExp(`(^|${URDU_EDGE})${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|${URDU_EDGE})`, 'u');
    urduPatterns.set(name, re);
  }
  return re;
}

// Longest name first, so "Khyber Pakhtunkhwa" beats "Khyber" and "Dera Ismail Khan" beats any shorter name.
const BY_ENGLISH = [...PK_PLACES].sort((a, b) => b.name.length - a.name.length || KIND_RANK[a.kind] - KIND_RANK[b.kind]);
const BY_URDU = PK_PLACES.filter((p) => p.nameUr.length >= 3 && !URDU_COMMON_WORDS.has(p.nameUr))
  .sort((a, b) => b.nameUr.length - a.nameUr.length || KIND_RANK[a.kind] - KIND_RANK[b.kind]);

export function mentionsPlace(title: string, place: PkPlace): boolean {
  if (place.nameUr && !URDU_COMMON_WORDS.has(place.nameUr) && urduPattern(place.nameUr).test(title)) return true;
  return matchKeyword(tokenizeForMatch(title), place.name.toLowerCase());
}

export function locatePakistan(title: string, opts: { pakistaniSource?: boolean } = {}): PkPlace | null {
  for (const place of BY_URDU) {
    if (urduPattern(place.nameUr).test(title)) return place;
  }
  const tokens = tokenizeForMatch(title);
  const hasContext = opts.pakistaniSource === true || PAKISTAN_CONTEXT.test(title);
  for (const place of BY_ENGLISH) {
    const key = place.name.toLowerCase();
    if (NEEDS_CONTEXT.has(key) && !hasContext) continue;
    if (matchKeyword(tokens, key)) return place;
  }
  return null;
}

export const normalizePlaceName = (s: string): string => s.toLowerCase().replace(/\bdistrict\b/g, '').replace(/[^a-z]/g, '');

export function findDistrict(name: string): PkPlace | undefined {
  const key = normalizePlaceName(name);
  return PK_PLACES.find((p) => p.kind === 'district' && normalizePlaceName(p.name) === key)
    ?? PK_PLACES.find((p) => p.kind === 'city' && normalizePlaceName(p.name) === key);
}
