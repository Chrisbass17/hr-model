// api/savant.js
// Serverless proxy for Baseball Savant. Savant blocks browser requests via CORS,
// so this function runs server-side, fetches the CSV, and relays it to the client
// with permissive CORS headers. All leaderboards on Savant support CSV export via
// the &csv=true query param — we build the URL server-side from the `kind` param.

const SAVANT_BASE = 'https://baseballsavant.mlb.com';

// Each kind maps to a specific Savant leaderboard endpoint with the filters we need.
// These URLs mirror what the Savant UI sends when you click "Download CSV".
// Season is parameterized so this survives off-season rollovers.
function buildUrl(kind, season, handedness) {
  const S = season || '2026';

  // min_pa threshold keeps noisy low-sample players out. Adjust per-leaderboard.
  const urls = {
    // === BATTER LEADERBOARDS ===
    batting_expected: `${SAVANT_BASE}/leaderboard/expected_statistics?type=batter&year=${S}&position=&team=&filterType=bip&min=50&csv=true`,

    batting_exit_velo: `${SAVANT_BASE}/leaderboard/statcast?type=batter&year=${S}&position=&team=&min=50&csv=true`,

    batting_bat_tracking: `${SAVANT_BASE}/leaderboard/bat-tracking?attackZone=&batSide=&pitchHand=&seasonType=Reg&season=${S}&seasonLower=${S}&seasonUpper=${S}&team=&playerType=batter&min=50&sort=4,1&csv=true`,

    batting_batted_ball: `${SAVANT_BASE}/leaderboard/batted-ball?type=batter&year=${S}&team=&min=50&csv=true`,

    // === PITCHER LEADERBOARDS (handedness-split where supported) ===
    pitching_expected: `${SAVANT_BASE}/leaderboard/expected_statistics?type=pitcher&year=${S}&position=&team=&filterType=bip&min=50&csv=true`,

    pitching_exit_velo: `${SAVANT_BASE}/leaderboard/statcast?type=pitcher&year=${S}&position=&team=&min=50&csv=true`,

    // Bat tracking supports batSide filter — L or R — for platoon splits
    pitching_bat_tracking_vs_L: `${SAVANT_BASE}/leaderboard/bat-tracking?attackZone=&batSide=L&pitchHand=&seasonType=Reg&season=${S}&seasonLower=${S}&seasonUpper=${S}&team=&playerType=pitcher&min=50&sort=4,1&csv=true`,

    pitching_bat_tracking_vs_R: `${SAVANT_BASE}/leaderboard/bat-tracking?attackZone=&batSide=R&pitchHand=&seasonType=Reg&season=${S}&seasonLower=${S}&seasonUpper=${S}&team=&playerType=pitcher&min=50&sort=4,1&csv=true`,

    // Batted ball profile also supports batter-side split for pitchers
    pitching_batted_ball_vs_L: `${SAVANT_BASE}/leaderboard/batted-ball?type=pitcher&year=${S}&team=&min=50&bat_side=L&csv=true`,

    pitching_batted_ball_vs_R: `${SAVANT_BASE}/leaderboard/batted-ball?type=pitcher&year=${S}&team=&min=50&bat_side=R&csv=true`,
  };

  return urls[kind];
}

export default async function handler(req, res) {
  // CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { kind, season, handedness } = req.query;
  if (!kind) {
    return res.status(400).json({ error: 'Missing `kind` query param' });
  }

  const url = buildUrl(kind, season, handedness);
  if (!url) {
    return res.status(400).json({ error: `Unknown kind: ${kind}` });
  }

  try {
    // Savant sometimes throttles — add a real browser UA to look less botty
    const savantResp = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        Accept: 'text/csv,application/csv,*/*',
      },
    });

    if (!savantResp.ok) {
      return res.status(502).json({
        error: `Savant responded ${savantResp.status}`,
        url,
      });
    }

    const csv = await savantResp.text();

    // Cache at the edge for 10 minutes — Savant updates leaderboards only a few
    // times per day anyway, and this dramatically reduces our surface area to
    // being rate-limited. Client can force refresh with ?t=<timestamp>.
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('X-Savant-Source', url);
    return res.status(200).send(csv);
  } catch (err) {
    return res.status(500).json({ error: err.message, url });
  }
}
