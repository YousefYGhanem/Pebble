// GitHub every 2 minutes: review requests, unread notifications, and the checks of your own open pull requests.
// While CI runs on one of them, the island shows it live (checks done of all) and looks every 30 seconds; when it
// ends you hear whether it passed or failed.
const API = 'https://api.github.com'
const opts = { auth: 'token', headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } }

/** A commit's check runs, summed up: how many, how many finished, how many failed, still running. */
function ciState(runs) {
  const total = runs.length, done = runs.filter(r => r.status === 'completed').length
  const failed = runs.filter(r => ['failure', 'timed_out', 'cancelled', 'action_required'].includes(r.conclusion)).length
  return { total, done, failed, running: done < total }
}

module.exports = pebble => {
  let soon = false // a quick look is already planned
  async function look() {
    soon = false
    const reviews = await pebble.fetchJSON(`${API}/search/issues?q=${encodeURIComponent('is:open is:pr review-requested:@me archived:false')}&per_page=5`, opts)
    const notes = await pebble.fetchJSON(`${API}/notifications?per_page=50`, opts)
    const mine = await pebble.fetchJSON(`${API}/search/issues?q=${encodeURIComponent('is:open is:pr author:@me archived:false')}&per_page=5`, opts)

    // CI of your own pull requests: the head commit's check runs (at most 5 PRs)
    const prs = []
    for (const pr of mine.items) {
      const repo = pr.repository_url.replace(`${API}/repos/`, '')
      const full = await pebble.fetchJSON(`${API}/repos/${repo}/pulls/${pr.number}`, opts)
      const runs = await pebble.fetchJSON(`${API}/repos/${repo}/commits/${full.head.sha}/check-runs?per_page=100`, opts)
      prs.push({ title: pr.title, number: pr.number, repo: repo.split('/')[1], url: pr.html_url, sha: full.head.sha, ci: ciState(runs.check_runs) })
    }
    const failing = prs.filter(p => p.ci.failed)
    const running = prs.filter(p => p.ci.running && p.ci.total)

    // live on the island while CI runs (the first one; the card lists the rest)
    const r = running[0]
    if (r) {
      pebble.widget('ci', { kind: 'activity', title: `${r.repo} #${r.number}`, text: `CI ${r.ci.done}/${r.ci.total}${r.ci.failed ? ` · ${r.ci.failed} failed` : ''}`, icon: 'run',
        tone: r.ci.failed ? 'error' : 'info', progress: Math.round((r.ci.done / r.ci.total) * 100), link: `${r.url}/checks` })
      if (!soon) { soon = true; pebble.after(30_000, look) }
    } else pebble.remove('ci')

    const n = reviews.total_count
    pebble.widget('count', { kind: 'chip', text: `${n ? n + ' review' + (n > 1 ? 's' : '') : '✓'}${notes.length ? ' · ' + notes.length + ' unread' : ''}`, tone: failing.length ? 'error' : n ? 'warn' : 'ok' })
    pebble.widget('card', {
      kind: 'card', title: 'GitHub', icon: 'agents',
      text: n ? `${n} review${n > 1 ? 's' : ''} for you` : 'No reviews waiting',
      tone: failing.length ? 'error' : n ? 'warn' : 'ok',
      lines: [...running.map(p => `CI running: ${p.title} (${p.ci.done}/${p.ci.total})`), ...failing.map(f => `CI failed: ${f.title}`),
        ...reviews.items.slice(0, 3).map(i => `Review: ${i.title}`), `${notes.length} unread notification${notes.length === 1 ? '' : 's'}`],
      link: n ? 'https://github.com/pulls/review-requested' : 'https://github.com/notifications'
    })

    // tell once per new review request, per failed commit, and when CI you watched run has passed
    const seen = pebble.store.get('seen') || []
    const wasRunning = pebble.store.get('running') || []
    for (const i of reviews.items) if (!seen.includes('r' + i.id)) pebble.notify({ title: 'Review requested', body: i.title, link: i.html_url })
    for (const f of failing) if (!seen.includes('f' + f.sha) && !f.ci.running) pebble.notify({ title: 'CI failed', body: f.title, link: `${f.url}/checks` })
    for (const p of prs) if (wasRunning.includes(p.sha) && !p.ci.running && !p.ci.failed) pebble.notify({ title: 'CI passed', body: p.title, link: p.url })
    pebble.store.set('running', running.map(p => p.sha))
    pebble.store.set('seen', [...reviews.items.map(i => 'r' + i.id), ...failing.filter(f => !f.ci.running).map(f => 'f' + f.sha)].slice(-100))
  }
  pebble.every('2m', look)
}
module.exports.ciState = ciState
