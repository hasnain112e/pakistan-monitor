/**
 * Pakistan Monitor // War Room Intelligence Suite
 * Senior UI/UX Architecture - Linear / Vercel / Stripe Aesthetic
 * Pure Vanilla JavaScript Logic
 */

// ============================================================
// 1. DATA STATE & TELEMETRY
// ============================================================
const APP_STATE = {
  isPro: localStorage.getItem('pk_pro_subscriber') === 'true',
  soundEnabled: true,
  currentTheater: 'all',
  
  // Tactical ME War Incidents
  meIncidents: [
    {
      id: 'inc-01',
      theater: 'red-sea',
      title: 'Anti-Ship Ballistic Missile Targeting Commercial Vessel in Southern Red Sea',
      summary: 'US CENTCOM naval forces destroyed an anti-ship ballistic missile and two attack drones launched from Houthi-controlled territory over international shipping lanes.',
      location: 'Bab el-Mandeb / Red Sea',
      lat: 12.5833,
      lon: 43.3333,
      severity: 'critical',
      category: 'BALLISTIC MISSILE',
      source: 'CENTCOM / Reuters ME',
      timestamp: '14m ago'
    },
    {
      id: 'inc-02',
      theater: 'hormuz',
      title: 'IRGC Fast Patrol Boats Intercept Radio Communications of Oil Tanker near Qeshm',
      summary: 'Iranian naval units issued radio challenges to a Marshall Islands-flagged VLCC crude oil tanker transiting inbound to Ras Tanura. US 5th Fleet guided-missile destroyer monitored.',
      location: 'Strait of Hormuz',
      lat: 26.5667,
      lon: 56.2500,
      severity: 'flash',
      category: 'MARITIME HARASSMENT',
      source: 'UKMTO / Al Arabiya',
      timestamp: '38m ago'
    },
    {
      id: 'inc-03',
      theater: 'levant',
      title: 'Extensive Drone Swarm & Rocket Barrage Triggers Sirens across Northern Galilee',
      summary: 'Over 45 rockets and one-way attack drones launched toward military staging bases and radar installations in Upper Galilee; Iron Dome interceptors active.',
      location: 'Northern Israel / Lebanon Border',
      lat: 33.1500,
      lon: 35.3000,
      severity: 'critical',
      category: 'AIR STRIKE / ROCKETS',
      source: 'Al Jazeera / Haaretz',
      timestamp: '1h 05m ago'
    },
    {
      id: 'inc-04',
      theater: 'levant',
      title: 'IDF Strikes Underground Weapons Depot in Southern Beirut Suburbs',
      summary: 'Precision airstrikes struck subterranean missile manufacturing facilities and command centers in Dahieh. Secondary explosions reported across southern district.',
      location: 'Beirut, Lebanon',
      lat: 33.8938,
      lon: 35.5018,
      severity: 'critical',
      category: 'PRECISION STRIKE',
      source: 'Naharnet / BBC ME',
      timestamp: '1h 35m ago'
    },
    {
      id: 'inc-05',
      theater: 'iran-axis',
      title: 'Targeted Drone Attack on Coalition Staging Outpost near Al-Tanf Garrison',
      summary: 'Two Iranian-made Shahed attack drones struck outer perimeter fortifications near Syria-Iraq tri-border; counter-UAS air defense neutralized one incoming drone.',
      location: 'Al-Tanf, Syria-Iraq Border',
      lat: 33.4333,
      lon: 38.6833,
      severity: 'flash',
      category: 'DRONE ATTACK',
      source: 'Syria Direct / SOHR',
      timestamp: '2h 15m ago'
    },
    {
      id: 'inc-06',
      theater: 'iran-axis',
      title: 'GPS Spoofing & Radar Jamming Detected Over Persian Gulf & Kharg Island',
      summary: 'Civilian and commercial maritime GPS anomalies reported near Kharg Island crude export terminal. Vessels instructed to maintain dead reckoning navigation protocols.',
      location: 'Kharg Island, Persian Gulf',
      lat: 29.2333,
      lon: 50.3167,
      severity: 'maritime',
      category: 'ELECTRONIC WARFARE',
      source: 'GPS Jam / Lloyd’s List',
      timestamp: '3h 10m ago'
    }
  ],

  // Pakistan Strategic Nodes
  pakistanNodes: [
    { name: 'Gwadar Deep-Sea Port', lat: 25.1264, lon: 62.3225, type: 'naval', note: 'CPEC Maritime Chokepoint & Deep Sea Naval Patrol' },
    { name: 'Karachi Flight Information Region (FIR)', lat: 24.8607, lon: 67.0011, type: 'airspace', note: '+31.4% International traffic diversion around Middle East' },
    { name: 'Lahore Airspace Control Center', lat: 31.5204, lon: 74.3587, type: 'airspace', note: 'Major transit corridor for Gulf-Europe flights' },
    { name: 'Taftan Border Crossing (Pak-Iran)', lat: 28.9667, lon: 61.5833, type: 'border', note: 'Commercial land route monitoring & fuel convoy security' }
  ],

  // Pakistan Strategic News
  pakistanNews: [
    { source: 'Dawn', time: '18m ago', title: 'Chief of Army Staff chairs high-level security meeting on regional stability & border surveillance' },
    { source: 'Express Tribune', time: '42m ago', title: 'PSX surges past 163,000 points on strong foreign corporate inflows & IMF review progress' },
    { source: 'Geo News', time: '1h 10m ago', title: 'Lahore & Gujranwala issue red alerts for smog & AQI peaks; artificial rain teams placed on standby' },
    { source: 'Business Recorder', time: '1h 50m ago', title: 'Petroleum Division reviews national oil stockpiles: Petrol reserves safe at 21 days cover' }
  ]
};

