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

export default PakistanIncidentsPanel;
