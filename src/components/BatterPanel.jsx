import React from 'react';
import { StatRow } from './StatRow';

// Displays the batter's full power/contact profile from all Savant leaderboards.
// Organized into 4 sections matching Chris's spec: Player Batting, Bat Tracking,
// Batted Ball Profile, Exit Velocity & Barrels.
export function BatterPanel({ batter, recentForm }) {
  if (!batter) {
    return (
      <div className="p-6 text-center text-slate-500 text-sm">
        Select a batter to see power profile.
      </div>
    );
  }

  const f1 = (v) => (v == null ? '—' : Number(v).toFixed(1));
  const f0 = (v) => (v == null ? '—' : Number(v).toFixed(0));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-baseline justify-between border-b border-ink-500 pb-2">
        <div>
          <div className="font-display text-2xl text-white leading-none">
            {batter.playerName || 'Batter'}
          </div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-teal-400 mt-1">
            Batter Profile · 2026
          </div>
        </div>
        {batter.batSide && (
          <div className="font-mono text-xs text-slate-500">
            bats {batter.batSide}
          </div>
        )}
      </div>

      {/* Section: Player Batting */}
      <Section title="Player Batting">
        <StatRow label="LA Sweet Spot %" value={batter.la_sweet_spot_pct} unit="%" format={f1} leagueAvg={34} sd={4} />
        <StatRow label="Barrel %" value={batter.barrel_pct} unit="%" format={f1} leagueAvg={8.0} sd={3.5} />
        <StatRow label="Hard Hit %" value={batter.hard_hit_pct} unit="%" format={f1} leagueAvg={40.0} sd={6.0} />
        <StatRow label="EV 50" value={batter.ev50} unit="mph" format={f1} leagueAvg={90.5} sd={3.0} />
        <StatRow label="Adj EV" value={batter.adj_ev} unit="mph" format={f1} leagueAvg={90.0} sd={3.0} />
      </Section>

      {/* Section: Bat Tracking */}
      <Section title="Bat Tracking">
        <StatRow label="Avg Bat Speed" value={batter.bat_speed} unit="mph" format={f1} leagueAvg={72.0} sd={2.5} />
        <StatRow label="Squared Up / Contact" value={batter.squared_up_pct_contact} unit="%" format={f1} leagueAvg={30.0} sd={5.0} />
        <StatRow label="Squared Up / Swing" value={batter.squared_up_pct_swing} unit="%" format={f1} leagueAvg={22.0} sd={4.5} />
        <StatRow label="Blasts / Contact" value={batter.blasts_pct_contact} unit="%" format={f1} leagueAvg={20.0} sd={7.0} />
        <StatRow label="Blasts / Swing" value={batter.blasts_pct_swing} unit="%" format={f1} leagueAvg={14.0} sd={5.5} />
      </Section>

      {/* Section: Batted Ball Profile */}
      <Section title="Batted Ball Profile">
        <StatRow label="FB %" value={batter.fb_pct} unit="%" format={f1} leagueAvg={23.0} sd={5.0} />
        <StatRow label="Pull Air %" value={batter.pull_air_pct} unit="%" format={f1} leagueAvg={22.0} sd={5.0} />
        <StatRow label="Straight Air %" value={batter.straight_air_pct} unit="%" format={f1} leagueAvg={30.0} sd={4.0} />
        <StatRow label="Oppo Air %" value={batter.oppo_air_pct} unit="%" format={f1} leagueAvg={16.0} sd={4.0} />
      </Section>

      {/* Section: Exit Velo & Barrels */}
      <Section title="Exit Velo & Barrels">
        <StatRow label="EV FB/LD" value={batter.ev_fb_ld} unit="mph" format={f1} leagueAvg={93.0} sd={3.0} />
        <StatRow label="Barrels / PA" value={batter.brl_pa_pct} unit="%" format={f1} leagueAvg={5.5} sd={2.5} />
      </Section>

      {/* Recent form from CSV upload */}
      {recentForm && (
        <Section title="Recent Form (uploaded)" accent="amber">
          <StatRow label="L7 HR" value={recentForm.l7_hr} format={f0} />
          <StatRow label="L7 Barrel %" value={recentForm.l7_barrel_pct} unit="%" format={f1} leagueAvg={8.0} sd={3.5} />
          <StatRow label="L14 Barrel %" value={recentForm.l14_barrel_pct} unit="%" format={f1} leagueAvg={8.0} sd={3.5} />
          <StatRow label="L14 Hard Hit" value={recentForm.l14_hard_hit} unit="%" format={f1} leagueAvg={40.0} sd={6.0} />
        </Section>
      )}
    </div>
  );
}

function Section({ title, children, accent = 'teal' }) {
  const dot = accent === 'amber' ? 'bg-amber-400' : 'bg-teal-400';
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-1 h-1 rounded-full ${dot}`} />
        <h3 className="font-display text-[11px] tracking-[0.25em] text-slate-400">
          {title}
        </h3>
      </div>
      <div className="divide-y divide-ink-500/60">{children}</div>
    </div>
  );
}
