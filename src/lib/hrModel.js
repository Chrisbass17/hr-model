// src/lib/hrModel.js
// Composite HR projection model. Produces a 0-100 score per batter-vs-pitcher
// matchup with a full breakdown so the UI can show what's driving the number.
//
// DESIGN PRINCIPLE: every sub-score is z-score normalized against league average,
// then squashed into 0-1 via logistic. Weights sum to 1.0. This means the score
// is interpretable: 50 = league-average matchup for HR, 70+ = elite spot, <35 = avoid.
//
// Factors (with weights reflecting Chris's spec + standard HR research):
//  - Batter power          (28%)  — Barrel%, EV50, HardHit%, BatSpeed, Blasts%
//  - Pitcher vulnerability (26%)  — same metrics allowed, vs batter's handedness
//  - Batted ball profile   (12%)  — FB%, Pull Air% (batter) vs same allowed (pitcher)
//  - Park factor           (10%)  — 3yr HR park factor (100 = neutral)
//  - Weather               (14%)  — temp, wind-to-CF component, humidity, pressure
//  - Recent form           (10%)  — from user-uploaded CSV (L7/L14 power metrics)

// ------ League averages (2025-26 benchmarks; update annually) ------
const LG = {
  barrel_pct: 8.0,     // % of BBE that are barreled
  ev50: 90.5,          // 50th percentile exit velo
  hard_hit_pct: 40.0,
  bat_speed: 72.0,     // mph
  blasts_pct_contact: 20.0,
  squared_up_pct_contact: 30.0,
  fb_pct: 23.0,        // fly ball rate
  pull_air_pct: 22.0,
  adj_ev: 90.0,
  // Pitcher-allowed averages (mirror batter numbers since they're population avgs)
  p_barrel_pct_allowed: 8.0,
  p_ev50_allowed: 90.5,
  p_hard_hit_allowed: 40.0,
  p_fb_pct_allowed: 23.0,
  p_pull_air_allowed: 22.0,
};

// Standard deviations used for z-scoring. Tighter σ = more score spread.
const SD = {
  barrel_pct: 3.5,
  ev50: 3.0,
  hard_hit_pct: 6.0,
  bat_speed: 2.5,
  blasts_pct_contact: 7.0,
  squared_up_pct_contact: 5.0,
  fb_pct: 5.0,
  pull_air_pct: 5.0,
  adj_ev: 3.0,
  p_barrel_pct_allowed: 2.5,
  p_ev50_allowed: 2.0,
  p_hard_hit_allowed: 4.0,
  p_fb_pct_allowed: 4.0,
  p_pull_air_allowed: 4.0,
};

// Logistic squash: maps z-score (-3..+3) into (0..1) centered at 0.5
const sig = (z) => 1 / (1 + Math.exp(-z * 0.9));
const z = (val, mean, sd) => (val == null ? 0 : (val - mean) / sd);

// --------- Sub-score: batter power ---------
function batterPowerScore(b) {
  if (!b) return { score: 0.5, parts: {} };
  const zBarrel = z(b.barrel_pct, LG.barrel_pct, SD.barrel_pct);
  const zEV50 = z(b.ev50, LG.ev50, SD.ev50);
  const zHard = z(b.hard_hit_pct, LG.hard_hit_pct, SD.hard_hit_pct);
  const zBatSpd = z(b.bat_speed, LG.bat_speed, SD.bat_speed);
  const zBlasts = z(b.blasts_pct_contact, LG.blasts_pct_contact, SD.blasts_pct_contact);
  const zAdjEV = z(b.adj_ev, LG.adj_ev, SD.adj_ev);

  // Weighted combo — barrels + adj EV carry the most signal for HR
  const composite =
    0.28 * zBarrel +
    0.18 * zEV50 +
    0.14 * zHard +
    0.14 * zBatSpd +
    0.12 * zBlasts +
    0.14 * zAdjEV;

  return {
    score: sig(composite),
    parts: { zBarrel, zEV50, zHard, zBatSpd, zBlasts, zAdjEV, composite },
  };
}

// --------- Sub-score: pitcher vulnerability (vs batter handedness) ---------
function pitcherVulnScore(p) {
  if (!p) return { score: 0.5, parts: {} };
  // Higher allowed = worse pitcher = better for batter HR = HIGHER score
  const zBarrel = z(p.barrel_pct_allowed, LG.p_barrel_pct_allowed, SD.p_barrel_pct_allowed);
  const zEV50 = z(p.ev50_allowed, LG.p_ev50_allowed, SD.p_ev50_allowed);
  const zHard = z(p.hard_hit_allowed, LG.p_hard_hit_allowed, SD.p_hard_hit_allowed);

  const composite = 0.45 * zBarrel + 0.30 * zEV50 + 0.25 * zHard;
  return { score: sig(composite), parts: { zBarrel, zEV50, zHard, composite } };
}

// --------- Sub-score: batted ball profile alignment ---------
function battedBallScore(b, p) {
  const zBatterFB = z(b?.fb_pct, LG.fb_pct, SD.fb_pct);
  const zBatterPull = z(b?.pull_air_pct, LG.pull_air_pct, SD.pull_air_pct);
  const zPitchFB = z(p?.fb_pct_allowed, LG.p_fb_pct_allowed, SD.p_fb_pct_allowed);
  const zPitchPull = z(p?.pull_air_allowed, LG.p_pull_air_allowed, SD.p_pull_air_allowed);

  // Best HR setup: fly-ball/pull-air hitter against fly-ball/pull-prone pitcher
  const composite = 0.3 * zBatterFB + 0.3 * zBatterPull + 0.2 * zPitchFB + 0.2 * zPitchPull;
  return { score: sig(composite), parts: { zBatterFB, zBatterPull, zPitchFB, zPitchPull, composite } };
}

