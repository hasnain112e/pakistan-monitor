import type { NewsItem } from '../types';
import { detectPakistanTopics } from './pakistan-desk';
import { locatePakistan, PAKISTANI_SOURCE_NAMES } from './pk-gazetteer';
import { safeStorageGet, safeStorageSet } from '../utils/safe-storage';

export type BroadcastLangMode = 'bilingual' | 'ur' | 'en';

export interface BroadcastStory {
  id: string;
  title: string;
  source: string;
  link: string;
  pubDate: Date;
  isUrdu: boolean;
  isBreaking: boolean;
  category: string;
  topics: string[];
  placeName: string;
  province: string;
  lat: number;
  lon: number;
  zoom: number;
}

const SEEN_STORAGE_KEY = 'pm.broadcast-seen.v1';
const MAX_SEEN_LINKS = 200;
const URDU_SCRIPT_RE = /[\u0600-\u06FF]/;

const FALLBACK_COORDS: Array<{ pattern: RegExp; placeName: string; province: string; lat: number; lon: number; zoom: number }> = [
  { pattern: /\b(hormuz|gulf|iran|tehran|tanker)\b/i, placeName: 'Strait of Hormuz', province: 'Gulf Corridor', lat: 26.56, lon: 56.25, zoom: 5 },
  { pattern: /\b(red sea|houthi|yemen|aden|bab el-mandeb)\b/i, placeName: 'Bab el-Mandeb', province: 'Red Sea', lat: 12.58, lon: 43.33, zoom: 5 },
  { pattern: /\b(gaza|israel|lebanon|beirut|syria)\b/i, placeName: 'Levant Theater', province: 'Middle East', lat: 32.5, lon: 35.2, zoom: 5 },
  { pattern: /\b(cpec|gwadar)\b/i, placeName: 'Gwadar Port', province: 'Balochistan', lat: 25.13, lon: 62.32, zoom: 7 },
];

export function isUrduText(text: string): boolean {
  return URDU_SCRIPT_RE.test(text);
}

export function loadSeenBroadcastLinks(): Set<string> {
  try {
    const raw = safeStorageGet(SEEN_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []);
  } catch {
    return new Set();
  }
}

export function saveSeenBroadcastLinks(links: ReadonlySet<string>): void {
  const recent = [...links].slice(-MAX_SEEN_LINKS);
  safeStorageSet(SEEN_STORAGE_KEY, JSON.stringify(recent));
}

export function clearSeenBroadcastLinks(): void {
  safeStorageSet(SEEN_STORAGE_KEY, '[]');
}

export function buildBroadcastQueue(
  items: NewsItem[],
  seenLinks: ReadonlySet<string>,
  langMode: BroadcastLangMode = 'bilingual',
): BroadcastStory[] {
  const deduped = new Set<string>();
  const stories: BroadcastStory[] = [];

  const sorted = [...items].sort((a, b) => {
    const alertDelta = Number(b.isAlert) - Number(a.isAlert);
    if (alertDelta !== 0) return alertDelta;
    return b.pubDate.getTime() - a.pubDate.getTime();
  });

  for (const item of sorted) {
    const title = item.title.trim();
    const key = item.link || title.toLowerCase();
    if (!title || deduped.has(key) || seenLinks.has(key)) continue;

    const urdu = isUrduText(title);
    if (langMode === 'ur' && !urdu) continue;
    if (langMode === 'en' && urdu) continue;

    deduped.add(key);

    const place = locatePakistan(title, { pakistaniSource: PAKISTANI_SOURCE_NAMES.has(item.source) });
    const fallback = !place ? FALLBACK_COORDS.find((entry) => entry.pattern.test(title)) : undefined;

    const lat = place?.lat ?? item.lat ?? fallback?.lat ?? 33.6844;
    const lon = place?.lon ?? item.lon ?? fallback?.lon ?? 73.0479;
    const placeName = place?.name ?? item.locationName ?? fallback?.placeName ?? 'Islamabad';
    const province = place?.province ?? fallback?.province ?? 'Pakistan';
    const zoom = place ? 7 : fallback ? fallback.zoom : 5;

    const threatLevel = item.threat?.level;
    const isBreaking = Boolean(item.isAlert || threatLevel === 'critical' || threatLevel === 'high');
    const category = (item.threat?.category ?? (urdu ? 'URDU DESK' : 'LIVE UPDATE')).toUpperCase();
    const topics = detectPakistanTopics(title);

    stories.push({
      id: key,
      title,
      source: item.source || 'Pakistan Monitor',
      link: item.link || '#',
      pubDate: item.pubDate,
      isUrdu: urdu,
      isBreaking,
      category,
      topics,
      placeName,
      province,
      lat,
      lon,
      zoom,
    });

    if (stories.length >= 25) break;
  }

  return stories;
}

export function composeAnchorScript(
  story: BroadcastStory,
  langMode: BroadcastLangMode,
  aiSummary?: string,
): { spokenText: string; captionText: string; speechLang: string } {
  const cleanTitle = story.title.replace(/\s+/g, ' ').trim();
  const body = aiSummary?.trim() || cleanTitle;

  if (story.isUrdu || langMode === 'ur') {
    const lead = story.isBreaking ? 'پاکستان مانیٹر بریکنگ نیوز' : 'پاکستان مانیٹر تازہ ترین خبر';
    const spokenText = `${lead}۔ ${story.placeName} سے ${story.source} کی رپورٹ کے مطابق، ${body}`;
    return { spokenText, captionText: body, speechLang: 'ur-PK' };
  }

  const tagLead = story.topics[0] ? `${story.topics[0]} update` : story.isBreaking ? 'Breaking update' : 'Regional desk update';
  const spokenText = `Pakistan Monitor ${tagLead} from ${story.placeName}. ${body}. Reported by ${story.source}.`;
  return { spokenText, captionText: body, speechLang: 'en-PK' };
}

export function pickSpeechVoice(voices: SpeechSynthesisVoice[], speechLang: string): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const prefix = speechLang.toLowerCase().split('-')[0] ?? 'en';
  if (prefix === 'ur') {
    return (
      voices.find((v) => v.lang.toLowerCase().startsWith('ur-pk')) ??
      voices.find((v) => v.lang.toLowerCase().startsWith('ur')) ??
      voices.find((v) => v.lang.toLowerCase().startsWith('hi')) ??
      null
    );
  }
  return (
    voices.find((v) => v.lang.toLowerCase().startsWith('en-pk')) ??
    voices.find((v) => v.lang.toLowerCase().startsWith('en-gb')) ??
    voices.find((v) => v.lang.toLowerCase().startsWith('en-us')) ??
    voices.find((v) => v.lang.toLowerCase().startsWith('en')) ??
    voices[0] ??
    null
  );
}

export function playBroadcastChime(isBreaking: boolean): void {
  if (typeof window === 'undefined') return;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;
  try {
    const ctx = new AudioCtx();
    const notes = isBreaking ? [587.33, 880, 1174.66] : [523.25, 659.25];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + idx * 0.11;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.08, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.3);
    });
    setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 800);
  } catch {
    // Ignore audio context restrictions
  }
}
