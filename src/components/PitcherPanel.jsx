import React from 'react';
import { StatRow } from './StatRow';

// Shows the pitcher's vulnerability profile vs the batter's handedness.
// Uses "allowed" versions of every metric. The goodDirection is flipped — for
// a pitcher, lower barrel% allowed is better, higher is worse (better for HRs).
export function PitcherPanel({ pitcher, batterHand }) {
  if (!pitcher) {
    return (
      <div className="p-6 text-center text-slate-500 text-sm">
        No pitcher selected.
      </div>
    );
  }

  const f1 = (v) => (v == null ? '—' : Number(v).toFixed(1));
  const handLabel = batterHand === 'L' ? 'vs LHB' : batterHand === 'R' ? 'vs RHB' : '';

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between border-b border-ink-500 pb-2">
        <div>
          <div className="font-display text-2xl text-white leading-none">
            {pitcher.playerName || 'Pitcher'}
          </div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-amber-400 mt-1">
            Pitcher Allowed {handLabel && `· ${handLabel}`} · 2026
          </div>
        </div>
        {pitcher.pitchHand && (
          <div className="font-mono text-xs text-slate-500">
            throws {pitcher.pitchHand}
          </div>
        )}
      </div>

      <Section title="Player Pitching · Allowed">
        {/* goodDirection="down" — for pitcher, lower allowed = pitcher doing well
            = worse HR spot for batter. We flip color logic. */}
        <StatRow label="LA Sweet Spot %" value={pitcher.la_sweet_spot_allowed} unit="%" format={f1} leagueAvg={34} sd={4} goodDirection="down" />
        <StatRow label="Barrel % Allowed" value={pitcher.barrel_pct_allowed} unit="%" format={f1} leagueAvg={8.0} sd={2.5} goodDirection="down" />
        <StatRow label="Hard Hit Allowed" value={pitcher.hard_hit_allowed} unit="%" format={f1} leagueAvg={40.0} sd={4.0} goodDirection="down" />
        <StatRow label="EV 50 Allowed" value={pitcher.ev50_allowed} unit="mph" format={f1} leagueAvg={90.5} sd={2.0} goodDirection="down" />
        <StatRow label="Adj EV Allowed" value={pitcher.adj_ev_allowed} unit="mph" format={f1} leagueAvg={90.0} sd={2.0} goodDirection="down" />
      </Section>

      <Section title={`Bat Tracking Allowed ${handLabel}`}>
        <StatRow label="Avg Bat Speed" value={pitcher.bat_speed_allowed} unit="mph" format={f1} leagueAvg={72.0} sd={2.0} goodDirection="down" />
        <StatRow label="Squared Up / Contact" value={pitcher.squared_up_pct_allowed} unit="%" format={f1} leagueAvg={30.0} sd={4.0} goodDirection="down" />
        <StatRow label="Blasts / Contact" value={pitcher.blasts_pct_allowed} unit="%" format={f1} leagueAvg={20.0} sd={5.0} goodDirection="down" />
      </Section>

      <Section title={`Batted Ball Allowed ${handLabel}`}>
        <StatRow label="FB %" value={pitcher.fb_pct_allowed} unit="%" format={f1} leagueAvg={23.0} sd={4.0} goodDirection="down" />
        <StatRow label="Pull Air % Allowed" value={pitcher.pull_air_allowed} unit="%" format={f1} leagueAvg={22.0} sd={4.0} goodDirection="down" />
        <StatRow label="Straight Air %" value={pitcher.straight_air_allowed} unit="%" format={f1} leagueAvg={30.0} sd={3.5} goodDirection="down" />
        <StatRow label="Oppo Air %" value={pitcher.oppo_air_allowed} unit="%" format={f1} leagueAvg={16.0} sd={3.5} goodDirection="down" />
      </Section>

      <Section title="Exit Velo & Barrels Allowed">
        <StatRow label="EV FB/LD Allowed" value={pitcher.ev_fb_ld_allowed} unit="mph" format={f1} leagueAvg={93.0} sd={2.5} goodDirection="down" />
        <StatRow label="Barrels / PA" value={pitcher.brl_pa_pct_allowed} unit="%" format={f1} leagueAvg={5.5} sd={2.0} goodDirection="down" />
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1 h-1 rounded-full bg-amber-400" />
        <h3 className="font-display text-[11px] tracking-[0.25em] text-slate-400">
          {title}
        </h3>
      </div>
      <div className="divide-y divide-ink-500/60">{children}</div>
    </div>
  );
}
