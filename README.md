# HR Model — Matchup Analysis

Deep per-matchup home-run projection tool. Pulls live Baseball Savant data
through a Vercel serverless proxy (solves CORS), merges MLB Stats API schedules
and probable pitchers, layers in real-time Open-Meteo weather, and computes a
transparent composite HR score with full factor breakdown.

## Quick Deploy (Vercel)

```bash
# 1. Push to GitHub (this repo)
git init
git add .
git commit -m "Initial HR model"
git remote add origin https://github.com/Chrisbass17/hr-model.git
git push -u origin main

# 2. Import in Vercel
# Go to vercel.com → New Project → import hr-model repo
# Framework preset: Vite (auto-detected)
# No environment variables needed
# Deploy.
```

That's it. No env vars, no database, no secrets.

## Architecture

```
┌─────────────────────────┐         ┌──────────────────────────┐
│   React (Vite) frontend │ fetch() │  Vercel serverless /api  │
│   deployed as static    │────────▶│  ──────────────────────  │
│   assets                │         │  /api/savant   (CSV)     │
└─────────────────────────┘         │  /api/schedule (JSON)    │
                                    │  /api/roster   (JSON)    │
                                    │  /api/weather  (JSON)    │
                                    └─────────────┬────────────┘
                                                  │
                          ┌───────────────────────┼───────────────────────┐
                          ▼                       ▼                       ▼
                  baseballsavant.mlb.com   statsapi.mlb.com     api.open-meteo.com
                  (CSV exports)            (official API)       (free, no key)
```

Every Savant call passes through `/api/savant?kind=...` which:
- adds a browser-like User-Agent (Savant occasionally throttles obvious bots)
- sets permissive CORS headers so the browser accepts the response
- caches at Vercel's edge for 10 minutes (Savant updates a few times per day)

The client additionally caches parsed CSVs in `localStorage` for 10 min to
minimize round-trips when you refresh or navigate.

## Data Pulled

### Per boot (10 Savant calls, all in parallel)
- `batting_expected` — LA Sweet Spot %, Barrel %, Hard Hit %, EV 50, Adj EV
- `batting_exit_velo` — EV FB/LD, Hard Hit %, Barrels/PA, Brls/BBE
- `batting_bat_tracking` — Avg Bat Speed, Squared Up %, Blasts %
- `batting_batted_ball` — FB %, Pull Air %, Straight Air %, Oppo Air %
- `pitching_expected`, `pitching_exit_velo` — pitcher allowed versions
- `pitching_bat_tracking_vs_L`, `pitching_bat_tracking_vs_R` — platoon splits
- `pitching_batted_ball_vs_L`, `pitching_batted_ball_vs_R` — platoon splits

### Per game/batter selection
- MLB schedule + probable pitcher (`statsapi.mlb.com`)
- Active roster with handedness (`statsapi.mlb.com`)
- Weather: temp, wind (speed + direction), humidity, pressure — game time + next 2 hours (`api.open-meteo.com`)

### User-provided
- CSV drop zone for recent form (L7/L14 batter) and pitcher-vs-handedness data
  from previous models. Schema auto-detected from common column name patterns.

## Refresh Behavior

- **Auto**: every 10 minutes the app re-fetches everything in the background
- **Manual**: "Refresh" button in matchup picker bypasses all caches (`?force=true`)
- **Per-game**: switching games triggers a fresh weather fetch
- **Per-batter**: switching batters re-resolves pitcher splits against new bat-side

## HR Composite Model

Score ranges 0–100, centered at 50 (league-average matchup).

| Factor | Weight | Components |
|--------|--------|------------|
| Batter Power | 28% | Barrel%, EV50, Hard Hit%, Bat Speed, Blasts%, Adj EV |
| Pitcher Vulnerability | 26% | Barrel% allowed, EV50 allowed, Hard Hit allowed (vs batter's hand) |
| Batted Ball Fit | 12% | Batter FB/Pull Air × Pitcher FB/Pull allowed |
| Park Factor | 10% | 3-yr HR park factor (Coors 118 → Oracle 89) |
| Weather | 14% | Wind-to-CF component (dominant), temp, humidity, pressure |
| Recent Form | 10% | L7 Barrel%, L14 Hard Hit% from uploaded CSV |

Each sub-factor is z-score normalized against 2025–26 league averages and
squashed through a logistic function before weighted combination.

### Tiers
- **ELITE** (72+) — pound it
- **PRIME** (62–71) — strong HR spot
- **LEAN** (52–61) — slight edge
- **NEUTRAL** (42–51) — pass
- **FADE** (<42) — avoid

## File Structure

```
hr-model/
├── api/                          # Vercel serverless functions
│   ├── savant.js                 # Savant CSV proxy (all 10 leaderboards)
│   ├── schedule.js               # MLB schedule + probable pitchers
│   ├── roster.js                 # Team active rosters
│   └── weather.js                # Open-Meteo forecast slice
├── src/
│   ├── App.jsx                   # Main matchup analysis page
│   ├── components/
│   │   ├── MatchupPicker.jsx     # Game/side/batter selector
│   │   ├── BatterPanel.jsx       # Full batter profile display
│   │   ├── PitcherPanel.jsx      # Pitcher vs handedness splits
│   │   ├── WeatherPanel.jsx      # Weather + wind compass viz
│   │   ├── ScoreBreakdown.jsx    # Composite score + factor bars
│   │   ├── CSVUploadZone.jsx     # Previous-model CSV drop zone
│   │   └── StatRow.jsx           # Reusable stat w/ percentile bar
│   ├── lib/
│   │   ├── hrModel.js            # Composite HR scoring (weights, z-scores)
│   │   ├── dataLayer.js          # Fetch + cache + field normalization
│   │   └── csvUpload.js          # User CSV parser (auto-detect schema)
│   ├── data/
│   │   └── ballparks.js          # 30 parks: coords, bearings, dome, HR factor
│   └── index.css                 # Tailwind + custom design tokens
├── vercel.json                   # Function routing config
├── vite.config.js
├── tailwind.config.js
└── package.json
```

## Tuning Notes

- **League averages** (in `src/lib/hrModel.js` → `LG` object): update these at
  the start of each season, or when the first few weeks of data are stale
  (early-season numbers differ from full-season).
- **Weights** (in `computeHRScore` → `W` object): if you backtest and find
  weather is over/under-weighted, adjust here. Weights must sum to 1.0.
- **Park factors** (in `src/data/ballparks.js`): rolling 3-year factors. Update
  annually from BaseballSavant's park factors leaderboard.
- **Savant URL changes**: if a leaderboard endpoint moves or adds params,
  update `buildUrl()` in `api/savant.js`. Test by hitting the URL directly.

## Known Limitations

- **Retractable roofs** are currently treated as outdoor for weather purposes.
  Add a game-time roof status check if precision matters (the MLB schedule
  hydration sometimes includes a `weather` block with `roof: 'closed'`).
- **Switch hitters** are assigned the opposite-handed pitcher split automatically.
- **Savant CSV column names** drift occasionally; `normalizeBatterRow` /
  `normalizePitcherRow` in `dataLayer.js` accept multiple aliases per field to
  survive minor changes. If a new column name appears, add it to the alias array.
- **Minimum PA threshold** is 50 — early season, players below this won't
  appear in Savant data and will show "—" in panels.

## Development

```bash
npm install
npm run dev          # runs Vite dev server
# or
npm run vercel-dev   # runs with serverless function emulation
```

For iPhone/Codespaces development (per Chris's standard workflow), just push
to GitHub and let Vercel auto-deploy.
