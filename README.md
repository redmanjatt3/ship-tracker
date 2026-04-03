# MarineOps — Global Vessel Tracker

Real-time cargo ship tracking using live AIS data. 100% free stack.

---

## Tech Stack

| Layer | Tool | Cost |
|-------|------|------|
| Map | Leaflet.js + OpenStreetMap | Free |
| Ship data | AISStream.io WebSocket API | Free |
| Hosting | Vercel | Free |

---

## Setup (5 minutes)

### 1. Get your free AIS API key
- Go to [aisstream.io](https://aisstream.io)
- Sign up (no credit card needed)
- Copy your API key from the dashboard

### 2. Run locally
Just open `public/index.html` in your browser — no build step needed.
Paste your API key when prompted. Ships will start appearing within seconds.

### 3. Deploy to Vercel (free hosting)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd shiptracker
vercel --prod
```

That's it. Your site will be live at a `*.vercel.app` URL instantly.

---

## How it works

1. Browser opens a WebSocket to `wss://stream.aisstream.io/v0/stream`
2. We subscribe to **PositionReport** messages for the entire world bounding box
3. Ships broadcast their position every few seconds via AIS radio
4. AISStream aggregates signals from coastal receivers + satellites and streams them to us
5. Each message contains: MMSI (ship ID), lat/lon, speed, course, ship name
6. We place/update a Leaflet marker for each vessel and rotate it by heading
7. Clicking any ship opens a popup with full vessel details

## File structure

```
shiptracker/
├── public/
│   ├── index.html    ← Full UI (HUD, map, log bar)
│   └── app.js        ← WebSocket logic, Leaflet markers, stats
├── vercel.json       ← Vercel deployment config
└── README.md
```

## Customisation ideas

- Filter by ship type (buttons in the HUD)
- Click a ship to show its route history
- Add a search bar to find a specific vessel by name or MMSI
- Show a heatmap of busy shipping lanes
- Add weather overlay using OpenWeatherMap (also free)
