# Pakistan Monitor: Day-1 Parallel Build Plan (Claude + Gemini)

> **For agentic workers:** Claude runs Task 0, Track A and Task X (use superpowers:executing-plans or superpowers:subagent-driven-development). Gemini runs Track B, in order. Steps use checkboxes (`- [ ]`): tick each one as you finish it.

**Goal:** In one day, grow the current Pakistan Monitor (Pakistan map, Pakistan news, KSE-100 + rupee, city air quality, AI brief) into a fuller national dashboard: disasters, weather warnings, Urdu news, Pakistani live TV, more PSX indices, Pakistani headlines and incidents placed on the map, and clickable districts. Two agents build at the same time without touching each other's files.

**Architecture:** Panels are browser-side TypeScript classes (`src/components/`). They call keyless public APIs directly when those send CORS headers (USGS, NASA EONET, GDACS, Open-Meteo), and go through small edge handlers in `api/` when they don't (PSX, forex.pk). In dev, `pakistanApiPlugin` in `vite.config.ts` runs those handlers. A gazetteer generated from Wikidata and geoBoundaries gives Pakistani headlines coordinates, in English and Urdu. Those coordinates put news, incidents and districts on the existing deck.gl map.

**Tech Stack:** Vite 6 + vanilla TypeScript, deck.gl + MapLibre, edge-style `Request → Response` handlers, `node:test` via `scripts/run-data-tests.mjs` (tsx), Ollama (local LLM).

**Spec:** §1 of this document (scope agreed with the user on 2026-10-16). Every data source below was probed live on 2026-10-16.

## Global Constraints

- Free sources only. No Day-1 task needs an API key.
- Never show invented data. Every number names its source and time. When a source fails, show the last good value marked `stale`, or an explicit "unavailable".
- Out of scope for good: military bases, nuclear sites, military flights (security-sensitive), the X/Twitter API (paid).
- Keep the AGPL credit in the footer (`PAKISTAN_FOOTER_LINKS_HTML` in `src/app/panel-layout.ts`).
- Browser import direction is `types → config → services → components → app → App.ts`, enforced by `npm run lint:boundaries`. `api/*.js` imports only same-folder `_*.js` helpers. Never edit `src/generated/`.
- Pure helpers that tests import must avoid runtime `@/` imports. Use relative imports; `import type` from `@/…` is fine because it is erased.
- Do not set `OLLAMA_API_URL` or `LLM_API_URL`: they switch on upstream's own LLM jobs and swamp the local model. The AI brief uses `PK_BRIEF_*` in `.env.local`.
- Node 24 (`.nvmrc`). Windows machine: run the commands shown in Git Bash.
- UI text may be plain English literals. Add no i18n keys today.

---

## 0. How the two agents work in parallel

| | Track A: Claude | Track B: Gemini |
|---|---|---|
| Folder | `C:\Users\AYAT LAPTOP POINT\Desktop\Pakistan Monitor` | `C:\Users\AYAT LAPTOP POINT\Desktop\Pakistan Monitor Gemini` (git worktree) |
| Branch | `pm/track-a` | `pm/track-b` |
| Dev server | `npx vite --port 3000 --strictPort` | `npx vite --port 3001 --strictPort` |
| Status file (only you edit it) | `docs/superpowers/plans/status-track-a.md` | `docs/superpowers/plans/status-track-b.md` |

**Rules**

1. Gemini starts only after Claude finishes Task 0 and the user says go.
2. Edit only files your track owns (table below). If you need a change in the other track's file, write it under "Needs from the other track" in your status file and carry on. The user relays it.
3. Commit after every task, adding files by name. Never use `git add -A`. Message format: `track-a: A2 Pakistan gazetteer` / `track-b: B3 weather warnings panel`.
4. Run at most one dev server and one test command at a time. After editing `.env.local` or `vite.config.ts`, kill the dev server and start it again; a soft restart keeps old env vars.
5. Do not run `npm run test:data`. On this shallow Windows clone, `tests/docs-page-dates.test.mjs` needs full git history, and 2,000 file arguments exceed the Windows argv limit. Run named files instead: `node scripts/run-data-tests.mjs tests/<file>`.
6. Definition of done, for every task:
   - [ ] `npx tsc --noEmit` passes (browser code)
   - [ ] `npx tsc --noEmit -p tsconfig.api.json` passes (api/ and server/)
   - [ ] `npm run lint:boundaries` and `npm run lint:api-contract` pass
   - [ ] `npx biome lint <files you touched>` is clean
   - [ ] the task's tests pass, plus the upstream suites the task names
   - [ ] in the browser, with fresh storage (DevTools → Application → Clear site data), the feature shows real data and no new console errors from it
   - [ ] the source-down path renders an honest message, never a broken panel
   - [ ] committed, and your status file updated with the task ID, the commit hash and a one-line note

**Gemini start prompt** (the user pastes this into Gemini, opened in the Gemini folder):

> Read `docs/superpowers/plans/2026-10-16-pakistan-monitor-day1-parallel.md`. You are Track B. Work only in this folder, on branch `pm/track-b`. Do B1, B2, B3, B4 and B5 in order, then B6 if time remains. Follow §0 exactly: edit only Track B files, commit after each task, and update `docs/superpowers/plans/status-track-b.md`. Use dev port 3001.

### File ownership (after Task 0)

**Track A (Claude)**
- Map: `src/components/DeckGLMap.ts`, `GlobeMap.ts`, `Map.ts`, `MapContainer.ts`
- App shell: `src/app/**`, `src/App.ts`, `src/main.ts`
- Config: `src/config/panels.ts`, `src/config/commands.ts`, `src/config/variant-meta.ts`
- Services: `src/services/earthquakes.ts`, `eonet.ts`, `news-digest-items.ts`, `rss.ts`, `mission-presets.ts`, `pakistan-desk.ts`, and the new `pk-public-sources.ts`, `pk-gazetteer.ts`, `pk-incidents.ts`
- Data and scripts: `src/data/pk-gazetteer.ts` (generated), `scripts/pk/build-gazetteer.mjs`, `scripts/pk/fetch-boundaries.mjs`, `public/data/pk-districts.geojson`
- Panels: `src/components/PakistanBriefPanel.ts`, `PakistanAirPanel.ts`, `PakistanIncidentsPanel.ts`, `PakistanDistrictPanel.ts`
- API: `api/pk-brief.ts`, `api/api-route-exceptions.json`, `vite.config.ts`
- `src/styles/pakistan.css`, `tests/pakistan-desk.test.mts`

**Track B (Gemini)**
- News: `src/config/feeds.ts`, `server/worldmonitor/news/v1/_feeds.ts`
- RSS allowlist: `shared/rss-allowed-domains.json`, `scripts/shared/rss-allowed-domains.json`, `api/_rss-allowed-domains.js`, and the new `scripts/pk/add-rss-domains.mjs`
- Source registries, only if B1's tests require entries: `shared/source-tiers.json`, its mirror `scripts/shared/source-tiers.json`, and `shared/source-provenance-declarations.ts`
- Live TV: `src/config/live-video-sources.ts`, `src/services/live-channels.ts`, `scripts/shared/live-video-refresh-channels.generated.json`
- Markets: `api/pk-kse100.js`, `api/pk-gold.js`, `src/components/PakistanMarketsPanel.ts`
- Panels: `src/components/PakistanWeatherPanel.ts`, `PakistanDisastersPanel.ts`
- Services: the new `src/services/pk-weather.ts`, `pk-disasters.ts`, `pk-gold.ts`
- `src/styles/pakistan-b.css`, `tests/pakistan-track-b.test.mts`

**Read-only for Track B:** `src/services/pakistan-desk.ts` (import `AQ_CITIES`, `errorMessage`, `formatTime` and the types; do not edit it). Nobody edits any other file today. If you believe you must, stop and write why in your status file.

**Shared contract:** Track A's `PAKISTANI_SOURCE_NAMES` (Task A2) lists feed names Track B creates in B1. Use these exact names: `BBC Urdu`, `Independent Urdu`, `Express Urdu`, `Jang`, `Dawn News Urdu`.

---

## 1. Scope for today

| ID | Feature | Track | When |
|---|---|---|---|
| 0 | Baseline commit, scaffolding, Gemini worktree | Claude | First |
| A1 | Earthquakes and natural events on the map without Redis (USGS, EONET) | Claude | Today |
| A2 | Pakistan gazetteer: Pakistani headlines (English and Urdu) get map coordinates | Claude | Today |
| A3 | District boundaries; clicking a district shows its headlines | Claude | Today |
| A4 | Incidents panel: terrorism, protests, crime, disasters, by province | Claude | Today |
| A5 | Pakistan workspaces: Disaster, Economy, Security, Smog desks | Claude | Stretch |
| B1 | Urdu news panel (5 sources) | Gemini | Today |
| B2 | Pakistani live TV: Geo, ARY, Dunya, SAMAA, PTV, BOL | Gemini | Today |
| B3 | Weather warnings panel: heat, heavy rain, wind, fog | Gemini | Today |
| B4 | Disasters panel: GDACS floods, cyclones, droughts, wildfires, quakes + USGS | Gemini | Today |
| B5 | PSX: KSE-30, All Share, KMI-30, Banks and Oil & Gas indices | Gemini | Today |
| B6 | Gold per tola | Gemini | Stretch |
| X | Merge both tracks, final checks | Claude | Last |

Start a stretch task only when every "Today" task in your track is done. §7 lists everything deliberately left for later.

---

## 2. Codebase cheat-sheet

**Already built (Phase 2, uncommitted until Task 0):**
- Map opens on Pakistan: `'pakistan'` view in `DeckGLMap.ts` `VIEW_PRESETS`, `GlobeMap.ts` `VIEW_POVS` and `Map.ts` `viewSettings`.
- Pakistan news: category `pakistan` in `FULL_FEEDS` (`src/config/feeds.ts`) and in `VARIANT_FEEDS.full` (`server/worldmonitor/news/v1/_feeds.ts`).
- Markets: `src/components/PakistanMarketsPanel.ts` + `api/pk-kse100.js`.
- Air quality: `src/components/PakistanAirPanel.ts`.
- AI brief: `src/components/PakistanBriefPanel.ts` + `api/pk-brief.ts`.
- Shared helpers: `src/services/pakistan-desk.ts`. Styles: `src/styles/pakistan.css`. Tests: `tests/pakistan-desk.test.mts`.

**Panel pattern** (copy `src/components/PakistanAirPanel.ts`):
- Extend `Panel` with `super({ id, title, infoTooltip })` and call `this.showLoading()`.
- Poll with `startSmartPollLoop(() => this.refresh(), { intervalMs, runImmediately: true, pauseWhenHidden: true })`.
- Render only through `this.setSafeContent(safeHtml\`…\`)`. Never write `innerHTML`; `npm run lint:safe-html` enforces this. Build links with `safeUrlAttr(url)`.
- Errors go through `this.showError(message, () => this.loop.trigger())`.
- Skip rendering when `this.signal.aborted`, and stop the loop in `destroy()`.

**Panel registration** (Task 0 does this for every new panel today):
- `src/config/panels.ts`: an entry in `WORLD_PANELS`, plus the panel id in `PAKISTAN_DEFAULT_ON`.
- `src/app/panel-layout.ts`: a `lazyDefaultPanel(...)` or `lazyImportedPanel(...)` call in the "Pakistan desk" block.

**API route pattern:** handlers are `export default async function handler(req): Response`.
- Model: `api/pk-kse100.js`: `getCorsHeaders` + `isDisallowedOrigin` from `./_cors.js`, `jsonResponse` from `./_json-response.js`, and an in-memory `lastGood`.
- Dev routing: the `routes` map inside `pakistanApiPlugin()` in `vite.config.ts`.
- Every new `api/` file also needs an entry in `api/api-route-exceptions.json`, checked by `npm run lint:api-contract`.

**News pipeline:**
- Most news comes from the server digest `/api/news/v1/list-feed-digest?variant=full`, built from `VARIANT_FEEDS.full`.
- A feed must appear in both `FULL_FEEDS` (client) and `VARIANT_FEEDS.full` (server). `tests/feeds-client-server-parity.test.mjs` checks this.
- Its domain must be in all three allowlist mirrors. `tests/edge-functions.test.mjs` checks this.
- Its name must appear in `DEFAULT_ENABLED_SOURCES[category]`, or it stays disabled by default.

**Map data flow:**
- `src/app/data-loader.ts` calls `fetchEarthquakes()` and `fetchNaturalEvents()`, then `this.ctx.map?.setEarthquakes(...)` and `setNaturalEvents(...)`, around lines 3170-3200.
- News clusters that have `lat`/`lon` become markers through `this.ctx.map?.setNewsLocations(...)`, around data-loader line 2269.
- Digest items carry no coordinates today: the server sends `locationName: ''`. See `src/services/news-digest-items.ts`.
- `tokenizeForMatch` (`src/utils/keyword-match.ts`) drops non-Latin script, so Urdu titles never match `geo-hub-index.ts`.

**Verified sources (2026-10-16):**

