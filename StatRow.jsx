import React from 'react';

// A single labeled stat with optional percentile bar, z-score coloring,
// and a "good direction" flag so we color-correctly (e.g. "barrel %" up = good
// for batters but up = bad for pitchers).
export function StatRow({
  label,
  value,
  unit = '',
  format = (v) => v,
  leagueAvg,
  sd,
  goodDirection = 'up', // 'up' or 'down'
  muted = false,
}) {
  const num = typeof value === 'number' && !isNaN(value) ? value : null;
  const z = num != null && leagueAvg != null && sd ? (num - leagueAvg) / sd : null;

  // Color: positive z in "good direction" = teal, negative = rose
  let color = 'text-slate-300';
  if (z != null) {
    const effective = goodDirection === 'up' ? z : -z;
    if (effective >= 1) color = 'text-teal-400';
    else if (effective >= 0.3) color = 'text-teal-500/90';
    else if (effective <= -1) color = 'text-rose-400';
    else if (effective <= -0.3) color = 'text-rose-500/80';
  }

  // Horizontal bar (−3σ left, +3σ right) centered at league avg
  const barPct = z != null ? Math.max(-1, Math.min(1, z / 2.5)) * 50 + 50 : 50;

  return (
    <div className={`flex items-center gap-3 py-1.5 ${muted ? 'opacity-50' : ''}`}>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 w-28 shrink-0">
        {label}
      </div>
      <div className={`stat-num text-sm font-medium w-16 shrink-0 ${color}`}>
        {num != null ? format(num) : '—'}
        {num != null && unit && <span className="text-slate-600 ml-0.5">{unit}</span>}
      </div>
      <div className="flex-1 h-[3px] bg-ink-500 rounded-full relative overflow-hidden">
        {z != null && (
          <>
            <div
              className="absolute top-0 bottom-0 w-px bg-slate-600"
              style={{ left: '50%' }}
            />
            <div
              className={`absolute top-0 bottom-0 ${
                (goodDirection === 'up' ? z : -z) >= 0 ? 'bg-teal-500' : 'bg-rose-500'
              }`}
              style={{
                left: Math.min(barPct, 50) + '%',
                width: Math.abs(barPct - 50) + '%',
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
