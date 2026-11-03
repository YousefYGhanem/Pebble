// ESPN's public scoreboard: football leagues (eng.1, ned.1…) or US sports (nba, nfl, nhl, mlb). Every 30 s while your
// team plays, every 5–15 minutes otherwise.
// shortcut: ESPN's scoreboard has no published contract; if it changes, this connector breaks (football-data.org with a
// free key would be the stable alternative).
const SPORT = { nba: 'basketball/nba', nfl: 'football/nfl', nhl: 'hockey/nhl', mlb: 'baseball/mlb' }

module.exports = pebble => {
  const team = String(pebble.settings.team).toLowerCase(), league = String(pebble.settings.league || 'eng.1')
  const path = SPORT[league] || `soccer/${league}`
  let next = 0
  pebble.every('30s', async () => {
    if (Date.now() < next) return
    const board = await pebble.fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard`)
    const game = (board.events || []).find(e => e.competitions[0].competitors.some(c =>
      c.team.displayName.toLowerCase().includes(team) || c.team.shortDisplayName.toLowerCase().includes(team)))
    if (!game) { pebble.remove('live'); pebble.remove('card'); next = Date.now() + 15 * 60_000; return }
    const comp = game.competitions[0], st = game.status.type
    const home = comp.competitors.find(c => c.homeAway === 'home'), away = comp.competitors.find(c => c.homeAway === 'away')
    const score = `${home.team.abbreviation} ${home.score}–${away.score} ${away.team.abbreviation}`
    const link = game.links && game.links[0] ? game.links[0].href : undefined
    if (st.state === 'in') {
      pebble.widget('live', { kind: 'activity', title: 'Live', text: `${score} · ${game.status.displayClock}`, icon: '⚽' })
      const goals = Number(home.score) + Number(away.score), before = pebble.store.get(game.id)
      if (before !== undefined && goals > before) pebble.notify({ title: 'Goal!', body: score, link })
      pebble.store.set(game.id, goals)
      next = 0
    } else {
      pebble.remove('live')
      next = Date.now() + (st.state === 'pre' ? 5 * 60_000 : 15 * 60_000)
    }
    pebble.widget('card', { kind: 'card', title: 'Scores', icon: '⚽', text: score, lines: [st.state === 'pre' ? new Date(game.date).toLocaleString() : st.shortDetail], link })
  })
}
