import { Panel } from './Panel';
import { joinSafeHtml, safeHtml } from '@/utils/sanitize';
import { startSmartPollLoop, type SmartPollLoopHandle } from '@/services/smart-poll-loop';
import { aqiBand, errorMessage, fetchAirQuality } from '@/services/pakistan-desk';

export class PakistanAirPanel extends Panel {
  private readonly loop: SmartPollLoopHandle;

  constructor() {
    super({
      id: 'pk-air',
      title: 'Air Quality',
      infoTooltip: 'US AQI and PM2.5 from the Open-Meteo Air Quality API (CAMS model, hourly). Modelled values on a ~40 km grid, not ground-station readings.',
    });
    this.showLoading();
    // CAMS updates hourly; 30 minutes keeps a long-lived tab current.
    this.loop = startSmartPollLoop(() => this.refresh(), { intervalMs: 30 * 60_000, runImmediately: true, pauseWhenHidden: true });
  }

  private async refresh(): Promise<void> {
    try {
      const { cities, observedAt } = await fetchAirQuality(this.signal);
      if (this.signal.aborted) return;
      const ranked = [...cities].sort((a, b) => (b.aqi ?? -1) - (a.aqi ?? -1));
      const rows = joinSafeHtml(ranked.map((city) => {
        if (city.aqi === null) {
          return safeHtml`<div class="pk-aqi-row"><span class="pk-aqi-city">${city.name}</span><span class="pk-note">no data</span></div>`;
        }
        const band = aqiBand(city.aqi);
        return safeHtml`<div class="pk-aqi-row">
          <span class="pk-aqi-badge pk-aqi-${band.level}">${Math.round(city.aqi)}</span>
          <span class="pk-aqi-city">${city.name}</span>
          <span class="pk-aqi-label">${band.label}</span>
          <span class="pk-aqi-pm">${city.pm25 === null ? '–' : Math.round(city.pm25)}</span>
        </div>`;
      }));
      this.setSafeContent(safeHtml`<div class="pk-air">
        ${rows}
        <div class="pk-note">US AQI · PM2.5 µg/m³ · Open-Meteo (CAMS)${observedAt ? ` · ${observedAt.replace('T', ' ')} PKT` : ''}</div>
      </div>`);
    } catch (error) {
      if (this.signal.aborted) return;
      this.showError(`Air quality unavailable: ${errorMessage(error)}`, () => this.loop.trigger());
    }
  }

  public override destroy(): void {
    this.loop.stop();
    super.destroy();
  }
}
