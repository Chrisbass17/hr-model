// api/weather.js
// Open-Meteo forecast API. Free, no key required, hourly resolution.
// We pull temp + wind speed/direction + humidity + surface pressure for the
// game hour and the next 2 hours (per spec). The client converts wind direction
// relative to home-plate bearing to decide if it's blowing out vs in.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { lat, lon, gameTimeISO } = req.query;
  if (!lat || !lon) {
    return res.status(400).json({ error: 'Missing lat/lon' });
  }

  // Pull hourly data for today + tomorrow to cover late games
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,surface_pressure,precipitation_probability` +
    `&temperature_unit=fahrenheit&wind_speed_unit=mph&pressure_unit=hPa&timezone=America%2FNew_York&forecast_days=2`;

  try {
    const r = await fetch(url);
    if (!r.ok) return res.status(502).json({ error: `Open-Meteo ${r.status}` });
    const data = await r.json();

    // Client passes gameTimeISO so we can slice hour-of-game + next 2 hours
    // server-side and return just what matters (keeps payload small).
    let slice = null;
    if (gameTimeISO && data.hourly?.time) {
      const gameTime = new Date(gameTimeISO);
      const times = data.hourly.time.map((t) => new Date(t).getTime());
      // Find nearest hour ≥ game time
      const targetMs = gameTime.getTime();
      let startIdx = times.findIndex((t) => t >= targetMs - 30 * 60 * 1000);
      if (startIdx < 0) startIdx = 0;

      slice = {
        hours: [],
      };
      for (let i = startIdx; i < Math.min(startIdx + 3, data.hourly.time.length); i++) {
        slice.hours.push({
          time: data.hourly.time[i],
          temp_f: data.hourly.temperature_2m[i],
          humidity_pct: data.hourly.relative_humidity_2m[i],
          wind_mph: data.hourly.wind_speed_10m[i],
          wind_dir_deg: data.hourly.wind_direction_10m[i],
          pressure_hpa: data.hourly.surface_pressure[i],
          precip_pct: data.hourly.precipitation_probability[i],
        });
      }
    }

    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');
    return res.status(200).json({ raw: data, slice });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
