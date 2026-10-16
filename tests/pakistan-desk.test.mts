import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { briefEndpoints, parseBullets } from '../api/pk-brief';
import { aqiBand, pkrRates } from '../src/services/pakistan-desk';

describe('parseBullets', () => {
  it('keeps marked lines and drops preamble and bold markers', () => {
    assert.deepEqual(parseBullets('Here is the brief:\n- **IMF** tranche approved\n* Karachi floods\n1. KSE-100 dips\n• Smog in Lahore'),
      ['IMF tranche approved', 'Karachi floods', 'KSE-100 dips', 'Smog in Lahore']);
  });

  it('falls back to plain lines and caps at five', () => {
    assert.deepEqual(parseBullets('a\nb\n\nc\nd\ne\nf'), ['a', 'b', 'c', 'd', 'e']);
  });
});

describe('briefEndpoints', () => {
  it('tries Ollama first, then the OpenAI-compatible endpoint', () => {
    const endpoints = briefEndpoints({
      PK_BRIEF_OLLAMA_URL: 'http://localhost:11434',
      PK_BRIEF_LLM_URL: 'https://api.groq.com/openai/v1/chat/completions',
      PK_BRIEF_LLM_KEY: 'gsk_test',
      PK_BRIEF_LLM_MODEL: 'llama-3.1-8b-instant',
    });
    assert.deepEqual(endpoints.map((e) => [e.provider, e.url, e.model]), [
      ['ollama', 'http://localhost:11434/v1/chat/completions', 'qwen2.5:3b-instruct'],
      ['api.groq.com', 'https://api.groq.com/openai/v1/chat/completions', 'llama-3.1-8b-instant'],
    ]);
    assert.equal(endpoints[1]?.key, 'gsk_test');
  });

  it('skips an OpenAI-compatible URL without a model, and needs some config', () => {
    assert.deepEqual(briefEndpoints({ PK_BRIEF_LLM_URL: 'https://api.groq.com/openai/v1/chat/completions' }), []);
    assert.deepEqual(briefEndpoints({}), []);
  });
});

describe('aqiBand', () => {
  it('uses the US EPA breakpoints', () => {
    assert.equal(aqiBand(50).level, 0);
    assert.equal(aqiBand(51).level, 1);
    assert.equal(aqiBand(150).level, 2);
    assert.equal(aqiBand(151).label, 'Unhealthy');
    assert.equal(aqiBand(301).level, 5);
    assert.equal(aqiBand(999).label, 'Hazardous');
  });
});

describe('pkrRates', () => {
  it('derives PKR per unit from USD-based quotes and skips bad values', () => {
    const rates = pkrRates({ PKR: 280, EUR: 0.875, SAR: 3.75, AED: 'n/a' });
    assert.equal(rates?.usd, 280);
    assert.deepEqual(rates?.crosses, [{ code: 'EUR', pkr: 320 }, { code: 'SAR', pkr: 280 / 3.75 }]);
  });

  it('returns null without a positive PKR quote', () => {
    assert.equal(pkrRates({ EUR: 0.9 }), null);
    assert.equal(pkrRates({ PKR: 0 }), null);
  });
});

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

import { buildObsidianGraph, generateObsidianVaultMarkdown } from '../src/services/pk-obsidian-graph';

describe('buildObsidianGraph', () => {
  const item = (title: string, link: string, category: string) => ({
    source: 'Dawn', title, link, pubDate: new Date('2026-10-15T10:00:00Z'), isAlert: false,
    threat: { level: 'high', category, confidence: 0.8, source: 'keyword' },
  }) as import('../src/types').NewsItem;

  it('builds nodes for provinces, topics and places, and links them', () => {
    const items = [
      item('Blast in Quetta kills five', '1', 'terrorism'),
      item('Lahore smog worsens', '2', 'health'),
    ];
    const graph = buildObsidianGraph(items);
    assert.ok(graph.nodes.some((n) => n.id === 'prov:Balochistan'));
    assert.ok(graph.nodes.some((n) => n.id === 'prov:Punjab'));
    assert.ok(graph.nodes.some((n) => n.id === 'topic:security'));
    assert.ok(graph.links.length > 0);
  });
});

describe('generateObsidianVaultMarkdown', () => {
  const item = (title: string, link: string, category: string) => ({
    source: 'Dawn', title, link, pubDate: new Date('2026-10-15T10:00:00Z'), isAlert: false,
    threat: { level: 'high', category, confidence: 0.8, source: 'keyword' },
  }) as import('../src/types').NewsItem;

  it('generates valid markdown with Obsidian callouts and wikilinks', () => {
    const md = generateObsidianVaultMarkdown({
      date: '2026-10-16',
      items: [item('Protest in Lahore over prices', 'p1', 'protest')],
      kse100: 166419,
      usdPkr: 280.25,
      goldTola: 285000,
    });
    assert.ok(md.includes('> [!INFO]'));
    assert.ok(md.includes('> [!SUCCESS]'));
    assert.ok(md.includes('> [!CRITICAL]'));
    assert.ok(md.includes('[[Punjab]]'));
    assert.ok(md.includes('[[Lahore]]'));
    assert.ok(md.includes('166,419'));
  });
});



