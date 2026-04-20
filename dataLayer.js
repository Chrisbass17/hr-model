// src/lib/dataLayer.js
// Unified client for talking to our Vercel serverless proxies.
// All Savant data flows through /api/savant?kind=... and comes back as CSV,
// which we parse with PapaParse. We cache each "kind" in memory (and localStorage)
// for 10 minutes since Savant only updates a few times per day.

import Papa from 'papaparse';

const CACHE_VERSION = 'v1';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function cacheKey(kind, season) {
  return `hrmodel:${CACHE_VERSION}:${kind}:${season}`;
}

function readCache(kind, season) {
  try {
    const raw = localStorage.getItem(cacheKey(kind, season));
    if (!raw) return null;
    const { t, data } = JSON.parse(raw);
    if (Date.now() - t > CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(kind, season, data) {
  try {
    localStorage.setItem(
      cacheKey(kind, season),
      JSON.stringify({ t: Date.now(), data })
    );
  } catch {
    // localStorage can throw when quota exceeded — silently skip
  }
}

// ---------- Savant CSV fetcher ----------
export async function fetchSavant(kind, { season = '2026', force = false } = {}) {
  if (!force) {
    const cached = readCache(kind, season);
    if (cached) return { data: cached, fromCache: true };
  }

  // Cache-buster when forcing refresh
  const tParam = force ? `&t=${Date.now()}` : '';
  const resp = await fetch(`/api/savant?kind=${kind}&season=${season}${tParam}`);

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Savant fetch ${kind} failed: ${resp.status} ${err}`);
  }

  const csv = await resp.text();
  const parsed = Papa.parse(csv, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors.length) {
    console.warn(`Savant CSV parse warnings for ${kind}:`, parsed.errors.slice(0, 3));
  }

  writeCache(kind, season, parsed.data);
  return { data: parsed.data, fromCache: false };
}

// ---------- Schedule ----------
export async function fetchSchedule(date) {
  const q = date ? `?date=${date}` : '';
  const resp = await fetch(`/api/schedule${q}`);
  if (!resp.ok) throw new Error(`Schedule fetch failed: ${resp.status}`);
  return resp.json();
}

// ---------- Roster ----------
export async function fetchRoster(teamId) {
  const resp = await fetch(`/api/roster?teamId=${teamId}`);
  if (!resp.ok) throw new Error(`Roster fetch failed: ${resp.status}`);
  return resp.json();
}

// ---------- Weather ----------
export async function fetchWeather(lat, lon, gameTimeISO) {
  const q = new URLSearchParams({ lat, lon });
  if (gameTimeISO) q.set('gameTimeISO', gameTimeISO);
  const resp = await fetch(`/api/weather?${q}`);
  if (!resp.ok) throw new Error(`Weather fetch failed: ${resp.status}`);
  return resp.json();
}

// ---------- Player lookup helpers ----------
// Savant CSVs vary in their column naming. These normalizers smooth over that.
// Keys we try in order; first non-null wins.

const BATTER_FIELDS = {
  playerId: ['player_id', 'batter', 'mlb_id'],
  playerName: ['player_name', 'last_name, first_name', 'name'],
  // Batting Expected / generic
  la_sweet_spot_pct: ['la_sweet_spot_percent', 'sweet_spot_percent', 'sweet_spot_pct', 'la_sweet_spot'],
  barrel_pct: ['brl_percent', 'barrels_per_bbe_percent', 'barrel_batted_rate', 'brl_pct'],
  hard_hit_pct: ['hard_hit_percent', 'hard_hit_rate', 'ev95percent', 'hard_hit'],
  ev50: ['ev50', 'exit_velocity_avg', 'avg_hit_speed', 'hit_speed_50'],
  adj_ev: ['adjusted_exit_velocity', 'adj_ev', 'avg_adjusted_hit_speed'],
  // Bat tracking
  bat_speed: ['avg_bat_speed', 'bat_speed', 'swing_speed'],
  squared_up_pct_contact: ['squared_up_per_bat_contact_percent', 'squared_up_contact_pct', 'squared_up_rate'],
  squared_up_pct_swing: ['squared_up_per_swing_percent', 'squared_up_swing_pct'],
  blasts_pct_contact: ['blast_per_bat_contact_percent', 'blast_contact_pct', 'blasts_contact_rate'],
  blasts_pct_swing: ['blast_per_swing_percent', 'blast_swing_pct'],
  // Batted ball profile
  fb_pct: ['fly_ball_percent', 'flyball_percent', 'fb_percent'],
  pull_air_pct: ['pull_air_percent', 'pull_percent_air', 'pulled_air_percent'],
  straight_air_pct: ['straight_air_percent', 'straightaway_air_percent'],
  oppo_air_pct: ['oppo_air_percent', 'opposite_air_percent'],
  // Exit velo / barrels
  ev_fb_ld: ['avg_hit_speed_fb_ld', 'exit_velocity_fb_ld', 'ev_fb_ld'],
  brl_pa_pct: ['brl_pa', 'barrels_per_pa_percent', 'barrels_per_pa'],
};

const PITCHER_FIELDS = {
  playerId: ['player_id', 'pitcher', 'mlb_id'],
  playerName: ['player_name', 'last_name, first_name', 'name'],
  la_sweet_spot_allowed: ['la_sweet_spot_percent', 'sweet_spot_percent'],
  barrel_pct_allowed: ['brl_percent', 'barrels_per_bbe_percent', 'barrel_batted_rate'],
  hard_hit_allowed: ['hard_hit_percent', 'hard_hit_rate', 'ev95percent'],
  ev50_allowed: ['ev50', 'exit_velocity_avg', 'avg_hit_speed'],
  adj_ev_allowed: ['adjusted_exit_velocity', 'adj_ev'],
  bat_speed_allowed: ['avg_bat_speed', 'bat_speed'],
  squared_up_pct_allowed: ['squared_up_per_bat_contact_percent'],
  blasts_pct_allowed: ['blast_per_bat_contact_percent'],
  fb_pct_allowed: ['fly_ball_percent', 'flyball_percent'],
  pull_air_allowed: ['pull_air_percent', 'pull_percent_air'],
  straight_air_allowed: ['straight_air_percent'],
  oppo_air_allowed: ['oppo_air_percent'],
  ev_fb_ld_allowed: ['avg_hit_speed_fb_ld'],
  brl_pa_pct_allowed: ['brl_pa', 'barrels_per_pa_percent'],
};

function pickField(row, candidates) {
  for (const key of candidates) {
    if (row[key] != null && row[key] !== '') return row[key];
  }
  return null;
}

export function normalizeBatterRow(row) {
  if (!row) return null;
  const out = {};
  for (const [outKey, candidates] of Object.entries(BATTER_FIELDS)) {
    out[outKey] = pickField(row, candidates);
  }
  return out;
}

export function normalizePitcherRow(row) {
  if (!row) return null;
  const out = {};
  for (const [outKey, candidates] of Object.entries(PITCHER_FIELDS)) {
    out[outKey] = pickField(row, candidates);
  }
  return out;
}

// Find a player by MLB ID across a merged dataset (rows from multiple Savant kinds
// for the same player get merged by ID).
export function buildPlayerIndex(rowsByKind) {
  const index = new Map();
  for (const [kind, rows] of Object.entries(rowsByKind)) {
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const pid = row.player_id || row.batter || row.pitcher;
      if (!pid) continue;
      if (!index.has(pid)) index.set(pid, { _id: pid, _kinds: [] });
      const merged = index.get(pid);
      merged._kinds.push(kind);
      // Merge fields — later kinds override earlier ones on conflict
      Object.assign(merged, row);
    }
  }
  return index;
}
