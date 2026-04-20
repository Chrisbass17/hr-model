// api/roster.js
// Returns the active 26-man roster for a team, with handedness. This powers the
// batter dropdown in the matchup picker. Savant's CSVs are keyed by MLB player
// ID, so we use that same ID space here for clean joins.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { teamId } = req.query;
  if (!teamId) return res.status(400).json({ error: 'Missing teamId' });

  const url =
    `https://statsapi.mlb.com/api/v1/teams/${teamId}/roster` +
    `?rosterType=active&hydrate=person(stats(type=season,group=hitting))`;

  try {
    const r = await fetch(url);
    if (!r.ok) return res.status(502).json({ error: `MLB API ${r.status}` });
    const data = await r.json();

    const batters = (data.roster || [])
      .filter((p) => p.position?.abbreviation !== 'P')
      .map((p) => ({
        id: p.person?.id,
        fullName: p.person?.fullName,
        batSide: p.person?.batSide?.code || null, // L, R, or S (switch)
        position: p.position?.abbreviation,
        jerseyNumber: p.jerseyNumber,
      }));

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    return res.status(200).json({ teamId, batters });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
