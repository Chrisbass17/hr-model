import React from 'react';

// The heart of the UI: shows the 0-100 HR score prominently, its tier badge,
// and a transparent breakdown of every factor's contribution so Chris can see
// WHY a matchup is rated the way it is.
export function ScoreBreakdown({ result }) {
  if (!result) {
    return (
      <div className="p-6 rounded-lg bg-ink-700 border border-ink-500 text-center">
        <div className="text-slate-600 text-sm">Select a batter and pitcher to compute.</div>
      </div>
    );
  }

  const { score, tier, breakdown } = result;

  const tierStyle = {
    ELITE: { bg: 'from-teal-500/20 to-teal-600/5', text: 'text-teal-400', ring: 'ring-teal-500/40' },
    PRIME: { bg: 'from-amber-500/20 to-amber-600/5', text: 'text-amber-400', ring: 'ring-amber-500/40' },
    LEAN: { bg: 'from-slate-500/10 to-slate-600/5', text: 'text-slate-200', ring: 'ring-slate-500/30' },
    NEUTRAL: { bg: 'from-ink-500/20 to-ink-600/5', text: 'text-slate-400', ring: 'ring-ink-500' },
    FADE: { bg: 'from-rose-500/20 to-rose-600/5', text: 'text-rose-400', ring: 'ring-rose-500/40' },
  }[tier];

  // Factor labels for display
  const factors = [
    { key: 'power', label: 'Batter Power', color: 'bg-teal-500' },
    { key: 'vuln', label: 'Pitcher Vulnerability', color: 'bg-amber-500' },
    { key: 'bbProfile', label: 'Batted Ball Fit', color: 'bg-teal-400' },
    { key: 'park', label: 'Park Factor', color: 'bg-slate-400' },
    { key: 'weather', label: 'Weather', color: 'bg-amber-400' },
    { key: 'form', label: 'Recent Form', color: 'bg-rose-400' },
  ];

  return (
    <div className="space-y-4">
      {/* Hero score */}
      <div
        className={`rounded-xl bg-gradient-to-br ${tierStyle.bg} ring-1 ${tierStyle.ring} p-6 grid-bg relative overflow-hidden`}
      >
        <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500 mb-1">
          HR Composite Score
        </div>
        <div className="flex items-end gap-4">
          <div className="font-display text-7xl leading-none text-white stat-num">
            {score}
          </div>
          <div className={`font-display text-xl ${tierStyle.text} mb-2`}>
            {tier}
          </div>
        </div>
        <div className="text-[10px] text-slate-600 mt-2 font-mono">
          0–100 scale · 50 = league average · tier-adjusted
        </div>
      </div>

      {/* Factor stack */}
      <div className="rounded-lg bg-ink-700 border border-ink-500 p-4">
        <div className="font-display text-[11px] tracking-[0.25em] text-slate-400 mb-3">
          Factor Breakdown
        </div>
        <div className="space-y-2.5">
          {factors.map(({ key, label, color }) => {
            const f = breakdown[key];
            if (!f) return null;
            // How much this factor contributed, in score points (0-100 scale)
            const contribPoints = (f.contrib / 1) * 100 * (f.weight / 1);
            // Visual bar: 0-1 sub-score
            const barWidth = `${Math.max(2, f.score * 100)}%`;
            return (
              <div key={key}>
                <div className="flex items-baseline justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
                    <span className="text-xs text-slate-300">{label}</span>
                    <span className="text-[10px] font-mono text-slate-600">
                      ({(f.weight * 100).toFixed(0)}%)
                    </span>
                  </div>
                  <span className="stat-num text-xs text-slate-400">
                    {(f.score * 100).toFixed(0)}
                  </span>
                </div>
                <div className="h-1.5 bg-ink-500 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${color} transition-all duration-500`}
                    style={{ width: barWidth }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Weather detail (if available) */}
      {breakdown.weather?.parts && !breakdown.weather.parts.dome && !breakdown.weather.parts.missing && (
        <div className="rounded-lg bg-ink-800 border border-ink-500 p-3 grid grid-cols-2 gap-2 text-[11px]">
          <DetailStat label="Wind to CF" value={`${breakdown.weather.parts.windToCF?.toFixed(1)} mph`} />
          <DetailStat label="Temp" value={`${breakdown.weather.parts.temp?.toFixed(0)}°F`} />
          <DetailStat label="Humidity" value={`${breakdown.weather.parts.humidity?.toFixed(0)}%`} />
          <DetailStat label="Pressure" value={`${breakdown.weather.parts.pressure?.toFixed(0)} hPa`} />
        </div>
      )}
    </div>
  );
}

function DetailStat({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-600 uppercase tracking-wider">{label}</span>
      <span className="stat-num text-slate-300">{value}</span>
    </div>
  );
}
