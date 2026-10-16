import { Panel } from './Panel';
import { joinSafeHtml, safeHtml, safeUrlAttr } from '@/utils/sanitize';
import { districtHeadlines, findDistrict } from '@/services/pk-gazetteer';
import { formatTime } from '@/services/pakistan-desk';
import type { NewsItem } from '@/types';

export class PakistanDistrictPanel extends Panel {
  constructor(private readonly getNews: () => NewsItem[]) {
    super({
      id: 'pk-district',
      title: 'District',
      infoTooltip: 'Click any district on the map to see the latest headlines that name it. Boundaries: geoBoundaries (public domain).',
    });
    this.setSafeContent(safeHtml`<div class="pk-note">Click a district on the map.</div>`);
  }

  public showDistrict(name: string): void {
    const place = findDistrict(name);
    const items = districtHeadlines(this.getNews(), name).slice(0, 12);
    const list = items.length
      ? joinSafeHtml(items.map((item) => safeHtml`<li><a href="${safeUrlAttr(item.link)}" target="_blank" rel="noopener">${item.title}</a> <span class="pk-note">${item.source} · ${formatTime(item.pubDate.toISOString())}</span></li>`))
      : safeHtml`<li class="pk-note">No loaded headline names ${name} right now.</li>`;
    this.setSafeContent(safeHtml`<div class="pk-district">
      <div class="pk-stat-label">${place?.province ?? 'Pakistan'}</div>
      <div class="pk-stat-value">${name}${place?.nameUr ? safeHtml` <span class="pk-urdu">${place.nameUr}</span>` : ''}</div>
      <ul class="pk-brief-list">${list}</ul>
    </div>`);
  }
}
