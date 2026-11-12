# Pakistan Monitor

**Real-time national situational awareness & regional intelligence dashboard for Pakistan** — uniting live English & Urdu news aggregation, KSE-100 & PKR markets, district-level incident mapping, air quality & weather alerts, strategic corridors, and AI-assisted briefings in one map-centered interface.

Built on top of the open-source [World Monitor](https://github.com/koala73/worldmonitor) engine (AGPL-3.0).

---

## Key Features

- **Pakistan Desk & Bilingual Feeds:** Live English & Urdu (Nastaliq RTL) aggregation from Pakistani news outlets (`Dawn`, `Geo News`, `Express Tribune`, `Business Recorder`, `BBC Urdu`, `Dawn News Urdu`, and more).
- **AI Brief & Watchlist Export (`PakistanBriefPanel`):** Summarizes top Pakistan headlines via local Ollama or OpenAI-compatible endpoints, tags watchlist topics (`IMF / Economy`, `SBP / PKR`, `CPEC / Gwadar`, `Energy / POL`, `Security / Border`, `Climate / Flood`), and supports one-click Markdown brief export (`.md`).
- **Markets & Rupee (`PakistanMarketsPanel`):** Tracks KSE-100 & PSX indices, USD/PKR and cross rates (`EUR`, `GBP`, `SAR`, `AED`, `CNY`), GCC remittance quick readout (`1k USD / SAR / AED`), and Gold (per tola).
- **Provincial Incidents & District Desk (`PakistanIncidentsPanel`, `PakistanDistrictPanel`):** Categorizes headlines with the Pakistan gazetteer (`src/services/pk-gazetteer.ts`), supports interactive category and province filters, clickable map district boundaries, and strategic quick-hubs (`Islamabad`, `Karachi`, `Lahore`, `Peshawar`, `Quetta`, `Gwadar`, `Rawalpindi`, `Swat`).
- **Obsidian Intel Graph (`PakistanObsidianGraphPanel`):** Force-directed entity graph linking provinces, districts, topics, and live incidents with Obsidian Markdown vault export.
- **Middle East War Room & Strategic Corridors (`MiddleEastWarPanel`, `PakistanStrategicPanel`):** Monitors maritime chokepoints (`Strait of Hormuz`, `Bab el-Mandeb`), POL stockpile runway, and Karachi/Lahore FIR airspace exposure.
- **Air Quality, Weather & Disasters (`PakistanAirPanel`, `PakistanWeatherPanel`, `PakistanDisastersPanel`):** Open-Meteo city AQI, severe weather warnings, USGS earthquakes, and GDACS/EONET events around Pakistan.

---

## Local Development

Requires **Node.js 24** (see `.nvmrc`).

```bash
npm install
npm run dev
```

The dashboard runs at `http://localhost:3000/`.

### Optional Environment Configuration

Copy `.env.example` to `.env.local` to configure optional AI brief endpoints (`PK_BRIEF_OLLAMA_URL`, `PK_BRIEF_LLM_URL`, `PK_BRIEF_LLM_KEY`, `PK_BRIEF_LLM_MODEL`) or API keys.

---

## Verification

```bash
npm run typecheck
npm run lint:boundaries
npm run lint:safe-html
node --import tsx --test tests/pakistan-desk.test.mts tests/pakistan-track-b.test.mts
```

---

## License & Attribution

Licensed under **AGPL-3.0-only** ([LICENSE](LICENSE)). Based on [koala73/worldmonitor](https://github.com/koala73/worldmonitor).
