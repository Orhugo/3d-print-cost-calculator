# 🧮 3D Printing Cost Calculator

A **super lightweight** web app to work out the real cost of your 3D prints.
All the maths (and the G-code parsing) happens **in the browser**: no backend,
no database. Built with **[Astro](https://astro.build)**, which **compiles to
static HTML/CSS/JS** — the server just serves files. Designed to run on a
**Raspberry Pi** with barely any resource use (final image `nginx:alpine-slim`,
~12 MB; ~6-8 MB of RAM). The Node build runs inside Docker and is **discarded**:
the image that runs on the Pi ships no Node and no dependencies.

## Features

- **Basic data**: filament weight, print time, material and energy cost.
- **Advanced options** (optional): machine amortization, labor (preparation +
  post-processing), consumables, failure rate, profit margin and VAT.
- **G-code upload**: extracts weight and time automatically. Supports
  **PrusaSlicer, SuperSlicer, OrcaSlicer, Bambu Studio and Cura**.
- **Today's electricity price**: a button that pulls the **daily average PVPC**
  from REE's official API (ESIOS). No token. The request is made by your browser.
- **Saveable profiles** for printers (power, price, lifespan) and materials
  (type, price, density, diameter), so you don't retype everything each time.
- **Export quote**: copy to clipboard, download `.txt` or print to PDF.
- **Visual breakdown** with per-line % and a donut chart, sale price and per-part cost.
- From the G-code it also pulls (when present): number of layers, layer height and
  a multi-color warning.
- **Analysis tab**: upload a G-code to read the slicer's settings — temperatures, layer
  height, walls, infill, speeds, supports, adhesion — plus a per-print **history to
  compare** and an exportable **print card**. Tuned for OrcaSlicer.
- **Bilingual (ES/EN)** with automatic browser-language detection and a manual toggle.
- Light/dark theme. Values are stored in your browser (`localStorage`).

## Quick start (Docker)

```bash
docker compose up -d --build
```

Then open `http://YOUR_SERVER:8088` (change the port in `docker-compose.yml` if you like).

### Without compose

```bash
docker build -t costes3d .
docker run -d -p 8088:80 --restart unless-stopped --name costes3d costes3d
```

## Lightweight (Raspberry Pi)

It's tuned to use as little as possible:

- **nginx with a single worker** and no access log (`nginx.conf`) → ~6-8 MB of RAM.
- **Serves static files only**: 0% CPU at idle.
- **Caps in `docker-compose.yml`**: `mem_limit: 32m` and `cpus: 0.5`, so it can
  never steal resources from your other services even if it wanted to.

To check the real usage on your Pi:

```bash
docker stats --no-stream costes3d
```

And to validate the nginx config:

```bash
docker exec costes3d nginx -t
```

> **Raspberry Pi note**: on Raspberry Pi OS, Docker memory limits are usually
> disabled by default. If `docker stats` shows the `LIMIT` as the total RAM (not
> 32 MB), add `cgroup_enable=memory cgroup_memory=1` to the end of the single line
> in `/boot/firmware/cmdline.txt` (or `/boot/cmdline.txt` on older versions) and
> reboot. The app works fine without that tweak; the cap just wouldn't apply (and
> it uses so little that in practice it doesn't matter).

## Local development

Requires Node 18+ (only for development; production is served as static files).

```bash
npm install       # installs Astro and dev dependencies
npm run dev        # dev server with hot reload (http://localhost:4321)
npm run build      # compiles to dist/ (what nginx serves)
npm run preview    # serves the compiled dist/, like production
```

## Tests

The pure logic (G-code parsing, calculations, PVPC) lives in `src/lib/`, separate
from the DOM, and is tested with Node's native runner (no test dependencies):

```bash
npm test           # same as: node --test
```

## Structure

```
src/
├── lib/               Pure, testable logic (no DOM)
│   ├── parse.js       Parsing helpers (HMS, lists, ES numbers)
│   ├── gcode.js       G-code parser + gram resolution
│   ├── insights.js    Extra slicer insights (temps, settings, speeds…)
│   ├── pricing.js     Cost calculation and % split
│   ├── budget.js      Plain-text quote (ES/EN)
│   ├── pvpc.js        REE PVPC parsing
│   ├── i18n.js        ES/EN translations
│   ├── materials.js   Materials table
│   └── index.js       Barrel (single import point)
├── components/        UI pieces (.astro): cards, header, results, analysis view
├── layouts/Base.astro Document shell (head, styles, script)
├── pages/index.astro  Single page, tabs: calculator + analysis
├── scripts/           UI layer (DOM), imports from lib/
│   ├── app.js         Calculator tab
│   └── insights.js    Analysis tab (render, history, print card)
└── styles/global.css  Styles (light/dark theme)
tests/                 Tests with node:test (not included in the image)
astro.config.mjs       Astro config (static output)
nginx.conf             nginx config (cache for hashed assets)
Dockerfile             Multi-stage build: Node compiles -> nginx serves
docker-compose.yml
```

## Cost model

```
Material      = weight(g) / 1000 · price(€/kg)
Energy        = power(W) / 1000 · time(h) · price(€/kWh)
Amortization  = (machine_price / lifespan_h) · time(h)
Direct cost   = Material + Energy + Amortization + Consumables
Failure       = Direct cost · failure_rate%
Labor         = (preparation + post-processing)(min) / 60 · hourly_cost(€/h)

Total cost    = Direct cost + Failure + Labor
Margin        = Total cost · margin%
Sale price    = (Total cost + Margin) · (1 + VAT%)
```
