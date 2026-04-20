import React from 'react';
import { ChevronDown, RefreshCw } from 'lucide-react';

// The cascade: Game → Side (home/away as batter side) → Batter → (pitcher auto-set to opposing probable SP)
export function MatchupPicker({
  games,
  selectedGamePk,
  selectedSide, // 'home' or 'away' — which side we're picking the BATTER from
  selectedBatterId,
  roster, // { batters: [...] } for the selected side
  onSelectGame,
  onSelectSide,
  onSelectBatter,
  onRefresh,
  loading,
  lastUpdated,
}) {
  const selectedGame = games.find((g) => g.gamePk === selectedGamePk);
  const opposingSide = selectedSide === 'home' ? 'away' : 'home';
  const probablePitcher = selectedGame?.[opposingSide]?.probablePitcher;
  const selectedBatter = roster?.batters?.find((b) => b.id === selectedBatterId);

  return (
    <div className="rounded-lg bg-ink-700 border border-ink-500 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm tracking-[0.25em] text-slate-400">
          Matchup
        </h2>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500 hover:text-teal-400 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Game selector */}
      <Dropdown
        label="Game"
        value={
          selectedGame
            ? `${selectedGame.away.abbr} @ ${selectedGame.home.abbr} · ${new Date(
                selectedGame.gameDate
              ).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
            : games.length ? 'Select game…' : 'No games today'
        }
        onChange={(e) => onSelectGame(Number(e.target.value))}
        selectedValue={selectedGamePk || ''}
        options={games.map((g) => ({
          value: g.gamePk,
          label: `${g.away.abbr} @ ${g.home.abbr} · ${new Date(g.gameDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
        }))}
      />

      {/* Side toggle */}
      {selectedGame && (
        <div className="flex rounded-md bg-ink-800 border border-ink-500 p-0.5">
          <SideButton
            active={selectedSide === 'away'}
            onClick={() => onSelectSide('away')}
            label={selectedGame.away.abbr}
            subtitle="Batter"
          />
          <SideButton
            active={selectedSide === 'home'}
            onClick={() => onSelectSide('home')}
            label={selectedGame.home.abbr}
            subtitle="Batter"
          />
        </div>
      )}

      {/* Batter selector */}
      {selectedGame && (
        <Dropdown
          label={`Batter (${selectedGame[selectedSide].abbr})`}
          selectedValue={selectedBatterId || ''}
          onChange={(e) => onSelectBatter(Number(e.target.value))}
          options={(roster?.batters || []).map((b) => ({
            value: b.id,
            label: `${b.fullName} · ${b.batSide || '?'}`,
          }))}
          placeholder={roster?.batters?.length ? 'Select batter…' : 'Loading roster…'}
        />
      )}

      {/* Pitcher (auto-determined) */}
      {selectedGame && (
        <div className="rounded-md bg-ink-800 border border-ink-500 px-3 py-2">
          <div className="text-[9px] uppercase tracking-wider text-slate-600 mb-0.5">
            Opposing Pitcher ({selectedGame[opposingSide].abbr})
          </div>
          {probablePitcher ? (
            <div className="flex items-center justify-between">
              <div className="text-sm text-white">{probablePitcher.fullName}</div>
              <div className="text-[10px] font-mono text-slate-500">
                throws {probablePitcher.pitchHand || '?'}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500 italic">TBD</div>
          )}
        </div>
      )}

      {lastUpdated && (
        <div className="text-[9px] text-slate-600 text-center font-mono pt-1">
          last updated · {new Date(lastUpdated).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

function Dropdown({ label, value, selectedValue, onChange, options, placeholder }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider text-slate-600 mb-1">
        {label}
      </div>
      <div className="relative">
        <select
          value={selectedValue}
          onChange={onChange}
          className="w-full appearance-none bg-ink-800 border border-ink-500 rounded-md px-3 py-2 pr-8 text-sm text-white focus:outline-none focus:border-teal-500/50 transition-colors"
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
        />
      </div>
    </div>
  );
}

function SideButton({ active, onClick, label, subtitle }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded px-3 py-1.5 text-xs transition-all ${
        active
          ? 'bg-teal-500/15 text-teal-400 ring-1 ring-teal-500/30'
          : 'text-slate-400 hover:text-slate-200'
      }`}
    >
      <div className="font-display text-sm tracking-wider">{label}</div>
      <div className="text-[8px] uppercase tracking-widest opacity-60">{subtitle}</div>
    </button>
  );
}