| Source | URL | Browser-direct (CORS) |
|---|---|---|
| USGS quakes | `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&…` | yes (`*`) |
| NASA EONET | `https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=30&bbox=minLon,maxLat,maxLon,minLat` | yes |
| GDACS | `https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP?eventtype=FL` (also TC, DR, WF, EQ) | yes |
| Open-Meteo forecast | `https://api.open-meteo.com/v1/forecast?latitude=a,b&longitude=c,d&daily=…&hourly=visibility` | yes |
| PSX indices | `https://dps.psx.com.pk/indices` (codes KSE100, KSE30, ALLSHR, KMI30, BKTI, OGTI…) | no → `api/pk-kse100.js` |
| forex.pk gold | `https://www.forex.pk/bullion-rates-gold-xau-pkr.php` | no → `api/pk-gold.js` |
| Urdu RSS | BBC Urdu, Independent Urdu, Express (express.pk), Jang, Dawn News | no → `/api/rss-proxy` |
| geoBoundaries PAK | ADM1 (7 units, public domain), ADM2 (126 districts, public domain) | GitHub raw |
| Wikidata SPARQL | 175 districts and 57+ cities with Urdu labels | build-time only |

---

## 3. Task 0: Baseline, scaffolding, worktree (Claude, before Gemini starts)

**Files:**
- Modify: `tests/accuracy-corpus.test.mjs`, `tests/feed-catalog-drift.test.mts` (only if they fail, as described)
- Modify: `src/config/panels.ts`, `src/app/panel-layout.ts`, `src/services/pakistan-desk.ts`, `src/main.ts`, `vite.config.ts`, `api/api-route-exceptions.json`, `tests/pakistan-desk.test.mts`
- Create: `src/components/PakistanWeatherPanel.ts`, `PakistanDisastersPanel.ts`, `PakistanIncidentsPanel.ts`, `PakistanDistrictPanel.ts` (stubs)
- Create: `api/pk-gold.js` (stub), `src/styles/pakistan-b.css`, `tests/pakistan-track-b.test.mts`
- Create: `docs/superpowers/plans/status-track-a.md`, `status-track-b.md`

**Interfaces produced:**
- Panel ids: `pk-weather`, `pk-disasters`, `pk-incidents`, `pk-district`, `urdu`
- `PakistanIncidentsPanel(getNews: () => NewsItem[], focusMap: (lat: number, lon: number) => void)`
- `PakistanDistrictPanel(getNews: () => NewsItem[])`, with a public `showDistrict(name: string): void`
- `Kse100Quote.indices?: PsxIndexQuote[]`, where `PsxIndexQuote = { code; value; change; changePct }`
- Dev route `/api/pk-gold` → `api/pk-gold.js`

- [ ] **Step 0.1: Remove leftovers from yesterday's test run**

```bash
git checkout -- public/llms.txt pro-test/src/generated/tiers.json
rm -rf tmp-direct-news-feed-pack-test tmp-source-provenance-uniformity-test scripts/fixtures/_bundle-fixture-fast.mjs
git worktree list   # note the path of the half-made "pm-baseline" worktree
git worktree unlock "<pm-baseline path>"; git worktree remove --force "<pm-baseline path>"; git worktree prune
git status --short  # only Phase 2 files should remain
```

- [ ] **Step 0.2: Run the upstream suites touched by Phase 2, and repair expectations that encode World Monitor product content**

```bash
node scripts/run-data-tests.mjs tests/accuracy-corpus.test.mjs tests/feed-catalog-drift.test.mts tests/feeds-client-server-parity.test.mjs tests/edge-functions.test.mjs tests/geo-coverage-health.test.mts tests/news-feed-key-parity.test.mts tests/news-panel-key-reachability.test.mts tests/panel-config-guardrails.test.mjs tests/deploy-config.test.mjs tests/variant-inline-bootstrap.test.mjs tests/live-video-catalog.test.mts tests/pakistan-desk.test.mts
```

Repair rule: fix a test only when it pins World Monitor content that we changed on purpose, and leave a one-line comment saying so. If a failure shows a real bug, fix the code instead. Two failures are expected:
- `tests/accuracy-corpus.test.mjs`: delete the `assert.match(read('src/app/panel-layout.ts'), /\{ label: 'Accuracy', path: '\/accuracy\/' \}/, …)` block. Add the comment `// Pakistan Monitor removed the World Monitor corpus links from the dashboard footer.`
- `tests/feed-catalog-drift.test.mts`: the curated entries for `Dawn` and `Geo News` may say `category: 'asia'`. Change them to `category: 'pakistan'`, because Phase 2 moved those feeds on purpose.
- If a suite reports a missing source tier, source type or provenance entry for the seven Phase 2 Pakistani feeds, add entries for those names, following the existing `Dawn` entries in `shared/source-tiers.json` (and its byte-identical mirror `scripts/shared/source-tiers.json`) and `shared/source-provenance-declarations.ts`.

- [ ] **Step 0.3: Commit the Phase 2 baseline**

```bash
git add api/ docs/superpowers/plans/2026-10-16-pakistan-monitor-day1-parallel.md scripts/shared/ server/ shared/ src/ tests/ vite.config.ts
git status --short   # nothing unexpected staged
git commit -m "feat: Pakistan Monitor phase 2 (map, news, markets, air quality, AI brief, rebrand)"
```

- [ ] **Step 0.4: Register the new panels in `src/config/panels.ts`**

In `WORLD_PANELS`, replace the block from `map:` to the `'pk-air'` line with:

```ts
  map: { name: 'Pakistan Map', enabled: true, priority: 1 },
  pakistan: { name: 'Pakistan', enabled: true, priority: 1 },
  urdu: { name: 'Urdu News', enabled: true, priority: 1 },
  'pk-brief': { name: 'AI Brief', enabled: true, priority: 1 },
  'pk-incidents': { name: 'Incidents', enabled: true, priority: 1 },
  'pk-markets': { name: 'Markets & Rupee', enabled: true, priority: 1 },
  'pk-air': { name: 'Air Quality', enabled: true, priority: 1 },
  'pk-weather': { name: 'Weather Warnings', enabled: true, priority: 1 },
  'pk-disasters': { name: 'Disasters', enabled: true, priority: 1 },
  'pk-district': { name: 'District', enabled: true, priority: 1 },
```

Replace `PAKISTAN_DEFAULT_ON` with:

```ts
const PAKISTAN_DEFAULT_ON = new Set([
  'map', 'pakistan', 'urdu', 'pk-brief', 'pk-incidents', 'pk-markets', 'pk-air',
  'pk-weather', 'pk-disasters', 'pk-district', 'live-news',
  'politics', 'asia', 'middleeast', 'energy', 'monitors',
]);
```

- [ ] **Step 0.5: Register the panel classes in `src/app/panel-layout.ts`**

Replace the "Pakistan desk" block (it starts at the comment `// Pakistan desk.`) with:

```ts
    // Pakistan desk. The `pakistan` and `urdu` news panels come from the
    // CANONICAL_FEEDS loop below; these panels read what those loaded.
    const allNews = (): import('@/types').NewsItem[] => Object.values(this.ctx.newsByCategory).flat();
    this.lazyImportedPanel('pk-brief', () => import('@/components/PakistanBriefPanel'), 'PakistanBriefPanel',
      (PakistanBriefPanel) => new PakistanBriefPanel(() => this.ctx.newsByCategory['pakistan'] ?? []));
    this.lazyDefaultPanel('pk-markets', () => import('@/components/PakistanMarketsPanel'), 'PakistanMarketsPanel');
    this.lazyDefaultPanel('pk-air', () => import('@/components/PakistanAirPanel'), 'PakistanAirPanel');
    this.lazyDefaultPanel('pk-weather', () => import('@/components/PakistanWeatherPanel'), 'PakistanWeatherPanel');
    this.lazyDefaultPanel('pk-disasters', () => import('@/components/PakistanDisastersPanel'), 'PakistanDisastersPanel');
    this.lazyImportedPanel('pk-incidents', () => import('@/components/PakistanIncidentsPanel'), 'PakistanIncidentsPanel',
      (PakistanIncidentsPanel) => new PakistanIncidentsPanel(allNews, (lat, lon) => this.ctx.map?.setCenter(lat, lon, 8)));
    this.lazyImportedPanel('pk-district', () => import('@/components/PakistanDistrictPanel'), 'PakistanDistrictPanel',
      (PakistanDistrictPanel) => new PakistanDistrictPanel(allNews));
```

- [ ] **Step 0.6: Create the four panel stubs**

`src/components/PakistanWeatherPanel.ts` (Track B replaces it in B3):

```ts
import { Panel } from './Panel';

// Stub registered by Task 0; Track B implements it in B3.
export class PakistanWeatherPanel extends Panel {
  constructor() {
    super({ id: 'pk-weather', title: 'Weather Warnings' });
    this.showLoading('Coming soon');
  }
}
```

`src/components/PakistanDisastersPanel.ts` (Track B replaces it in B4):

```ts
import { Panel } from './Panel';

// Stub registered by Task 0; Track B implements it in B4.
export class PakistanDisastersPanel extends Panel {
  constructor() {
    super({ id: 'pk-disasters', title: 'Disasters' });
    this.showLoading('Coming soon');
  }
}
```

`src/components/PakistanIncidentsPanel.ts` (Track A replaces it in A4):

```ts
import { Panel } from './Panel';
import type { NewsItem } from '@/types';

// Stub registered by Task 0; Track A implements it in A4.
export class PakistanIncidentsPanel extends Panel {
  constructor(_getNews: () => NewsItem[], _focusMap: (lat: number, lon: number) => void) {
    super({ id: 'pk-incidents', title: 'Incidents' });
    this.showLoading('Coming soon');
  }
}
```

`src/components/PakistanDistrictPanel.ts` (Track A replaces it in A3):

```ts
import { Panel } from './Panel';
import type { NewsItem } from '@/types';

// Stub registered by Task 0; Track A implements it in A3.
export class PakistanDistrictPanel extends Panel {
  constructor(_getNews: () => NewsItem[]) {
    super({ id: 'pk-district', title: 'District' });
    this.showLoading('Coming soon');
  }

  public showDistrict(_name: string): void {}
}
```

- [ ] **Step 0.7: Pre-register the gold route, so Track B never edits Track A files**

Create `api/pk-gold.js`:

```js
import { getCorsHeaders } from './_cors.js';
import { jsonResponse } from './_json-response.js';

export const config = { runtime: 'edge' };

// Stub registered by Task 0; Track B implements it in B6.
export default async function handler(req) {
  return jsonResponse({ error: 'Not implemented yet' }, 501, getCorsHeaders(req));
}
```

In `vite.config.ts`, inside `pakistanApiPlugin()`, add a line to `routes`:

```ts
    '/api/pk-gold': () => import('./api/pk-gold.js') as Promise<EdgeHandlerModule>,
```

In `api/api-route-exceptions.json`, add after the `api/pk-brief.ts` entry:

```json
    {
      "path": "api/pk-gold.js",
      "category": "upstream-proxy",
      "reason": "Pakistan Monitor: reads the per-tola gold row from forex.pk (no CORS, no JSON API) and serves the last good value marked stale on failure.",
      "owner": "@pakistan-monitor",
      "removal_issue": null
    },
```

- [ ] **Step 0.8: Pre-declare the PSX indices type in `src/services/pakistan-desk.ts`**

Replace the `Kse100Quote` interface with:

```ts
export interface PsxIndexQuote {
  code: string;
  value: number;
  change: number;
  changePct: number;
}

export interface Kse100Quote {
  value: number;
  change: number;
  changePct: number;
  asOf: string | null;
  fetchedAt: string;
  stale: boolean;
  /** Filled by api/pk-kse100.js once Track B's B5 lands. */
  indices?: PsxIndexQuote[];
}
```

- [ ] **Step 0.9: Give Track B its own stylesheet and test file**

Create `src/styles/pakistan-b.css`:

```css
/* Pakistan Monitor, Track B panels. Unlayered, like pakistan.css. */
```

In `src/main.ts`, add the line `import './styles/pakistan-b.css';` right after `import './styles/pakistan.css';`.

Then move the three `parseKse100` tests (`describe('parseKse100', …)` with `KSE100_ROW`, `KSE100PR_ROW` and `page`) out of `tests/pakistan-desk.test.mts` into a new `tests/pakistan-track-b.test.mts` that starts with:

```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseKse100 } from '../api/pk-kse100.js';
```

Remove `parseKse100` from the imports of `tests/pakistan-desk.test.mts`.

- [ ] **Step 0.10: Create the status files**

`docs/superpowers/plans/status-track-a.md`:

```markdown
# Track A (Claude) status

| Task | State | Commit | Note |
|---|---|---|---|

## Needs from the other track
```

`docs/superpowers/plans/status-track-b.md`: the same, titled `# Track B (Gemini) status`.

- [ ] **Step 0.11: Verify the scaffold, then commit**

```bash
npx tsc --noEmit && npx tsc --noEmit -p tsconfig.api.json && npm run lint:boundaries && npm run lint:api-contract
node scripts/run-data-tests.mjs tests/pakistan-desk.test.mts tests/pakistan-track-b.test.mts
git add src/config/panels.ts src/app/panel-layout.ts src/components/PakistanWeatherPanel.ts src/components/PakistanDisastersPanel.ts src/components/PakistanIncidentsPanel.ts src/components/PakistanDistrictPanel.ts api/pk-gold.js vite.config.ts api/api-route-exceptions.json src/services/pakistan-desk.ts src/styles/pakistan-b.css src/main.ts tests/pakistan-desk.test.mts tests/pakistan-track-b.test.mts docs/superpowers/plans/status-track-a.md docs/superpowers/plans/status-track-b.md
git commit -m "chore: scaffold Day-1 parallel tracks"
```

Expected: everything passes. In the browser, the five new panels show "Coming soon", except Urdu News, which has no feeds until B1.

- [ ] **Step 0.12: Create the branches and Gemini's worktree**

```bash
git switch -c pm/track-a
git branch pm/track-b
git worktree add "../Pakistan Monitor Gemini" pm/track-b
cp .env.local "../Pakistan Monitor Gemini/.env.local"
(cd "../Pakistan Monitor Gemini" && npm install)
```

