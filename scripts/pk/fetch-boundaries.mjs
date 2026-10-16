#!/usr/bin/env node
// Downloads geoBoundaries PAK ADM2 (126 districts, public domain), keeps only
// shapeName and rounds coordinates to 3 decimals (~100 m) to cut the size.
// Run: node scripts/pk/fetch-boundaries.mjs
import { mkdirSync, writeFileSync } from 'node:fs';

const URL_ADM2 = 'https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/PAK/ADM2/geoBoundaries-PAK-ADM2_simplified.geojson';
const round = (c) => (typeof c[0] === 'number' ? [Math.round(c[0] * 1e3) / 1e3, Math.round(c[1] * 1e3) / 1e3] : c.map(round));
const geo = await (await fetch(URL_ADM2, { headers: { 'User-Agent': 'PakistanMonitor/1.0' } })).json();
const out = {
  type: 'FeatureCollection',
  features: geo.features.map((f) => ({
    type: 'Feature',
    properties: { shapeName: f.properties.shapeName },
    geometry: { type: f.geometry.type, coordinates: round(f.geometry.coordinates) },
  })),
};
mkdirSync(new URL('../../public/data/', import.meta.url), { recursive: true });
writeFileSync(new URL('../../public/data/pk-districts.geojson', import.meta.url), JSON.stringify(out));
console.log(`wrote ${out.features.length} districts`);
