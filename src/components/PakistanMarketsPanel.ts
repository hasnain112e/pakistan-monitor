import { Panel } from './Panel';
import { joinSafeHtml, safeHtml } from '@/utils/sanitize';
import type { SafeHtml } from '@/utils/sanitize';
import { startSmartPollLoop, type SmartPollLoopHandle } from '@/services/smart-poll-loop';
import { errorMessage, fetchKse100, fetchPkrRates, formatTime, type Kse100Quote, type PkrRates } from '@/services/pakistan-desk';
import { fetchGold, type GoldRate } from '@/services/pk-gold';

const FX_MAX_AGE_MS = 60 * 60_000; // open.er-api.com publishes once a day
const GOLD_MAX_AGE_MS = 30 * 60_000;

const number = (value: number, digits: number): string =>
  value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const signed = (value: number): string => `${value >= 0 ? '+' : ''}${number(value, 2)}`;

const INDEX_NAMES: Record<string, string> = {
  KSE30: 'KSE-30', ALLSHR: 'All Share', KMI30: 'KMI-30 (Shariah)', BKTI: 'Banks', OGTI: 'Oil & Gas',
};

export class PakistanMarketsPanel extends Panel {
  private readonly loop: SmartPollLoopHandle;
  private kse: Kse100Quote | null = null;
  private kseError: string | null = null;
  private fx: (PkrRates & { updated: string | null }) | null = null;
  private fxError: string | null = null;
  private fxFetchedAt = 0;
  private gold: GoldRate | null = null;
  private goldFetchedAt = 0;

  constructor() {
    super({
      id: 'pk-markets',
      title: 'Markets & Rupee',
      infoTooltip: 'KSE-100 from the PSX Data Portal, refreshed every 5 minutes; if PSX is unreachable the last good value is shown marked stale. Rupee rates from open.er-api.com, published daily.',
    });
    this.showLoading();
    this.loop = startSmartPollLoop(() => this.refresh(), { intervalMs: 5 * 60_000, runImmediately: true, pauseWhenHidden: true });
  }

  private async refresh(): Promise<void> {
    const wantFx = Date.now() - this.fxFetchedAt > FX_MAX_AGE_MS;
    const wantGold = Date.now() - this.goldFetchedAt > GOLD_MAX_AGE_MS;
    const [kse, fx, gold] = await Promise.allSettled([
      fetchKse100(this.signal),
      wantFx ? fetchPkrRates(this.signal) : Promise.resolve(this.fx),
      wantGold ? fetchGold(this.signal) : Promise.resolve(this.gold),
    ]);
    if (this.signal.aborted) return;
    if (kse.status === 'fulfilled') [this.kse, this.kseError] = [kse.value, null];
    else this.kseError = errorMessage(kse.reason);
    if (fx.status === 'fulfilled') {
      if (wantFx) this.fxFetchedAt = Date.now();
      [this.fx, this.fxError] = [fx.value, null];
    } else {
      this.fxError = errorMessage(fx.reason);
    }
    if (gold.status === 'fulfilled') {
      if (wantGold) this.goldFetchedAt = Date.now();
      this.gold = gold.value;
    }
    this.setSafeContent(safeHtml`<div class="pk-markets">${this.renderKse()}${this.renderFx()}${this.renderGold()}</div>`);
  }

  private renderKse(): SafeHtml {
    const q = this.kse;
    if (!q) return safeHtml`<div class="pk-stat"><div class="pk-stat-label">KSE-100</div><div class="pk-note pk-warn">Unavailable: ${this.kseError ?? 'no data'}</div></div>`;
    const source = q.asOf ? `PSX · as of ${q.asOf} PKT` : `PSX · fetched ${formatTime(q.fetchedAt)}`;
    const others = (q.indices ?? []).filter((i) => i.code !== 'KSE100');
    const table = others.length
      ? safeHtml`<div class="pk-index-table">${joinSafeHtml(others.map((i) => safeHtml`<div class="pk-index-row">
          <span>${INDEX_NAMES[i.code] ?? i.code}</span><span>${number(i.value, 0)}</span>
          <span class="${i.change < 0 ? 'pk-down' : 'pk-up'}">${signed(i.changePct)}%</span>
        </div>`))}</div>`
      : '';
    return safeHtml`<div class="pk-stat">
      <div class="pk-stat-label">KSE-100 ${q.stale ? safeHtml`<span class="pk-badge pk-badge-warn" title="PSX unreachable; last good quote">stale</span>` : ''}</div>
      <div class="pk-stat-value">${number(q.value, 2)}</div>
      <div class="pk-stat-change ${q.change < 0 ? 'pk-down' : 'pk-up'}">${signed(q.change)} (${signed(q.changePct)}%)</div>
      ${table}
      <div class="pk-note">${source}</div>
      ${this.kseError ? safeHtml`<div class="pk-note pk-warn">Refresh failed: ${this.kseError}</div>` : ''}
    </div>`;
  }

  private renderFx(): SafeHtml {
    const fx = this.fx;
    if (!fx) return safeHtml`<div class="pk-stat"><div class="pk-stat-label">USD / PKR</div><div class="pk-note pk-warn">Unavailable: ${this.fxError ?? 'no data'}</div></div>`;
    const crosses = joinSafeHtml(fx.crosses.map((c) => safeHtml`<span><b>${c.code}</b> ${number(c.pkr, 2)}</span>`));
    return safeHtml`<div class="pk-stat">
      <div class="pk-stat-label">USD / PKR</div>
      <div class="pk-stat-value">${number(fx.usd, 2)}</div>
      <div class="pk-cross">${crosses}</div>
      <div class="pk-note">open.er-api.com${fx.updated ? ` · ${fx.updated}` : ''}</div>
      ${this.fxError ? safeHtml`<div class="pk-note pk-warn">Refresh failed: ${this.fxError}</div>` : ''}
    </div>`;
  }

  private renderGold(): SafeHtml {
    const g = this.gold;
    if (!g) return safeHtml``;
    return safeHtml`<div class="pk-stat">
      <div class="pk-stat-label">Gold (per tola) ${g.stale ? safeHtml`<span class="pk-badge pk-badge-warn">stale</span>` : ''}</div>
      <div class="pk-stat-value">PKR ${number(g.perTola, 0)}</div>
      <div class="pk-note">forex.pk · ${formatTime(g.fetchedAt)}</div>
    </div>`;
  }

  public override destroy(): void {
    this.loop.stop();
    super.destroy();
  }
}