// ============================================================
// 2. SYNTHESIZED TACTICAL AUDIO (Web Audio API)
// ============================================================
class TacticalAudio {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx && typeof AudioContext !== 'undefined') {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playBlip() {
    if (!APP_STATE.soundEnabled || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, this.ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch (e) {
      // ignore
    }
  }

  playAlert() {
    if (!APP_STATE.soundEnabled || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, this.ctx.currentTime);
      osc.frequency.setValueAtTime(780, this.ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.25);
    } catch (e) {
      // ignore
    }
  }
}

const audio = new TacticalAudio();

// ============================================================
// 3. TACTICAL LEAFLET MAP
// ============================================================
let tacticalMap = null;
let mapMarkers = [];

function initTacticalMap() {
  if (typeof L === 'undefined') return;

  tacticalMap = L.map('tactical-map', {
    center: [26.0, 52.0],
    zoom: 5,
    zoomControl: false,
    attributionControl: false
  });

  // Esri World Dark Gray Base (No watermarks, clean military intelligence styling)
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 16,
    attribution: 'Esri, Garmin, © OpenStreetMap contributors'
  }).addTo(tacticalMap);

  // Border and Label Reference Overlay for clean geopolitical typography
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 16,
    opacity: 0.85
  }).addTo(tacticalMap);

  // Add Custom Zoom Control at Top Right
  L.control.zoom({ position: 'topright' }).addTo(tacticalMap);

  // Plot Middle East Kinetic Incidents
  APP_STATE.meIncidents.forEach(inc => {
    const color = inc.severity === 'critical' ? '#f43f5e' : inc.severity === 'flash' ? '#f59e0b' : '#38bdf8';
    
    const icon = L.divIcon({
      className: 'custom-leaflet-marker',
      html: `<div class="pulsing-marker" style="background:${color}; color:${color}"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });

    const marker = L.marker([inc.lat, inc.lon], { icon }).addTo(tacticalMap);
    marker.bindPopup(`
      <div class="p-1 space-y-1.5 max-w-[280px]">
        <div class="flex items-center justify-between text-[10px] font-mono font-semibold" style="color:${color}">
          <span>● ${inc.category}</span>
          <span class="text-zinc-400 font-normal">${inc.timestamp}</span>
        </div>
        <div class="text-sm font-semibold text-white tracking-tight leading-snug">${inc.title}</div>
        <div class="text-xs text-zinc-400 font-medium">${inc.location} · <span class="text-zinc-300">${inc.source}</span></div>
        <div class="text-xs text-zinc-300 leading-relaxed pt-1 border-t border-zinc-800/80">${inc.summary}</div>
      </div>
    `);

    mapMarkers.push({ id: inc.id, marker, lat: inc.lat, lon: inc.lon });
  });

  // Plot Pakistan Strategic Nodes
  APP_STATE.pakistanNodes.forEach(node => {
    const icon = L.divIcon({
      className: 'custom-leaflet-marker',
      html: `<div class="pulsing-marker" style="background:#10b981; color:#10b981"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });

    const marker = L.marker([node.lat, node.lon], { icon }).addTo(tacticalMap);
    marker.bindPopup(`
      <div class="p-1 space-y-1 max-w-[240px]">
        <div class="text-[10px] font-mono font-semibold text-emerald-400 uppercase tracking-wider">● PK STRATEGIC NODE</div>
        <div class="text-sm font-semibold text-white tracking-tight">${node.name}</div>
        <div class="text-xs text-zinc-300 leading-relaxed">${node.note}</div>
      </div>
    `);

    mapMarkers.push({ id: node.name, marker, lat: node.lat, lon: node.lon });
  });
}

