import type { EventCategory, NewsItem } from '../types';
import { locatePakistan, PAKISTANI_SOURCE_NAMES, type PkPlace } from './pk-gazetteer';

export const INCIDENT_CATEGORIES: ReadonlySet<EventCategory> = new Set<EventCategory>([
  'terrorism', 'conflict', 'military', 'protest', 'crime', 'disaster', 'infrastructure', 'health',
]);

export interface PkIncident {
  item: NewsItem;
  place: PkPlace;
  category: EventCategory;
  level: string;
}

export function pakistanIncidents(items: NewsItem[]): PkIncident[] {
  const seen = new Set<string>();
  const out: PkIncident[] = [];
  for (const item of items) {
    const category = item.threat?.category;
    if (!category || !INCIDENT_CATEGORIES.has(category) || seen.has(item.link)) continue;
    const place = locatePakistan(item.title, { pakistaniSource: PAKISTANI_SOURCE_NAMES.has(item.source) });
    if (!place) continue;
    seen.add(item.link);
    out.push({ item, place, category, level: item.threat?.level ?? 'info' });
  }
  return out.sort((a, b) => b.item.pubDate.getTime() - a.item.pubDate.getTime());
}

export type IncidentFilterGroup = 'all' | 'security' | 'protest' | 'disaster' | 'infra';

const SECURITY_CATEGORIES: ReadonlySet<EventCategory> = new Set<EventCategory>([
  'terrorism', 'conflict', 'military',
]);
const INFRA_OTHER_CATEGORIES: ReadonlySet<EventCategory> = new Set<EventCategory>([
  'infrastructure', 'health', 'crime',
]);

export function filterPakistanIncidents(
  incidents: PkIncident[],
  opts: { province?: string | null; group?: IncidentFilterGroup } = {},
): PkIncident[] {
  const group = opts.group ?? 'all';
  const province = opts.province ?? null;
  return incidents.filter((inc) => {
    if (province && inc.place.province !== province) return false;
    if (group === 'security') return SECURITY_CATEGORIES.has(inc.category);
    if (group === 'protest') return inc.category === 'protest';
    if (group === 'disaster') return inc.category === 'disaster';
    if (group === 'infra') return INFRA_OTHER_CATEGORIES.has(inc.category);
    return true;
  });
}

export function countByProvince(incidents: PkIncident[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const i of incidents) counts.set(i.place.province, (counts.get(i.place.province) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