Then tell the user: "Task 0 is done. Open Gemini in `Desktop\Pakistan Monitor Gemini` and paste the start prompt from §0."

---

## 4. Track A (Claude)

### Task A1: Earthquakes and natural events without Redis

The map's `natural` layer is already wired to `setEarthquakes` and `setNaturalEvents`. Both services read RPCs backed by a Redis seed we don't run, so the layer stays empty. Add a direct public fallback.

**Files:**
- Create: `src/services/pk-public-sources.ts`
- Modify: `src/services/earthquakes.ts` (`fetchEarthquakes`), `src/services/eonet.ts` (`fetchNaturalEvents`)
- Test: `tests/pakistan-desk.test.mts`

**Interfaces produced:**
- `usgsRegionUrl(days?: number, minMagnitude?: number, now?: number): string`
- `usgsToEarthquakes(body: unknown): Earthquake[]`
- `eonetRegionUrl(days?: number): string`
- `eonetToMapEvents(body: unknown): EonetMapEvent[]`

- [ ] **Step 1: Write the failing tests** (append to `tests/pakistan-desk.test.mts`, and add the import line at the top):

```ts
import { eonetToMapEvents, usgsRegionUrl, usgsToEarthquakes } from '../src/services/pk-public-sources';

describe('usgsToEarthquakes', () => {
  it('maps GeoJSON features and skips malformed ones', () => {
    const quakes = usgsToEarthquakes({ features: [
      { id: 'us7000abcd', properties: { mag: 4.8, place: '45 km SW of Quetta, Pakistan', time: 1792000000000, url: 'https://earthquake.usgs.gov/earthquakes/eventpage/us7000abcd' }, geometry: { coordinates: [66.7, 29.9, 10] } },
      { id: 'no-magnitude', properties: { mag: null }, geometry: { coordinates: [66, 29, 5] } },
    ] });
    assert.equal(quakes.length, 1);
    assert.deepEqual(quakes[0]?.location, { latitude: 29.9, longitude: 66.7 });
    assert.equal(quakes[0]?.depthKm, 10);
    assert.equal(quakes[0]?.source, 'usgs');
  });

  it('asks for the last N days around Pakistan', () => {
    const url = new URL(usgsRegionUrl(7, 2.5, Date.parse('2026-10-16T00:00:00Z')));
    assert.equal(url.searchParams.get('starttime'), '2026-10-09');
    assert.equal(url.searchParams.get('minlatitude'), '20');
    assert.equal(url.searchParams.get('maxlongitude'), '82');
  });
});

describe('eonetToMapEvents', () => {
  it('keeps point events with their latest position and skips polygons', () => {
    const events = eonetToMapEvents({ events: [
      { id: 'EONET_1', title: 'Wildfire near Quetta', categories: [{ id: 'wildfires', title: 'Wildfires' }], sources: [{ url: 'https://example.org/1' }],
        geometry: [{ date: '2026-10-14T00:00:00Z', coordinates: [66.9, 30.1] }, { date: '2026-10-15T00:00:00Z', coordinates: [67.0, 30.2] }] },
      { id: 'EONET_2', title: 'Ice', categories: [{ id: 'seaLakeIce', title: 'Sea and Lake Ice' }], geometry: [{ date: '2026-10-15T00:00:00Z', coordinates: [[[1, 2], [3, 4]]] }] },
    ] });
    assert.equal(events.length, 1);
    assert.deepEqual([events[0]?.lat, events[0]?.lon, events[0]?.category], [30.2, 67.0, 'wildfires']);
    assert.equal(events[0]?.date, Date.parse('2026-10-15T00:00:00Z'));
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node scripts/run-data-tests.mjs tests/pakistan-desk.test.mts`
Expected: FAIL, "Cannot find module … pk-public-sources".

- [ ] **Step 3: Create `src/services/pk-public-sources.ts`**

```ts
/**
 * Keyless, CORS-open public sources used when the upstream Redis-seeded RPCs
 * return nothing (Pakistan Monitor runs without that pipeline). Pure mappers
 * with no browser globals, so tests import this file directly.
 */
import type { Earthquake } from '@/generated/client/worldmonitor/seismology/v1/service_client';

/** Pakistan and its neighbourhood: Afghanistan, eastern Iran, north India, the Arabian Sea. */
export const PK_REGION_BBOX = { minLat: 20, maxLat: 42, minLon: 55, maxLon: 82 } as const;

export function usgsRegionUrl(days = 7, minMagnitude = 2.5, now = Date.now()): string {
  const { minLat, maxLat, minLon, maxLon } = PK_REGION_BBOX;
  const params = new URLSearchParams({
    format: 'geojson',
    orderby: 'time',
    limit: '300',
    minmagnitude: String(minMagnitude),
    starttime: new Date(now - days * 86_400_000).toISOString().slice(0, 10),
    minlatitude: String(minLat),
    maxlatitude: String(maxLat),
    minlongitude: String(minLon),
    maxlongitude: String(maxLon),
  });
  return `https://earthquake.usgs.gov/fdsnws/event/1/query?${params}`;
}

export function usgsToEarthquakes(body: unknown): Earthquake[] {
  const features = (body as { features?: unknown[] } | null)?.features;
  if (!Array.isArray(features)) return [];
  return features.flatMap((raw) => {
    const f = raw as { id?: string; properties?: { mag?: unknown; place?: unknown; time?: unknown; url?: unknown }; geometry?: { coordinates?: unknown[] } };
    const [lon, lat, depth] = f.geometry?.coordinates ?? [];
    const magnitude = f.properties?.mag;
    if (!f.id || typeof lat !== 'number' || typeof lon !== 'number' || typeof magnitude !== 'number') return [];
    return [{
      id: f.id,
      place: typeof f.properties?.place === 'string' ? f.properties.place : '',
      magnitude,
      depthKm: typeof depth === 'number' ? depth : 0,
      location: { latitude: lat, longitude: lon },
      occurredAt: typeof f.properties?.time === 'number' ? f.properties.time : 0,
      sourceUrl: typeof f.properties?.url === 'string' ? f.properties.url : '',
      source: 'usgs',
      category: 'earthquake',
    }];
  });
}

export function eonetRegionUrl(days = 30): string {
  const { minLat, maxLat, minLon, maxLon } = PK_REGION_BBOX;
  // EONET's bbox order is minLon,maxLat,maxLon,minLat.
  return `https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=${days}&bbox=${minLon},${maxLat},${maxLon},${minLat}`;
}

/** The fields eonet.ts `toNaturalEvent` needs. */
export interface EonetMapEvent {
  id: string;
  title: string;
  category: string;
  categoryTitle: string;
  lat: number;
  lon: number;
  date: number;
  closed: boolean;
  sourceUrl: string;
}

export function eonetToMapEvents(body: unknown): EonetMapEvent[] {
  const events = (body as { events?: unknown[] } | null)?.events;
  if (!Array.isArray(events)) return [];
  return events.flatMap((raw) => {
    const e = raw as {
      id?: string; title?: string;
      categories?: Array<{ id?: string; title?: string }>;
      geometry?: Array<{ date?: string; coordinates?: unknown }>;
      sources?: Array<{ url?: string }>;
    };
    const latest = e.geometry?.[e.geometry.length - 1];
    const category = e.categories?.[0];
    const coords = Array.isArray(latest?.coordinates) ? (latest.coordinates as unknown[]) : [];
    const [lon, lat] = coords;
    if (!e.id || !e.title || !category?.id || typeof lat !== 'number' || typeof lon !== 'number') return [];
    return [{
      id: e.id,
      title: e.title,
      category: category.id,
      categoryTitle: category.title ?? category.id,
      lat,
      lon,
      date: Date.parse(latest?.date ?? '') || 0,
      closed: false,
      sourceUrl: e.sources?.[0]?.url ?? '',
    }];
  });
}
```

- [ ] **Step 4: Run the tests again**

Run: `node scripts/run-data-tests.mjs tests/pakistan-desk.test.mts`
Expected: PASS.

- [ ] **Step 5: Use the fallback in `src/services/earthquakes.ts`**

Add the import `import { usgsRegionUrl, usgsToEarthquakes } from '@/services/pk-public-sources';`. Then replace the last line of `fetchEarthquakes` (`return response.earthquakes as Earthquake[];`) with:

```ts
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
```

The function's existing closing `}` now closes `fetchUsgsFallback`. Check the braces.

- [ ] **Step 6: Use the fallback in `src/services/eonet.ts`**

Add the import `import { eonetRegionUrl, eonetToMapEvents } from '@/services/pk-public-sources';`. Then replace the last line of `fetchNaturalEvents` (`return (response.events || []).map(toNaturalEvent);`) with:

```ts
  if (response.events?.length) return response.events.map(toNaturalEvent);
  // Pakistan Monitor: no Redis seed behind the RPC, so read NASA EONET directly.
  try {
    const res = await fetch(eonetRegionUrl(), { credentials: 'omit' });
    return res.ok ? eonetToMapEvents(await res.json()).map(toNaturalEvent) : [];
  } catch {
    return [];
  }
```

- [ ] **Step 7: Verify in the browser.** Typecheck, open `http://localhost:3000/`, and make sure the "Natural events" layer is on in the Layers list. Recent quakes around Pakistan should show as red dots, and clicking one opens its popup. If USGS has nothing, set `minMagnitude` to 1.5 temporarily, confirm, then revert.

- [ ] **Step 8: Commit**

```bash
git add src/services/pk-public-sources.ts src/services/earthquakes.ts src/services/eonet.ts tests/pakistan-desk.test.mts
git commit -m "track-a: A1 USGS and EONET fallbacks for the natural layer"
```

### Task A2: Pakistan gazetteer (headlines get coordinates)

**Files:**
- Create: `scripts/pk/build-gazetteer.mjs`, `src/data/pk-gazetteer.ts` (generated), `src/services/pk-gazetteer.ts`
- Modify: `src/services/news-digest-items.ts` (`protoItemToNewsItem`), `src/services/rss.ts` (around line 354)
- Test: `tests/pakistan-desk.test.mts`

**Interfaces produced:**
- `PkPlace { id; kind: 'city' | 'district' | 'province'; name; nameUr; province; lat; lon }`
- `PK_PLACES: readonly PkPlace[]`
- `locatePakistan(title: string, opts?: { pakistaniSource?: boolean }): PkPlace | null`
- `findDistrict(name: string): PkPlace | undefined`
- `mentionsPlace(title: string, place: PkPlace): boolean`
- `PAKISTANI_SOURCE_NAMES: ReadonlySet<string>`

- [ ] **Step 1: Create `scripts/pk/build-gazetteer.mjs`**

```js
#!/usr/bin/env node
// Builds src/data/pk-gazetteer.ts: Pakistan's provinces, districts and cities
// over 100k people, with English and Urdu names and coordinates.
// Sources: Wikidata (CC0) for names and points; geoBoundaries ADM1 (public
// domain) for province membership (point-in-polygon) and province centroids.
// Run: node scripts/pk/build-gazetteer.mjs
import { writeFileSync } from 'node:fs';

const UA = 'PakistanMonitor/1.0 (gazetteer build)';
const ADM1_URL = 'https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/PAK/ADM1/geoBoundaries-PAK-ADM1_simplified.geojson';
const PROVINCE_UR = {
  Punjab: 'پنجاب', Sindh: 'سندھ', 'Khyber Pakhtunkhwa': 'خیبر پختونخوا', Balochistan: 'بلوچستان',
  'Gilgit-Baltistan': 'گلگت بلتستان', 'Azad Kashmir': 'آزاد کشمیر', Islamabad: 'اسلام آباد',
};
const DISTRICTS = `SELECT ?item ?en ?ur ?coord WHERE {
  ?type rdfs:label "district of Pakistan"@en . ?item wdt:P31 ?type ; wdt:P625 ?coord .
  OPTIONAL { ?item rdfs:label ?en FILTER(lang(?en)="en") }
  OPTIONAL { ?item rdfs:label ?ur FILTER(lang(?ur)="ur") } }`;
const CITIES = `SELECT ?item ?en ?ur ?coord WHERE {
  ?item wdt:P17 wd:Q843 ; wdt:P31/wdt:P279* wd:Q515 ; wdt:P1082 ?pop ; wdt:P625 ?coord . FILTER(?pop > 100000)
  OPTIONAL { ?item rdfs:label ?en FILTER(lang(?en)="en") }
  OPTIONAL { ?item rdfs:label ?ur FILTER(lang(?ur)="ur") } }`;

async function sparql(query) {
  const res = await fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}`, {
    headers: { Accept: 'application/sparql-results+json', 'User-Agent': UA },
  });
  if (!res.ok) throw new Error(`Wikidata HTTP ${res.status}`);
  return (await res.json()).results.bindings;
}

const parsePoint = (wkt) => {
  const m = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(wkt);
  return m ? { lon: Number(m[1]), lat: Number(m[2]) } : null;
};

function inRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const polygonsOf = (f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates);
const provinceAt = (lon, lat, adm1) =>
  adm1.features.find((f) => polygonsOf(f).some((poly) => inRing(lon, lat, poly[0])))?.properties.shapeName ?? '';
const round = (n) => Math.round(n * 1e4) / 1e4;
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const adm1 = await (await fetch(ADM1_URL, { headers: { 'User-Agent': UA } })).json();
const places = new Map();

