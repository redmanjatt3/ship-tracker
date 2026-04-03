// ── MarineOps — app.js ──────────────────────────────────────────────────────

const SHIP_COLORS = {
  70: '#1de9b6', // Cargo
  71: '#1de9b6',
  72: '#1de9b6',
  73: '#1de9b6',
  74: '#1de9b6',
  80: '#f59e0b', // Tanker
  81: '#f59e0b',
  82: '#f59e0b',
  83: '#f59e0b',
  84: '#f59e0b',
  89: '#f59e0b',
  79: '#f59e0b',
  60: '#f472b6', // Passenger
  61: '#f472b6',
  62: '#f472b6',
  69: '#f472b6',
  40: '#60a5fa', // High speed / container (type 40s used loosely)
  90: '#60a5fa', // Container by convention in AIS legend
  1 : '#60a5fa',
  70: '#1de9b6',
  77: '#a78bfa', // Bulk carrier (type 77)
};

const TYPE_NAMES = {
  70: 'Cargo', 71: 'Cargo', 72: 'Cargo', 73: 'Cargo', 74: 'Cargo',
  80: 'Tanker', 81: 'Tanker', 82: 'Tanker', 83: 'Tanker', 84: 'Tanker', 89: 'Tanker', 79: 'Tanker',
  60: 'Passenger', 61: 'Passenger', 62: 'Passenger', 69: 'Passenger',
  40: 'Container', 90: 'Container',
  77: 'Bulk Carrier',
};

function shipColor(typeCode) {
  return SHIP_COLORS[typeCode] || '#94a3b8';
}
function shipTypeName(typeCode) {
  return TYPE_NAMES[typeCode] || 'Vessel';
}

// ── Leaflet map setup ────────────────────────────────────────────────────────
const map = L.map('map-el', {
  center: [20, 0],
  zoom: 3,
  zoomControl: true,
  attributionControl: false,
});

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
}).addTo(map);

// ── State ────────────────────────────────────────────────────────────────────
const vessels = {};     // mmsi -> { marker, data }
let ws = null;
let totalUpdates = 0;

// ── Clock ────────────────────────────────────────────────────────────────────
setInterval(() => {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  document.getElementById('hud-time').textContent =
    `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())} UTC`;
}, 1000);

