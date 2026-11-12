/**
 * Middle East War Room & Conflict Radar Panel.
 * Provides commercial-grade kinetic strike tracking, naval chokepoint surveillance,
 * and real-time flashpoint updates for the Middle East theater.
 */

import { Panel } from './Panel';
import { safeHtml, joinSafeHtml, safeUrlAttr } from '@/utils/sanitize';
import { startSmartPollLoop, type SmartPollLoopHandle } from '@/services/smart-poll-loop';
import {
  ME_THREAT_BASELINE,
  extractLiveWarEvents,
  type KineticIncident,
  type WarTheater,
} from '@/services/me-war-intel';
import type { NewsItem } from '@/types';
import { openProIntelligenceModal } from './ProIntelligenceModal';

export class MiddleEastWarPanel extends Panel {
  private readonly loop: SmartPollLoopHandle;
  private currentTheater: WarTheater | 'all' = 'all';
  private incidents: KineticIncident[] = [];
  private lastKey = '';

  constructor(
    private readonly getNews: () => NewsItem[],
    private readonly focusMap: (lat: number, lon: number) => void
  ) {
    super({
      id: 'me-war-room',
      title: 'Middle East War Room',
      infoTooltip: 'Live kinetic strikes, drone/missile interceptions, Bab el-Mandeb & Hormuz maritime chokepoints telemetry, and tactical regional defense updates.',
    });

    this.showLoading('Monitoring Middle East war frequencies…');

    // Event listener for map focus and filter buttons
    this.content.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;

      // Handle map focus button
      const mapBtn = target.closest<HTMLButtonElement>('button[data-map-lat]');
      if (mapBtn) {
        const lat = parseFloat(mapBtn.dataset.mapLat ?? '0');
        const lon = parseFloat(mapBtn.dataset.mapLon ?? '0');
        if (lat && lon) {
          this.focusMap(lat, lon);
        }
        return;
      }

      // Handle theater filter pill buttons
      const filterBtn = target.closest<HTMLButtonElement>('button[data-theater]');
      if (filterBtn) {
        const theater = filterBtn.dataset.theater as WarTheater | 'all';
        this.currentTheater = theater;
        this.renderPanel();
        return;
      }

      // Handle Telegram Dispatch Demo / PRO button
      const proBtn = target.closest<HTMLButtonElement>('.me-pro-trigger');
      if (proBtn) {
        openProIntelligenceModal();
        return;
      }
    });

    this.loop = startSmartPollLoop(() => this.refresh(), {
      intervalMs: 25_000,
      runImmediately: true,
      pauseWhenHidden: true,
    });
  }

  private refresh(): void {
    const rawNews = this.getNews();
    const incidents = extractLiveWarEvents(rawNews);
    const key = `${this.currentTheater}:${incidents.map((i) => i.id).join('|')}`;

    if (key === this.lastKey && this.incidents.length > 0) return;
    this.lastKey = key;
    this.incidents = incidents;
    this.setCount(incidents.length);
    this.renderPanel();
  }

  private renderPanel(): void {
    const matrix = ME_THREAT_BASELINE;
    const filtered =
      this.currentTheater === 'all'
        ? this.incidents
        : this.incidents.filter((i) => i.theater === this.currentTheater);

    // 1. HUD Threat Matrix Header
    const hudHeader = safeHtml`
      <div class="me-threat-hud">
        <div class="me-hud-top">
          <div class="me-defcon-badge">
            <span class="me-pulse-dot"></span>
            <b>${matrix.defconStatus}</b>
          </div>
          <div class="me-crude-badge" title="Brent Crude Oil & War Risk Spread">
            <span class="me-crude-label">BRENT CRUDE</span>
            <span class="me-crude-val">$${matrix.brentCrudePrice.toFixed(2)}</span>
            <span class="me-crude-spread">+$${matrix.brentWarPremium.toFixed(2)} WAR RISK</span>
          </div>
        </div>

        <div class="me-chokepoint-strip">
          <div class="me-choke-card me-risk-critical" title="Bab el-Mandeb Red Sea corridor">
            <div class="me-choke-title">BAB EL-MANDEB</div>
            <div class="me-choke-stat">RISK: CRITICAL (${matrix.chokepoints.babElMandeb.trafficChangePct}%)</div>
            <div class="me-choke-note">Houthis: Anti-ship missiles · Cape routing</div>
          </div>
          <div class="me-choke-card me-risk-high" title="Strait of Hormuz Persian Gulf chokepoint">
            <div class="me-choke-title">STRAIT OF HORMUZ</div>
            <div class="me-choke-stat">RISK: HIGH · 20.6M BPD</div>
            <div class="me-choke-note">IRGC electronic radar & gunboat surveillance</div>
          </div>
        </div>
      </div>
    `;

    // 2. Commercial PRO Bot Banner
    const proBanner = safeHtml`
      <div class="me-pro-banner">
        <div class="me-pro-left">
          <span class="me-pro-badge">PRO INTEL BOT</span>
          <span class="me-pro-text">Zero-latency Telegram Flash War Alerts active</span>
        </div>
        <button type="button" class="me-pro-trigger">⚡ TEST TELEGRAM DISPATCH</button>
      </div>
    `;

    // 3. Theater Filter Tabs
    const filterTabs = safeHtml`
      <div class="me-theater-tabs">
        <button type="button" class="me-tab ${this.currentTheater === 'all' ? 'me-tab-active' : ''}" data-theater="all">All Fronts (${this.incidents.length})</button>
        <button type="button" class="me-tab ${this.currentTheater === 'red-sea' ? 'me-tab-active' : ''}" data-theater="red-sea">Red Sea / Houthi</button>
        <button type="button" class="me-tab ${this.currentTheater === 'hormuz' ? 'me-tab-active' : ''}" data-theater="hormuz">Hormuz / Gulf</button>
        <button type="button" class="me-tab ${this.currentTheater === 'levant' ? 'me-tab-active' : ''}" data-theater="levant">Israel / Lebanon</button>
        <button type="button" class="me-tab ${this.currentTheater === 'iran-axis' ? 'me-tab-active' : ''}" data-theater="iran-axis">Iran / Syria Axis</button>
      </div>
    `;

    // 4. Kinetic Incident Cards
    const incidentRows = filtered.map((i) => {
      const sevClass = `me-sev-${i.severity}`;
      return safeHtml`
        <li class="me-incident-card ${sevClass}">
          <div class="me-incident-meta">
            <span class="me-badge me-badge-${i.severity}">${i.category}</span>
            <span class="me-loc">${i.location}</span>
            <span class="me-time">${i.timestamp}</span>
          </div>
          <div class="me-incident-title">
            <a href="${safeUrlAttr(i.url)}" target="_blank" rel="noopener">${i.title}</a>
          </div>
          <div class="me-incident-summary">${i.summary}</div>
          <div class="me-incident-foot">
            <span class="me-src">${i.source}</span>
            <button type="button" class="me-map-btn" data-map-lat="${i.lat}" data-map-lon="${i.lon}" aria-label="Center map on ${i.location}">
              📍 Focus Map
            </button>
          </div>
        </li>
      `;
    });

    const incidentList = safeHtml`<ul class="me-incident-list">${joinSafeHtml(incidentRows)}</ul>`;

    this.setSafeContent(safeHtml`
      <div class="me-war-container">
        ${hudHeader}
        ${proBanner}
        ${filterTabs}
        ${incidentList}
      </div>
    `);
  }

  public override destroy(): void {
    this.loop.stop();
    super.destroy();
  }
}

export default MiddleEastWarPanel;
