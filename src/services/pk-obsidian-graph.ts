import type { NewsItem } from '../types';
import { locatePakistan, PAKISTANI_SOURCE_NAMES } from './pk-gazetteer';
import { pakistanIncidents } from './pk-incidents';

export interface ObsidianNode {
  id: string;
  label: string;
  type: 'province' | 'district' | 'topic' | 'incident' | 'source';
  province?: string;
  val: number; // size
  color: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  lat?: number;
  lon?: number;
  linkCount?: number;
}

export interface ObsidianLink {
  source: string;
  target: string;
  strength?: number;
}

export interface ObsidianGraphData {
  nodes: ObsidianNode[];
  links: ObsidianLink[];
}

const PROVINCE_COLORS: Record<string, string> = {
  Balochistan: '#a855f7', // purple
  Punjab: '#f59e0b',     // amber
  Sindh: '#06b6d4',      // cyan
  'Khyber Pakhtunkhwa': '#10b981', // emerald
  Islamabad: '#ec4899',  // pink
  'Gilgit-Baltistan': '#3b82f6', // blue
  'Azad Jammu & Kashmir': '#8b5cf6', // violet
};

export const DEFAULT_PROVINCE_COLOR = '#2fbf71';

export function buildObsidianGraph(items: NewsItem[]): ObsidianGraphData {
  const nodesMap = new Map<string, ObsidianNode>();
  const linkPairs = new Set<string>();
  const links: ObsidianLink[] = [];

  const addNode = (node: ObsidianNode) => {
    const existing = nodesMap.get(node.id);
    if (!existing) {
      nodesMap.set(node.id, { ...node, linkCount: 0 });
    } else {
      existing.val = Math.max(existing.val, node.val);
    }
  };

  const addLink = (source: string, target: string, strength = 1) => {
    if (source === target) return;
    const key = source < target ? `${source}--${target}` : `${target}--${source}`;
    if (!linkPairs.has(key)) {
      linkPairs.add(key);
      links.push({ source, target, strength });
      const s = nodesMap.get(source);
      const t = nodesMap.get(target);
      if (s) s.linkCount = (s.linkCount ?? 0) + 1;
      if (t) t.linkCount = (t.linkCount ?? 0) + 1;
    }
  };

  // 1. Seed Core Provinces
  const provinces = ['Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan', 'Islamabad', 'Gilgit-Baltistan', 'Azad Jammu & Kashmir'];
  for (const prov of provinces) {
    addNode({
      id: `prov:${prov}`,
      label: prov,
      type: 'province',
      province: prov,
      val: 16,
      color: PROVINCE_COLORS[prov] ?? DEFAULT_PROVINCE_COLOR,
    });
  }

  // 2. Seed Key Strategic Topics
  const topics = [
    { id: 'topic:economy', label: 'Economy & PSX', color: '#10b981' },
    { id: 'topic:security', label: 'Security & Defense', color: '#ef4444' },
    { id: 'topic:smog', label: 'Smog & Environment', color: '#f59e0b' },
    { id: 'topic:politics', label: 'Politics & Governance', color: '#8b5cf6' },
  ];
  for (const t of topics) {
    addNode({
      id: t.id,
      label: t.label,
      type: 'topic',
      val: 14,
      color: t.color,
    });
  }

  // 3. Connect news items and gazetteer places
  const incidents = pakistanIncidents(items);
  for (const inc of incidents.slice(0, 30)) {
    const incId = `inc:${inc.item.link}`;
    const provId = `prov:${inc.place.province}`;

    addNode({
      id: incId,
      label: inc.place.name,
      type: 'incident',
      province: inc.place.province,
      val: 8,
      color: inc.level === 'critical' || inc.level === 'high' ? '#ef4444' : '#fb923c',
      lat: inc.place.lat,
      lon: inc.place.lon,
    });

    if (nodesMap.has(provId)) {
      addLink(incId, provId, 2);
    }

    if (inc.category === 'terrorism' || inc.category === 'conflict' || inc.category === 'military') {
      addLink(incId, 'topic:security');
    } else if (inc.category === 'disaster' || inc.category === 'health') {
      addLink(incId, 'topic:smog');
    }
  }

  // 4. Connect general headlines
  for (const item of items.slice(0, 40)) {
    const isPak = PAKISTANI_SOURCE_NAMES.has(item.source);
    const place = locatePakistan(item.title, { pakistaniSource: isPak });
    if (!place) continue;

    const distId = `dist:${place.name}`;
    const provId = `prov:${place.province}`;

    addNode({
      id: distId,
      label: place.name,
      type: 'district',
      province: place.province,
      val: 10,
      color: PROVINCE_COLORS[place.province] ?? DEFAULT_PROVINCE_COLOR,
      lat: place.lat,
      lon: place.lon,
    });

    if (nodesMap.has(provId)) {
      addLink(distId, provId, 1.5);
    }
  }

  return {
    nodes: Array.from(nodesMap.values()),
    links,
  };
}

export function generateObsidianVaultMarkdown(options: {
  date?: string;
  items: NewsItem[];
  kse100?: number | null;
  usdPkr?: number | null;
  goldTola?: number | null;
}): string {
  const dateStr = options.date ?? new Date().toISOString().slice(0, 10);
  const incidents = pakistanIncidents(options.items).slice(0, 10);

  const incidentLines = incidents.length
    ? incidents.map((i) => `- **${i.category.toUpperCase()}** in [[${i.place.name}]] ([[${i.place.province}]]): ${i.item.title} — [Source](${i.item.link})`).join('\n')
    : '- No major located security incidents flagged.';

  const kseStr = options.kse100 != null ? options.kse100.toLocaleString('en-US', { maximumFractionDigits: 0 }) : 'N/A';
  const usdStr = options.usdPkr != null ? options.usdPkr.toFixed(2) : 'N/A';
  const goldStr = options.goldTola != null ? `PKR ${options.goldTola.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : 'N/A';

  return `---
title: Pakistan Monitor Intelligence SITREP
date: ${dateStr}
tags:
  - pakistan
  - intelligence
  - osint
  - national-security
  - obsidian-vault
---

# 🇵🇰 Pakistan Monitor — Situation Report (${dateStr})

> [!INFO] Mission Intelligence Overview
> Live multi-source telemetry aggregated across federal and provincial jurisdictions: [[Punjab]], [[Sindh]], [[Khyber Pakhtunkhwa]], [[Balochistan]], [[Islamabad]], [[Gilgit-Baltistan]], and [[Azad Jammu & Kashmir]].

---

## 📈 Economic & Financial Dashboard

> [!SUCCESS] Key Market Indicators
> - **KSE-100 Index**: \`${kseStr}\`
> - **USD / PKR Exchange**: \`PKR ${usdStr}\`
> - **24K Gold (per Tola)**: \`${goldStr}\`
>
> Reference link: [[Pakistan Economy Desk]] | [[PSX Markets]]

---

## 🚨 Security & Incidents by Province

> [!CRITICAL] Tracked National Incidents
${incidentLines}

---

## 🗺️ Knowledge Graph Connections
- Entities: [[Quetta]], [[Karachi]], [[Lahore]], [[Peshawar]], [[Gwadar]], [[Islamabad]]
- Threat Clusters: #security #economy #disaster #smog

_Generated by Pakistan Monitor (Obsidian Intel Integration)_
`;
}
