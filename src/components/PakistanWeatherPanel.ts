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
