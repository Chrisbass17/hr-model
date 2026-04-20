import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  fetchSavant,
  fetchSchedule,
  fetchRoster,
  fetchWeather,
  normalizeBatterRow,
  normalizePitcherRow,
  buildPlayerIndex,
} from './lib/dataLayer';
import { computeHRScore } from './lib/hrModel';
import { getPark } from './data/ballparks';
import { buildFormIndex } from './lib/csvUpload';
import { MatchupPicker } from './components/MatchupPicker';
import { BatterPanel } from './components/BatterPanel';
import { PitcherPanel } from './components/PitcherPanel';
import { WeatherPanel } from './components/WeatherPanel';
import { ScoreBreakdown } from './components/ScoreBreakdown';
import { CSVUploadZone } from './components/CSVUploadZone';
import { Activity, Zap } from 'lucide-react';

// Savant "kinds" we pull on boot. Pitcher handedness splits are fetched
// on-demand based on the selected batter's bat side to avoid extra calls.
const BATTER_KINDS = [
  'batting_expected',
  'batting_exit_velo',
  'batting_bat_tracking',
  'batting_batted_ball',
];

const PITCHER_KINDS_BASE = [
  'pitching_expected',
  'pitching_exit_velo',
];

export default function App() {
  // --- Schedule / matchup state ---
  const [games, setGames] = useState([]);
  const [scheduleDate, setScheduleDate] = useState(null);
  const [selectedGamePk, setSelectedGamePk] = useState(null);
  const [selectedSide, setSelectedSide] = useState('away');
  const [selectedBatterId, setSelectedBatterId] = useState(null);

  // --- Savant data ---
  const [batterData, setBatterData] = useState({}); // { kind: [rows] }
  const [pitcherData, setPitcherData] = useState({});
  const [rosters, setRosters] = useState({}); // { teamId: { batters: [] } }

  // --- Weather ---
  const [weather, setWeather] = useState(null);

  // --- Uploads ---
  const [uploads, setUploads] = useState([]);

  // --- Status ---
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // ============ Initial Load ============
  const loadEverything = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      // Fetch schedule + all Savant data in parallel
      const [sched, ...savantResults] = await Promise.all([
        fetchSchedule(),
        ...BATTER_KINDS.map((k) => fetchSavant(k, { force })),
        ...PITCHER_KINDS_BASE.map((k) => fetchSavant(k, { force })),
        fetchSavant('pitching_bat_tracking_vs_L', { force }),
        fetchSavant('pitching_bat_tracking_vs_R', { force }),
        fetchSavant('pitching_batted_ball_vs_L', { force }),
        fetchSavant('pitching_batted_ball_vs_R', { force }),
      ]);

      setGames(sched.games || []);
      setScheduleDate(sched.date);

      // Split savant results into batter/pitcher buckets
      const batterResults = savantResults.slice(0, BATTER_KINDS.length);
      const pitcherResultsBase = savantResults.slice(
        BATTER_KINDS.length,
        BATTER_KINDS.length + PITCHER_KINDS_BASE.length
      );
      const pitcherSplits = savantResults.slice(BATTER_KINDS.length + PITCHER_KINDS_BASE.length);

      const batterMap = {};
      BATTER_KINDS.forEach((k, i) => {
        batterMap[k] = batterResults[i].data;
      });
      setBatterData(batterMap);

      const pitcherMap = {};
      PITCHER_KINDS_BASE.forEach((k, i) => {
        pitcherMap[k] = pitcherResultsBase[i].data;
      });
      pitcherMap.pitching_bat_tracking_vs_L = pitcherSplits[0].data;
      pitcherMap.pitching_bat_tracking_vs_R = pitcherSplits[1].data;
      pitcherMap.pitching_batted_ball_vs_L = pitcherSplits[2].data;
      pitcherMap.pitching_batted_ball_vs_R = pitcherSplits[3].data;
      setPitcherData(pitcherMap);

      setLastUpdated(Date.now());

      // Auto-select first game
      if (sched.games?.length && !selectedGamePk) {
        setSelectedGamePk(sched.games[0].gamePk);
      }
    } catch (err) {
      setError(err.message);
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedGamePk]);

  useEffect(() => {
    loadEverything(false);
    // Auto-refresh every 10 minutes
    const interval = setInterval(() => loadEverything(false), 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadEverything]);

  // ============ Load roster when side changes ============
  const selectedGame = games.find((g) => g.gamePk === selectedGamePk);
  const selectedTeamId = selectedGame?.[selectedSide]?.id;

  useEffect(() => {
    if (!selectedTeamId) return;
    if (rosters[selectedTeamId]) return; // cached
    fetchRoster(selectedTeamId)
      .then((r) => setRosters((prev) => ({ ...prev, [selectedTeamId]: r })))
      .catch((err) => console.error('Roster error:', err));
  }, [selectedTeamId, rosters]);

  // Reset batter when game/side changes
  useEffect(() => {
    setSelectedBatterId(null);
  }, [selectedGamePk, selectedSide]);

  // ============ Load weather when game changes ============
  useEffect(() => {
    if (!selectedGame) {
      setWeather(null);
      return;
    }
    const park = getPark(selectedGame.venue?.id, selectedGame.home?.abbr);
    if (!park || park.dome === true) {
      setWeather(null);
      return;
    }
    fetchWeather(park.lat, park.lon, selectedGame.gameDate)
      .then(setWeather)
      .catch((err) => console.error('Weather error:', err));
  }, [selectedGamePk, selectedGame]);

  // ============ Derived: resolved batter/pitcher profiles ============
  const resolvedBatter = useMemo(() => {
    if (!selectedBatterId) return null;
    const batterRoster = rosters[selectedTeamId]?.batters || [];
    const rosterEntry = batterRoster.find((b) => b.id === selectedBatterId);

    // Build merged batter index across all batter kinds
    const idx = buildPlayerIndex(batterData);
    const merged = idx.get(selectedBatterId);
    const normalized = normalizeBatterRow(merged);

    return {
      ...normalized,
      playerName: rosterEntry?.fullName || normalized?.playerName,
      batSide: rosterEntry?.batSide,
    };
  }, [selectedBatterId, selectedTeamId, rosters, batterData]);

  const resolvedPitcher = useMemo(() => {
    if (!selectedGame || !resolvedBatter) return null;
    const opposingSide = selectedSide === 'home' ? 'away' : 'home';
    const pp = selectedGame[opposingSide]?.probablePitcher;
    if (!pp) return null;

    // Pick the handedness-appropriate splits
    const batHand = resolvedBatter.batSide;
    const hand =
      batHand === 'L' ? 'vs_L' :
      batHand === 'R' ? 'vs_R' :
      // Switch hitters: bat opposite of pitcher throws, so use opposite of pitchHand
      pp.pitchHand === 'R' ? 'vs_L' : 'vs_R';

    // Merge all pitcher kinds, prioritizing the handedness-split ones for those metrics
    const general = [pitcherData.pitching_expected, pitcherData.pitching_exit_velo];
    const splitTracking = pitcherData[`pitching_bat_tracking_${hand}`];
    const splitBB = pitcherData[`pitching_batted_ball_${hand}`];

    const allRows = [
      ...(general[0] || []),
      ...(general[1] || []),
      ...(splitTracking || []),
      ...(splitBB || []),
    ].filter((r) => (r.player_id || r.pitcher) === pp.id);

    const merged = allRows.reduce((acc, r) => ({ ...acc, ...r }), {});
    const normalized = normalizePitcherRow(merged);

    return {
      ...normalized,
      playerName: pp.fullName,
      pitchHand: pp.pitchHand,
    };
  }, [selectedGame, selectedSide, resolvedBatter, pitcherData]);

  // ============ Park + weather resolved ============
  const park = useMemo(() => {
    if (!selectedGame) return null;
    return getPark(selectedGame.venue?.id, selectedGame.home?.abbr);
  }, [selectedGame]);

  // ============ Recent form lookup from uploaded CSVs ============
  const formIndex = useMemo(() => buildFormIndex(uploads), [uploads]);
  const recentForm = selectedBatterId ? formIndex.batterForm.get(selectedBatterId) : null;

  // ============ Compute HR score ============
  const hrResult = useMemo(() => {
    if (!resolvedBatter || !resolvedPitcher) return null;
    return computeHRScore({
      batter: resolvedBatter,
      pitcher: resolvedPitcher,
      park,
      weather,
      recentForm,
    });
  }, [resolvedBatter, resolvedPitcher, park, weather, recentForm]);

  // ============ Render ============
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-ink-500 bg-ink-800/50 backdrop-blur sticky top-0 z-20">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-teal-500 to-amber-500 flex items-center justify-center">
              <Zap size={16} className="text-ink-900" strokeWidth={3} />
            </div>
            <div>
              <h1 className="font-display text-xl tracking-wider text-white leading-none">
                HR MODEL
              </h1>
              <div className="text-[9px] uppercase tracking-[0.3em] text-slate-500 mt-0.5">
                Matchup Analysis · {scheduleDate || '...'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {loading && (
              <div className="flex items-center gap-1.5 text-[10px] text-teal-400">
                <Activity size={10} className="animate-pulse" />
                syncing
              </div>
            )}
            <div className="text-[9px] text-slate-500 font-mono">
              {games.length} games · {Object.values(batterData).flat().length} batters
            </div>
          </div>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="max-w-[1400px] mx-auto px-4 pt-3">
          <div className="rounded-md bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-xs text-rose-300">
            <strong className="text-rose-400">Data fetch error:</strong> {error}
          </div>
        </div>
      )}

      {/* Main grid */}
      <main className="max-w-[1400px] mx-auto px-4 py-4 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* LEFT: Matchup picker + uploads */}
        <aside className="space-y-4 lg:sticky lg:top-[76px] lg:self-start">
          <MatchupPicker
            games={games}
            selectedGamePk={selectedGamePk}
            selectedSide={selectedSide}
            selectedBatterId={selectedBatterId}
            roster={rosters[selectedTeamId]}
            onSelectGame={setSelectedGamePk}
            onSelectSide={setSelectedSide}
            onSelectBatter={setSelectedBatterId}
            onRefresh={() => loadEverything(true)}
            loading={loading}
            lastUpdated={lastUpdated}
          />
          <CSVUploadZone
            uploads={uploads}
            onUpload={(u) => setUploads((prev) => [...prev, u])}
            onRemove={(i) => setUploads((prev) => prev.filter((_, idx) => idx !== i))}
          />
        </aside>

        {/* RIGHT: Analysis panels */}
        <section className="space-y-4">
          {/* Score hero */}
          <ScoreBreakdown result={hrResult} />

          {/* Batter + Pitcher side-by-side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg bg-ink-700 border border-ink-500 p-5">
              <BatterPanel batter={resolvedBatter} recentForm={recentForm} />
            </div>
            <div className="rounded-lg bg-ink-700 border border-ink-500 p-5">
              <PitcherPanel
                pitcher={resolvedPitcher}
                batterHand={resolvedBatter?.batSide}
              />
            </div>
          </div>

          {/* Weather full width */}
          <div className="rounded-lg bg-ink-700 border border-ink-500 p-5">
            <WeatherPanel
              weather={weather}
              park={park}
              gameTimeISO={selectedGame?.gameDate}
            />
          </div>
        </section>
      </main>

      <footer className="max-w-[1400px] mx-auto px-4 py-6 text-center text-[10px] text-slate-600 font-mono">
        data · Baseball Savant (via serverless proxy) · MLB Stats API · Open-Meteo
      </footer>
    </div>
  );
}
