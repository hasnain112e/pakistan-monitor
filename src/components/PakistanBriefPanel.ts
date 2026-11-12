import { Panel } from './Panel';
import { joinSafeHtml, safeHtml, safeUrlAttr } from '@/utils/sanitize';
import { startSmartPollLoop, type SmartPollLoopHandle } from '@/services/smart-poll-loop';
import {
  briefHeadlines,
  detectPakistanTopics,
  errorMessage,
  formatPakistanBriefMarkdown,
  formatTime,
  requestBrief,
  type PakistanBrief,
} from '@/services/pakistan-desk';
import type { NewsItem } from '@/types';

/**
 * AI brief over the Pakistan headlines the news panel already loaded. When no
 * model is reachable it tags and surfaces those real headlines with watchlist
 * topic chips and one-click Markdown export — never invented summary text.
 */
export class PakistanBriefPanel extends Panel {
  private readonly loop: SmartPollLoopHandle;
  private lastHeadlineKey = '';
  private currentItems: NewsItem[] = [];
  private currentBrief: PakistanBrief | null = null;
  private activeTopic = 'all';
  private llmStatus: 'pending' | 'ready' | 'offline' = 'pending';
  private llmError = '';
  private copied = false;
  private copyTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly getHeadlines: () => NewsItem[]) {
    super({
      id: 'pk-brief',
      title: 'AI Brief',
      infoTooltip: 'Summarizes Pakistan headlines with Ollama or an OpenAI-compatible endpoint, adds watchlist topic tags, and exports a Markdown brief.',
    });
    this.showLoading('Waiting for Pakistan headlines…');
    this.content.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const topicBtn = target.closest<HTMLButtonElement>('button[data-brief-topic]');
      if (topicBtn) {
        this.activeTopic = topicBtn.dataset.briefTopic ?? 'all';
        this.renderCurrentState();
        return;
      }
      if (target.closest('button[data-brief-export]')) {
        void this.exportMarkdownBrief();
      }
    });
    // Polls cheaply: the model is only called when the headline set changes, so
    // a short interval just makes the first brief land soon after news loads.
    this.loop = startSmartPollLoop(() => this.refresh(), { intervalMs: 15_000, runImmediately: true, pauseWhenHidden: true });
  }

  private async refresh(): Promise<void> {
    const items = briefHeadlines(this.getHeadlines(), 12);
    const key = items.slice(0, 8).map((item) => item.title).join('\n');
    if (items.length === 0 || key === this.lastHeadlineKey) return;
    this.currentItems = items;
    if (this.llmStatus === 'pending') {
      this.renderCurrentState();
    }
    try {
      const brief = await requestBrief(items.slice(0, 8).map((item) => `${item.title} (${item.source})`), this.signal);
      if (this.signal.aborted) return;
      this.currentBrief = brief;
      this.llmStatus = 'ready';
      this.llmError = '';
      this.renderCurrentState();
    } catch (error) {
      if (this.signal.aborted) return;
      this.currentBrief = null;
      this.llmStatus = 'offline';
      this.llmError = errorMessage(error);
      this.renderCurrentState();
    } finally {
      this.lastHeadlineKey = key;
    }
  }

  private async exportMarkdownBrief(): Promise<void> {
    const markdown = formatPakistanBriefMarkdown({
      bullets: this.currentBrief?.bullets,
      items: this.currentItems,
      provider: this.currentBrief?.provider,
      model: this.currentBrief?.model,
      generatedAt: this.currentBrief?.generatedAt,
    });
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(markdown);
      } else {
        throw new Error('Clipboard unavailable');
      }
    } catch {
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pakistan-brief-${new Date().toISOString().slice(0, 10)}.md`;
      a.click();
      URL.revokeObjectURL(url);
    }
    this.copied = true;
    this.renderCurrentState();
    if (this.copyTimer) clearTimeout(this.copyTimer);
    this.copyTimer = setTimeout(() => {
      this.copied = false;
      this.renderCurrentState();
    }, 2000);
  }

  private renderCurrentState(): void {
    const items = this.currentItems;
    if (items.length === 0) return;

    const topicCounts = new Map<string, number>();
    for (const item of items) {
      for (const topic of detectPakistanTopics(item.title)) {
        topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
      }
    }

    const topicChips = joinSafeHtml([
      safeHtml`<button type="button" class="pk-filter-pill ${this.activeTopic === 'all' ? 'active' : ''}" data-brief-topic="all">All (${items.length})</button>`,
      ...[...topicCounts.entries()].map(([topic, count]) =>
        safeHtml`<button type="button" class="pk-filter-pill ${this.activeTopic === topic ? 'active' : ''}" data-brief-topic="${topic}">${topic} (${count})</button>`),
    ]);

    const exportBtn = safeHtml`<button type="button" class="pk-action-btn" data-brief-export="1">${this.copied ? 'Copied ✓' : '⤓ Export .md'}</button>`;

    if (this.llmStatus === 'ready' && this.currentBrief && this.activeTopic === 'all') {
      const brief = this.currentBrief;
      this.setSafeContent(safeHtml`<div class="pk-brief">
        <div class="pk-brief-toolbar">
          <span class="pk-badge">AI Summary · ${brief.provider}</span>
          ${exportBtn}
        </div>
        <div class="pk-filter-bar">${topicChips}</div>
        <ul class="pk-brief-list">${joinSafeHtml(brief.bullets.map((bullet) => safeHtml`<li>${bullet}</li>`))}</ul>
        <div class="pk-note">Generated from ${Math.min(8, items.length)} headlines · ${brief.model} · ${formatTime(brief.generatedAt)}. Check sources before acting.</div>
      </div>`);
      return;
    }

    const visibleItems = this.activeTopic === 'all'
      ? items.slice(0, 6)
      : items.filter((item) => detectPakistanTopics(item.title).includes(this.activeTopic)).slice(0, 8);

    const badge = this.llmStatus === 'pending'
      ? safeHtml`<span class="pk-badge">Summarizing…</span>`
      : this.llmStatus === 'ready'
        ? safeHtml`<span class="pk-badge">Filtered: ${this.activeTopic}</span>`
        : safeHtml`<span class="pk-badge pk-badge-warn">Watchlist · LLM offline</span>`;

    const links = joinSafeHtml(visibleItems.map((item) => {
      const tags = detectPakistanTopics(item.title);
      const tagHtml = tags.length
        ? safeHtml` <span class="pk-topic-tags-inline">${joinSafeHtml(tags.map((tag) => safeHtml`<span class="pk-topic-tag">${tag}</span>`))}</span>`
        : '';
      return safeHtml`<li><a href="${safeUrlAttr(item.link)}" target="_blank" rel="noopener">${item.title}</a>${tagHtml} <span class="pk-note">${item.source}</span></li>`;
    }));

    const note = this.llmStatus === 'offline'
      ? `Watchlist-tagged live headlines (${this.llmError}). Set Ollama or PK_BRIEF_* in .env.local for AI synthesis.`
      : 'Latest Pakistan headlines; click any topic chip to filter.';

    this.setSafeContent(safeHtml`<div class="pk-brief">
      <div class="pk-brief-toolbar">
        ${badge}
        ${exportBtn}
      </div>
      <div class="pk-filter-bar">${topicChips}</div>
      <ul class="pk-brief-list">${links}</ul>
      <div class="pk-note">${note}</div>
    </div>`);
  }

  public override destroy(): void {
    if (this.copyTimer) clearTimeout(this.copyTimer);
    this.loop.stop();
    super.destroy();
  }
}