for (const f of adm1.features) {
  const ring = polygonsOf(f).flat(1).flat(1);
  const lons = ring.map((c) => c[0]);
  const lats = ring.map((c) => c[1]);
  const name = f.properties.shapeName;
  places.set(`province:${slug(name)}`, {
    id: `province:${slug(name)}`, kind: 'province', name, nameUr: PROVINCE_UR[name] ?? '', province: name,
    lat: round((Math.min(...lats) + Math.max(...lats)) / 2), lon: round((Math.min(...lons) + Math.max(...lons)) / 2),
  });
}

for (const [kind, rows] of [['city', await sparql(CITIES)], ['district', await sparql(DISTRICTS)]]) {
  for (const b of rows) {
    const point = parsePoint(b.coord.value);
    const en = b.en?.value;
    if (!point || !en) continue;
    const name = kind === 'district' ? en.replace(/\s+District$/i, '') : en;
    const id = `${kind}:${slug(name)}`;
    const province = provinceAt(point.lon, point.lat, adm1);
    if (places.has(id) || !province) continue; // no province = coordinates outside Pakistan's polygons
    places.set(id, {
      id, kind, name, nameUr: (b.ur?.value ?? '').replace(/^ضلع\s+/, ''), province,
      lat: round(point.lat), lon: round(point.lon),
    });
  }
}

const list = [...places.values()].sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(new URL('../../src/data/pk-gazetteer.ts', import.meta.url), `// Generated by scripts/pk/build-gazetteer.mjs from Wikidata (CC0) and geoBoundaries ADM1
// (public domain). Do not edit by hand; re-run the script.

export interface PkPlace {
  id: string;
  kind: 'city' | 'district' | 'province';
  name: string;
  nameUr: string;
  province: string;
  lat: number;
  lon: number;
}

export const PK_PLACES: readonly PkPlace[] = ${JSON.stringify(list, null, 2)};
`);
console.log(`wrote ${list.length} places`);
```

- [ ] **Step 2: Generate the data.** Run `node scripts/pk/build-gazetteer.mjs`. Expect about 250 places. Spot-check `src/data/pk-gazetteer.ts`: `city:karachi` should be in `Sindh` with nameUr `کراچی`, and `district:quetta` in `Balochistan`.

- [ ] **Step 3: Write the failing tests** (append to `tests/pakistan-desk.test.mts`):

```ts
import { findDistrict, locatePakistan } from '../src/services/pk-gazetteer';

describe('locatePakistan', () => {
  it('finds English and Urdu place names', () => {
    assert.equal(locatePakistan('Blast in Quetta kills five')?.name, 'Quetta');
    assert.equal(locatePakistan('کراچی میں موسلا دھار بارش')?.name, 'Karachi');
  });

  it('reads "Khyber Pakhtunkhwa" as the province, not Khyber district', () => {
    assert.equal(locatePakistan('Khyber Pakhtunkhwa cabinet approves budget')?.kind, 'province');
  });

  it('needs Pakistani context for ambiguous names', () => {
    assert.equal(locatePakistan('SWAT team storms a building in Texas'), null);
    assert.equal(locatePakistan('Hyderabad startup raises funds'), null);
    assert.equal(locatePakistan('Floods hit Swat valley', { pakistaniSource: true })?.kind, 'district');
  });

  it('does not read the Urdu word for "late" as a place', () => {
    assert.equal(locatePakistan('پروازیں دیر سے روانہ ہوئیں'), null);
  });

  it('finds districts by geoBoundaries spelling', () => {
    assert.equal(findDistrict('Quetta')?.province, 'Balochistan');
  });
});
```

- [ ] **Step 4: Run and watch them fail.** Run `node scripts/run-data-tests.mjs tests/pakistan-desk.test.mts`. Expected: FAIL, missing module.

- [ ] **Step 5: Create `src/services/pk-gazetteer.ts`**

```ts
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
```

- [ ] **Step 6: Run the tests.** Run `node scripts/run-data-tests.mjs tests/pakistan-desk.test.mts`. Expected: PASS. If a name assertion fails because Wikidata spells a place differently (for example "Swat" against "Swat Valley"), fix the expectation to match the generated data, never the generated file.

- [ ] **Step 7: Give digest items coordinates, in `src/services/news-digest-items.ts`**

Add the import `import { locatePakistan, PAKISTANI_SOURCE_NAMES } from '@/services/pk-gazetteer';`. In `protoItemToNewsItem`, first add `const place = p.location ? null : locatePakistan(p.title, { pakistaniSource: PAKISTANI_SOURCE_NAMES.has(p.source) });`, then replace the two location lines:

```ts
    ...(p.locationName && { locationName: p.locationName }),
    ...(p.location && { lat: p.location.latitude, lon: p.location.longitude }),
```

with:

```ts
    ...(p.locationName && { locationName: p.locationName }),
    ...(p.location
      ? { lat: p.location.latitude, lon: p.location.longitude }
      : place && { lat: place.lat, lon: place.lon, locationName: place.name }),
```

- [ ] **Step 8: Do the same for directly fetched feeds in `src/services/rss.ts`.** Add the import `import { locatePakistan, PAKISTANI_SOURCE_NAMES } from './pk-gazetteer';`. After the line `const topGeo = geoMatches[0];` (around line 344), add:

```ts
      const pkPlace = locatePakistan(title, { pakistaniSource: PAKISTANI_SOURCE_NAMES.has(feed.name) });
```

Then replace the line `...(topGeo && { lat: topGeo.hub.lat, lon: topGeo.hub.lon, locationName: topGeo.hub.name }),` with:

```ts
        ...(pkPlace
          ? { lat: pkPlace.lat, lon: pkPlace.lon, locationName: pkPlace.name }
          : topGeo && { lat: topGeo.hub.lat, lon: topGeo.hub.lon, locationName: topGeo.hub.name }),
```

- [ ] **Step 9: Run the digest and clustering suites, then check the browser.** Run `ls tests | grep -i -E "digest-items|clustering|geo-hub"` and run those files. In the browser, Pakistani headlines should appear as news markers on Karachi, Lahore, Quetta and so on, rather than nowhere.

- [ ] **Step 10: Commit**

```bash
git add scripts/pk/build-gazetteer.mjs src/data/pk-gazetteer.ts src/services/pk-gazetteer.ts src/services/news-digest-items.ts src/services/rss.ts tests/pakistan-desk.test.mts
git commit -m "track-a: A2 Pakistan gazetteer puts Pakistani headlines on the map"
```

### Task A3: District boundaries and the District panel

**Files:**
- Create: `scripts/pk/fetch-boundaries.mjs`, `public/data/pk-districts.geojson`
- Modify: `src/components/DeckGLMap.ts`, `src/components/MapContainer.ts`, `src/app/panel-layout.ts`, `src/components/PakistanDistrictPanel.ts` (replace the stub), `src/services/pk-gazetteer.ts` (add `districtHeadlines`), `src/styles/pakistan.css`
- Test: `tests/pakistan-desk.test.mts`

**Interfaces:**
- Consumes: `findDistrict` and `mentionsPlace` from A2.
- Produces: `districtHeadlines(items: NewsItem[], districtName: string): NewsItem[]`, `MapContainer.onDistrictClicked(cb: (d: { name: string }) => void)`, `DeckGLMap.setOnDistrictClick(cb)`.

- [ ] **Step 1: Create `scripts/pk/fetch-boundaries.mjs`, then run it**

```js
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
```

Run `node scripts/pk/fetch-boundaries.mjs`. Expected output: "wrote 126 districts".

- [ ] **Step 2: Write the failing test for `districtHeadlines`**

```ts
import { districtHeadlines } from '../src/services/pk-gazetteer';

describe('districtHeadlines', () => {
  const item = (title: string, link: string, iso: string) =>
    ({ source: 'Dawn', title, link, pubDate: new Date(iso), isAlert: false }) as import('../src/types').NewsItem;

  it('keeps headlines naming the district, newest first, once each', () => {
    const items = [
      item('Rain lashes Quetta', 'a', '2026-10-15T08:00:00Z'),
      item('کوئٹہ میں سردی', 'b', '2026-10-15T09:00:00Z'),
      item('Rain lashes Quetta', 'a', '2026-10-15T08:00:00Z'),
      item('Lahore smog worsens', 'c', '2026-10-15T10:00:00Z'),
    ];
    assert.deepEqual(districtHeadlines(items, 'Quetta').map((i) => i.link), ['b', 'a']);
  });
});
```

(`کوئٹہ` must equal the generated `nameUr` for Quetta. Check `src/data/pk-gazetteer.ts` and adjust the test string if Wikidata spells it differently.)

- [ ] **Step 3: Add `districtHeadlines` to `src/services/pk-gazetteer.ts`**

```ts
import type { NewsItem } from '../types';

export function districtHeadlines(items: NewsItem[], districtName: string): NewsItem[] {
  const place = findDistrict(districtName);
  const seen = new Set<string>();
  return items
    .filter((item) => (place ? mentionsPlace(item.title, place) : item.title.toLowerCase().includes(districtName.toLowerCase())))
    .filter((item) => !seen.has(item.link) && Boolean(seen.add(item.link)))
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
}
```

Run the tests. Expected: PASS.

- [ ] **Step 4: Add the district layer to `src/components/DeckGLMap.ts`**

Add these fields next to `countriesGeoJsonData` (line ~686):

```ts
  private pkDistrictsGeoJson: FeatureCollection<Geometry> | null = null;
  private onDistrictClick?: (district: { name: string }) => void;
```

Add these methods next to the choropleth factories (around `createHappinessChoroplethLayer`):

```ts
  // Pakistan Monitor: district outlines, clickable everywhere inside Pakistan.
  private loadPakistanDistricts(): void {
    void fetch('/data/pk-districts.geojson')
      .then((res) => (res.ok ? res.json() : null))
      .then((geojson: FeatureCollection<Geometry> | null) => {
        if (!geojson || this.destroyed) return;
        this.pkDistrictsGeoJson = geojson;
        this.debouncedRebuildLayers();
      })
      .catch(() => { /* outlines are decoration; the map works without them */ });
  }

  private createPakistanDistrictsLayer(): GeoJsonLayer | null {
    if (!this.pkDistrictsGeoJson) return null;
    return new GeoJsonLayer({
      id: 'pk-districts-layer',
      data: this.pkDistrictsGeoJson,
      filled: true,
      stroked: true,
      pickable: true,
      autoHighlight: true,
      // Alpha 1 of 255: invisible, but every district stays clickable.
      getFillColor: [0, 0, 0, 1],
      highlightColor: [47, 191, 113, 70],
      getLineColor: [47, 191, 113, 120],
      getLineWidth: 1,
      lineWidthMinPixels: 0.6,
    });
  }

  public setOnDistrictClick(cb: (district: { name: string }) => void): void {
    this.onDistrictClick = cb;
  }
