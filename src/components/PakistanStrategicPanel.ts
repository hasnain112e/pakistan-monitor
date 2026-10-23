/**
 * Pakistan Strategic Corridors & Fuel Runway Panel.
 * Tracks Pakistan's fuel stock reserves against Middle East chokepoint risks,
 * commercial flight rerouting through Karachi/Lahore FIRs, and GCC remittance lifelines.
 */

import { Panel } from './Panel';
import { safeHtml, type SafeHtml } from '@/utils/sanitize';
import { startSmartPollLoop, type SmartPollLoopHandle } from '@/services/smart-poll-loop';

export interface FuelStock {
  name: string;
  daysCover: number;
  benchmarkDays: number;
  status: 'optimal' | 'adequate' | 'warning';
}

export class PakistanStrategicPanel extends Panel {
  private readonly loop: SmartPollLoopHandle;

  private fuelStocks: FuelStock[] = [
    { name: 'Mogas (Petrol)', daysCover: 24, benchmarkDays: 20, status: 'adequate' },
    { name: 'High Speed Diesel (HSD)', daysCover: 38, benchmarkDays: 30, status: 'optimal' },
    { name: 'Jet Fuel (A-1)', daysCover: 29, benchmarkDays: 25, status: 'adequate' },
    { name: 'Crude Oil (Refineries)', daysCover: 21, benchmarkDays: 20, status: 'adequate' },
  ];

  constructor(private readonly focusMap: (lat: number, lon: number) => void) {
    super({
      id: 'pk-strategic',
      title: 'Strategic Corridors & POL Runway',
      infoTooltip: 'Pakistan national fuel supply runway, Middle East conflict airspace rerouting over Karachi/Lahore FIRs, and Gwadar CPEC maritime protection.',
    });

    this.showLoading();

    this.content.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const mapBtn = target.closest<HTMLButtonElement>('button[data-strategic-focus]');
      if (mapBtn) {
        const place = mapBtn.dataset.strategicFocus;
        if (place === 'gwadar') this.focusMap(25.1264, 62.3225);
        if (place === 'karachi-fir') this.focusMap(24.8607, 67.0011);
        if (place === 'lahore-fir') this.focusMap(31.5204, 74.3587);
        if (place === 'taftan') this.focusMap(28.9667, 61.5833);
      }
    });

    this.loop = startSmartPollLoop(() => this.refresh(), {
      intervalMs: 60_000,
      runImmediately: true,
      pauseWhenHidden: true,
    });
  }

  private refresh(): void {
    this.render();
  }

  private render(): void {
    const fuelRows = this.fuelStocks.map((stock) => {
      const pct = Math.min(100, Math.round((stock.daysCover / 45) * 100));
      const color = stock.daysCover >= 30 ? '#2ecc71' : stock.daysCover >= 20 ? '#f39c12' : '#e74c3c';

      return safeHtml`
        <div class="pk-strat-fuel-item">
          <div class="pk-strat-fuel-meta">
            <span class="pk-strat-fuel-name">${stock.name}</span>
            <span class="pk-strat-fuel-days" style="color: ${color}">${stock.daysCover} Days Cover</span>
          </div>
          <div class="pk-strat-bar-track">
            <div class="pk-strat-bar-fill" style="width: ${pct}%; background: ${color}"></div>
          </div>
        </div>
      `;
    });

    this.setSafeContent(safeHtml`
      <div class="pk-strat-container">
        <!-- Fuel Runway Section -->
        <div class="pk-strat-section">
          <div class="pk-strat-sec-hdr">
            <span>NATIONAL POL STOCKPILE (DAYS OF COVER)</span>
            <span class="pk-strat-badge pk-strat-badge-ok">SUPPLY NORMAL</span>
          </div>
          <div class="pk-strat-fuel-grid">
            ${fuelRows}
          </div>
          <div class="pk-strat-hint">Benchmark minimum: 20 days. 85% of crude imported via Gulf/Hormuz tankers.</div>
        </div>

        <!-- Airspace Rerouting Section -->
        <div class="pk-strat-section">
          <div class="pk-strat-sec-hdr">
            <span>AIRSPACE TRAFFIC (ME CONFLICT DIVERSION)</span>
            <span class="pk-strat-badge pk-strat-badge-amber">+31.4% TRAFFIC SURGE</span>
          </div>
          <div class="pk-strat-flight-stats">
            <div class="pk-strat-stat-card">
              <div class="pk-strat-num">+148</div>
              <div class="pk-strat-lbl">Daily Flights Rerouted via Pakistan</div>
            </div>
            <div class="pk-strat-stat-card">
              <div class="pk-strat-num">$820K</div>
              <div class="pk-strat-lbl">Daily Overflight Navigation Revenue</div>
            </div>
          </div>
          <div class="pk-strat-buttons">
            <button type="button" class="pk-map-btn" data-strategic-focus="karachi-fir">Karachi FIR</button>
            <button type="button" class="pk-map-btn" data-strategic-focus="lahore-fir">Lahore FIR</button>
            <button type="button" class="pk-map-btn" data-strategic-focus="gwadar">Gwadar Port</button>
            <button type="button" class="pk-map-btn" data-strategic-focus="taftan">Pak-Iran Taftan Border</button>
          </div>
        </div>

        <!-- Economic Nexus -->
        <div class="pk-strat-section pk-strat-econ">
          <div class="pk-strat-sec-hdr">
            <span>GCC REMITTANCES LIFELINE (WAR EXPOSURE)</span>
            <span class="pk-strat-badge pk-strat-badge-ok">$1.42B / MO</span>
          </div>
          <div class="pk-strat-remit-pills">
            <span><b>Saudi Arabia</b> $650M</span>
            <span><b>UAE</b> $480M</span>
            <span><b>Qatar/Oman</b> $290M</span>
          </div>
        </div>
      </div>
    `);
  }

  public override destroy(): void {
    this.loop.stop();
    super.destroy();
  }
}

export default PakistanStrategicPanel;
