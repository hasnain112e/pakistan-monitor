import { Panel } from './Panel';
import { joinSafeHtml, safeHtml, safeUrlAttr } from '@/utils/sanitize';
import { startSmartPollLoop, type SmartPollLoopHandle } from '@/services/smart-poll-loop';
import { districtHeadlines, findDistrict } from '@/services/pk-gazetteer';
import { detectPakistanTopics, formatTime } from '@/services/pakistan-desk';
import type { NewsItem } from '@/types';

const QUICK_HUBS = ['Islamabad', 'Karachi', 'Lahore', 'Peshawar', 'Quetta', 'Gwadar', 'Rawalpindi', 'Swat'] as const;

export class PakistanDistrictPanel extends Panel {
  private readonly loop: SmartPollLoopHandle;
  private selectedDistrict = 'Islamabad';
  private lastRenderKey = '';

  constructor(private readonly getNews: () => NewsItem[]) {
    super({
      id: 'pk-district',
      title: 'District Desk',
      infoTooltip: 'Click any district on the map or pick a strategic hub below to see live headlines, Urdu place name, and topic signals.',
    });
    this.content.addEventListener('click', (event) => {
      const btn = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-district-hub]');
      if (btn?.dataset.districtHub) {
        this.showDistrict(btn.dataset.districtHub);
      }
    });
    this.renderDistrict(this.selectedDistrict);
    this.loop = startSmartPollLoop(() => this.refresh(), { intervalMs: 30_000, runImmediately: true, pauseWhenHidden: true });
  }

  private refresh(): void {
    const news = this.getNews();
    const key = `${this.selectedDistrict}:${news.length}:${news[0]?.link ?? ''}`;
    if (key === this.lastRenderKey) return;
    this.lastRenderKey = key;
    this.renderDistrict(this.selectedDistrict);
  }

  public showDistrict(name: string): void {
    this.selectedDistrict = name;
    this.lastRenderKey = '';
    this.renderDistrict(name);
  }

  private renderDistrict(name: string): void {
    const news = this.getNews();
    const place = findDistrict(name);
    const items = districtHeadlines(news, name).slice(0, 12);

    const hubChips = joinSafeHtml(QUICK_HUBS.map((hub) => {
      const count = districtHeadlines(news, hub).length;
      const active = hub.toLowerCase() === name.toLowerCase();
      return safeHtml`<button type="button" class="pk-hub-chip ${active ? 'active' : ''}" data-district-hub="${hub}" aria-pressed="${String(active)}">${hub}${count > 0 ? safeHtml` <b>${count}</b>` : ''}</button>`;
    }));

    const topicCounts = new Map<string, number>();
    for (const item of items) {
      for (const tag of detectPakistanTopics(item.title)) {
        topicCounts.set(tag, (topicCounts.get(tag) ?? 0) + 1);
      }
    }
    const topicBadges = topicCounts.size
      ? safeHtml`<div class="pk-topic-tags">${joinSafeHtml([...topicCounts.entries()].map(([tag, n]) => safeHtml`<span class="pk-topic-tag">${tag} · ${n}</span>`))}</div>`
      : '';

    const list = items.length
      ? joinSafeHtml(items.map((item) => safeHtml`<li><a href="${safeUrlAttr(item.link)}" target="_blank" rel="noopener">${item.title}</a> <span class="pk-note">${item.source} · ${formatTime(item.pubDate.toISOString())}</span></li>`))
      : safeHtml`<li class="pk-note">No loaded headline names ${name} right now. Click another hub or district on the map.</li>`;

    this.setSafeContent(safeHtml`<div class="pk-district">
      <div class="pk-hub-grid">${hubChips}</div>
      <div class="pk-stat-label">${place?.province ?? 'Pakistan'} · ${items.length} headline${items.length === 1 ? '' : 's'}</div>
      <div class="pk-stat-value">${name}${place?.nameUr ? safeHtml` <span class="pk-urdu">${place.nameUr}</span>` : ''}</div>
      ${topicBadges}
      <ul class="pk-brief-list">${list}</ul>
    </div>`);
  }

  public override destroy(): void {
    this.loop.stop();
    super.destroy();
  }
}