// --------- Sub-score: park factor ---------
// 100 = neutral. 118 (Coors) = ~12% more HRs than average. We map to 0-1 around 0.5.
function parkScore(hrFactor) {
  if (!hrFactor) return { score: 0.5, parts: {} };
  const delta = (hrFactor - 100) / 20; // 100→0, 120→+1, 80→-1
  return { score: sig(delta * 1.5), parts: { hrFactor, delta } };
}

// --------- Sub-score: weather ---------
// Given hourly weather array (3 hours: game time + next 2) and wind-to-CF component.
// Temp boost: every 10°F above 70°F ≈ +1% HR rate (Alan Nathan research).
// Wind to CF: +10 mph to CF ≈ +15% HR; -10 mph (in) ≈ -15%.
// Humidity: higher humidity = less dense air = slight HR boost (small effect).
// Pressure: lower pressure = less dense = more HR (opposite of intuition).
function weatherScore(weather, parkBearing, isDome) {
  if (isDome === true) return { score: 0.5, parts: { dome: true } };
  if (!weather?.hours?.length) return { score: 0.5, parts: { missing: true } };

  // Average across the 3 game hours — games last ~3 hours so this captures the whole window
  const avg = (key) =>
    weather.hours.reduce((s, h) => s + (h[key] || 0), 0) / weather.hours.length;

  const temp = avg('temp_f');
  const humidity = avg('humidity_pct');
  const pressure = avg('pressure_hpa');
  const windSpd = avg('wind_mph');
  const windDir = avg('wind_dir_deg');

  // Wind component toward CF (positive = blowing out)
  const windToward = (windDir + 180) % 360;
  const delta = ((windToward - parkBearing + 540) % 360) - 180;
  const windToCF = windSpd * Math.cos((delta * Math.PI) / 180);

  // Individual z-scores (custom, not from SD table)
  const zTemp = (temp - 70) / 12;            // each 12°F ≈ 1 sigma
  const zWind = windToCF / 7;                 // each 7mph out ≈ 1 sigma
  const zHum = (humidity - 55) / 25;
  const zPres = -(pressure - 1013) / 10;      // inverted: low pressure = HR+

  // Wind dominates, temp next, humidity/pressure minor
  const composite = 0.5 * zWind + 0.3 * zTemp + 0.1 * zHum + 0.1 * zPres;
  return {
    score: sig(composite),
    parts: { temp, humidity, pressure, windSpd, windDir, windToCF, zTemp, zWind, zHum, zPres, composite },
  };
}

// --------- Sub-score: recent form (from user CSV) ---------
// Expects { l7_hr, l7_barrel_pct, l14_barrel_pct, l14_hard_hit } shape.
function recentFormScore(rf) {
  if (!rf) return { score: 0.5, parts: { missing: true } };
  const zL7Barrel = z(rf.l7_barrel_pct, LG.barrel_pct, SD.barrel_pct);
  const zL14Hard = z(rf.l14_hard_hit, LG.hard_hit_pct, SD.hard_hit_pct);
  const composite = 0.6 * zL7Barrel + 0.4 * zL14Hard;
  return { score: sig(composite), parts: { zL7Barrel, zL14Hard, composite } };
}

// --------- MASTER COMPOSITE ---------
export function computeHRScore({ batter, pitcher, park, weather, recentForm }) {
  const power = batterPowerScore(batter);
  const vuln = pitcherVulnScore(pitcher);
  const bbProfile = battedBallScore(batter, pitcher);
  const parkS = parkScore(park?.hrFactor);
  const weatherS = weatherScore(
    weather,
    park?.bearing ?? 0,
    park?.dome === true // treat retractable as outdoor for now
  );
  const formS = recentFormScore(recentForm);

  // Weights — tuned so each factor has meaningful but non-dominant influence
  const W = {
    power: 0.28,
    vuln: 0.26,
    bbProfile: 0.12,
    park: 0.10,
    weather: 0.14,
    form: 0.10,
  };

  const raw =
    W.power * power.score +
    W.vuln * vuln.score +
    W.bbProfile * bbProfile.score +
    W.park * parkS.score +
    W.weather * weatherS.score +
    W.form * formS.score;

  // Convert 0-1 to 0-100 with slight stretch so extremes are more visible
  const finalScore = Math.round(Math.max(0, Math.min(100, (raw - 0.5) * 180 + 50)));

  return {
    score: finalScore,
    tier:
      finalScore >= 72 ? 'ELITE' :
      finalScore >= 62 ? 'PRIME' :
      finalScore >= 52 ? 'LEAN' :
      finalScore >= 42 ? 'NEUTRAL' : 'FADE',
    breakdown: {
      power: { ...power, weight: W.power, contrib: W.power * power.score },
      vuln: { ...vuln, weight: W.vuln, contrib: W.vuln * vuln.score },
      bbProfile: { ...bbProfile, weight: W.bbProfile, contrib: W.bbProfile * bbProfile.score },
      park: { ...parkS, weight: W.park, contrib: W.park * parkS.score },
      weather: { ...weatherS, weight: W.weather, contrib: W.weather * weatherS.score },
      form: { ...formS, weight: W.form, contrib: W.form * formS.score },
    },
  };
}
