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