function panToLocation(lat, lon, zoom = 7) {
  if (!tacticalMap) return;
  audio.playBlip();
  tacticalMap.flyTo([lat, lon], zoom, {
    animate: true,
    duration: 1.2
  });

  // Open corresponding popup if exists
  const found = mapMarkers.find(m => Math.abs(m.lat - lat) < 0.01 && Math.abs(m.lon - lon) < 0.01);
  if (found) {
    setTimeout(() => found.marker.openPopup(), 1250);
  }
}

// ============================================================
// 4. UI RENDERING & EVENT HANDLERS (Shadcn / Linear Style)
// ============================================================

function renderIncidents() {
  const container = document.getElementById('incident-list-container');
  if (!container) return;

  const filtered = APP_STATE.currentTheater === 'all' 
    ? APP_STATE.meIncidents 
    : APP_STATE.meIncidents.filter(i => i.theater === APP_STATE.currentTheater);

  container.innerHTML = filtered.map(inc => {
    const isCrit = inc.severity === 'critical';
    const isFlash = inc.severity === 'flash';
    
    const badgeStyle = isCrit
      ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
      : isFlash
      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      : 'bg-sky-500/10 text-sky-400 border-sky-500/20';

    const accentBorder = isCrit
      ? 'border-l-rose-500'
      : isFlash
      ? 'border-l-amber-500'
      : 'border-l-sky-500';

    return `
      <div class="group bg-zinc-900/60 hover:bg-zinc-900/90 border border-zinc-800/80 hover:border-zinc-700/80 border-l-[3px] ${accentBorder} rounded-xl p-3.5 space-y-2 transition-all duration-200 shadow-sm cursor-pointer" data-id="${inc.id}">
        <div class="flex items-center justify-between gap-2">
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border ${badgeStyle}">
            ${inc.category}
          </span>
          <span class="text-[11px] font-mono text-zinc-500">${inc.timestamp}</span>
        </div>

        <div class="text-xs font-semibold text-zinc-100 group-hover:text-white tracking-tight leading-snug">
          ${inc.title}
        </div>

        <p class="text-xs text-zinc-400 leading-relaxed line-clamp-2">
          ${inc.summary}
        </p>

        <div class="flex items-center justify-between pt-1.5 border-t border-zinc-800/60 text-xs">
          <span class="text-[11px] font-mono text-zinc-500">${inc.location}</span>
          <button class="target-map-btn inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors" data-lat="${inc.lat}" data-lon="${inc.lon}">
            <i data-lucide="crosshair" class="w-3 h-3 text-emerald-400"></i>
            <span>Focus</span>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Re-initialize Lucide Icons for dynamic content
  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Attach Target Map Click Handlers
  container.querySelectorAll('.target-map-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const lat = parseFloat(e.currentTarget.dataset.lat);
      const lon = parseFloat(e.currentTarget.dataset.lon);
      panToLocation(lat, lon, 8);
    });
  });

  // Card click also pans
  container.querySelectorAll('[data-id]').forEach(card => {
    card.addEventListener('click', (e) => {
      const inc = APP_STATE.meIncidents.find(i => i.id === card.dataset.id);
      if (inc) panToLocation(inc.lat, inc.lon, 8);
    });
  });
}

function renderPakistanNews() {
  const container = document.getElementById('pk-news-container');
  if (!container) return;

  container.innerHTML = APP_STATE.pakistanNews.map(item => `
    <div class="bg-zinc-900/60 hover:bg-zinc-900/90 border border-zinc-800/80 hover:border-zinc-700/80 rounded-xl p-3 space-y-1 transition-all duration-200 shadow-sm">
      <div class="flex items-center justify-between text-xs">
        <span class="font-semibold text-emerald-400 text-[11px] tracking-wide">${item.source}</span>
        <span class="font-mono text-[10px] text-zinc-500">${item.time}</span>
      </div>
      <div class="text-xs text-zinc-200 leading-snug font-medium">
        ${item.title}
      </div>
    </div>
  `).join('');

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function updateClock() {
  const clockEl = document.getElementById('military-clock');
  if (!clockEl) return;
  const now = new Date();
  const utc = now.toISOString().slice(11, 19) + ' UTC';
  const pkt = new Date(now.getTime() + 5 * 3600000).toISOString().slice(11, 19) + ' PKT';
  clockEl.textContent = `${pkt} · ${utc}`;
}

function showToast(msg) {
  const toast = document.getElementById('hud-toast');
  if (!toast) return;
  const msgEl = document.getElementById('hud-toast-msg');
  if (msgEl) msgEl.textContent = msg;
  else toast.textContent = msg;
  
  toast.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
  toast.classList.add('translate-y-0', 'opacity-100');
  setTimeout(() => {
    toast.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none');
    toast.classList.remove('translate-y-0', 'opacity-100');
  }, 3500);
}

// ============================================================
// 5. PRO MODAL & TELEGRAM DISPATCH SIMULATOR (Stripe/Vercel Style)
// ============================================================

function setupProModal() {
  const modal = document.getElementById('pro-modal-backdrop');
  const openBtn = document.getElementById('btn-open-pro');
  const closeBtn = document.getElementById('btn-close-pro');
  const activateProBtn = document.getElementById('btn-activate-pro');
  const testTgBtn = document.getElementById('btn-test-tg');
  const tgInput = document.getElementById('tg-handle-input');
  const tgBubble = document.getElementById('tg-live-bubble');
  const tgBody = document.getElementById('tg-bubble-body');

  function openModal() {
    audio.init();
    audio.playBlip();
    modal.classList.remove('opacity-0', 'pointer-events-none');
    modal.classList.add('opacity-100', 'pointer-events-auto');
  }

  function closeModal() {
    modal.classList.add('opacity-0', 'pointer-events-none');
    modal.classList.remove('opacity-100', 'pointer-events-auto');
  }

  if (openBtn) openBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  // Escape key closes modal
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('opacity-0')) {
      closeModal();
    }
  });

  if (activateProBtn) {
    activateProBtn.addEventListener('click', () => {
      APP_STATE.isPro = !APP_STATE.isPro;
      localStorage.setItem('pk_pro_subscriber', APP_STATE.isPro ? 'true' : 'false');
      audio.playAlert();
      updateProUi();
      showToast(APP_STATE.isPro ? '⚡ PRO Intelligence Pass Activated!' : 'Reverted to Civilian Free Tier');
    });
  }

  if (testTgBtn) {
    testTgBtn.addEventListener('click', () => {
      audio.init();
      audio.playAlert();
      const handle = (tgInput.value || '@hasnain_analyst').trim();
      testTgBtn.disabled = true;
      testTgBtn.innerHTML = `
        <span class="inline-block animate-spin mr-1.5">⟳</span>
        <span>Transmitting...</span>
      `;

      setTimeout(() => {
        testTgBtn.disabled = false;
        testTgBtn.innerHTML = `
          <i data-lucide="zap" class="w-3.5 h-3.5"></i>
          <span>Test Fire Alert</span>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        
        tgBubble.classList.remove('hidden');
        tgBody.innerHTML = `
          <div class="space-y-1.5 text-xs">
            <div class="flex items-center justify-between text-rose-400 font-mono font-semibold">
              <span>🔴 BAB EL-MANDEB FLASH ADVISORY</span>
              <span>0.24s SATELLITE LATENCY</span>
            </div>
            <div class="text-zinc-200">
              <span class="font-medium text-white">Target Telemetry:</span> Commercial VLCC tanker transiting 38nm SW Hodeidah.
            </div>
            <div class="text-zinc-300">
              <span class="font-medium text-white">Incident:</span> Anti-ship ballistic missile inbound trajectory detected; Aegis intercept confirmed.
            </div>
            <div class="pt-1 border-t border-zinc-800 text-[11px] text-zinc-400 font-mono">
              Direct dispatch delivered to <code class="text-emerald-400">${handle}</code> via @PakMonitorIntelBot
            </div>
          </div>
        `;
        showToast('📱 Emergency Strike Alert dispatched to Telegram!');
      }, 550);
    });
  }
}

