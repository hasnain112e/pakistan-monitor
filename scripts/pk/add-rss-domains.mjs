#!/usr/bin/env node
// Adds domains to the three RSS allowlist mirrors, keeping sort order and formats.
// Usage: node scripts/pk/add-rss-domains.mjs example.com www.example.org
import { readFileSync, writeFileSync } from 'node:fs';

const domains = process.argv.slice(2);
if (domains.length === 0) throw new Error('pass at least one domain');
const jsonPaths = ['shared/rss-allowed-domains.json', 'scripts/shared/rss-allowed-domains.json'];
const original = readFileSync(jsonPaths[0], 'utf8');
const list = JSON.parse(original);
const next = [...new Set([...list, ...domains])].sort();
for (const p of jsonPaths) writeFileSync(p, JSON.stringify(next, null, 2) + (original.endsWith('\n') ? '\n' : ''));
const js = readFileSync('api/_rss-allowed-domains.js', 'utf8');
const start = js.indexOf('export default [');
const end = js.indexOf('];', start);
writeFileSync('api/_rss-allowed-domains.js', js.slice(0, start) + 'export default [\n' + next.map((d) => `  ${JSON.stringify(d)},\n`).join('') + js.slice(end));
console.log(`added ${next.length - list.length}: ${list.length} -> ${next.length}`);
