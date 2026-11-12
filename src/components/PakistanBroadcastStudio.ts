import type { NewsItem } from '@/types';
import { setTrustedHtml, trustedHtml } from '@/utils/dom-utils';
import { joinSafeHtml, safeHtml } from '@/utils/sanitize';
import {
  fetchAirQuality,
  fetchKse100,
  fetchPkrRates,
  type CityAirQuality,
  type Kse100Quote,
  type PkrRates,
} from '@/services/pakistan-desk';
import { fetchGold, type GoldRate } from '@/services/pk-gold';
import {
  buildBroadcastQueue,
  clearSeenBroadcastLinks,
  composeAnchorScript,
  loadSeenBroadcastLinks,
  pickSpeechVoice,
  playBroadcastChime,
  saveSeenBroadcastLinks,
  type BroadcastLangMode,
  type BroadcastStory,
} from '@/services/pk-broadcast-engine';

export interface BroadcastStudioOptions {
  getNews: () => NewsItem[];
  focusMap: (lat: number, lon: number, zoom?: number) => void;
  onClose?: () => void;
}

export class PakistanBroadcastStudio {
  private readonly root: HTMLElement;
  private isOpen = false;
  private isOnAir = false;
  private isSpeaking = false;
  private langMode: BroadcastLangMode = 'bilingual';
  private speechRate = 1.0;
  private chimeEnabled = true;

  private seenLinks: Set<string> = loadSeenBroadcastLinks();
  private queue: BroadcastStory[] = [];
  private currentStory: BroadcastStory | null = null;
  private currentCaption = 'Press “Start AI Anchor” to begin 24/7 live bilingual broadcast.';
  private currentSpeechLang = 'en-PK';

  private kse: Kse100Quote | null = null;
  private fx: (PkrRates & { updated: string | null }) | null = null;
  private gold: GoldRate | null = null;
  private aqiCities: CityAirQuality[] = [];

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private telemetryTimer: ReturnType<typeof setInterval> | null = null;
  private fallbackAdvanceTimer: ReturnType<typeof setTimeout> | null = null;
  private telemetryAbort: AbortController | null = null;

  constructor(private readonly opts: BroadcastStudioOptions) {
    this.root = document.createElement('div');
    this.root.id = 'pk-broadcast-studio';
    this.root.className = 'pk-studio-overlay';
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', 'Pakistan Monitor 24/7 AI Broadcast Studio');
    this.bindEvents();
  }

  public open(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.root.hidden = false;
    if (!this.root.parentElement) {
      document.body.appendChild(this.root);
    }
    document.body.classList.add('pk-studio-active');
    this.refreshQueue(true);
    void this.refreshTelemetry();

    this.pollTimer = setInterval(() => this.refreshQueue(false), 15_000);
    this.telemetryTimer = setInterval(() => void this.refreshTelemetry(), 3 * 60_000);
    this.clockTimer = setInterval(() => this.updateClock(), 1_000);
    this.render();
  }

