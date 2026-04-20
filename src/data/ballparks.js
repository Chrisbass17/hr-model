// src/data/ballparks.js
// MLB ballparks keyed by venue ID (from statsapi.mlb.com/api/v1/venues).
// - lat/lon: stadium coordinates for weather lookups
// - bearing: compass heading from home plate to center field (degrees, 0=N, 90=E)
//   Used to rotate wind direction into park-relative frame. Wind "out to CF"
//   means wind is blowing in the same direction as this bearing.
// - dome: true means skip weather (Tropicana, Minute Maid roof closed, etc.)
//         'retractable' means check status per game (we default to outdoor values)
// - hrFactor: 3-year park HR factor (100 = neutral). Coors/GABP/Yankee are HR-friendly,
//             Marlins Park/Oracle suppress HRs.

export const BALLPARKS = {
  // AL East
  1: { name: 'Oriole Park at Camden Yards', team: 'BAL', lat: 39.2839, lon: -76.6218, bearing: 60, dome: false, hrFactor: 104 },
  2: { name: 'Tropicana Field', team: 'TB', lat: 27.7683, lon: -82.6534, bearing: 45, dome: true, hrFactor: 96 },
  3: { name: 'Yankee Stadium', team: 'NYY', lat: 40.8296, lon: -73.9262, bearing: 75, dome: false, hrFactor: 110 },
  4: { name: 'Fenway Park', team: 'BOS', lat: 42.3467, lon: -71.0972, bearing: 45, dome: false, hrFactor: 102 },
  14: { name: 'Rogers Centre', team: 'TOR', lat: 43.6414, lon: -79.3894, bearing: 0, dome: 'retractable', hrFactor: 104 },

  // AL Central
  5: { name: 'Progressive Field', team: 'CLE', lat: 41.4962, lon: -81.6852, bearing: 0, dome: false, hrFactor: 97 },
  7: { name: 'Comerica Park', team: 'DET', lat: 42.3390, lon: -83.0485, bearing: 150, dome: false, hrFactor: 95 },
  4705: { name: 'Kauffman Stadium', team: 'KC', lat: 39.0517, lon: -94.4803, bearing: 45, dome: false, hrFactor: 94 },
  3312: { name: 'Target Field', team: 'MIN', lat: 44.9817, lon: -93.2776, bearing: 90, dome: false, hrFactor: 99 },
  4: { name: 'Guaranteed Rate Field', team: 'CWS', lat: 41.8300, lon: -87.6337, bearing: 30, dome: false, hrFactor: 108 },
  // Note: some venue IDs conflict across sources; MLB Stats API is authoritative — we'll fall back by team abbr if needed

  // AL West
  2680: { name: 'Angel Stadium', team: 'LAA', lat: 33.8003, lon: -117.8827, bearing: 60, dome: false, hrFactor: 100 },
  2392: { name: 'Minute Maid Park', team: 'HOU', lat: 29.7572, lon: -95.3555, bearing: 345, dome: 'retractable', hrFactor: 102 },
  10: { name: 'Oakland Coliseum', team: 'ATH', lat: 37.7516, lon: -122.2005, bearing: 60, dome: false, hrFactor: 90 },
  680: { name: 'T-Mobile Park', team: 'SEA', lat: 47.5914, lon: -122.3325, bearing: 45, dome: 'retractable', hrFactor: 94 },
  13: { name: 'Globe Life Field', team: 'TEX', lat: 32.7473, lon: -97.0847, bearing: 345, dome: 'retractable', hrFactor: 101 },

  // NL East
  4705: { name: 'Truist Park', team: 'ATL', lat: 33.8908, lon: -84.4678, bearing: 150, dome: false, hrFactor: 101 },
  4169: { name: 'loanDepot park', team: 'MIA', lat: 25.7781, lon: -80.2197, bearing: 40, dome: 'retractable', hrFactor: 87 },
  3289: { name: 'Citi Field', team: 'NYM', lat: 40.7571, lon: -73.8458, bearing: 30, dome: false, hrFactor: 95 },
  2681: { name: 'Citizens Bank Park', team: 'PHI', lat: 39.9061, lon: -75.1665, bearing: 15, dome: false, hrFactor: 106 },
  3309: { name: 'Nationals Park', team: 'WSH', lat: 38.8730, lon: -77.0074, bearing: 15, dome: false, hrFactor: 101 },

  // NL Central
  17: { name: 'Wrigley Field', team: 'CHC', lat: 41.9484, lon: -87.6553, bearing: 30, dome: false, hrFactor: 104 },
  2602: { name: 'Great American Ball Park', team: 'CIN', lat: 39.0979, lon: -84.5069, bearing: 135, dome: false, hrFactor: 115 },
  32: { name: 'American Family Field', team: 'MIL', lat: 43.0280, lon: -87.9712, bearing: 30, dome: 'retractable', hrFactor: 101 },
  31: { name: 'PNC Park', team: 'PIT', lat: 40.4469, lon: -80.0057, bearing: 115, dome: false, hrFactor: 92 },
  2889: { name: 'Busch Stadium', team: 'STL', lat: 38.6226, lon: -90.1928, bearing: 60, dome: false, hrFactor: 94 },

  // NL West
  15: { name: 'Chase Field', team: 'AZ', lat: 33.4453, lon: -112.0667, bearing: 90, dome: 'retractable', hrFactor: 104 },
  19: { name: 'Coors Field', team: 'COL', lat: 39.7559, lon: -104.9942, bearing: 0, dome: false, hrFactor: 118 },
  22: { name: 'Dodger Stadium', team: 'LAD', lat: 34.0739, lon: -118.2400, bearing: 22, dome: false, hrFactor: 103 },
  2395: { name: 'Petco Park', team: 'SD', lat: 32.7076, lon: -117.1570, bearing: 0, dome: false, hrFactor: 95 },
  2395: { name: 'Oracle Park', team: 'SF', lat: 37.7786, lon: -122.3893, bearing: 90, dome: false, hrFactor: 89 },
};

// Fallback lookup by team abbreviation when venue ID is missing or ambiguous
export const BALLPARKS_BY_TEAM = Object.values(BALLPARKS).reduce((acc, park) => {
  acc[park.team] = park;
  return acc;
}, {});

export function getPark(venueId, teamAbbr) {
  return BALLPARKS[venueId] || BALLPARKS_BY_TEAM[teamAbbr] || null;
}

/**
 * Convert absolute wind direction (meteorological: where wind blows FROM, 0°=N)
 * into park-relative "wind component toward center field" in mph.
 *
 * Positive = blowing OUT to CF (helps HR). Negative = blowing IN from CF (suppresses).
 *
 * Meteorological wind: if wind_dir_deg = 270, wind is coming FROM the west, blowing
 * TO the east. The direction wind is blowing TOWARD = (dir + 180) mod 360.
 *
 * Park bearing = compass angle from home plate to CF.
 * Angle between wind-toward direction and park bearing = how aligned wind is with
 * the CF axis. cos(angle) × wind_speed gives the out-to-CF component.
 */
export function windComponentToCF(wind_mph, wind_dir_deg, park_bearing_deg) {
  const windToward = (wind_dir_deg + 180) % 360;
  const delta = ((windToward - park_bearing_deg + 540) % 360) - 180; // -180..180
  const component = wind_mph * Math.cos((delta * Math.PI) / 180);
  return component;
}
