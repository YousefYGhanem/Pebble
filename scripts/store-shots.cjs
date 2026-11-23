// `npm run store-shots`: the Microsoft Store's screenshots (1920×1080) from docs/screens (npm run capture first): the
// island at the top of a calm desktop, as it sits on a real screen, with one line about it. Writes docs/store/*.png.
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

app.disableHardwareAcceleration()
app.on('window-all-closed', () => {})

const root = path.join(__dirname, '..'), screens = path.join(root, 'docs', 'screens'), out = path.join(root, 'docs', 'store')
const SHOTS = [
  ['1-agents', 'open.png', 'Your AI agents, at the top of your screen', 'Claude Code, Codex, Gemini, Cursor and more: what they do, live'],
  ['2-answer', 'question.png', 'Answer them without switching windows', 'Permissions and questions, right on the island'],
  ['3-plan', 'plan.png', 'Review a plan before it runs', 'Read it, approve it, or say what to change'],
  ['4-home', 'page-home.png', 'Your day at a glance', 'Agents, music, focus, files, reminders and prayer times'],
  ['5-music', 'page-music.png', 'Music and lyrics from any player', "Plus every app's own volume"],
  ['6-files', 'page-files.png', 'A shelf for your files', 'Drop them on the island, drag them anywhere, send them from your phone'],
  ['7-pip', 'page-pip.png', 'Ask Pip anything, in your own words', 'A free AI out of the box; sums, units, timers and translations answer instantly'],
  ['8-strip', 'strip.png', "Your PC's readings, over the game", 'CPU and GPU use and temperatures over full-screen games (Ctrl+Alt+G)', 'game']
]
const W = 1920, H = 1080, SCALE = 1.55

app.whenReady().then(async () => {
  fs.mkdirSync(out, { recursive: true })
  for (const [name, file, title, sub, game] of SHOTS) {
    const img = 'data:image/png;base64,' + fs.readFileSync(path.join(screens, file)).toString('base64')
    const html = `<style>
      html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;font-family:'Segoe UI Variable Display','Segoe UI',sans-serif}
      body{background:radial-gradient(1200px 700px at 50% 0%,#3b2f6b 0%,transparent 70%),radial-gradient(900px 600px at 85% 100%,#1d3a5c 0%,transparent 70%),linear-gradient(160deg,#17151f,#0d0c12)}
      img{position:absolute;left:50%;top:0;transform:translateX(-50%);width:${824 * SCALE}px;filter:drop-shadow(0 30px 60px #0008)}
      .t{position:absolute;left:0;right:0;bottom:120px;text-align:center;color:#f3f0fb}
      h1{margin:0;font-size:64px;font-weight:700;letter-spacing:-0.5px}
      p{margin:16px 0 0;font-size:30px;color:#bdb6d6}
      .game{position:absolute;inset:0;background:linear-gradient(180deg,#2a1846,#612c5a 55%,#e0795a)}
      .sun{position:absolute;width:360px;height:360px;border-radius:50%;left:780px;bottom:300px;background:radial-gradient(circle,#ffd27a,#ff8a5b 70%);box-shadow:0 0 140px #ff9b6b}
      .hill{position:absolute;bottom:0;border-radius:50% 50% 0 0;background:#2b1638}
      .shade{position:absolute;left:0;right:0;bottom:0;height:420px;background:linear-gradient(180deg,transparent,#0d0c12ee)}
    </style>${game ? '<div class="game"><div class="sun"></div><div class="hill" style="left:-300px;width:1500px;height:430px"></div><div class="hill" style="right:-400px;width:1400px;height:330px;background:#1d0f28"></div><div class="shade"></div></div>' : ''}<img src="${img}"><div class="t"><h1>${title}</h1><p>${sub}</p></div>`
    const win = new BrowserWindow({ width: W, height: H, show: false, frame: false, webPreferences: { offscreen: true, zoomFactor: 1 } })
    await win.loadURL('data:text/html,' + encodeURIComponent(html))
    await new Promise(r => setTimeout(r, 500))
    const page = await win.webContents.capturePage()
    win.destroy()
    fs.writeFileSync(path.join(out, `${name}.png`), page.crop({ x: 0, y: 0, width: W, height: H }).toPNG())
  }
  app.quit()
})