```

Wire it up in three places:
- Call `this.loadPakistanDistricts();` once, at the end of the constructor, after `this.debouncedRebuildLayers` is assigned.
- In `buildLayers()`, right after the day/night block (`if (mapLayers.dayNight) { … }`), add `const pkDistricts = this.createPakistanDistrictsLayer(); if (pkDistricts) layers.push(pkDistricts);`. Pushing it early keeps markers above it, so they still win clicks.
- In `handleClick()`, just before `if (layerId === 'news-locations-layer') {`, add:

```ts
    if (layerId === 'pk-districts-layer') {
      const name = (info.object as { properties?: { shapeName?: unknown } }).properties?.shapeName;
      if (typeof name === 'string') this.onDistrictClick?.({ name });
      return;
    }
```

- [ ] **Step 5: Forward the callback in `src/components/MapContainer.ts`**

Add the field `private cachedOnDistrictClicked: ((district: { name: string }) => void) | null = null;` next to `cachedOnCountryClicked`. Add this method next to `onCountryClicked`:

```ts
  public onDistrictClicked(callback: (district: { name: string }) => void): void {
    this.cachedOnDistrictClicked = callback;
    // Only the deck.gl renderer draws Pakistan's districts.
    if (this.useDeckGL) this.deckGLMap?.setOnDistrictClick(callback);
  }
```

In `rehydrateActiveMap()`, after the `cachedOnCountryClicked` line, add `if (this.cachedOnDistrictClicked) this.onDistrictClicked(this.cachedOnDistrictClicked);`.

- [ ] **Step 6: Wire it in `src/app/panel-layout.ts`**, right after `this.ctx.map.initEscalationGetters();`:

```ts
    this.ctx.map.onDistrictClicked(({ name }) => {
      (this.ctx.panels['pk-district'] as import('@/components/PakistanDistrictPanel').PakistanDistrictPanel | undefined)?.showDistrict(name);
    });
```

- [ ] **Step 7: Replace the stub in `src/components/PakistanDistrictPanel.ts`**

```ts
import { Panel } from './Panel';
import { joinSafeHtml, safeHtml, safeUrlAttr } from '@/utils/sanitize';
import { districtHeadlines, findDistrict } from '@/services/pk-gazetteer';
import { formatTime } from '@/services/pakistan-desk';
import type { NewsItem } from '@/types';

export class PakistanDistrictPanel extends Panel {
  constructor(private readonly getNews: () => NewsItem[]) {
    super({
      id: 'pk-district',
      title: 'District',
      infoTooltip: 'Click any district on the map to see the latest headlines that name it. Boundaries: geoBoundaries (public domain).',
    });
    this.setSafeContent(safeHtml`<div class="pk-note">Click a district on the map.</div>`);
  }

  public showDistrict(name: string): void {
    const place = findDistrict(name);
    const items = districtHeadlines(this.getNews(), name).slice(0, 12);
    const list = items.length
      ? joinSafeHtml(items.map((item) => safeHtml`<li><a href="${safeUrlAttr(item.link)}" target="_blank" rel="noopener">${item.title}</a> <span class="pk-note">${item.source} · ${formatTime(item.pubDate.toISOString())}</span></li>`))
      : safeHtml`<li class="pk-note">No loaded headline names ${name} right now.</li>`;
    this.setSafeContent(safeHtml`<div class="pk-district">
      <div class="pk-stat-label">${place?.province ?? 'Pakistan'}</div>
      <div class="pk-stat-value">${name}${place?.nameUr ? safeHtml` <span class="pk-urdu">${place.nameUr}</span>` : ''}</div>
      <ul class="pk-brief-list">${list}</ul>
    </div>`);
  }
}
```

Add to `src/styles/pakistan.css`:

```css
.pk-urdu { direction: rtl; unicode-bidi: isolate; font-size: 0.8em; color: var(--text-dim); }
```

- [ ] **Step 8: Verify, then commit.** Typecheck. Run `ls tests | grep -i -E "deckgl|map-container|map-layer"` and run those files. In the browser, district outlines appear; clicking Quetta fills the District panel; markers still open their popups.

```bash
git add scripts/pk/fetch-boundaries.mjs public/data/pk-districts.geojson src/components/DeckGLMap.ts src/components/MapContainer.ts src/app/panel-layout.ts src/components/PakistanDistrictPanel.ts src/services/pk-gazetteer.ts src/styles/pakistan.css tests/pakistan-desk.test.mts
git commit -m "track-a: A3 clickable district boundaries and District panel"
```

### Task A4: Incidents panel

Server-side keyword classification already sets `item.threat.category`. This task groups Pakistani incidents by province; the A2 coordinates already put them on the map.

**Files:**
- Create: `src/services/pk-incidents.ts`
- Modify: `src/components/PakistanIncidentsPanel.ts` (replace the stub), `src/styles/pakistan.css`
- Test: `tests/pakistan-desk.test.mts`

**Interfaces produced:** `PkIncident { item; place; category; level }`, `pakistanIncidents(items: NewsItem[]): PkIncident[]`, `countByProvince(incidents: PkIncident[]): Array<[string, number]>`

- [ ] **Step 1: Write the failing test**

```ts
import { countByProvince, pakistanIncidents } from '../src/services/pk-incidents';

describe('pakistanIncidents', () => {
  const item = (title: string, link: string, category: string) => ({
    source: 'Dawn', title, link, pubDate: new Date('2026-10-15T10:00:00Z'), isAlert: false,
    threat: { level: 'high', category, confidence: 0.8, source: 'keyword' },
  }) as import('../src/types').NewsItem;

  it('keeps located incident categories once each and counts them by province', () => {
    const incidents = pakistanIncidents([
      item('Blast in Quetta kills five', 'a', 'terrorism'),
      item('Blast in Quetta kills five', 'a', 'terrorism'),
      item('Protest in Lahore over prices', 'b', 'protest'),
      item('Cricket win in Lahore', 'c', 'general'),
      item('Blast in Kabul', 'd', 'terrorism'),
    ]);
    assert.deepEqual(incidents.map((i) => i.item.link), ['a', 'b']);
    assert.deepEqual(countByProvince(incidents), [['Balochistan', 1], ['Punjab', 1]]);
  });
});
```

- [ ] **Step 2: Create `src/services/pk-incidents.ts`**

```ts
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

export function countByProvince(incidents: PkIncident[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const i of incidents) counts.set(i.place.province, (counts.get(i.place.province) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
```

Run the tests. Expected: PASS.

- [ ] **Step 3: Replace the stub in `src/components/PakistanIncidentsPanel.ts`**

```ts
import { Panel } from './Panel';
import { joinSafeHtml, safeHtml, safeUrlAttr } from '@/utils/sanitize';
import { startSmartPollLoop, type SmartPollLoopHandle } from '@/services/smart-poll-loop';
import { countByProvince, pakistanIncidents, type PkIncident } from '@/services/pk-incidents';
import { formatTime } from '@/services/pakistan-desk';
import type { NewsItem } from '@/types';

export class PakistanIncidentsPanel extends Panel {
  private readonly loop: SmartPollLoopHandle;
  private lastKey = '';
  private incidents: PkIncident[] = [];

  constructor(private readonly getNews: () => NewsItem[], private readonly focusMap: (lat: number, lon: number) => void) {
    super({
      id: 'pk-incidents',
      title: 'Incidents',
      infoTooltip: 'Pakistani headlines classified as terrorism, conflict, protest, crime, disaster, infrastructure or health, placed with the Pakistan gazetteer. Keyword classification: check the source.',
    });
    this.showLoading('Waiting for headlines…');
    this.content.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-incident]');
      const incident = button ? this.incidents[Number(button.dataset.incident)] : undefined;
      if (incident) this.focusMap(incident.place.lat, incident.place.lon);
    });
    this.loop = startSmartPollLoop(() => this.refresh(), { intervalMs: 30_000, runImmediately: true, pauseWhenHidden: true });
  }

  private refresh(): void {
    const incidents = pakistanIncidents(this.getNews()).slice(0, 25);
    const key = incidents.map((i) => i.item.link).join('|');
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.incidents = incidents;
    this.setCount(incidents.length);
    if (incidents.length === 0) {
      this.setSafeContent(safeHtml`<div class="pk-note">No located incidents in the loaded Pakistani headlines.</div>`);
      return;
    }
    const provinces = joinSafeHtml(countByProvince(incidents).map(([name, n]) => safeHtml`<span><b>${name}</b> ${n}</span>`));
    const rows = joinSafeHtml(incidents.map((i, index) => safeHtml`<li class="pk-incident pk-level-${i.level}">
      <span class="pk-badge">${i.category}</span>
      <a href="${safeUrlAttr(i.item.link)}" target="_blank" rel="noopener">${i.item.title}</a>
      <span class="pk-note">${i.place.name} · ${i.item.source} · ${formatTime(i.item.pubDate.toISOString())}</span>
      <button type="button" class="pk-map-btn" data-incident="${String(index)}" aria-label="Show ${i.place.name} on the map">map</button>
    </li>`));
    this.setSafeContent(safeHtml`<div class="pk-cross">${provinces}</div><ul class="pk-brief-list">${rows}</ul>`);
  }

  public override destroy(): void {
    this.loop.stop();
    super.destroy();
  }
}
```

Add to `src/styles/pakistan.css`:

```css
.pk-incident { display: grid; gap: 2px; }
.pk-level-critical .pk-badge, .pk-level-high .pk-badge { color: var(--semantic-critical); }
.pk-map-btn { justify-self: start; padding: 0 6px; border: 1px solid var(--border); border-radius: 3px; background: none; color: var(--text-dim); font-size: 10px; cursor: pointer; }
.pk-map-btn:hover { color: var(--text); }
```

- [ ] **Step 4: Verify, then commit.** Typecheck, run the tests, and check the browser: incidents are listed, and the "map" button flies to the place.

```bash
git add src/services/pk-incidents.ts src/components/PakistanIncidentsPanel.ts src/styles/pakistan.css tests/pakistan-desk.test.mts
git commit -m "track-a: A4 Incidents panel grouped by province"
```

### Task A5 (stretch): Pakistan workspaces

**Files:** Modify `src/services/mission-presets.ts`. Test: the existing `tests/mission-presets.test.mts`, `tests/webmcp-mission-presets.test.mts`, `tests/mission-picker-reach.test.mts`, `tests/mission-preview-registry.test.mts`.

- [ ] **Step 1:** Run `grep -n "MissionPresetId\|MissionMapView" src/services/mission-presets.ts` and add `'pakistan'` to `MissionMapView`.
- [ ] **Step 2:** Prepend these four presets to `MISSION_PRESETS`. If `MissionPresetId` is a literal union, add the four ids to it.

```ts
  {
    id: 'pk-disaster-desk',
    label: 'Pakistan Disaster Desk',
    shortLabel: 'Disaster',
    description: 'Quakes, floods, heat and fog warnings, air quality and incidents across Pakistan.',
    icon: '!',
    view: 'pakistan',
    zoom: 4.5,
    timeRange: '24h',
    panels: ['map', 'pk-disasters', 'pk-weather', 'pk-air', 'pk-incidents', 'pakistan', 'urdu'],
    layers: ['natural', 'fires', 'weather'],
  },
  {
    id: 'pk-economy-desk',
    label: 'Pakistan Economy Desk',
    shortLabel: 'Economy',
    description: 'PSX indices, the rupee, energy news and the AI brief.',
    icon: '$',
    view: 'pakistan',
    zoom: 4.5,
    timeRange: '24h',
    panels: ['map', 'pk-markets', 'pakistan', 'pk-brief', 'energy'],
    layers: [],
  },
  {
    id: 'pk-security-desk',
    label: 'Pakistan Security Desk',
    shortLabel: 'Security',
    description: 'Incidents by province, district headlines, Pakistani and Urdu news, live TV.',
    icon: '◆',
    view: 'pakistan',
    zoom: 4.5,
    timeRange: '24h',
    panels: ['map', 'pk-incidents', 'pk-district', 'pakistan', 'urdu', 'live-news'],
    layers: ['hotspots', 'conflicts', 'protests'],
  },
  {
    id: 'pk-smog-desk',
    label: 'Pakistan Smog & Health Desk',
    shortLabel: 'Smog',
    description: 'City air quality, fog and heat warnings, and Pakistani headlines.',
    icon: '≋',
    view: 'pakistan',
    zoom: 4.5,
    timeRange: '24h',
    panels: ['map', 'pk-air', 'pk-weather', 'pakistan'],
    layers: ['fires', 'weather'],
  },
```

Every layer key above (`natural`, `fires`, `weather`, `hotspots`, `conflicts`, `protests`) exists in `MapLayers` (`src/types`). If typecheck rejects one, drop it from the list instead of adding a new layer.
- [ ] **Step 3:** Run the four suites listed above. Update any assertion that pins the upstream preset count or order, and leave a comment that Pakistan presets come first. Then commit as `track-a: A5 Pakistan workspaces`.

---

## 5. Track B (Gemini)

### Task B1: Urdu news panel

**Files:**
- Modify: `src/config/feeds.ts` (`FULL_FEEDS`, `DEFAULT_ENABLED_SOURCES`, `SOURCE_REGION_MAP`), `server/worldmonitor/news/v1/_feeds.ts` (`VARIANT_FEEDS.full`)
- Create: `scripts/pk/add-rss-domains.mjs`
- Modify: `shared/rss-allowed-domains.json`, `scripts/shared/rss-allowed-domains.json`, `api/_rss-allowed-domains.js` (through the script), `src/styles/pakistan-b.css`

**Interfaces produced:** feed category `urdu`, with the feed names from the shared contract in §0.

- [ ] **Step 1: Add the client feeds.** In `src/config/feeds.ts`, insert this right after the `pakistan: [ … ],` category in `FULL_FEEDS`:

```ts
  // Urdu-language desk. No `lang` tag on purpose: tagged feeds are hidden from
  // English-UI users by filterFeedsByLanguage.
  urdu: [
    { name: 'BBC Urdu', url: rss('https://feeds.bbci.co.uk/urdu/rss.xml') },
    { name: 'Independent Urdu', url: rss('https://www.independenturdu.com/rss.xml') },
    { name: 'Express Urdu', url: rss('https://www.express.pk/feed/') },
    { name: 'Jang', url: rss('https://jang.com.pk/rss/1/1') },
    { name: 'Dawn News Urdu', url: rss('https://www.dawnnews.tv/feeds/latest-news/') },
  ],
```

In `DEFAULT_ENABLED_SOURCES`, add after the `pakistan:` line:

```ts
  urdu: ['BBC Urdu', 'Independent Urdu', 'Express Urdu', 'Jang', 'Dawn News Urdu'],
```

In `SOURCE_REGION_MAP`, change the `asia` entry's `feedKeys` to `['pakistan', 'urdu', 'asia']`.

- [ ] **Step 2: Mirror the feeds on the server.** In `server/worldmonitor/news/v1/_feeds.ts`, insert this after the `pakistan: [ … ],` category of `VARIANT_FEEDS.full`:

```ts
    // Mirrors FULL_FEEDS.urdu in src/config/feeds.ts.
    urdu: [
      { name: 'BBC Urdu', url: 'https://feeds.bbci.co.uk/urdu/rss.xml' },
      { name: 'Independent Urdu', url: 'https://www.independenturdu.com/rss.xml' },
      { name: 'Express Urdu', url: 'https://www.express.pk/feed/' },
      { name: 'Jang', url: 'https://jang.com.pk/rss/1/1' },
      { name: 'Dawn News Urdu', url: 'https://www.dawnnews.tv/feeds/latest-news/' },
    ],
```

- [ ] **Step 3: Create `scripts/pk/add-rss-domains.mjs`, then run it** (`feeds.bbci.co.uk` is already allowed):

```js
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
```

```bash
node scripts/pk/add-rss-domains.mjs www.independenturdu.com www.express.pk jang.com.pk www.dawnnews.tv
git diff --stat -- shared/rss-allowed-domains.json scripts/shared/rss-allowed-domains.json api/_rss-allowed-domains.js   # +4 lines each, nothing else
```

- [ ] **Step 4: Add right-to-left headline styles** to `src/styles/pakistan-b.css`:

```css
/* Urdu headlines read right-to-left. */
.panel[data-panel="urdu"] .item-title {
  direction: rtl;
  unicode-bidi: plaintext;
  text-align: right;
  font-family: 'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', 'Urdu Typesetting', 'Segoe UI', sans-serif;
  line-height: 1.9;
}
```

- [ ] **Step 5: Run the news suites**

```bash
node scripts/run-data-tests.mjs tests/feeds-client-server-parity.test.mjs tests/feed-catalog-drift.test.mts tests/edge-functions.test.mjs tests/news-feed-key-parity.test.mts tests/news-panel-key-reachability.test.mts tests/direct-news-feed-pack.test.mts tests/curated-regional-news-feeds.test.mts
```

Expected: PASS. If a suite reports a missing source tier, source type or provenance entry for a new Urdu feed, add entries for exactly the five feed names:
- Copy the shape of the existing `Dawn` entries: run `grep -n "Dawn" shared/source-tiers.json shared/source-provenance-declarations.ts`.
- Give every new feed the same tier as Dawn.
- Write `shared/source-tiers.json` and `scripts/shared/source-tiers.json` byte-identical; a test compares them.

Then re-run the suites.

- [ ] **Step 6: Verify end to end**

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3001/api/rss-proxy?url=https%3A%2F%2Fjang.com.pk%2Frss%2F1%2F1"   # 200
```

Then check the browser with fresh storage: the "Urdu News" panel shows Urdu headlines right-to-left.

- [ ] **Step 7: Commit**

```bash
git add src/config/feeds.ts server/worldmonitor/news/v1/_feeds.ts scripts/pk/add-rss-domains.mjs shared/rss-allowed-domains.json scripts/shared/rss-allowed-domains.json api/_rss-allowed-domains.js src/styles/pakistan-b.css
git commit -m "track-b: B1 Urdu news panel"
```

### Task B2: Pakistani live TV

**Files:** `src/config/live-video-sources.ts`, `src/services/live-channels.ts`, `scripts/shared/live-video-refresh-channels.generated.json` (generated)

**Rules from `tests/live-video-catalog.test.mts`:**
- The built-in channel ids in `live-channels.ts` must equal the keys of `LIVE_NEWS_SOURCES`, exactly.
- Every default channel needs at least one entry.
- No stream may appear in two slots.

**Candidates** (verified 2026-10-16: each channel's `/live` page resolved to a running video, except Express, which had no live stream and is excluded):

| Slot id | Channel | YouTube channel URL |
|---|---|---|
| `geo-news` | Geo News | `https://www.youtube.com/channel/UC_vt34wimdCzdkrzVejwX9g` |
| `ary-news` | ARY News | `https://www.youtube.com/channel/UCMmpLL2ucRHAXbNHiCPyIyg` |
| `dunya-news` | Dunya News | `https://www.youtube.com/channel/UCnMBV5Iw4WqKILKue1nP6Hg` |
| `samaa-tv` | SAMAA TV | `https://www.youtube.com/channel/UCJekW1Vj5fCVEGdye_mBN6Q` |
| `ptv-news` | PTV News | `https://www.youtube.com/channel/UC5RvV_LtR1dxPCVFGw6dxXA` |
| `bol-news` | BOL News | `https://www.youtube.com/channel/UCz2yxQJZgiB_5elTzqV7FiQ` |

- [ ] **Step 1: Check every candidate with the repo's own checker.** Drop any candidate that does not report live.

```bash
for id in UC_vt34wimdCzdkrzVejwX9g UCMmpLL2ucRHAXbNHiCPyIyg UCnMBV5Iw4WqKILKue1nP6Hg UCJekW1Vj5fCVEGdye_mBN6Q UC5RvV_LtR1dxPCVFGw6dxXA UCz2yxQJZgiB_5elTzqV7FiQ; do npm run --silent live-video:check -- "https://www.youtube.com/channel/$id"; done
```

The checker prints a `paste:` line for live entries. Paste that line exactly where Step 2 shows the channel URL.

- [ ] **Step 2: Add the slots.** In `src/config/live-video-sources.ts`, inside `LIVE_NEWS_SOURCES`, before its closing `} as const satisfies Record<string, readonly string[]>;`, add:

```ts
  // Pakistan (2026-10-16). Channel entries: they play whatever the channel has live.
  'geo-news': ['https://www.youtube.com/channel/UC_vt34wimdCzdkrzVejwX9g'],
  'ary-news': ['https://www.youtube.com/channel/UCMmpLL2ucRHAXbNHiCPyIyg'],
  'dunya-news': ['https://www.youtube.com/channel/UCnMBV5Iw4WqKILKue1nP6Hg'],
  'samaa-tv': ['https://www.youtube.com/channel/UCJekW1Vj5fCVEGdye_mBN6Q'],
  'ptv-news': ['https://www.youtube.com/channel/UC5RvV_LtR1dxPCVFGw6dxXA'],
  'bol-news': ['https://www.youtube.com/channel/UCz2yxQJZgiB_5elTzqV7FiQ'],
```

- [ ] **Step 3: Add the channels.** In `src/services/live-channels.ts`:
  - Add a `// Pakistan` group to `OPTIONAL_LIVE_CHANNELS`:

```ts
  // Pakistan
  { id: 'geo-news', name: 'Geo News', handle: '@geonews' },
  { id: 'ary-news', name: 'ARY News' },
  { id: 'dunya-news', name: 'Dunya News', handle: '@DunyaNewsOfficial' },
  { id: 'samaa-tv', name: 'SAMAA TV', handle: '@SAMAATV' },
  { id: 'ptv-news', name: 'PTV News', handle: '@PTVNewsOfficial' },
  { id: 'bol-news', name: 'BOL News', handle: '@BOLNewsOfficial' },
```

  - Prepend `'geo-news', 'ary-news', 'dunya-news', 'samaa-tv', 'ptv-news', 'bol-news'` to the `channelIds` of the `{ key: 'asia', … }` entry in `_REGION_ENTRIES`.
  - Replace `FULL_LIVE_CHANNELS` with:

```ts
// Pakistan Monitor: Pakistani news channels first, one international channel for context.
const FULL_LIVE_CHANNELS: BuiltinLiveChannel[] = [
  { id: 'geo-news', name: 'Geo News', handle: '@geonews' },
  { id: 'ary-news', name: 'ARY News' },
  { id: 'dunya-news', name: 'Dunya News', handle: '@DunyaNewsOfficial' },
  { id: 'samaa-tv', name: 'SAMAA TV', handle: '@SAMAATV' },
  { id: 'ptv-news', name: 'PTV News', handle: '@PTVNewsOfficial' },
  { id: 'bol-news', name: 'BOL News', handle: '@BOLNewsOfficial' },
  { id: 'aljazeera', name: 'AlJazeera', handle: '@AlJazeeraEnglish' },
];
```

- [ ] **Step 4: Regenerate the refresh list and run the suites**

```bash
npm run sync:live-video-channels
npm run sync:live-video-channels:check
node scripts/run-data-tests.mjs tests/live-video-catalog.test.mts tests/live-channels-entry.test.mjs tests/live-news-panel-guard.test.mts tests/live-video-model.test.mts tests/live-video-refresh-channels.test.mts tests/live-video-chain.test.mts
```

Expected: PASS.

- [ ] **Step 5: Verify, then commit.** In the browser with fresh storage, the Live News panel lists Geo News first, and "Play live feed" plays it.

```bash
git add src/config/live-video-sources.ts src/services/live-channels.ts scripts/shared/live-video-refresh-channels.generated.json
git commit -m "track-b: B2 Pakistani live TV channels"
```

### Task B3: Weather warnings panel

**Files:** Create `src/services/pk-weather.ts`. Replace the stub `src/components/PakistanWeatherPanel.ts`. Modify `src/styles/pakistan-b.css`. Test: `tests/pakistan-track-b.test.mts`.

**Interfaces produced:**
- `DayForecast`, `CityForecast`, `WeatherWarning`
- `parseForecast(body: unknown): CityForecast[]`
- `weatherWarnings(day: DayForecast): WeatherWarning[]`
- `fetchPakistanForecast(signal?): Promise<CityForecast[]>`

- [ ] **Step 1: Write the failing tests** (append to `tests/pakistan-track-b.test.mts`):

```ts
import { parseForecast, weatherWarnings } from '../src/services/pk-weather';

describe('weatherWarnings', () => {
  const day = { date: '2026-10-16', maxTempC: 38, feelsLikeMaxC: 46, rainMm: 30, gustKmh: 40, minVisibilityM: 150 };
  it('flags heat, rain and fog with severity, and skips calm wind', () => {
    assert.deepEqual(weatherWarnings(day).map((w) => `${w.kind}:${w.severe}`), ['heat:true', 'rain:false', 'fog:true']);
  });
  it('is quiet on a calm day', () => {
    assert.deepEqual(weatherWarnings({ ...day, feelsLikeMaxC: 30, rainMm: 0, minVisibilityM: 10000 }), []);
  });
});

describe('parseForecast', () => {
  it('maps daily values and folds hourly visibility into a per-day minimum', () => {
    const body = [{
      daily: { time: ['2026-10-16', '2026-10-17'], temperature_2m_max: [35, 36], apparent_temperature_max: [37, 38], precipitation_sum: [0, 12], wind_gusts_10m_max: [20, 55] },
      hourly: { time: ['2026-10-16T00:00', '2026-10-16T06:00', '2026-10-17T06:00'], visibility: [24000, 800, 5000] },
    }];
    const [lahore] = parseForecast(body);
    assert.equal(lahore?.name, 'Lahore');
    assert.deepEqual(lahore?.days.map((d) => d.minVisibilityM), [800, 5000]);
    assert.equal(lahore?.days[1]?.gustKmh, 55);
  });
});
```

- [ ] **Step 2: Run and watch them fail.** Run `node scripts/run-data-tests.mjs tests/pakistan-track-b.test.mts`. Expected: FAIL, missing module.

- [ ] **Step 3: Create `src/services/pk-weather.ts`**

```ts
/**
 * Weather warnings from the Open-Meteo forecast (free, no key, CORS-open) for
 * the air-quality cities. Thresholds are this dashboard's heuristics, not
 * official PMD warnings, and the panel says so.
 */
import { AQ_CITIES } from './pakistan-desk';

export interface DayForecast {
  date: string;
  maxTempC: number | null;
  feelsLikeMaxC: number | null;
  rainMm: number | null;
  gustKmh: number | null;
  minVisibilityM: number | null;
}

export interface CityForecast {
  name: string;
  days: DayForecast[];
}

export type WarningKind = 'heat' | 'rain' | 'wind' | 'fog';

export interface WeatherWarning {
  kind: WarningKind;
  severe: boolean;
  text: string;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function weatherWarnings(day: DayForecast): WeatherWarning[] {
  const out: WeatherWarning[] = [];
  const heat = day.feelsLikeMaxC ?? day.maxTempC;
  if (heat !== null && heat >= 40) out.push({ kind: 'heat', severe: heat >= 45, text: `Feels like ${Math.round(heat)}°C` });
  if (day.rainMm !== null && day.rainMm >= 25) out.push({ kind: 'rain', severe: day.rainMm >= 50, text: `${Math.round(day.rainMm)} mm rain` });
  if (day.gustKmh !== null && day.gustKmh >= 50) out.push({ kind: 'wind', severe: day.gustKmh >= 75, text: `Gusts ${Math.round(day.gustKmh)} km/h` });
  if (day.minVisibilityM !== null && day.minVisibilityM < 1000) {
    out.push({ kind: 'fog', severe: day.minVisibilityM < 200, text: `Visibility ${Math.round(day.minVisibilityM)} m` });
  }
  return out;
}

export function parseForecast(body: unknown): CityForecast[] {
  const rows = (Array.isArray(body) ? body : [body]) as Array<{
    daily?: { time?: unknown[]; temperature_2m_max?: unknown[]; apparent_temperature_max?: unknown[]; precipitation_sum?: unknown[]; wind_gusts_10m_max?: unknown[] };
    hourly?: { time?: unknown[]; visibility?: unknown[] };
  }>;
  return AQ_CITIES.map((city, i) => {
    const daily = rows[i]?.daily;
    const hourly = rows[i]?.hourly;
    const dates = (daily?.time ?? []).filter((d): d is string => typeof d === 'string');
    const days = dates.map((date, d) => {
      const visibilities = (hourly?.time ?? [])
        .flatMap((t, h) => (typeof t === 'string' && t.startsWith(date) ? [num(hourly?.visibility?.[h])] : []))
        .filter((v): v is number => v !== null);
      return {
        date,
        maxTempC: num(daily?.temperature_2m_max?.[d]),
        feelsLikeMaxC: num(daily?.apparent_temperature_max?.[d]),
        rainMm: num(daily?.precipitation_sum?.[d]),
        gustKmh: num(daily?.wind_gusts_10m_max?.[d]),
        minVisibilityM: visibilities.length ? Math.min(...visibilities) : null,
      };
    });
    return { name: city.name, days };
  });
}

export async function fetchPakistanForecast(signal?: AbortSignal): Promise<CityForecast[]> {
  const params = new URLSearchParams({
    latitude: AQ_CITIES.map((c) => c.lat).join(','),
    longitude: AQ_CITIES.map((c) => c.lon).join(','),
    daily: 'temperature_2m_max,apparent_temperature_max,precipitation_sum,wind_gusts_10m_max',
    hourly: 'visibility',
    forecast_days: '2',
    timezone: 'Asia/Karachi',
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal, credentials: 'omit' });
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  return parseForecast(await res.json());
}
```

- [ ] **Step 4: Run the tests.** Run `node scripts/run-data-tests.mjs tests/pakistan-track-b.test.mts`. Expected: PASS.

- [ ] **Step 5: Replace the stub in `src/components/PakistanWeatherPanel.ts`**

```ts
import { Panel } from './Panel';
import { joinSafeHtml, safeHtml } from '@/utils/sanitize';
import { startSmartPollLoop, type SmartPollLoopHandle } from '@/services/smart-poll-loop';
import { errorMessage } from '@/services/pakistan-desk';
import { fetchPakistanForecast, weatherWarnings, type CityForecast } from '@/services/pk-weather';

const KIND_ICON = { heat: '🌡️', rain: '🌧️', wind: '💨', fog: '🌫️' } as const;

export class PakistanWeatherPanel extends Panel {
  private readonly loop: SmartPollLoopHandle;

  constructor() {
    super({
      id: 'pk-weather',
      title: 'Weather Warnings',
      infoTooltip: 'Heat, heavy rain, strong wind and fog risk for today and tomorrow, from the Open-Meteo forecast. Thresholds are this dashboard\u2019s heuristics, not official PMD warnings.',
    });
    this.showLoading();
    this.loop = startSmartPollLoop(() => this.refresh(), { intervalMs: 60 * 60_000, runImmediately: true, pauseWhenHidden: true });
  }

  private async refresh(): Promise<void> {
    try {
      const cities = await fetchPakistanForecast(this.signal);
      if (this.signal.aborted) return;
      this.render(cities);
    } catch (error) {
      if (this.signal.aborted) return;
      this.showError(`Forecast unavailable: ${errorMessage(error)}`, () => this.loop.trigger());
    }
  }

  private render(cities: CityForecast[]): void {
    const rows = cities
      .flatMap((city) => city.days.flatMap((day, index) =>
        weatherWarnings(day).map((w) => ({ ...w, city: city.name, when: index === 0 ? 'Today' : 'Tomorrow' }))))
      .sort((a, b) => Number(b.severe) - Number(a.severe));
    const warnings = rows.length
      ? joinSafeHtml(rows.map((r) => safeHtml`<div class="pk-wx-row${r.severe ? ' pk-wx-severe' : ''}">
          <span>${KIND_ICON[r.kind]}</span><span class="pk-wx-city">${r.city}</span><span class="pk-note">${r.when}</span><span>${r.text}</span>
        </div>`))
      : safeHtml`<div class="pk-note">No heat, heavy-rain, wind or fog warnings for today or tomorrow.</div>`;
    const temps = joinSafeHtml(cities.map((c) => {
      const t = c.days[0]?.maxTempC;
      return safeHtml`<span><b>${c.name}</b> ${t == null ? '–' : `${Math.round(t)}°`}</span>`;
    }));
    this.setSafeContent(safeHtml`<div class="pk-wx">${warnings}
      <div class="pk-cross">${temps}</div>
      <div class="pk-note">Open-Meteo forecast · heuristic thresholds, not official PMD warnings</div>
    </div>`);
  }

  public override destroy(): void {
    this.loop.stop();
    super.destroy();
  }
}
```

Add to `src/styles/pakistan-b.css`:

```css
.pk-wx { display: grid; gap: 6px; }
.pk-wx-row { display: grid; grid-template-columns: 20px 1fr auto auto; align-items: center; gap: 8px; font-size: 12px; padding: 3px 0; border-bottom: 1px solid var(--border-subtle); }
.pk-wx-city { font-weight: 600; }
.pk-wx-severe { color: var(--semantic-critical); }
```

- [ ] **Step 6: Verify, then commit.** Typecheck, then check the browser panel. To see the error state, temporarily point the URL at `api.open-meteo.invalid`, then revert.

```bash
git add src/services/pk-weather.ts src/components/PakistanWeatherPanel.ts src/styles/pakistan-b.css tests/pakistan-track-b.test.mts
git commit -m "track-b: B3 weather warnings panel"
```

### Task B4: Disasters panel

**Files:** Create `src/services/pk-disasters.ts`. Replace the stub `src/components/PakistanDisastersPanel.ts`. Modify `src/styles/pakistan-b.css`. Test: `tests/pakistan-track-b.test.mts`.

**Interfaces produced:**
- `DisasterEvent`
- `gdacsForPakistan(body: unknown, type: 'FL'|'TC'|'DR'|'WF'|'EQ'): DisasterEvent[]`
- `usgsNearPakistan(body: unknown): DisasterEvent[]`
- `fetchPakistanDisasters(signal?, now?): Promise<DisasterEvent[]>`

- [ ] **Step 1: Write the failing tests**

```ts
import { gdacsForPakistan, usgsNearPakistan } from '../src/services/pk-disasters';

describe('gdacsForPakistan', () => {
  it('keeps events whose country or affected countries include Pakistan', () => {
    const body = { features: [
      { properties: { eventid: 1, name: 'Flood in Pakistan', iso3: 'PAK', alertlevel: 'Orange', fromdate: '2026-10-10T00:00:00', url: { report: 'https://www.gdacs.org/report.aspx?eventid=1' } } },
      { properties: { eventid: 2, name: 'Cyclone Arabian Sea', iso3: 'OMN', affectedcountries: [{ iso3: 'OMN' }, { iso3: 'PAK' }], alertlevel: 'Green', fromdate: '2026-10-11T00:00:00', url: {} } },
      { properties: { eventid: 3, name: 'Flood in Ecuador', iso3: 'ECU', alertlevel: 'Green', fromdate: '2026-10-12T00:00:00' } },
    ] };
    const events = gdacsForPakistan(body, 'FL');
    assert.deepEqual(events.map((e) => e.title), ['Flood in Pakistan', 'Cyclone Arabian Sea']);
    assert.equal(events[0]?.alert, 'Orange');
    assert.equal(events[1]?.url, 'https://www.gdacs.org/');
  });
});

describe('usgsNearPakistan', () => {
  it('turns quakes into titled events', () => {
    const [e] = usgsNearPakistan({ features: [{ id: 'us1', properties: { mag: 4.6, place: '30 km N of Quetta, Pakistan', time: Date.parse('2026-10-15T00:00:00Z'), url: 'https://earthquake.usgs.gov/x' } }] });
    assert.equal(e?.title, 'M4.6 · 30 km N of Quetta, Pakistan');
    assert.equal(e?.startedAt, '2026-10-15T00:00:00.000Z');
  });
});
```

- [ ] **Step 2: Create `src/services/pk-disasters.ts`**

```ts
/**
 * Disasters touching Pakistan: GDACS (floods, cyclones, droughts, wildfires,
 * earthquakes) and recent USGS quakes in and around Pakistan. Both are free,
 * keyless and CORS-open.
 */
export interface DisasterEvent {
  id: string;
  kind: 'flood' | 'cyclone' | 'drought' | 'wildfire' | 'earthquake';
  title: string;
  alert: string; // GDACS Green / Orange / Red; '' for USGS
  startedAt: string; // ISO
  url: string;
  source: 'GDACS' | 'USGS';
  magnitude?: number;
}

const GDACS_TYPES = { FL: 'flood', TC: 'cyclone', DR: 'drought', WF: 'wildfire', EQ: 'earthquake' } as const;
type GdacsType = keyof typeof GDACS_TYPES;

export function gdacsForPakistan(body: unknown, type: GdacsType): DisasterEvent[] {
  const features = (body as { features?: unknown[] } | null)?.features;
  if (!Array.isArray(features)) return [];
  return features.flatMap((raw) => {
    const p = (raw as { properties?: Record<string, unknown> }).properties ?? {};
    const affected = Array.isArray(p.affectedcountries) ? (p.affectedcountries as Array<{ iso3?: unknown }>) : [];
    if (p.iso3 !== 'PAK' && !affected.some((c) => c.iso3 === 'PAK')) return [];
    const report = (p.url as { report?: unknown } | undefined)?.report;
    return [{
      id: `gdacs-${type}-${String(p.eventid)}`,
      kind: GDACS_TYPES[type],
      title: typeof p.name === 'string' ? p.name : GDACS_TYPES[type],
      alert: typeof p.alertlevel === 'string' ? p.alertlevel : '',
      startedAt: typeof p.fromdate === 'string' ? p.fromdate : '',
      url: typeof report === 'string' ? report : 'https://www.gdacs.org/',
      source: 'GDACS' as const,
    }];
  });
}

export function usgsNearPakistan(body: unknown): DisasterEvent[] {
  const features = (body as { features?: unknown[] } | null)?.features;
  if (!Array.isArray(features)) return [];
  return features.flatMap((raw) => {
    const f = raw as { id?: string; properties?: { mag?: unknown; place?: unknown; time?: unknown; url?: unknown } };
    const mag = f.properties?.mag;
    const time = f.properties?.time;
    if (!f.id || typeof mag !== 'number' || typeof time !== 'number') return [];
    const place = typeof f.properties?.place === 'string' ? f.properties.place : 'near Pakistan';
    return [{
      id: `usgs-${f.id}`,
      kind: 'earthquake' as const,
      title: `M${mag.toFixed(1)} · ${place}`,
      alert: '',
      startedAt: new Date(time).toISOString(),
      url: typeof f.properties?.url === 'string' ? f.properties.url : 'https://earthquake.usgs.gov/',
      source: 'USGS' as const,
      magnitude: mag,
    }];
  });
}

export async function fetchPakistanDisasters(signal?: AbortSignal, now = Date.now()): Promise<DisasterEvent[]> {
  const gdacs = (Object.keys(GDACS_TYPES) as GdacsType[]).map(async (type) => {
    const res = await fetch(`https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP?eventtype=${type}`, { signal, credentials: 'omit' });
    if (res.status === 204) return [];
    return res.ok ? gdacsForPakistan(await res.json(), type) : [];
  });
  const usgsParams = new URLSearchParams({
    format: 'geojson', orderby: 'time', limit: '50', minmagnitude: '4',
    starttime: new Date(now - 7 * 86_400_000).toISOString().slice(0, 10),
    minlatitude: '23.5', maxlatitude: '37.5', minlongitude: '60.5', maxlongitude: '77.9',
  });
  const usgs = fetch(`https://earthquake.usgs.gov/fdsnws/event/1/query?${usgsParams}`, { signal, credentials: 'omit' })
    .then(async (res) => (res.ok ? usgsNearPakistan(await res.json()) : []));
  const settled = await Promise.allSettled([...gdacs, usgs]);
  if (settled.every((r) => r.status === 'rejected')) throw new Error('GDACS and USGS unreachable');
  return settled
    .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
```

Run the tests. Expected: PASS.

- [ ] **Step 3: Replace the stub in `src/components/PakistanDisastersPanel.ts`**

```ts
import { Panel } from './Panel';
import { joinSafeHtml, safeHtml, safeUrlAttr } from '@/utils/sanitize';
import { startSmartPollLoop, type SmartPollLoopHandle } from '@/services/smart-poll-loop';
import { errorMessage, formatTime } from '@/services/pakistan-desk';
import { fetchPakistanDisasters } from '@/services/pk-disasters';

const KIND_ICON = { flood: '🌊', cyclone: '🌀', drought: '☀️', wildfire: '🔥', earthquake: '🔴' } as const;

export class PakistanDisastersPanel extends Panel {
  private readonly loop: SmartPollLoopHandle;

  constructor() {
    super({
      id: 'pk-disasters',
      title: 'Disasters',
      infoTooltip: 'GDACS alerts (floods, cyclones, droughts, wildfires, earthquakes) that touch Pakistan, plus USGS quakes of magnitude 4+ in and around Pakistan over the last 7 days.',
    });
    this.showLoading();
    this.loop = startSmartPollLoop(() => this.refresh(), { intervalMs: 15 * 60_000, runImmediately: true, pauseWhenHidden: true });
  }

  private async refresh(): Promise<void> {
    try {
      const events = await fetchPakistanDisasters(this.signal);
      if (this.signal.aborted) return;
      this.setCount(events.length);
      const rows = events.length
        ? joinSafeHtml(events.slice(0, 20).map((e) => safeHtml`<li class="pk-dis-row">
            <span>${KIND_ICON[e.kind]}</span>
            <a href="${safeUrlAttr(e.url)}" target="_blank" rel="noopener">${e.title}</a>
            ${e.alert ? safeHtml`<span class="pk-badge pk-alert-${e.alert.toLowerCase()}">${e.alert}</span>` : ''}
            <span class="pk-note">${e.source}${e.startedAt ? ` · ${formatTime(e.startedAt)}` : ''}</span>
          </li>`))
        : safeHtml`<li class="pk-note">No active GDACS alerts for Pakistan and no M4+ quakes nearby this week.</li>`;
      this.setSafeContent(safeHtml`<ul class="pk-brief-list">${rows}</ul><div class="pk-note">GDACS · USGS</div>`);
    } catch (error) {
      if (this.signal.aborted) return;
      this.showError(`Disaster feeds unavailable: ${errorMessage(error)}`, () => this.loop.trigger());
    }
  }

  public override destroy(): void {
    this.loop.stop();
    super.destroy();
  }
}
```

Add to `src/styles/pakistan-b.css`:

```css
.pk-dis-row { display: grid; grid-template-columns: 20px 1fr auto; gap: 2px 8px; align-items: baseline; }
.pk-dis-row .pk-note { grid-column: 2 / -1; }
.pk-alert-red { color: var(--semantic-critical); }
.pk-alert-orange { color: var(--semantic-high); }
.pk-alert-green { color: var(--semantic-positive); }
```

- [ ] **Step 4: Verify, then commit.** Typecheck, run the tests, and check the browser. An empty list is valid on a quiet day, as long as it shows the empty-state text.

```bash
git add src/services/pk-disasters.ts src/components/PakistanDisastersPanel.ts src/styles/pakistan-b.css tests/pakistan-track-b.test.mts
git commit -m "track-b: B4 disasters panel"
```

### Task B5: More PSX indices

**Files:** Modify `api/pk-kse100.js`, `src/components/PakistanMarketsPanel.ts`, `src/styles/pakistan-b.css`. Test: `tests/pakistan-track-b.test.mts`.

**Interfaces:**
- Consumes: `Kse100Quote.indices` (pre-declared in Task 0).
- Produces: `PSX_INDEX_CODES`, `parseIndex(html, code)`, `parseAsOf(html)`. The `parseKse100` behaviour stays unchanged.

- [ ] **Step 1: Write the failing test** (`KSE100_ROW` and `page` already exist in this file since Task 0):

```ts
import { parseIndex } from '../api/pk-kse100.js';

describe('parseIndex', () => {
  const KSE30_ROW = '<tr><td><a data-code="KSE30"><b>KSE30</b></a></td><td data-order="50100.5"></td><td data-order="49800"></td><td data-order="49950.25"></td><td data-order="-75.5"></td><td data-order="-0.15"></td></tr>';
  it('reads any index by its exact code', () => {
    assert.deepEqual(parseIndex(page(KSE100_ROW + KSE30_ROW), 'KSE30'), { code: 'KSE30', value: 49950.25, change: -75.5, changePct: -0.15, high: 50100.5, low: 49800 });
    assert.equal(parseIndex(page(KSE100_ROW), 'KMI30'), null);
  });
});
```

- [ ] **Step 2: Generalize the parser in `api/pk-kse100.js`.** Replace `parseKse100` with:

```js
// Indices the markets panel shows, in order. One /indices fetch serves them all.
export const PSX_INDEX_CODES = ['KSE100', 'KSE30', 'ALLSHR', 'KMI30', 'BKTI', 'OGTI'];

/** One row of the indices table. Columns: High, Low, Current, Change, % Change. */
export function parseIndex(html, code) {
  const start = html.indexOf(`data-code="${code}"`);
  const end = start === -1 ? -1 : html.indexOf('</tr>', start);
  if (end === -1) return null;
  const nums = [...html.slice(start, end).matchAll(/data-order="(-?\d+(?:\.\d+)?)"/g)].map((m) => Number(m[1]));
  if (nums.length < 5 || !(nums[2] > 0)) return null;
  const [high, low, value, change, changePct] = nums;
  return { code, value, change, changePct, high, low };
}

export function parseAsOf(html) {
  return html.match(/As of\s+([^<]+)</)?.[1].replace(/\s+/g, ' ').trim() ?? null;
}

/** KSE-100 row, in the response shape the panel has always read. */
export function parseKse100(html) {
  const row = parseIndex(html, 'KSE100');
  if (!row) return null;
  return { value: row.value, change: row.change, changePct: row.changePct, high: row.high, low: row.low, asOf: parseAsOf(html) };
}
```

In `handler`, replace the line `lastGood = { ...quote, fetchedAt: new Date().toISOString() };` with:

```js
    const indices = PSX_INDEX_CODES.map((code) => parseIndex(html, code))
      .filter(Boolean)
      .map(({ code, value, change, changePct }) => ({ code, value, change, changePct }));
    lastGood = { ...quote, indices, fetchedAt: new Date().toISOString() };
```

Run the tests. Expected: all `parseKse100` and `parseIndex` tests PASS.

- [ ] **Step 3: Show the indices in `src/components/PakistanMarketsPanel.ts`.** Add near the top:

```ts
const INDEX_NAMES: Record<string, string> = {
  KSE30: 'KSE-30', ALLSHR: 'All Share', KMI30: 'KMI-30 (Shariah)', BKTI: 'Banks', OGTI: 'Oil & Gas',
};
```

In `renderKse()`, build this table:

```ts
    const others = (q.indices ?? []).filter((i) => i.code !== 'KSE100');
    const table = others.length
      ? safeHtml`<div class="pk-index-table">${joinSafeHtml(others.map((i) => safeHtml`<div class="pk-index-row">
          <span>${INDEX_NAMES[i.code] ?? i.code}</span><span>${number(i.value, 0)}</span>
          <span class="${i.change < 0 ? 'pk-down' : 'pk-up'}">${signed(i.changePct)}%</span>
        </div>`))}</div>`
      : '';
```

Then insert `${table}` right after the `<div class="pk-stat-change …">` line of the KSE-100 block.

Add to `src/styles/pakistan-b.css`:

```css
.pk-index-table { display: grid; gap: 2px; margin: 6px 0; }
.pk-index-row { display: grid; grid-template-columns: 1fr auto 64px; gap: 8px; font-size: 12px; font-variant-numeric: tabular-nums; }
.pk-index-row span:last-child { text-align: right; }
```

- [ ] **Step 4: Verify, then commit.** Check `curl -s http://localhost:3001/api/pk-kse100` (the response has `indices` with 6 entries) and the browser.

```bash
git add api/pk-kse100.js src/components/PakistanMarketsPanel.ts src/styles/pakistan-b.css tests/pakistan-track-b.test.mts
git commit -m "track-b: B5 KSE-30, All Share, KMI-30, Banks and Oil & Gas indices"
```

### Task B6 (stretch): Gold per tola

**Files:** Replace the stub `api/pk-gold.js`. Create `src/services/pk-gold.ts`. Modify `src/components/PakistanMarketsPanel.ts`. Test: `tests/pakistan-track-b.test.mts`.

- [ ] **Step 1: Write the failing test**

```ts
import { parseGoldTola } from '../api/pk-gold.js';

describe('parseGoldTola', () => {
  it('reads per 10 g, per tola and per ounce from the bullion table', () => {
    assert.deepEqual(parseGoldTola('<tr><td>Gold</td><td>XAU</td><td>369,170</td><td>430,143</td><td>1,148,267</td></tr>'), { per10g: 369170, perTola: 430143, perOunce: 1148267 });
    assert.equal(parseGoldTola('<html>maintenance</html>'), null);
  });
});
```

- [ ] **Step 2: Replace `api/pk-gold.js`**

```js
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
```

- [ ] **Step 3: Create `src/services/pk-gold.ts`**

```ts
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
```

- [ ] **Step 4: Show it in `src/components/PakistanMarketsPanel.ts`.** Gold is secondary: when it is unavailable, render nothing rather than an error block.

Add the import, a constant and two fields:

```ts
import { fetchGold, type GoldRate } from '@/services/pk-gold';

const GOLD_MAX_AGE_MS = 30 * 60_000;

  // class fields
  private gold: GoldRate | null = null;
  private goldFetchedAt = 0;
```

In `refresh()`, replace the `Promise.allSettled([...])` statement with:

```ts
    const wantGold = Date.now() - this.goldFetchedAt > GOLD_MAX_AGE_MS;
    const [kse, fx, gold] = await Promise.allSettled([
      fetchKse100(this.signal),
      wantFx ? fetchPkrRates(this.signal) : Promise.resolve(this.fx),
      wantGold ? fetchGold(this.signal) : Promise.resolve(this.gold),
    ]);
```

After the existing `fx` handling, add:

```ts
    if (gold.status === 'fulfilled') {
      if (wantGold) this.goldFetchedAt = Date.now();
      this.gold = gold.value;
    }
```

Change the final render to `${this.renderKse()}${this.renderFx()}${this.renderGold()}`, and add the method:

```ts
  private renderGold(): SafeHtml {
    const g = this.gold;
    if (!g) return safeHtml``;
    return safeHtml`<div class="pk-stat">
      <div class="pk-stat-label">Gold (per tola) ${g.stale ? safeHtml`<span class="pk-badge pk-badge-warn">stale</span>` : ''}</div>
      <div class="pk-stat-value">PKR ${number(g.perTola, 0)}</div>
      <div class="pk-note">forex.pk · ${formatTime(g.fetchedAt)}</div>
    </div>`;
  }
```
- [ ] **Step 5: Verify, then commit.** Run the tests, then `curl -s http://localhost:3001/api/pk-gold` (expect `perTola` and `"stale":false`), then check the browser.

```bash
git add api/pk-gold.js src/services/pk-gold.ts src/components/PakistanMarketsPanel.ts tests/pakistan-track-b.test.mts
git commit -m "track-b: B6 gold per tola"
```

---

## 6. Task X: Merge and final checks (Claude, after both tracks report done)

- [ ] **Step 1:** Read both status files and resolve every "Needs from the other track" item.
- [ ] **Step 2: Merge**

```bash
git switch main
git merge --no-ff pm/track-a -m "merge: Pakistan Monitor day-1 track A"
git merge --no-ff pm/track-b -m "merge: Pakistan Monitor day-1 track B"
```

If ownership was respected there are no conflicts. If there are, resolve them by owner: the owning track's version wins.

- [ ] **Step 3: Full verification**

```bash
npx tsc --noEmit && npx tsc --noEmit -p tsconfig.api.json && npm run lint:boundaries && npm run lint:api-contract && npm run lint:safe-html
node scripts/run-data-tests.mjs tests/pakistan-desk.test.mts tests/pakistan-track-b.test.mts tests/feeds-client-server-parity.test.mjs tests/feed-catalog-drift.test.mts tests/edge-functions.test.mjs tests/live-video-catalog.test.mts tests/live-channels-entry.test.mjs
npx biome lint src/components/Pakistan*.ts src/services/pk-*.ts src/services/pakistan-desk.ts api/pk-*.js api/pk-*.ts tests/pakistan-*.test.mts
```

- [ ] **Step 4: Browser pass** with fresh storage at `http://localhost:3000/`. Every Pakistan panel should show real data or an honest empty or unavailable state. Also check that the district click works, that Pakistani headlines sit on the map, that live TV plays Geo, and that a reload keeps the Pakistan view at zoom 4.5. Take a desktop screenshot and a 390-px-wide mobile screenshot.
- [ ] **Step 5: Clean up**

```bash
git worktree remove "../Pakistan Monitor Gemini"
git branch -d pm/track-a pm/track-b
```

Report to the user what shipped, what didn't, and what is next in §7.

---

## 7. Backlog (not today)

Each item below needs its own plan before anyone builds it.

- **Morning SITREP (was A6):** a `mode: 'sitrep'` on `api/pk-brief.ts` with sanitized context (KSE-100, USD/PKR, worst AQI, weather warnings) and a four-section prompt (Security, Economy, Weather & Air, Watch today). Plus a printable `.pk-sitrep` block with `@media print` CSS.
- **Alerts (was A7):**
  - Rules: an M≥5 quake in `PK_REGION_BBOX`, a city AQI ≥ 300, a KSE-100 move ≤ −2%, a critical incident. Each fires once per event id.
  - Delivery: browser `Notification`s behind a "Turn on alerts" button, never prompted on load. Optionally `api/pk-telegram.ts`, using the free Telegram Bot API with a token in `.env.local`, rate-limited like `pk-brief`.
- **Fires:** NASA FIRMS (free MAP_KEY) feeds the existing `fires` layer. It shows Punjab crop burning, a key smog driver.
- **Province news tabs:** filter the Pakistan and Urdu headlines by province with `locatePakistan`.
- **GDELT for Pakistan:** the existing `gdelt-intel` panel, filtered to Pakistan.
- **Border situation:** Torkham, Chaman, Wagah and Taftan open or closed, from headlines.
- **PSX extras:** top movers (JavaScript-loaded on dps.psx.com.pk, needs a headless fetch), a market mood gauge, and stock analysis.
- **Health:** dengue and heatstroke reports from provincial health departments, and polio. `endpolio.com.pk` was unreachable from this network on 2026-10-16.
- **Cyber:** PKCERT advisories.
- **Energy:** a load-shedding tracker (K-Electric and DISCO schedules, each in its own format), and the upstream Hormuz tracker, enabled for Pakistan's oil imports.
- **Trade:** PBS monthly imports and exports, Torkham/Chaman border trade, FAO food prices for Pakistan, and a Pakistan debt clock (State Bank data).
- **Petrol and diesel prices:** OGRA publishes notified prices as PDFs (`https://www.ogra.org.pk/notified-petroleum-prices`). Needs a PDF table extractor.
- **Weekly SPI inflation:** PBS posts a weekly page with an Executive Summary PDF (`https://www.pbs.gov.pk/weekly-sensitive-price-indicator-spi-for-the-week-ended-on-<dd-mm-yyyy>/`). Same PDF need.
- **Open-market FX:** forex.pk's table is JavaScript-rendered. Needs a headless fetch, or another source.
- **Internet outages:** the IODA API (free) into the existing `outages` map layer. Also Cloudflare Radar (free token).
- **Flights:** OpenSky (free account) for the upstream flights layer.
- **Ships:** AISStream (free key) for Karachi, Qasim and Gwadar; the code is upstream.
- **Static map layers:** GPS jamming (gpsjam.org); undersea cables (static data exists); gas pipelines (OSM); mining sites (Reko Diq, Saindak, Thar).
- **AI layer upgrades:** LLM incident classification with Ollama (upgrades A4's keyword categories); province instability score; correlations (crop fires × AQI × smog); forecasts; analyst chat.
- **Source credibility:** provenance declarations for Pakistani sources, which removes the "UNREVIEWED" badges.
- **Languages:** a full Urdu UI locale; Sindhi, Pashto and Punjabi later.
- **Other:** official public Telegram channels; desktop app branding; login and roles for a team or government deployment.
- **Production deploy:**
  - your own domain in `api/_cors.js`;
  - the AGPL "Source code" link pointed at your fork;
  - the canonical URL in `src/config/variant-meta.ts`;
  - Upstash Redis, so `api/pk-brief.ts` has its rate limiter on Vercel.
