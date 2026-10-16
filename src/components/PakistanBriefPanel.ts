import { Panel } from './Panel';
import { joinSafeHtml, safeHtml, safeUrlAttr } from '@/utils/sanitize';
import { startSmartPollLoop, type SmartPollLoopHandle } from '@/services/smart-poll-loop';
import { briefHeadlines, errorMessage, formatTime, requestBrief } from '@/services/pakistan-desk';
import type { NewsItem } from '@/types';

/**
 * AI brief over the Pakistan headlines the news panel already loaded. When no
 * model is reachable it shows those real headlines labelled "LLM offline" —
 * never invented summary text.
 */
export class PakistanBriefPanel extends Panel {
  private readonly loop: SmartPollLoopHandle;
  private lastHeadlineKey = '';
  private rendered = false;

  constructor(private readonly getHeadlines: () => NewsItem[]) {
    super({
      id: 'pk-brief',
      title: 'AI Brief',
      infoTooltip: 'Summarizes the latest Pakistan headlines with a local Ollama model, or an OpenAI-compatible endpoint such as Groq. AI output can be wrong: check the linked sources before acting.',
    });
    this.showLoading('Waiting for Pakistan headlines…');
    // Polls cheaply: the model is only called when the headline set changes, so
    // a short interval just makes the first brief land soon after news loads.
    this.loop = startSmartPollLoop(() => this.refresh(), { intervalMs: 15_000, runImmediately: true, pauseWhenHidden: true });
  }

  private async refresh(): Promise<void> {
    // 8 headlines keep a slow local model's answer near a minute.
    const items = briefHeadlines(this.getHeadlines(), 8);
    const key = items.map((item) => item.title).join('\n');
    if (items.length === 0 || key === this.lastHeadlineKey) return;
    // Headlines first: a local model can take a minute, and the panel should be
    // useful meanwhile. A later refresh keeps the previous brief up instead.
    if (!this.rendered) this.renderHeadlines(items, 'Summarizing…', 'pk-badge', 'Latest headlines; the AI brief replaces them when the model answers.');
    this.rendered = true;
    try {
      const brief = await requestBrief(items.map((item) => `${item.title} (${item.source})`), this.signal);
      if (this.signal.aborted) return;
      this.setSafeContent(safeHtml`<div class="pk-brief">
        <ul class="pk-brief-list">${joinSafeHtml(brief.bullets.map((bullet) => safeHtml`<li>${bullet}</li>`))}</ul>
        <div class="pk-note">AI-generated from ${items.length} headlines · ${brief.provider} · ${brief.model} · ${formatTime(brief.generatedAt)}. Check sources before acting.</div>
      </div>`);
    } catch (error) {
      if (this.signal.aborted) return;
      this.renderHeadlines(items, 'LLM offline', 'pk-badge pk-badge-warn',
        `No AI model reachable (${errorMessage(error)}), so these are the latest headlines, not a summary. Start Ollama or set PK_BRIEF_* in .env.local.`);
    } finally {
      // Set either way: a dead model is retried when the headlines change, not every poll.
      this.lastHeadlineKey = key;
    }
  }

  private renderHeadlines(items: NewsItem[], badge: string, badgeClass: string, note: string): void {
    const links = joinSafeHtml(items.slice(0, 5).map((item) =>
      safeHtml`<li><a href="${safeUrlAttr(item.link)}" target="_blank" rel="noopener">${item.title}</a> <span class="pk-note">${item.source}</span></li>`));
    this.setSafeContent(safeHtml`<div class="pk-brief">
      <span class="${badgeClass}">${badge}</span>
      <ul class="pk-brief-list">${links}</ul>
      <div class="pk-note">${note}</div>
    </div>`);
  }

  public override destroy(): void {
    this.loop.stop();
    super.destroy();
  }
}
