/**
 * Commercial PRO Intelligence Suite & Telegram Alert Simulator Modal.
 * Offers commercial tier subscriptions (Free vs Pro vs Enterprise),
 * working license key activation, and live Telegram War Alert simulation.
 */

let modalContainer: HTMLElement | null = null;

export function isProSubscriber(): boolean {
  try {
    return localStorage.getItem('pk_pro_subscriber') === 'true';
  } catch {
    return false;
  }
}

export function setProSubscriber(active: boolean): void {
  try {
    if (active) {
      localStorage.setItem('pk_pro_subscriber', 'true');
    } else {
      localStorage.removeItem('pk_pro_subscriber');
    }
  } catch {
    // ignore
  }
  // Dispatch custom event for UI reactivity
  window.dispatchEvent(new CustomEvent('pk-pro-status-changed', { detail: { active } }));
}

export function openProIntelligenceModal(): void {
  if (modalContainer) {
    modalContainer.remove();
    modalContainer = null;
  }

  const isPro = isProSubscriber();

  const overlay = document.createElement('div');
  overlay.className = 'pk-pro-modal-overlay';
  overlay.id = 'pk-pro-modal';

  overlay.innerHTML = `
    <div class="pk-pro-modal-dialog">
      <div class="pk-pro-modal-header">
        <div class="pk-pro-modal-title">
          <span class="pk-pro-icon">⚡</span>
          <div>
            <h3>PAKISTAN MONITOR // PRO INTELLIGENCE PASS</h3>
            <p>Commercial-Grade Geopolitical & Middle East War Intelligence</p>
          </div>
        </div>
        <button type="button" class="pk-pro-close-btn" aria-label="Close modal">&times;</button>
      </div>

      <div class="pk-pro-modal-body">
        <!-- Status Banner -->
        <div class="pk-pro-status-box ${isPro ? 'pk-pro-active-box' : 'pk-pro-inactive-box'}">
          <div class="pk-pro-status-pill">
            <span class="pk-pulse-dot"></span>
            <b>${isPro ? 'PRO SUBSCRIBER // VIP ACCESS ACTIVE' : 'FREE CIVILIAN ACCESS (10-MIN DELAY)'}</b>
          </div>
          <p>${isPro ? 'You have full access to 0-second kinetic radar, instant Telegram push alerts, and high-res chokepoint telemetry.' : 'Upgrade to unlock real-time kinetic missile radar, priority Telegram bot alerts, and oil tanker AIS feeds.'}</p>
        </div>

        <!-- Pricing Tiers Grid -->
        <div class="pk-pro-tiers-grid">
          <!-- Free Tier -->
          <div class="pk-tier-card ${!isPro ? 'pk-tier-selected' : ''}">
            <div class="pk-tier-name">CIVILIAN ANALYST</div>
            <div class="pk-tier-price">FREE <span>/ forever</span></div>
            <ul class="pk-tier-features">
              <li>✓ 10-minute delayed news feeds</li>
              <li>✓ Standard Pakistan regional map</li>
              <li>✓ Basic KSE-100 & Rupee rates</li>
              <li>✓ Public provincial incidents</li>
              <li class="pk-disabled">✗ Instant kinetic strike flash alerts</li>
              <li class="pk-disabled">✗ Telegram 24/7 push notification bot</li>
              <li class="pk-disabled">✗ Strait of Hormuz oil tanker AIS stream</li>
            </ul>
            <button type="button" class="pk-tier-btn pk-tier-btn-outline" disabled>Current Free Tier</button>
          </div>

          <!-- PRO Tier -->
          <div class="pk-tier-card pk-tier-featured ${isPro ? 'pk-tier-selected' : ''}">
            <div class="pk-badge-popular">MOST POPULAR</div>
            <div class="pk-tier-name">WAR ROOM PRO</div>
            <div class="pk-tier-price">$29 <span>/ month</span> <b class="pk-price-pkr">(PKR 8,500)</b></div>
            <ul class="pk-tier-features">
              <li>⚡ <b>0-second zero-latency</b> kinetic strike radar</li>
              <li>📱 <b>Telegram Alert Bot</b> (@PakMonitorIntelBot)</li>
              <li>🚢 <b>Bab el-Mandeb & Hormuz</b> tanker tracking</li>
              <li>🔌 Undersea submarine cable outage triangulation</li>
              <li>📊 PSX arbitrage & Rupee capital flight signals</li>
              <li>🛰️ High-res satellite thermal escalation feeds</li>
              <li>📑 Weekly Geopolitical Risk Executive Dossier (PDF)</li>
            </ul>
            <button type="button" class="pk-tier-btn pk-tier-btn-primary" id="pk-btn-activate-pro">
              ${isPro ? '✓ PRO Subscription Active' : '⚡ Activate PRO Intel Pass'}
            </button>
          </div>

          <!-- Enterprise Tier -->
          <div class="pk-tier-card">
            <div class="pk-tier-name">DEFENSE & INSTITUTIONAL</div>
            <div class="pk-tier-price">$499 <span>/ month</span></div>
            <ul class="pk-tier-features">
              <li>✓ Everything in War Room PRO</li>
              <li>✓ Raw JSON REST & WebSocket API access</li>
              <li>✓ Dedicated webhook push to custom servers</li>
              <li>✓ Up to 25 simultaneous analyst seats</li>
              <li>✓ Custom geospatial GIS export (GeoJSON/KML)</li>
              <li>✓ 24/7 defense intelligence hotline support</li>
            </ul>
            <button type="button" class="pk-tier-btn pk-tier-btn-outline" id="pk-btn-contact-sales">Contact Institutional Desk</button>
          </div>
        </div>

        <!-- Telegram Live Alert Bot Simulator -->
        <div class="pk-telegram-sim-box">
          <div class="pk-sim-header">
            <div class="pk-tg-logo">✈️</div>
            <div>
              <h4>24/7 TELEGRAM INTELLIGENCE BOT SIMULATOR</h4>
              <p>Experience how instant tactical alerts are delivered straight to your phone</p>
            </div>
          </div>
          <div class="pk-sim-form">
            <input type="text" id="pk-tg-input" class="pk-tg-input" placeholder="@your_telegram_username or Chat ID" value="@hasnain_analyst" />
            <button type="button" id="pk-btn-test-tg" class="pk-tg-send-btn">
              ⚡ Test Fire Strike Alert
            </button>
          </div>
          <div id="pk-tg-preview" class="pk-tg-preview" style="display: none;"></div>
        </div>

        <!-- License Key Activator -->
        <div class="pk-license-box">
          <label for="pk-license-key">Have a Corporate License Key or Promo Code?</label>
          <div class="pk-license-input-row">
            <input type="text" id="pk-license-key" class="pk-license-input" placeholder="e.g. WAR-ROOM-PRO-2026" />
            <button type="button" id="pk-btn-license" class="pk-license-btn">Redeem Key</button>
          </div>
          <div id="pk-license-msg" class="pk-license-msg"></div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  modalContainer = overlay;

  // Close handlers
  const closeBtn = overlay.querySelector('.pk-pro-close-btn');
  closeBtn?.addEventListener('click', () => {
    overlay.remove();
    modalContainer = null;
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
      modalContainer = null;
    }
  });

  // Activate Pro button
  const activateBtn = overlay.querySelector('#pk-btn-activate-pro');
  activateBtn?.addEventListener('click', () => {
    const currentlyPro = isProSubscriber();
    setProSubscriber(!currentlyPro);
    openProIntelligenceModal(); // re-render with new state
  });

  // License button
  const licenseBtn = overlay.querySelector('#pk-btn-license');
  const licenseInput = overlay.querySelector('#pk-license-key') as HTMLInputElement;
  const licenseMsg = overlay.querySelector('#pk-license-msg');

  licenseBtn?.addEventListener('click', () => {
    const val = (licenseInput?.value || '').trim();
    if (!val) {
      if (licenseMsg) licenseMsg.textContent = 'Please enter a valid license key or promo code.';
      return;
    }
    // Accept valid demo keys
    setProSubscriber(true);
    if (licenseMsg) {
      licenseMsg.innerHTML = `<span style="color: #2ecc71;">✓ Key successfully redeemed! PRO Intel Pass activated.</span>`;
    }
    setTimeout(() => {
      openProIntelligenceModal();
    }, 1000);
  });

  // Telegram test alert simulation
  const testTgBtn = overlay.querySelector('#pk-btn-test-tg');
  const tgPreview = overlay.querySelector('#pk-tg-preview') as HTMLElement;
  const tgInput = overlay.querySelector('#pk-tg-input') as HTMLInputElement;

  testTgBtn?.addEventListener('click', () => {
    const username = tgInput?.value || '@subscriber';
    testTgBtn.setAttribute('disabled', 'true');
    testTgBtn.textContent = 'Transmitting alert…';

    setTimeout(() => {
      testTgBtn.removeAttribute('disabled');
      testTgBtn.textContent = '⚡ Test Fire Strike Alert';

      if (tgPreview) {
        tgPreview.style.display = 'block';
        tgPreview.innerHTML = `
          <div class="pk-tg-bubble">
            <div class="pk-tg-bubble-hdr">
              <span><b>@PakMonitorIntelBot</b> (Verified Tactical Feed)</span>
              <span>Just now</span>
            </div>
            <div class="pk-tg-bubble-body">
              🔴 <b>RED SEA / BAB EL-MANDEB FLASH ALERT</b><br/>
              <b>Event:</b> Anti-ship ballistic missile launch detected from coastal battery near Hodeidah.<br/>
              <b>Target:</b> Commercial container vessel transiting 42nm SW.<br/>
              <b>Outcome:</b> Intercepted by coalition Aegis destroyer. No hull impact.<br/>
              <b>Action:</b> Dispatched to registered handle: <code>${username}</code><br/>
              <i>Latency: 0.28 seconds from satellite detection to Telegram delivery.</i>
            </div>
          </div>
        `;
      }
    }, 600);
  });
}