// ── Ship SVG icon ─────────────────────────────────────────────────────────────
function makeIcon(color, heading) {
  const rot = (heading || 0) - 90;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="-10 -10 20 20">
      <g transform="rotate(${rot})">
        <polygon points="7,0 -5,4 -3,0 -5,-4" fill="${color}" opacity="0.95"/>
        <circle cx="0" cy="0" r="5" fill="${color}" opacity="0.12"/>
      </g>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: 'ship-marker',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

// ── Popup content ─────────────────────────────────────────────────────────────
function popupHTML(d) {
  const speed = d.sog !== undefined ? `${parseFloat(d.sog).toFixed(1)} kn` : '—';
  const heading = d.cog !== undefined ? `${Math.round(d.cog)}°` : '—';
  const dest = d.destination || '—';
  const flag = d.country || '—';
  const type = shipTypeName(d.shipType);
  return `
    <div class="popup-name">${d.name || d.mmsi || 'UNKNOWN'}</div>
    <div class="popup-row"><span>MMSI</span><span>${d.mmsi}</span></div>
    <div class="popup-row"><span>Type</span><span>${type}</span></div>
    <div class="popup-row"><span>Flag</span><span>${flag}</span></div>
    <div class="popup-row"><span>Speed</span><span>${speed}</span></div>
    <div class="popup-row"><span>Course</span><span>${heading}</span></div>
    <div class="popup-row"><span>Destination</span><span>${dest.slice(0,20)}</span></div>
  `;
}

// ── Update or create vessel marker ───────────────────────────────────────────
function upsertVessel(data) {
  const mmsi = data.mmsi;
  if (!mmsi) return;

  const lat = parseFloat(data.lat);
  const lon = parseFloat(data.lon);
  if (isNaN(lat) || isNaN(lon)) return;
  if (lat === 0 && lon === 0) return;

  const color = shipColor(data.shipType);

  if (vessels[mmsi]) {
    // Update existing
    const v = vessels[mmsi];
    v.marker.setLatLng([lat, lon]);
    v.marker.setIcon(makeIcon(color, data.cog));
    Object.assign(v.data, data);
    if (v.marker.isPopupOpen()) {
      v.marker.setPopupContent(popupHTML(v.data));
    }
  } else {
    // Create new
    const marker = L.marker([lat, lon], {
      icon: makeIcon(color, data.cog),
      title: data.name || mmsi,
    }).addTo(map);

    marker.bindPopup(popupHTML(data), { maxWidth: 220, className: '' });
    vessels[mmsi] = { marker, data: { ...data } };
  }

  totalUpdates++;
  updateStats();
}

// ── Stats HUD ────────────────────────────────────────────────────────────────
function updateStats() {
  const all = Object.values(vessels);
  document.getElementById('s-total').textContent = all.length;

  let cargo = 0, tanker = 0, container = 0, speedSum = 0, speedCount = 0;
  all.forEach(({ data: d }) => {
    const t = d.shipType;
    if (t >= 70 && t <= 79 && t !== 79) cargo++;
    else if (t >= 80 && t <= 89) tanker++;
    else if (t === 90 || t === 40) container++;

    const s = parseFloat(d.sog);
    if (!isNaN(s) && s > 0 && s < 50) { speedSum += s; speedCount++; }
  });

  document.getElementById('s-cargo').textContent = cargo;
  document.getElementById('s-tanker').textContent = tanker;
  document.getElementById('s-container').textContent = container;
  document.getElementById('s-speed').textContent =
    speedCount ? `${(speedSum / speedCount).toFixed(1)} kn` : '— kn';
}

// ── Activity log ─────────────────────────────────────────────────────────────
function addLog(msg) {
  const bar = document.getElementById('log-bar');
  const entries = bar.querySelectorAll('.log-entry');
  if (entries.length >= 2) entries[0].remove();
  const el = document.createElement('div');
  el.className = 'log-entry fresh';
  el.textContent = '> ' + msg;
  bar.appendChild(el);
  setTimeout(() => el.classList.remove('fresh'), 1500);
}

// ── WebSocket connection to AISStream ────────────────────────────────────────
function connectAIS(apiKey) {
  const statusEl = document.getElementById('conn-status');
  statusEl.className = 'connecting';
  statusEl.textContent = 'CONNECTING...';

  ws = new WebSocket('wss://stream.aisstream.io/v0/stream');

  ws.onopen = () => {
    // Subscribe to position reports globally
    const subscribeMsg = {
      APIKey: apiKey,
      BoundingBoxes: [[[-90, -180], [90, 180]]],  // Entire world
      FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
    };
    ws.send(JSON.stringify(subscribeMsg));
    statusEl.className = 'live';
    statusEl.textContent = 'LIVE';
    addLog('AIS STREAM CONNECTED // RECEIVING GLOBAL FEED');
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      const meta = msg.MetaData || {};
      const msgType = msg.MessageType;

      if (msgType === 'PositionReport') {
        const pos = msg.Message?.PositionReport || {};
        const data = {
          mmsi: String(meta.MMSI || pos.UserID),
          name: meta.ShipName?.trim() || '',
          lat: meta.latitude || pos.Latitude,
          lon: meta.longitude || pos.Longitude,
          sog: pos.Sog,
          cog: pos.Cog,
          heading: pos.TrueHeading,
          shipType: meta.shiptype || 0,
          country: meta.MMSI ? mmsiToCountry(String(meta.MMSI)) : '—',
        };
        upsertVessel(data);

        // Log every ~50th update to avoid flooding
        if (totalUpdates % 50 === 0) {
          const name = data.name || data.mmsi;
          const spd = data.sog ? `${parseFloat(data.sog).toFixed(1)} kn` : '';
          addLog(`AIS >> ${name} ${spd ? '// SPD ' + spd : ''}`);
        }

      } else if (msgType === 'ShipStaticData') {
        const stat = msg.Message?.ShipStaticData || {};
        const mmsi = String(meta.MMSI || stat.UserID);
        if (vessels[mmsi]) {
          Object.assign(vessels[mmsi].data, {
            name: stat.Name?.trim() || vessels[mmsi].data.name,
            destination: stat.Destination?.trim(),
            shipType: stat.Type || vessels[mmsi].data.shipType,
          });
        }
      }
    } catch (e) {
      // Silently skip malformed messages
    }
  };

  ws.onerror = () => {
    statusEl.className = 'error';
    statusEl.textContent = 'ERROR';
    addLog('CONNECTION ERROR — CHECK API KEY');
  };

  ws.onclose = () => {
    if (statusEl.classList.contains('live')) {
      statusEl.className = 'connecting';
      statusEl.textContent = 'RECONNECTING...';
      addLog('CONNECTION LOST — RETRYING IN 5s...');
      setTimeout(() => connectAIS(apiKey), 5000);
    }
  };
}

