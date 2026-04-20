import React from 'react';
import { Wind, Thermometer, Droplets, Gauge } from 'lucide-react';

// Shows game-time weather + next 2 hours with a compass visualization of
// wind direction relative to the park's home plate → CF bearing.
// For dome games, renders a "dome" placeholder.
export function WeatherPanel({ weather, park, gameTimeISO }) {
  if (!park) {
    return <div className="p-6 text-center text-slate-500 text-sm">Select a game first.</div>;
  }

  if (park.dome === true) {
    return (
      <div className="p-6 rounded-lg bg-ink-700 border border-ink-500">
        <div className="text-center text-slate-400">
          <div className="font-display text-2xl text-white mb-1">DOME</div>
          <div className="text-xs">Climate-controlled · weather neutral</div>
          <div className="text-[10px] text-slate-500 mt-2">{park.name}</div>
        </div>
      </div>
    );
  }

  const hours = weather?.slice?.hours || [];

  if (!hours.length) {
    return (
      <div className="p-6 rounded-lg bg-ink-700 border border-ink-500 text-center text-slate-500 text-sm">
        Fetching weather for {park.name}…
      </div>
    );
  }

  // Compute wind-to-CF component for the first hour (game time)
  const gh = hours[0];
  const windToward = (gh.wind_dir_deg + 180) % 360;
  const delta = ((windToward - park.bearing + 540) % 360) - 180;
  const windToCF = gh.wind_mph * Math.cos((delta * Math.PI) / 180);

  const windVerdict =
    windToCF > 6 ? { text: 'BLOWING OUT', color: 'text-teal-400', bg: 'bg-teal-500/10' } :
    windToCF > 2 ? { text: 'SLIGHT OUT', color: 'text-teal-500/80', bg: 'bg-teal-500/5' } :
    windToCF < -6 ? { text: 'BLOWING IN', color: 'text-rose-400', bg: 'bg-rose-500/10' } :
    windToCF < -2 ? { text: 'SLIGHT IN', color: 'text-rose-500/80', bg: 'bg-rose-500/5' } :
    { text: 'CROSS / NEUTRAL', color: 'text-slate-400', bg: 'bg-ink-500' };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="border-b border-ink-500 pb-2">
        <div className="font-display text-xl text-white leading-none">{park.name}</div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mt-1">
          Weather · game time + 2h
        </div>
      </div>

      {/* Wind hero */}
      <div className={`rounded-lg ${windVerdict.bg} border border-ink-500 p-4`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500">
              Wind to CF
            </div>
            <div className="font-display text-3xl mt-1 text-white stat-num">
              {windToCF >= 0 ? '+' : ''}{windToCF.toFixed(1)}
              <span className="text-sm text-slate-500 ml-1">mph</span>
            </div>
            <div className={`text-xs font-semibold tracking-wider mt-1 ${windVerdict.color}`}>
              {windVerdict.text}
            </div>
          </div>
          <WindCompass
            parkBearing={park.bearing}
            windDir={gh.wind_dir_deg}
            windSpd={gh.wind_mph}
          />
        </div>
      </div>

      {/* Hourly grid */}
      <div className="grid grid-cols-3 gap-2">
        {hours.map((h, i) => (
          <HourCard key={i} hour={h} isGameTime={i === 0} />
        ))}
      </div>

      {/* Legend */}
      <div className="text-[10px] text-slate-600 text-center">
        Park bearing (HP → CF): {park.bearing}° · HR factor: {park.hrFactor}
      </div>
    </div>
  );
}

function HourCard({ hour, isGameTime }) {
  const time = new Date(hour.time).toLocaleTimeString('en-US', {
    hour: 'numeric',
    hour12: true,
  });
  return (
    <div
      className={`rounded-md p-3 ${
        isGameTime ? 'bg-ink-600 border border-teal-500/30' : 'bg-ink-700 border border-ink-500'
      }`}
    >
      <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-2">
        {isGameTime ? 'First Pitch' : time}
      </div>
      <div className="space-y-1.5">
        <MiniStat icon={<Thermometer size={10} />} value={`${Math.round(hour.temp_f)}°`} />
        <MiniStat icon={<Wind size={10} />} value={`${Math.round(hour.wind_mph)} mph`} />
        <MiniStat icon={<Droplets size={10} />} value={`${Math.round(hour.humidity_pct)}%`} />
        <MiniStat icon={<Gauge size={10} />} value={`${Math.round(hour.pressure_hpa)} hPa`} />
      </div>
    </div>
  );
}

function MiniStat({ icon, value }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="text-slate-600">{icon}</span>
      <span className="stat-num text-slate-300">{value}</span>
    </div>
  );
}

function WindCompass({ parkBearing, windDir, windSpd }) {
  const size = 80;
  const cx = size / 2, cy = size / 2;
  const r = size / 2 - 6;

  // Wind arrow: wind blows TO direction (windDir + 180)
  const windTo = (windDir + 180) % 360;
  const windRad = ((windTo - 90) * Math.PI) / 180; // -90 so 0 is up
  const ax = cx + r * 0.8 * Math.cos(windRad);
  const ay = cy + r * 0.8 * Math.sin(windRad);

  // CF direction
  const cfRad = ((parkBearing - 90) * Math.PI) / 180;
  const cfx = cx + r * Math.cos(cfRad);
  const cfy = cy + r * Math.sin(cfRad);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Outer ring */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#29333f" strokeWidth="1" />
      {/* CF line (park's CF direction) */}
      <line x1={cx} y1={cy} x2={cfx} y2={cfy} stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="2 2" />
      <text x={cfx} y={cfy - 3} fill="#fbbf24" fontSize="7" textAnchor="middle" fontFamily="DM Mono">
        CF
      </text>
      {/* Home plate */}
      <circle cx={cx} cy={cy} r="2.5" fill="#e5e7eb" />
      {/* Wind arrow */}
      <line
        x1={cx}
        y1={cy}
        x2={ax}
        y2={ay}
        stroke="#3dd6c9"
        strokeWidth="2"
        markerEnd="url(#arrowhead)"
      />
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#3dd6c9" />
        </marker>
      </defs>
    </svg>
  );
}
