// The focus guard's calm screen (animation #19): the screen dims, a circle breathes (4 s in, 4 s out) with Pip in the
// middle, blinking. After one breath the two choices appear: go back (the window is minimised) or open it anyway.
import { drawPip } from '../island/pip'
import theme from '../../../themes/default.json'

declare global { interface Window { guard: { choose(c: 'back' | 'anyway'): void } } }

const site = decodeURIComponent(location.hash.slice(1)) || 'this'
const tok = theme.tokens as unknown as Record<string, string>
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

document.body.innerHTML = `
<style>
  html, body { margin: 0; height: 100%; background: transparent; font: 16px 'Segoe UI Variable', 'Segoe UI', sans-serif; color: #f3f3f6; user-select: none; }
  .dim { position: fixed; inset: 0; background: rgba(8, 8, 12, 0.86); opacity: 0; animation: fade 0.6s ease-out forwards; display: grid; place-items: center; }
  .box { display: flex; flex-direction: column; align-items: center; gap: 22px; text-align: center; }
  .ring { position: relative; width: 220px; height: 220px; display: grid; place-items: center; }
  .ring::before { content: ''; position: absolute; inset: 0; border-radius: 50%; background: radial-gradient(circle, ${tok.accent}55, ${tok.accent}11 70%); animation: breathe 8s ease-in-out infinite; }
  canvas { position: relative; }
  h1 { margin: 0; font-size: 26px; font-weight: 600; }
  .hint { color: #a6a6b4; min-height: 22px; }
  .choices { display: flex; gap: 12px; opacity: 0; transition: opacity 0.5s; }
  .choices.on { opacity: 1; }
  button { font: inherit; border: 0; border-radius: 999px; padding: 10px 22px; cursor: pointer; color: #f3f3f6; background: #ffffff1f; }
  button.likely { background: #f3f3f6; color: #0d0d12; font-weight: 600; }
  button:focus-visible { outline: 2px solid ${tok.accent}; outline-offset: 3px; }
  @keyframes fade { to { opacity: 1; } }
  @keyframes breathe { 0%, 100% { transform: scale(0.72); } 50% { transform: scale(1); } }
  @media (prefers-reduced-motion: reduce) { .ring::before, .dim { animation: none; opacity: 1; } }
</style>
<div class="dim">
  <div class="box">
    <div class="ring"><canvas width="160" height="160" style="width:80px;height:80px"></canvas></div>
    <h1>A breath first.</h1>
    <div class="hint" id="hint">Breathe in…</div>
    <div class="choices" id="choices">
      <button class="likely" id="back">Go back</button>
      <button id="anyway"></button>
    </div>
  </div>
</div>`

const anyway = document.getElementById('anyway')!
anyway.textContent = `Open ${site} anyway`
document.getElementById('back')!.onclick = () => window.guard.choose('back')
anyway.onclick = () => window.guard.choose('anyway')
addEventListener('keydown', e => { if (e.key === 'Escape') window.guard.choose('back') })

const hint = document.getElementById('hint')!
const start = performance.now()
setTimeout(() => (hint.textContent = 'and out…'), reduced ? 0 : 4000)
setTimeout(() => {
  hint.textContent = `You opened ${site}. Still want to?`
  document.getElementById('choices')!.classList.add('on')
  ;(document.getElementById('back') as HTMLButtonElement).focus()
}, reduced ? 0 : 8000)

const canvas = document.querySelector('canvas')!
const ctx = canvas.getContext('2d')!
function frame(t: number) {
  const s = (t - start) / 1000
  const blink = (s % 3.4) < 0.14 ? Math.abs(1 - 2 * ((s % 3.4) / 0.14)) : 1
  ctx.setTransform(2, 0, 0, 2, 0, 0)
  ctx.clearRect(0, 0, 80, 80)
  drawPip(ctx, { x: 40, y: 44, size: 40, mood: 'idle', color: tok.text!, body: tok.pipBody ?? '#ece9f6', visor: tok.pipVisor ?? '#15151c', open: blink, t: s })
  if (!reduced) requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
