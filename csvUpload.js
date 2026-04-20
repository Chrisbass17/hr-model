// src/lib/csvUpload.js
// Parses user-uploaded CSVs from previous models (recent batter form,
// pitcher-vs-handedness splits). Tolerant to many column naming conventions.

import Papa from 'papaparse';

// Heuristic column detection — maps a variety of common headers to our canonical keys
const HEADER_ALIASES = {
  playerId: ['player_id', 'mlb_id', 'id', 'playerid'],
  playerName: ['player_name', 'name', 'batter', 'player'],
  // Recent form
  l7_hr: ['l7_hr', 'hr_l7', 'hr_last_7', 'l7hr'],
  l7_barrel_pct: ['l7_barrel_pct', 'l7_barrel', 'barrel_l7', 'barrel_pct_l7'],
  l14_barrel_pct: ['l14_barrel_pct', 'barrel_l14', 'barrel_pct_l14'],
  l14_hard_hit: ['l14_hard_hit', 'hardhit_l14', 'hard_hit_l14'],
  l30_iso: ['l30_iso', 'iso_l30'],
  // Pitcher vs handedness
  pitcher_id: ['pitcher_id', 'pitcher', 'mlb_id'],
  pitcher_name: ['pitcher_name', 'name'],
  hand_split: ['hand', 'bat_side', 'vs_hand', 'handedness'],
  hr_per_9_split: ['hr9', 'hr_per_9', 'hr_9'],
  barrel_allowed_split: ['barrel_allowed', 'barrel_pct_allowed'],
  hard_hit_allowed_split: ['hardhit_allowed', 'hard_hit_allowed'],
};

function normalizeHeader(h) {
  return String(h).toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

function detectSchema(headers) {
  const normHeaders = headers.map(normalizeHeader);
  const map = {};
  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    const hit = aliases.find((a) => normHeaders.includes(a));
    if (hit) map[canonical] = headers[normHeaders.indexOf(hit)];
  }
  return map;
}

export async function parseUploadedCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        const schema = detectSchema(headers);

        // Decide CSV type: if it has hand_split column, it's pitcher-vs-hand data
        const type = schema.hand_split ? 'pitcher_vs_hand' : 'batter_form';

        // Convert rows to canonical shape
        const rows = results.data.map((row) => {
          const out = { _type: type };
          for (const [canonical, original] of Object.entries(schema)) {
            out[canonical] = row[original];
          }
          return out;
        });

        resolve({ type, rows, schema, rawHeaders: headers });
      },
      error: reject,
    });
  });
}

// Build lookup maps for fast O(1) access during score computation
export function buildFormIndex(uploads) {
  const batterForm = new Map(); // playerId -> row
  const pitcherVsL = new Map(); // playerId -> row (pitcher vs LHB)
  const pitcherVsR = new Map(); // playerId -> row (pitcher vs RHB)

  for (const upload of uploads) {
    for (const row of upload.rows) {
      if (upload.type === 'batter_form' && row.playerId) {
        batterForm.set(row.playerId, row);
      } else if (upload.type === 'pitcher_vs_hand' && row.pitcher_id) {
        const hand = String(row.hand_split || '').toUpperCase();
        if (hand.startsWith('L')) pitcherVsL.set(row.pitcher_id, row);
        if (hand.startsWith('R')) pitcherVsR.set(row.pitcher_id, row);
      }
    }
  }

  return { batterForm, pitcherVsL, pitcherVsR };
}
