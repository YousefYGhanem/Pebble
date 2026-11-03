// Weather from Open-Meteo: the city's coordinates once, then the weather every 15 minutes.
const ICON = code => code === 0 ? '☀️' : code <= 3 ? '⛅' : code <= 48 ? '🌫️' : code <= 67 ? '🌧️' : code <= 77 ? '❄️' : code <= 82 ? '🌦️' : '⛈️'

module.exports = async pebble => {
  const { city, unit, rainAlert } = pebble.settings
  const geo = await pebble.fetchJSON(`https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(city)}`)
  const place = geo.results && geo.results[0]
  if (!place) throw new Error(`Open-Meteo does not know the city "${city}"`)
  const f = unit === 'fahrenheit' ? 'fahrenheit' : 'celsius'

  pebble.every('15m', async () => {
    const w = await pebble.fetchJSON(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
      `&current=temperature_2m,weather_code&minutely_15=precipitation&forecast_hours=2&temperature_unit=${f}&timezone=auto`)
    const t = Math.round(w.current.temperature_2m), icon = ICON(w.current.weather_code)
    pebble.widget('now', { kind: 'chip', text: `${icon} ${t}°` })
    const rainSoon = (w.minutely_15?.precipitation ?? []).slice(0, 4).some(p => p >= 0.2)
    pebble.widget('card', { kind: 'card', title: place.name, icon, text: `${t}°`, lines: [rainSoon ? 'Rain in the next hour' : 'Dry for the next hour'], link: `https://open-meteo.com/en/docs#latitude=${place.latitude}&longitude=${place.longitude}` })
    if (rainAlert && rainSoon && !pebble.store.get('warned')) pebble.notify({ title: 'Rain is coming', body: `Rain in ${place.name} within the hour.` })
    pebble.store.set('warned', rainSoon)
  })
}
