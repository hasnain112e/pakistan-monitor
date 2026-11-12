import { Panel } from './Panel';
import { joinSafeHtml, safeHtml, safeUrlAttr } from '@/utils/sanitize';
import { startSmartPollLoop, type SmartPollLoopHandle } from '@/services/smart-poll-loop';
import {
  countByProvince,
  filterPakistanIncidents,
  pakistanIncidents,
  type IncidentFilterGroup,
  type PkIncident,
} from '@/services/pk-incidents';
import { formatTime } from '@/services/pakistan-desk';
import type { NewsItem } from '@/types';

const FILTER_GROUPS: Array<{ id: IncidentFilterGroup; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'security', label: 'Security' },
  { id: 'protest', label: 'Protest' },
  { id: 'disaster', label: 'Disaster' },
  { id: 'infra', label: 'Infra / Civic' },
];

export class PakistanIncidentsPanel extends Panel {
  private readonly loop: SmartPollLoopHandle;
  private lastKey = '';
  private allIncidents: PkIncident[] = [];
  private visibleIncidents: PkIncident[] = [];
  private activeGroup: IncidentFilterGroup = 'all';
  private activeProvince: string | null = null;

  constructor(private readonly getNews: () => NewsItem[], private readonly focusMap: (lat: number, lon: number) => void) {
    super({
      id: 'pk-incidents',
      title: 'Incidents',
      infoTooltip: 'Pakistani headlines classified as terrorism, conflict, protest, crime, disaster, infrastructure or health, placed with the Pakistan gazetteer. Filter by category or province.',
    });
    this.showLoading('Waiting for headlines…');
    this.content.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const groupBtn = target.closest<HTMLButtonElement>('button[data-inc-group]');
      if (groupBtn) {
        this.activeGroup = (groupBtn.dataset.incGroup as IncidentFilterGroup) ?? 'all';
        this.render();
        return;
      }
      const provBtn = target.closest<HTMLButtonElement>('button[data-inc-province]');
      if (provBtn) {
        const prov = provBtn.dataset.incProvince ?? null;
        this.activeProvince = this.activeProvince === prov ? null : prov;
        this.render();
        return;
      }
      const button = target.closest<HTMLButtonElement>('button[data-incident]');
      const incident = button ? this.visibleIncidents[Number(button.dataset.incident)] : undefined;
      if (incident) this.focusMap(incident.place.lat, incident.place.lon);
    });
    this.loop = startSmartPollLoop(() => this.refresh(), { intervalMs: 30_000, runImmediately: true, pauseWhenHidden: true });
  }

  private refresh(): void {
    const incidents = pakistanIncidents(this.getNews()).slice(0, 40);
    const key = incidents.map((i) => i.item.link).join('|');
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.allIncidents = incidents;
    this.render();
  }

  private render(): void {
    if (this.allIncidents.length === 0) {
      this.setCount(0);
      this.setSafeContent(safeHtml`<div class="pk-note">No located incidents in the loaded Pakistani headlines.</div>`);
      return;
    }

    const filtered = filterPakistanIncidents(this.allIncidents, {
      province: this.activeProvince,
      group: this.activeGroup,
    }).slice(0, 25);
    this.visibleIncidents = filtered;
    this.setCount(filtered.length);

    const groupPills = joinSafeHtml(FILTER_GROUPS.map((g) => safeHtml`
      <button type="button" class="pk-filter-pill ${this.activeGroup === g.id ? 'active' : ''}" data-inc-group="${g.id}" aria-pressed="${String(this.activeGroup === g.id)}">${g.label}</button>
    `));

    const provinces = joinSafeHtml(countByProvince(this.allIncidents).map(([name, n]) => safeHtml`
      <button type="button" class="pk-filter-pill pk-prov-pill ${this.activeProvince === name ? 'active' : ''}" data-inc-province="${name}" aria-pressed="${String(this.activeProvince === name)}"><b>${name}</b> ${n}</button>
    `));

    const rows = filtered.length
      ? joinSafeHtml(filtered.map((i, index) => safeHtml`<li class="pk-incident pk-level-${i.level}">
          <span class="pk-badge">${i.category}</span>
          <a href="${safeUrlAttr(i.item.link)}" target="_blank" rel="noopener">${i.item.title}</a>
          <span class="pk-note">${i.place.name} · ${i.item.source} · ${formatTime(i.item.pubDate.toISOString())}</span>
          <button type="button" class="pk-map-btn" data-incident="${String(index)}" aria-label="Show ${i.place.name} on the map">map</button>
        </li>`))
      : safeHtml`<li class="pk-note">No incidents match the selected filters.</li>`;

    this.setSafeContent(safeHtml`
      <div class="pk-filter-bar">${groupPills}</div>
      <div class="pk-filter-bar">${provinces}</div>
      <ul class="pk-brief-list">${rows}</ul>
    `);
  }

  public override destroy(): void {
    this.loop.stop();
    super.destroy();
  }
}

export default PakistanIncidentsPanel;