function updateProUi() {
  const openBtn = document.getElementById('btn-open-pro');
  const activateProBtn = document.getElementById('btn-activate-pro');
  if (!openBtn) return;

  if (APP_STATE.isPro) {
    openBtn.classList.remove('bg-white', 'text-zinc-950', 'hover:bg-zinc-200');
    openBtn.classList.add('bg-emerald-500', 'text-zinc-950', 'hover:bg-emerald-400', 'ring-2', 'ring-emerald-500/50');
    openBtn.innerHTML = `
      <i data-lucide="shield-check" class="w-3.5 h-3.5"></i>
      <span>PRO ACTIVE</span>
    `;
    if (activateProBtn) {
      activateProBtn.textContent = '✓ PRO Subscription Active';
      activateProBtn.classList.add('bg-zinc-800', 'text-zinc-300');
      activateProBtn.classList.remove('bg-emerald-500', 'text-zinc-950');
    }
  } else {
    openBtn.classList.remove('bg-emerald-500', 'text-zinc-950', 'hover:bg-emerald-400', 'ring-2', 'ring-emerald-500/50');
    openBtn.classList.add('bg-white', 'text-zinc-950', 'hover:bg-zinc-200');
    openBtn.innerHTML = `
      <i data-lucide="zap" class="w-3.5 h-3.5 fill-current"></i>
      <span>PRO INTEL PASS</span>
    `;
    if (activateProBtn) {
      activateProBtn.textContent = '⚡ Activate PRO Intel Pass';
      activateProBtn.classList.remove('bg-zinc-800', 'text-zinc-300');
      activateProBtn.classList.add('bg-emerald-500', 'text-zinc-950');
    }
  }

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ============================================================
// 6. INITIALIZATION ON DOM LOAD
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initTacticalMap();
  renderIncidents();
  renderPakistanNews();
  setupProModal();
  updateProUi();

  // Initialize Lucide Icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // Clock Ticker
  updateClock();
  setInterval(updateClock, 1000);

  // Audio Toggle Button
  const audioBtn = document.getElementById('btn-toggle-sound');
  if (audioBtn) {
    audioBtn.addEventListener('click', () => {
      audio.init();
      APP_STATE.soundEnabled = !APP_STATE.soundEnabled;
      audioBtn.innerHTML = APP_STATE.soundEnabled
        ? `<i data-lucide="volume-2" class="w-4 h-4"></i><span class="hidden sm:inline">Audio</span>`
        : `<i data-lucide="volume-x" class="w-4 h-4 text-zinc-500"></i><span class="hidden sm:inline text-zinc-500">Muted</span>`;
      if (typeof lucide !== 'undefined') lucide.createIcons();
      if (APP_STATE.soundEnabled) audio.playBlip();
    });
  }

  // Theater Filter Pills (Linear Segmented Control Style)
  document.querySelectorAll('.theater-pill').forEach(pill => {
    pill.addEventListener('click', (e) => {
      audio.init();
      audio.playBlip();
      document.querySelectorAll('.theater-pill').forEach(p => {
        p.classList.remove('bg-zinc-800', 'text-white', 'shadow-sm');
        p.classList.add('text-zinc-400', 'hover:text-zinc-200');
      });
      e.currentTarget.classList.remove('text-zinc-400', 'hover:text-zinc-200');
      e.currentTarget.classList.add('bg-zinc-800', 'text-white', 'shadow-sm');
      APP_STATE.currentTheater = e.currentTarget.dataset.theater;
      renderIncidents();
    });
  });

  // Quick Jump Map Controls
  document.querySelectorAll('[data-jump]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      audio.init();
      const target = e.currentTarget.dataset.jump;
      if (target === 'pakistan') panToLocation(30.3753, 69.3451, 6);
      if (target === 'middleeast') panToLocation(24.5, 48.0, 5);
      if (target === 'redsea') panToLocation(13.8, 43.0, 7);
      if (target === 'hormuz') panToLocation(26.6, 56.4, 7);
      if (target === 'gwadar') panToLocation(25.1264, 62.3225, 9);
      if (target === 'levant') panToLocation(33.2, 35.5, 7);
    });
  });
});
