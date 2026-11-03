// GitHub every 2 minutes: review requests, unread notifications, the checks of your own open pull requests.
const API = 'https://api.github.com'
const opts = { auth: 'token', headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } }

module.exports = pebble => {
  pebble.every('2m', async () => {
    const reviews = await pebble.fetchJSON(`${API}/search/issues?q=${encodeURIComponent('is:open is:pr review-requested:@me archived:false')}&per_page=5`, opts)
    const notes = await pebble.fetchJSON(`${API}/notifications?per_page=50`, opts)
    const mine = await pebble.fetchJSON(`${API}/search/issues?q=${encodeURIComponent('is:open is:pr author:@me archived:false')}&per_page=5`, opts)

    // CI of your own pull requests: the head commit's check runs (at most 5 PRs)
    const failing = []
    for (const pr of mine.items) {
      const repo = pr.repository_url.replace(`${API}/repos/`, '')
      const full = await pebble.fetchJSON(`${API}/repos/${repo}/pulls/${pr.number}`, opts)
      const runs = await pebble.fetchJSON(`${API}/repos/${repo}/commits/${full.head.sha}/check-runs?per_page=50`, opts)
      if (runs.check_runs.some(r => r.conclusion === 'failure' || r.conclusion === 'timed_out')) failing.push({ title: pr.title, url: pr.html_url, sha: full.head.sha })
    }

    const n = reviews.total_count
    pebble.widget('count', { kind: 'chip', text: `${n ? n + ' review' + (n > 1 ? 's' : '') : '✓'}${notes.length ? ' · ' + notes.length + ' unread' : ''}`, tone: failing.length ? 'error' : n ? 'warn' : 'ok' })
    pebble.widget('card', {
      kind: 'card', title: 'GitHub', icon: 'agents',
      text: n ? `${n} review${n > 1 ? 's' : ''} for you` : 'No reviews waiting',
      tone: failing.length ? 'error' : n ? 'warn' : 'ok',
      lines: [...failing.map(f => `CI failed: ${f.title}`), ...reviews.items.slice(0, 3).map(i => `Review: ${i.title}`), `${notes.length} unread notification${notes.length === 1 ? '' : 's'}`],
      link: n ? 'https://github.com/pulls/review-requested' : 'https://github.com/notifications'
    })

    // tell once per new review request and per failed commit
    const seen = pebble.store.get('seen') || []
    for (const i of reviews.items) if (!seen.includes('r' + i.id)) pebble.notify({ title: 'Review requested', body: i.title, link: i.html_url })
    for (const f of failing) if (!seen.includes('f' + f.sha)) pebble.notify({ title: 'CI failed', body: f.title, link: f.url })
    pebble.store.set('seen', [...reviews.items.map(i => 'r' + i.id), ...failing.map(f => 'f' + f.sha)].slice(-100))
  })
}
