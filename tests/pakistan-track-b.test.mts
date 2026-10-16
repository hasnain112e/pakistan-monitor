import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseKse100 } from '../api/pk-kse100.js';

// Trimmed from https://dps.psx.com.pk/indices (2026-10-13). Column order:
// Index, High, Low, Current, Change, % Change.
const KSE100_ROW = '<tr><td><a class="link" href="javascript:;" data-code="KSE100"><b>KSE100</b></a></td>'
  + '<td class="right" data-order="166070.47">166,070.47</td><td class="right" data-order="164773.66">164,773.66</td>'
  + '<td class="right" data-order="164776.44">164,776.44</td>'
  + '<td class="right change__text--neg" data-order="-347.97000000000116"><i class="icon-down-dir"></i> -347.97</td>'
  + '<td class="right change__text--neg" data-order="-0.21073201714997872"><i class="icon-down-dir"></i> -0.21%</td></tr>';
const KSE100PR_ROW = '<tr><td><a class="link" data-code="KSE100PR"><b>KSE100PR</b></a></td>'
  + '<td data-order="49500.1"></td><td data-order="49400"></td><td data-order="49423.3"></td><td data-order="-10"></td><td data-order="-0.02"></td></tr>';
const page = (rows: string) => `<div style="text-align: right;">As of  Oct 13, 2026 3:50 PM</div><table><tbody>${rows}</tbody></table>`;

describe('parseKse100', () => {
  it('reads the KSE-100 row and the as-of stamp', () => {
    assert.deepEqual(parseKse100(page(KSE100PR_ROW + KSE100_ROW)), {
      value: 164776.44,
      change: -347.97000000000116,
      changePct: -0.21073201714997872,
      high: 166070.47,
      low: 164773.66,
      asOf: 'Oct 13, 2026 3:50 PM',
    });
  });

  it('never mistakes KSE100PR for KSE100', () => {
    assert.equal(parseKse100(page(KSE100PR_ROW)), null);
  });

  it('returns null when the markup no longer has five numeric columns', () => {
    assert.equal(parseKse100(page('<tr><td data-code="KSE100">KSE100</td><td data-order="1">1</td></tr>')), null);
    assert.equal(parseKse100('<html>maintenance</html>'), null);
  });
});

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


