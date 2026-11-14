// The newest installer from GitHub Releases: the page's only request to another site. Falls back to the releases page.

const API = 'https://api.github.com/repos/YousefYGhanem/Pebble/releases/latest'
export const FALLBACK = 'https://github.com/YousefYGhanem/Pebble/releases/latest'

export const release = $state({ href: FALLBACK, version: '' })

let asked = false
export function loadRelease() {
  if (asked) return
  asked = true
  fetch(API)
    .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((j: { tag_name?: unknown; assets?: { name?: unknown; browser_download_url?: unknown }[] }) => {
      const exe = j.assets?.find(a => typeof a.name === 'string' && /\.exe$/i.test(a.name))
      const url = exe?.browser_download_url
      // only ever link to GitHub itself
      if (typeof url === 'string' && url.startsWith('https://github.com/')) release.href = url
      if (typeof j.tag_name === 'string' && /^v?\d[\w.-]{0,20}$/.test(j.tag_name)) release.version = j.tag_name.startsWith('v') ? j.tag_name : `v${j.tag_name}`
    })
    .catch(() => { /* keep the releases page */ })
}
