# Pebble on film

Films are made with Remotion from Pebble's own island and Pip. Everything below comes from the product; change it
there first.

## Brief (the launch film, Nov 2026)

- For LinkedIn: 4:5 (1080 × 1350), 26 s, 60 fps, plays muted first, so the captions carry it. English and Arabic.
- Content and format chosen by the product owner:
  - a royalty-free track, composed in code (`scripts/compose.py`, so Pebble owns it);
  - Pip as the guide;
  - one island that changes shape between scenes.
- Story, one idea per scene:
  1. Pip wakes.
  2. An agent works.
  3. It asks; you click "Stripe".
  4. Done.
  5. Music with lyrics.
  6. Home, where the batteries row lights up.
  7. Headphones connect (a peek).
  8. Pip's page.
  9. The end card: Pebble, "Free · Open source · Windows 10 & 11", Microsoft's Store badge, "Search 'Pebble Pet'".

## Look

| What | Value | Source |
| --- | --- | --- |
| Night | `#08070d`; a lamp of `#7c5cff` at the top, a faint `#53e4ff` glow at the bottom | `site/src/global.css`, the site hero |
| Island | `#0d0d12`, its top edge `#1d1d22` fading over 17 app px, a 1 px rim at 14% white, 20 px corners, 8 px ears | `themes/default.json`, measured from the captures (`scripts/sample-ui.cjs`) |
| Text | `#f4f4f6`, muted `#9b99ab`, accent words `#b9a8ff` | site tokens |
| Type | Segoe UI Variable Display (captions, 72 px bold, −1.2 tracking), Segoe UI for Arabic | `site/src/global.css` |
| Motion | The island's springs: growing 0.42 s / 0.86, shrinking 0.34 s / 1. Content fades in 0.08 s after the shape moves, blurring from 6 px | `app/renderer/island/spring.ts`, `App.svelte` |
| Pip | `drawPip` from the app, body `#ece9f6`, visor `#15151c`, eyes in the colour of what goes on | `app/renderer/island/pip.ts`, `PipCanvas.svelte` |

## Components

| Component | How | Why |
| --- | --- | --- |
| The island's states | Real captures: `npm run capture` with `--capture-scale=3 --user-data-dir=<a fresh profile>` (Arabic: a profile whose settings say `"language": "ar"`), in `public/ui` and `public/ui-ar` | The real thing, sharp up to 3x zoom; default theme |
| The island's shape | Redrawn (`src/pebble/Island.tsx`): one body on the app's springs, captures fading inside | The app's canvas runs on its own clock |
| Pip | The app's `drawPip`, painted from t (`src/pebble/Pip.tsx`) | It is a pure painter |
| The connect peek | Twin (`src/pebble/Peek.tsx`) | A peek is not a capturable scene |
| Store badge | Microsoft's own artwork (`public/brand`, from `site/public/badges`) | Brand rules |

## Claims

Show only what Pebble does:
- it follows coding agents and lets you answer them from the island;
- music with timed lyrics;
- accessory batteries;
- Pip's chat with a free AI by default;
- it is free and open source, on Windows 10 and 11, and in the Microsoft Store as "Pebble Pet".

## Making it

```
cd videos
npm install
npx remotion studio src/index.ts                                         # preview
node scripts/stills.ts out/review/vN <frames...> --composition Launch-en  # review stills (60 fps frames)
uv run --with numpy --with scipy python scripts/compose.py               # the music
npx remotion render src/index.ts Launch-en out/final/pebble-launch-en.mp4 --props='{"fps":60,"lang":"en"}' --codec=h264 --crf=16 --audio-codec=aac
```

The timing is all in `src/launch/cues.ts`, and the words in `src/launch/words.ts`.
