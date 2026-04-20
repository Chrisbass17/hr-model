// api/schedule.js
// Returns today's MLB slate with probable pitchers, venue, and game time.
// Uses the official MLB Stats API (statsapi.mlb.com) which is what Savant's
// own scoreboard pulls from. No auth needed, but CORS-blocked for browsers.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Default to today in America/New_York (when MLB's day rolls over)
  const date =
    req.query.date ||
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

  // hydrate=probablePitcher is the magic param that returns the probable SPs
  // inline in the schedule response — otherwise you'd need a second call per game.
  const url =
    `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}` +
    `&hydrate=probablePitcher,linescore,weather,team,venue`;

  try {
    const r = await fetch(url);
    if (!r.ok) return res.status(502).json({ error: `MLB API ${r.status}` });

    const data = await r.json();
    const games = (data.dates?.[0]?.games || []).map((g) => ({
      gamePk: g.gamePk,
      gameDate: g.gameDate,
      status: g.status?.detailedState,
      venue: {
        id: g.venue?.id,
        name: g.venue?.name,
      },
      home: {
        id: g.teams?.home?.team?.id,
        name: g.teams?.home?.team?.name,
        abbr: g.teams?.home?.team?.abbreviation,
        probablePitcher: g.teams?.home?.probablePitcher
          ? {
              id: g.teams.home.probablePitcher.id,
              fullName: g.teams.home.probablePitcher.fullName,
              pitchHand:
                g.teams.home.probablePitcher.pitchHand?.code || null,
            }
          : null,
      },
      away: {
        id: g.teams?.away?.team?.id,
        name: g.teams?.away?.team?.name,
        abbr: g.teams?.away?.team?.abbreviation,
        probablePitcher: g.teams?.away?.probablePitcher
          ? {
              id: g.teams.away.probablePitcher.id,
              fullName: g.teams.away.probablePitcher.fullName,
              pitchHand:
                g.teams.away.probablePitcher.pitchHand?.code || null,
            }
          : null,
      },
    }));

    // 5-minute edge cache — schedules barely change intra-day, but lineup
    // scratches happen so we don't want stale data for too long.
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
    return res.status(200).json({ date, games });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