// ── Simple MMSI -> country mapping (first 3 digits = MID) ───────────────────
const MID_COUNTRY = {
  '211':'Germany','212':'Cyprus','215':'Malta','219':'Denmark','224':'Spain',
  '227':'France','229':'Malta','232':'UK','235':'UK','244':'Netherlands',
  '247':'Italy','255':'Portugal','257':'Norway','265':'Sweden','269':'Switzerland',
  '273':'Russia','276':'Estonia','277':'Latvia','278':'Lithuania','279':'Russia',
  '303':'USA','338':'USA','339':'USA','352':'Panama','357':'Panama',
  '370':'Panama','371':'Panama','372':'Panama','374':'Panama','376':'Panama',
  '378':'Bahamas','416':'Taiwan','431':'Japan','432':'Japan','440':'South Korea',
  '441':'South Korea','477':'Hong Kong','503':'Australia','525':'Indonesia',
  '533':'Malaysia','538':'Marshall Is.','566':'Singapore','574':'Vietnam',
  '601':'South Africa','612':'Liberia','613':'Liberia','636':'Liberia',
  '710':'Brazil','725':'Chile','730':'Colombia','735':'Ecuador',
};

function mmsiToCountry(mmsi) {
  const mid = mmsi.slice(0, 3);
  return MID_COUNTRY[mid] || '—';
}

// ── API key entry ─────────────────────────────────────────────────────────────
function startWithKey() {
  const key = document.getElementById('apikey-input').value.trim();
  if (!key) return;
  // Save key in session so page refresh doesn't require re-entry
  sessionStorage.setItem('ais_api_key', key);
  document.getElementById('apikey-overlay').style.display = 'none';
  connectAIS(key);
}

// Auto-connect if key was saved this session
const savedKey = sessionStorage.getItem('ais_api_key');
if (savedKey) {
  document.getElementById('apikey-input').value = savedKey;
  startWithKey();
}

// Allow pressing Enter in input
document.getElementById('apikey-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') startWithKey();
});

// ── Prune stale vessels every 5 min (keep map clean) ─────────────────────────
setInterval(() => {
  const MAX = 1500; // max markers to show at once
  const keys = Object.keys(vessels);
  if (keys.length > MAX) {
    const toRemove = keys.slice(0, keys.length - MAX);
    toRemove.forEach(mmsi => {
      map.removeLayer(vessels[mmsi].marker);
      delete vessels[mmsi];
    });
  }
}, 5 * 60 * 1000);