  public close(): void {
    if (!this.isOpen) return;
    this.stopAnchor();
    this.isOpen = false;
    this.root.hidden = true;
    document.body.classList.remove('pk-studio-active');
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.telemetryTimer) clearInterval(this.telemetryTimer);
    if (this.clockTimer) clearInterval(this.clockTimer);
    this.pollTimer = null;
    this.telemetryTimer = null;
    this.clockTimer = null;
    this.telemetryAbort?.abort();
    this.opts.onClose?.();
  }

  public toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  public getIsOpen(): boolean {
    return this.isOpen;
  }

  public destroy(): void {
    this.close();
    this.root.remove();
  }

  private bindEvents(): void {
    this.root.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const actionBtn = target.closest<HTMLButtonElement>('button[data-studio-action]');
      if (!actionBtn) return;

      const action = actionBtn.dataset.studioAction;
      if (action === 'close') {
        this.close();
      } else if (action === 'toggle-air') {
        if (this.isOnAir) this.stopAnchor();
        else this.startAnchor();
      } else if (action === 'next') {
        this.playNextStory(true);
      } else if (action === 'test-breaking') {
        this.triggerTestBreaking();
      } else if (action === 'replay') {
        this.seenLinks.clear();
        clearSeenBroadcastLinks();
        this.refreshQueue(true);
        if (this.isOnAir) this.playNextStory(true);
        else this.render();
      } else if (action === 'toggle-chime') {
        this.chimeEnabled = !this.chimeEnabled;
        this.render();
      } else if (action === 'lang') {
        const mode = actionBtn.dataset.lang as BroadcastLangMode | undefined;
        if (mode) {
          this.langMode = mode;
          this.refreshQueue(true);
          if (this.isOnAir) this.playNextStory(true);
          else this.render();
        }
      } else if (action === 'speed') {
        const nextRate = this.speechRate === 1.0 ? 1.15 : this.speechRate === 1.15 ? 0.9 : 1.0;
        this.speechRate = nextRate;
        this.render();
      }
    });
  }

  private async refreshTelemetry(): Promise<void> {
    this.telemetryAbort?.abort();
    this.telemetryAbort = new AbortController();
    const { signal } = this.telemetryAbort;
    const [kse, fx, gold, aq] = await Promise.allSettled([
      fetchKse100(signal),
      fetchPkrRates(signal),
      fetchGold(signal),
      fetchAirQuality(signal),
    ]);
    if (signal.aborted || !this.isOpen) return;
    if (kse.status === 'fulfilled') this.kse = kse.value;
    if (fx.status === 'fulfilled') this.fx = fx.value;
    if (gold.status === 'fulfilled') this.gold = gold.value;
    if (aq.status === 'fulfilled') this.aqiCities = aq.value.cities;
    this.render();
  }

  private refreshQueue(forcePreview: boolean): void {
    const news = this.opts.getNews();
    let candidates = buildBroadcastQueue(news, this.seenLinks, this.langMode);
    if (candidates.length === 0 && news.length > 0 && this.isOnAir) {
      // 24/7 loop safety: once all loaded items have aired, recycle unseen window
      this.seenLinks.clear();
      clearSeenBroadcastLinks();
      candidates = buildBroadcastQueue(news, this.seenLinks, this.langMode);
    }
    this.queue = candidates;
    if ((forcePreview || !this.currentStory) && this.queue.length > 0) {
      const first = this.queue[0]!;
      this.currentStory = first;
      const script = composeAnchorScript(first, this.langMode);
      this.currentCaption = script.captionText;
      this.currentSpeechLang = script.speechLang;
      this.opts.focusMap(first.lat, first.lon, first.zoom);
    }
    if (this.isOnAir && !this.isSpeaking && this.queue.length > 0) {
      this.playNextStory(false);
    } else if (this.isOpen) {
      this.render();
    }
  }

  private startAnchor(): void {
    this.isOnAir = true;
    this.playNextStory(true);
  }

  private stopAnchor(): void {
    this.isOnAir = false;
    this.isSpeaking = false;
    if (this.fallbackAdvanceTimer) {
      clearTimeout(this.fallbackAdvanceTimer);
      this.fallbackAdvanceTimer = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (this.isOpen) this.render();
  }

  private triggerTestBreaking(): void {
    const sample: BroadcastStory = {
      id: `test-${Date.now()}`,
      title: 'Karachi Port & Strait of Hormuz maritime corridor advisory active — PSX energy stocks on watch',
      source: 'Pakistan Monitor Desk',
      link: '#broadcast-test',
      pubDate: new Date(),
      isUrdu: false,
      isBreaking: true,
      category: 'BREAKING',
      topics: ['Energy / POL', 'SBP / PKR'],
      placeName: 'Karachi',
      province: 'Sindh',
      lat: 24.8607,
      lon: 67.0011,
      zoom: 7,
    };
    this.queue = [sample, ...this.queue.filter((s) => s.id !== sample.id)];
    if (!this.isOnAir) this.isOnAir = true;
    this.playNextStory(true);
  }

  private playNextStory(manualSkip: boolean): void {
    if (this.fallbackAdvanceTimer) {
      clearTimeout(this.fallbackAdvanceTimer);
      this.fallbackAdvanceTimer = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    if (this.queue.length === 0) {
      this.refreshQueue(false);
    }

    const next = this.queue.shift();
    if (!next) {
      this.isSpeaking = false;
      this.currentCaption = 'Monitoring live Pakistan & regional feeds for new breaking developments…';
      this.render();
      return;
    }

    this.currentStory = next;
    if (!next.id.startsWith('test-')) {
      this.seenLinks.add(next.id);
      saveSeenBroadcastLinks(this.seenLinks);
    }

    if (this.chimeEnabled && (next.isBreaking || manualSkip)) {
      playBroadcastChime(next.isBreaking);
    }

    this.opts.focusMap(next.lat, next.lon, next.zoom);

    const script = composeAnchorScript(next, this.langMode);
    this.currentCaption = script.captionText;
    this.currentSpeechLang = script.speechLang;
    this.speakScript(script.spokenText, script.speechLang);
  }

  private speakScript(text: string, speechLang: string): void {
    const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
      this.isSpeaking = true;
      this.render();
      this.fallbackAdvanceTimer = setTimeout(() => {
        this.isSpeaking = false;
        if (this.isOnAir) this.playNextStory(false);
      }, 9000);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechLang;
    utterance.rate = this.speechRate;
    const voice = pickSpeechVoice(synth.getVoices(), speechLang);
    if (voice) utterance.voice = voice;

    this.isSpeaking = true;
    this.render();

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (this.fallbackAdvanceTimer) {
        clearTimeout(this.fallbackAdvanceTimer);
        this.fallbackAdvanceTimer = null;
      }
      this.isSpeaking = false;
      if (this.isOnAir) {
        setTimeout(() => {
          if (this.isOnAir) this.playNextStory(false);
        }, 1200);
      } else if (this.isOpen) {
        this.render();
      }
    };

    utterance.onend = finish;
    utterance.onerror = finish;

    // Chrome bug guard: long utterances occasionally stall without firing onend
    this.fallbackAdvanceTimer = setTimeout(finish, 26_000);
    synth.speak(utterance);
  }

  private pktClockText(): string {
    return `${new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Karachi',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date())} PKT`;
  }

  private updateClock(): void {
    const clockEl = this.root.querySelector('#pkStudioClock');
    if (clockEl) clockEl.textContent = this.pktClockText();
  }

  private renderTickerText(): string {
    const parts: string[] = [];
    if (this.kse) {
      const sign = this.kse.change >= 0 ? '+' : '';
      parts.push(`KSE-100 ${this.kse.value.toLocaleString('en-US', { maximumFractionDigits: 0 })} (${sign}${this.kse.changePct.toFixed(2)}%)`);
    }
    if (this.fx) parts.push(`USD/PKR ${this.fx.usd.toFixed(2)}`);
    if (this.gold) parts.push(`GOLD/TOLA PKR ${this.gold.perTola.toLocaleString('en-US')}`);
    const topAqi = this.aqiCities.filter((c) => c.aqi !== null).slice(0, 3);
    if (topAqi.length) {
      parts.push(topAqi.map((c) => `${c.name.toUpperCase()} AQI ${c.aqi}`).join(' · '));
    }
    const headlines = this.opts.getNews().slice(0, 6).map((n) => `${n.source}: ${n.title}`);
    parts.push(...headlines);
    return parts.length ? parts.join('   ◆   ') : 'PAKISTAN MONITOR 24/7 LIVE SITUATIONAL DESK · LOADING TELEMETRY…';
  }

  private render(): void {
    const story = this.currentStory;
    const isUrdu = Boolean(story?.isUrdu || this.currentSpeechLang.startsWith('ur'));
    const topicPills = story?.topics.length
      ? joinSafeHtml(story.topics.map((topic) => safeHtml`<span class="pk-studio-tag">${topic}</span>`))
      : safeHtml`<span class="pk-studio-tag">${story?.category ?? 'LIVE DESK'}</span>`;

    const kseChip = this.kse
      ? safeHtml`<span class="pk-studio-stat">KSE-100 <b>${this.kse.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}</b></span>`
      : '';
    const fxChip = this.fx
      ? safeHtml`<span class="pk-studio-stat">USD/PKR <b>${this.fx.usd.toFixed(2)}</b></span>`
      : '';

    const ticker = this.renderTickerText();

    const markup = safeHtml`
      <div class="pk-studio-top">
        <div class="pk-studio-brand">
          <span class="pk-studio-live-pill ${this.isOnAir ? 'on-air' : ''}">
            <span class="pk-studio-dot"></span>
            ${this.isOnAir ? 'ON AIR · 24/7 AI NEWS' : 'STUDIO STANDBY'}
          </span>
          <span class="pk-studio-title">PAKISTAN MONITOR TV</span>
          <span class="pk-studio-clock" id="pkStudioClock">${this.pktClockText()}</span>
          ${kseChip}${fxChip}
        </div>
        <div class="pk-studio-controls">
          <div class="pk-studio-seg" role="group" aria-label="Broadcast Language">
            <button type="button" class="pk-studio-btn ${this.langMode === 'bilingual' ? 'active' : ''}" data-studio-action="lang" data-lang="bilingual">Bilingual</button>
            <button type="button" class="pk-studio-btn ${this.langMode === 'ur' ? 'active' : ''}" data-studio-action="lang" data-lang="ur">Urdu</button>
            <button type="button" class="pk-studio-btn ${this.langMode === 'en' ? 'active' : ''}" data-studio-action="lang" data-lang="en">English</button>
          </div>
          <button type="button" class="pk-studio-btn pk-studio-btn-primary" data-studio-action="toggle-air">
            ${this.isOnAir ? '⏸ Pause Anchor' : '🎙 Start AI Anchor'}
          </button>
          <button type="button" class="pk-studio-btn" data-studio-action="next">⏭ Next (${this.queue.length})</button>
          <button type="button" class="pk-studio-btn" data-studio-action="speed">${this.speechRate}x</button>
          <button type="button" class="pk-studio-btn ${this.chimeEnabled ? 'active' : ''}" data-studio-action="toggle-chime">🔔 Chime</button>
          <button type="button" class="pk-studio-btn pk-studio-btn-warn" data-studio-action="test-breaking">⚡ Test Breaking</button>
          <button type="button" class="pk-studio-btn" data-studio-action="replay">↺ Replay All</button>
          <button type="button" class="pk-studio-btn" data-studio-action="close">✕ Exit</button>
        </div>
      </div>

      <div class="pk-studio-stage">
        <div class="pk-studio-map-badge">
          <span class="pk-studio-loc-pin">⌖</span>
          <div>
            <div class="pk-studio-loc-name">${story ? `${story.placeName} · ${story.province}` : 'Pakistan Theater'}</div>
            <div class="pk-studio-loc-coords">${story ? `${story.lat.toFixed(2)}°N, ${story.lon.toFixed(2)}°E` : '33.68°N, 73.05°E'}</div>
          </div>
        </div>

        <aside class="pk-studio-card ${story?.isBreaking ? 'is-breaking' : ''}">
          <div class="pk-studio-card-hdr">
            <span class="pk-studio-cat ${story?.isBreaking ? 'breaking' : ''}">${story?.isBreaking ? '⚡ BREAKING NEWS' : story?.category ?? 'LIVE BRIEF'}</span>
            <span class="pk-studio-source">Source: ${story?.source ?? 'Pakistan Monitor'}</span>
          </div>
          <div class="pk-studio-tags">${topicPills}</div>
          <div class="pk-studio-wave ${this.isSpeaking ? 'speaking' : ''}" aria-hidden="true">
            <span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>
          </div>
          <p class="pk-studio-caption ${isUrdu ? 'pk-urdu-caption' : ''}">${this.currentCaption}</p>
          <div class="pk-studio-disclaimer">AI-synthesized live briefing · Original telemetry & source-attributed commentary</div>
        </aside>
      </div>

      <div class="pk-studio-bottom">
        <div class="pk-studio-lower-third ${story?.isBreaking ? 'breaking' : ''}">
          <span class="pk-lt-badge">${story?.isBreaking ? 'BREAKING' : 'LIVE DESK'}</span>
          <span class="pk-lt-headline ${isUrdu ? 'pk-urdu-caption' : ''}">${story?.title ?? 'Monitoring Pakistan, Markets, Energy & Regional Feeds'}</span>
        </div>
        <div class="pk-studio-ticker">
          <span class="pk-ticker-label">LIVE TELEMETRY</span>
          <div class="pk-ticker-track">
            <span>${ticker}</span>
          </div>
        </div>
      </div>
    `;

    setTrustedHtml(this.root, trustedHtml(markup.toString(), 'PakistanBroadcastStudio safeHtml'));
  }
}

export default PakistanBroadcastStudio;
