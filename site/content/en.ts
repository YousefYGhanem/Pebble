import type { Content } from './types'

// Every word on the site in English. ar.ts has the same shape; README.md says how to add a feature.

const en: Content = {
  lang: 'en',
  dir: 'ltr',
  meta: {
    title: 'Pebble: your AI agents, at the top of your screen',
    description: 'A free, open-source island for Windows that follows Claude Code, Codex, Gemini CLI, Cursor and more, and lets you answer them from the top of your screen. With Pip, music, files, focus and your day.'
  },
  nav: { skip: 'Skip to content', features: 'Features', how: 'Get started', faq: 'FAQ', github: 'GitHub', language: 'Language', menu: 'Sections' },
  hero: {
    eyebrow: 'Free and open source for Windows',
    title: 'Your AI agents, at the top of your screen',
    lead: 'Pebble is a small island that follows your coding agents live. When one needs you, answer it right there, without hunting for the terminal.',
    download: 'Download for Windows',
    downloadSub: 'Latest release',
    store: 'Microsoft Store',
    storeSoon: 'Coming soon',
    small: 'Free · Open source (MIT) · Windows 10 and 11',
    worksWith: 'Follows',
    agents: ['Claude Code', 'Codex', 'Gemini CLI', 'Cursor', 'OpenCode', 'Aider', 'DeepSeek Harness', 'Any MCP agent']
  },
  demo: {
    label: 'A live demo of the Pebble island following an agent',
    hint: 'Try it: answer from the island',
    agent: 'Claude Code',
    project: 'webshop',
    time: '08:27',
    working: 'Edit cart.js',
    asks: 'webshop asks',
    question: 'Allow Bash: npm test?',
    allow: 'Allow',
    deny: 'Deny',
    done: 'Done · tests pass',
    denied: 'Stopped · you said no',
    terminal: {
      title: 'Terminal · webshop',
      prompt: 'fix the cart total when a coupon is used',
      working: ['Read cart.js', 'Grep "total"', 'Edit cart.js'],
      ask: 'Waiting for permission: Bash(npm test)',
      done: ['Bash(npm test): 12 passed', 'The coupon now applies to the total.'],
      denied: 'Permission denied from Pebble'
    }
  },
  statuses: { ready: 'Ready', working: 'Working', done: 'Done', stopped: 'Stopped', needs: 'Needs you' },
  story: {
    kicker: 'How the island feels',
    title: 'Quiet when nothing happens. Right there when it matters.',
    steps: [
      { state: 'resting', title: 'Resting', text: 'A small pill with Pip in it. At rest it draws no frames at all, so it costs your PC next to nothing.' },
      { state: 'working', title: 'Working', text: 'An agent starts: the island shows the project and the step it is on, live. Its colour and shape say the state at a glance.' },
      { state: 'ask', title: 'Needs you', text: 'It wants permission, asks a question or has a plan: the island grows into a card. Answer with one click, even when it was tucked away.' },
      { state: 'done', title: 'Done', text: 'The task is finished. Pip is happy, the result waits until you have looked at it, then the island settles again.' }
    ]
  },
  featuresTitle: {
    kicker: 'Everything in the island',
    title: 'Made for agents. Handy all day.',
    lead: 'The open island has its pages on top: Home, Agents, Chat, Music, Files, Clipboard, Notes, Focus and Widgets. Keep the ones you use.'
  },
  features: [
    {
      id: 'agents',
      icon: 'agents',
      kicker: 'Follow agents live',
      title: 'Every agent, one glance',
      text: 'Pebble connects the agents it finds on your PC and shows what each one does: the prompt, every step, the diff, the answer. Several sessions sit side by side as tabs.',
      points: ['Claude Code, Codex, Gemini CLI, Cursor, OpenCode, Aider and DeepSeek Harness', 'Any agent that speaks MCP can message you and ask', 'Status is a shape as well as a colour', 'Jump to terminal brings the right window forward'],
      shots: [{ src: 'open', alt: 'The open island on the Agents page: a session working, its steps and a diff of cart.js', h: 320 }],
      live: 'status',
      mood: 'focused'
    },
    {
      id: 'answer',
      icon: 'answer',
      kicker: 'Answer from the island',
      title: 'Allow, answer, approve. Without switching windows.',
      text: 'When Claude Code wants permission, asks a question or has a plan for you, the island grows into a card. Pick an answer, type your own, or send the plan back with feedback. After it stops, reply and it carries on.',
      points: ['Allow, Always allow or Deny', 'Questions with options, or your own answer', 'Approve a plan, or send it back with feedback', 'Clicks are ignored for the first 0.6 s, so you never answer by accident'],
      shots: [
        { src: 'question', alt: 'A question card on the island with four answer buttons', h: 150 },
        { src: 'plan', alt: 'A plan to review on the open island, with Approve and Send back', h: 456 }
      ],
      mood: 'alert'
    },
    {
      id: 'usage',
      icon: 'gauge',
      kicker: 'Claude plan usage',
      title: 'See the limit coming',
      text: 'Your Claude session and weekly limits come straight from Anthropic with the sign-in Claude Code keeps on your PC, so they show for the Claude app too. Codex and DeepSeek Harness usage is there as well.',
      points: ['A warning at 75%, 90% and 100%, once each', 'A usage ring on the island', 'The Usage tab lists every limit and when it resets'],
      live: 'usage',
      chips: [
        { id: '75', label: '75%', sub: 'Heads up' },
        { id: '90', label: '90%', sub: 'Almost there' },
        { id: '100', label: '100%', sub: 'Limit reached' }
      ],
      mood: 'alert'
    },
    {
      id: 'pip',
      icon: 'pip',
      kicker: 'Meet Pip',
      title: 'A tiny companion with a big heart',
      text: 'Pip lives in the island. His eyes take the colour of what your agent does, and he feels it: focused while it works, happy when it is done, curious when you point at him. He dances to your music and falls asleep when you are away.',
      points: ['Moods for every moment, plus a blink and a wink', 'Outfits earned by finished tasks: glasses, cap, headphones, crown', 'Seasonal hats by themselves, or your own SVG outfit', 'Poke him a few times. He has opinions.'],
      shots: [{ src: 'pip-gallery', alt: 'Pip in every mood and outfit', size: [720, 360] }],
      live: 'pip',
      chips: [
        { id: 'idle', label: 'Idle' },
        { id: 'curious', label: 'Curious' },
        { id: 'focused', label: 'Focused' },
        { id: 'happy', label: 'Happy' },
        { id: 'love', label: 'Love' },
        { id: 'dancing', label: 'Dancing' },
        { id: 'sleepy', label: 'Sleepy' },
        { id: 'alert', label: 'Asks you' }
      ],
      mood: 'happy'
    },
    {
      id: 'home',
      icon: 'home',
      kicker: 'Home',
      title: 'Your day at a glance',
      text: 'Time and date, Wi-Fi and Bluetooth, a tile per page, and today with your agents: tasks done, time worked, files changed. Plus the next prayer, your top app, glasses of water, your to-dos and quick controls.',
      points: ['Volume, mute, microphone and power mode', 'CPU and memory', 'Connector cards right on Home'],
      shots: [{ src: 'page-home', alt: 'The Home page: time, Wi-Fi and Bluetooth, tiles for agents, music, focus and files, and today with your agents', h: 310 }],
      mood: 'idle'
    },
    {
      id: 'music',
      icon: 'music',
      kicker: 'Music',
      title: 'Whatever plays, at your fingertips',
      text: 'Spotify, a browser tab or any player: Pebble reads Windows\' media controls. Cover, a wavy seek bar, controls and timed lyrics that follow the song. The resting island shows the line being sung and a real sound wave.',
      points: ['Player | Lyrics, timed from LRCLIB', 'Each app\'s own volume and mute, like a mixer', 'Pip dances while music plays'],
      shots: [
        { src: 'page-music', alt: 'The Music page with the cover, controls and lyrics', h: 272 },
        { src: 'music', alt: 'The resting island with the album cover and a sound wave', h: 62 }
      ],
      mood: 'dancing'
    },
    {
      id: 'files',
      icon: 'folder',
      kicker: 'Files',
      title: 'A shelf at the top of your screen',
      text: 'Drop files on the island to keep them handy, then drag them out into any app. Snip part of the screen: the picture lands on the shelf and its text goes to your clipboard list.',
      points: ['Drag in, drag out', 'Snip with the text read for you', 'Phone drop: scan a QR code to send files both ways on your Wi-Fi'],
      shots: [
        { src: 'page-files', alt: 'The Files page with three files on the shelf and the Snip and Phone tools', h: 242 },
        { src: 'page-phone', alt: 'The Phone page with a QR code to scan', h: 280 }
      ],
      mood: 'curious'
    },
    {
      id: 'clipboard',
      icon: 'clipboard',
      kicker: 'Clipboard',
      title: 'Everything you copied, nothing you leaked',
      text: 'Your last 25 copied texts and pictures, kept in memory only and never on disk. Pin the ones you need again.',
      points: ['Pictures too', 'Pins stay at the top and survive Clear', 'Copies marked private by password managers are skipped', 'Keys and tokens show only their ends'],
      shots: [{ src: 'page-clipboard', alt: 'The Clipboard page with three copied entries, each with pin and remove', h: 222 }],
      mood: 'idle'
    },
    {
      id: 'notes',
      icon: 'notes',
      kicker: 'Notes & To-do',
      title: 'Write it down before it slips',
      text: 'Notes are saved as you type. Tasks can have a time: the island reminds you (Done, or In 10 min) and so does Windows. Some things repeat daily.',
      points: ['Saved as you type', 'Reminders on the island', 'Daily repeats'],
      shots: [{ src: 'page-notes', alt: 'The Notes page with a list of notes and one open', h: 350 }],
      mood: 'curious'
    },
    {
      id: 'focus',
      icon: 'timer',
      kicker: 'Focus',
      title: 'Deep work, gently kept',
      text: 'Start a timer and the island turns it into a ring around Pip, with a chime at the end. Rain, deep or waves play while it runs. Then another round, or a short break.',
      points: ['Focus sounds: rain, deep, waves', 'Rounds and breaks, counted for today', 'Focus guard: a calm screen asks you to breathe before a distracting site or app'],
      shots: [
        { src: 'page-focus', alt: 'The Focus page with a timer', h: 262 },
        { src: 'focus', alt: 'The resting island with the focus ring around Pip', h: 62 }
      ],
      mood: 'focused'
    },
    {
      id: 'day',
      icon: 'sun',
      kicker: 'Your day',
      title: 'Water, a stretch, a prayer, a pause',
      text: 'Reminders to drink water and stand up, only within your hours, and time away counts as a break. Prayer times are worked out on your PC from your city. Screen time shows your top apps today, counted on this PC only.',
      points: ['Water and stand-up reminders', 'Prayer times, a reminder at each, music can pause', 'Screen time, today only, never sent anywhere'],
      live: 'peeks',
      chips: [
        { id: 'water', label: 'Drink water', sub: 'Pip reminds you' },
        { id: 'stand', label: 'Stand up', sub: 'A short stretch' },
        { id: 'prayer', label: 'Prayer times', sub: 'The next one on Home' },
        { id: 'screen', label: 'Screen time', sub: 'Your top app today' }
      ],
      mood: 'happy'
    },
    {
      id: 'connectors',
      icon: 'plug',
      kicker: 'Connectors',
      title: 'Your world, in the island',
      text: 'Connectors bring apps and web services in: a chip next to Pip, cards on Home and Widgets, live activities and notifications. Write your own in a few lines.',
      points: ['GitHub: reviews waiting, notifications, failing CI', 'Weather, news feeds, live scores', 'Calendar, with a Join button two minutes before an online meeting', 'Webhook inbox, watch a value, DeepSeek balance', 'Each one runs with only what it declares'],
      shots: [{ src: 'page-widgets', alt: 'The Widgets page with connector cards', h: 334 }],
      mood: 'curious'
    },
    {
      id: 'chat',
      icon: 'chat',
      kicker: 'Pip\'s chat',
      title: 'Ask Pip. Show him a window.',
      text: 'Pick who answers: Claude Code or Codex with your own plan, or the Anthropic, OpenAI, Gemini or DeepSeek API with your key, kept encrypted. Point at a window and Pip sees it. In Word, he proposes fixes as tracked changes you accept or reject.',
      points: ['Show him a window: Ctrl+Alt+B', 'Talk to him: Ctrl+Alt+Space', 'Fix in Word, as tracked changes'],
      live: 'chat',
      chips: [
        { id: 'you', label: 'What does this error mean?' },
        { id: 'pip', label: 'The import path is wrong: cart.js lives in src/.' },
        { id: 'you', label: 'Fix my letter in Word' },
        { id: 'pip', label: '3 fixes ready as tracked changes.' }
      ],
      mood: 'love'
    },
    {
      id: 'peeks',
      icon: 'peek',
      kicker: 'Peeks',
      title: 'Little notices, right where you look',
      text: 'When something changes, the island peeks out for a moment and settles again. Point at one and it stays put, so its buttons are easy to hit.',
      points: ['Sound device, Caps Lock, keyboard language', 'Microphone, charger, network', 'Usage warnings and updates'],
      live: 'peeks',
      chips: [
        { id: 'sound', label: 'Sound', sub: 'Sound plays here now' },
        { id: 'caps', label: 'Caps Lock', sub: 'On' },
        { id: 'mic', label: 'Microphone', sub: 'Muted for every app' },
        { id: 'charge', label: 'Charging', sub: 'Charger connected' }
      ],
      mood: 'curious'
    },
    {
      id: 'look',
      icon: 'palette',
      kicker: 'Make it yours',
      title: 'Your colours, your corner',
      text: 'Six themes and Auto, which follows Windows\' light or dark mode. Customize colours with a live preview. Put the island left, middle or right, as a notch or a floating pill, detailed or minimal.',
      points: ['Themes and your own colours', 'Left, middle or right along the top', 'Minimal island', 'Game mode hides it; the game strip shows your PC\'s readings', 'Living skins: embers, frost, a web at night'],
      live: 'themes',
      chips: [
        { id: 'default', label: 'Default' },
        { id: 'midnight', label: 'Midnight' },
        { id: 'graphite', label: 'Graphite' },
        { id: 'black', label: 'Black' },
        { id: 'mist', label: 'Mist (light)' },
        { id: 'high-contrast', label: 'High contrast' }
      ],
      mood: 'love'
    },
    {
      id: 'access',
      icon: 'keyboard',
      kicker: 'For everyone',
      title: 'Keyboard first, screen readers welcome',
      text: 'Ctrl+Alt+P hands the island the keyboard: Tab and Enter answer, arrows move between pages, Esc gives the keyboard back to your app. Screen readers hear what finished, stopped or needs you.',
      points: ['Status as a shape, not only a colour', 'Windows contrast themes', 'Motion follows Windows\' animation setting'],
      live: 'keys',
      chips: [
        { id: 'open', label: 'Ctrl+Alt+P', sub: 'Open with the keyboard' },
        { id: 'answer', label: 'Tab · Enter', sub: 'Answer' },
        { id: 'pages', label: '← →', sub: 'Between pages' },
        { id: 'close', label: 'Esc', sub: 'Back to your app' },
        { id: 'tuck', label: 'Ctrl+Alt+H', sub: 'Tuck away' }
      ],
      mood: 'idle'
    },
    {
      id: 'rest',
      icon: 'leaf',
      kicker: 'Always on, kept light',
      title: 'Rests when you do',
      text: 'Pebble runs all day, so it does as little as it can. At rest the island draws no frames. When you are away, in a full-screen game or have tucked it away, what nobody needs pauses, and it wakes within seconds when you are back.',
      points: ['About 6% of one CPU core with an agent working', 'About 0.1% while tucked away', 'Connectors and readings rest on battery'],
      live: 'pip',
      mood: 'sleepy'
    },
    {
      id: 'privacy',
      icon: 'shield',
      kicker: 'Privacy',
      title: 'Your PC. Your data.',
      text: 'Pebble has no server of its own. It talks to the outside only for features you switch on, and only to that feature\'s service. API keys and connector secrets are encrypted for your Windows account.',
      points: ['No account', 'No analytics', 'No tracking', 'Data stays on your PC', 'Clipboard and chat stay in memory'],
      mood: 'love'
    },
    {
      id: 'languages',
      icon: 'globe',
      kicker: 'English and Arabic',
      title: 'Speaks your language',
      text: 'The island, Settings, the welcome tour, the tray and notifications, all in English and Arabic. In Arabic, Settings, the tour and the open pages run right to left.',
      points: ['Right to left where it matters', 'One kind of digit for times', 'Adding a language is one file and one line of code'],
      live: 'lang',
      mood: 'happy'
    }
  ],
  more: {
    kicker: 'And the little things',
    title: 'Small touches, all over',
    lead: 'The details that make it feel finished.',
    items: [
      { icon: 'terminal', title: 'Long commands', text: 'PowerShell or Git Bash tell you when a command of 10 s or more finishes, red when it failed.' },
      { icon: 'code', title: 'VS Code and Cursor', text: 'The extension shows the exact terminal tab when you jump to it.' },
      { icon: 'prompt', title: 'The pebble command', text: 'pebble notify and pebble ask from any script or CI step.' },
      { icon: 'history', title: 'History', text: 'The last 40 finished turns, a click away.' },
      { icon: 'undo', title: 'Undo for 5 s', text: 'After clearing the clipboard or the shelf, or deleting a note.' },
      { icon: 'search', title: 'Settings search', text: 'Ctrl+F finds any setting and highlights it.' },
      { icon: 'sparkle', title: 'Suggested next step', text: 'Claude\'s next step shows on the island. A click answers it.' },
      { icon: 'line', title: 'Tucked away', text: 'A thin line: dashed when an agent stopped, dotted when one needs you.' },
      { icon: 'confetti', title: 'Confetti and hearts', text: 'After long tasks, and when you answer from the island.' },
      { icon: 'trophy', title: 'Achievements', text: 'Night owl, Quick one, Marathon and more.' },
      { icon: 'chip', title: 'Resting chips', text: 'Time, battery, CPU, memory or the next prayer beside Pip.' },
      { icon: 'gamepad', title: 'Game strip', text: 'Your PC\'s readings during a full-screen game.' },
      { icon: 'flame', title: 'Living skins', text: 'Embers when the CPU works hard, frost when it idles, vines after a long day.' },
      { icon: 'pip', title: 'App icon', text: 'Pip as a lavender, cream or graphite pebble.' },
      { icon: 'stethoscope', title: 'Diagnostics', text: 'Checks every part and gives you a report to copy.' },
      { icon: 'play', title: 'Test mode', text: 'Plays every state of the island without a real session.' },
      { icon: 'refresh', title: 'Updates itself', text: 'New versions arrive by themselves, with What\'s new.' },
      { icon: 'hand', title: 'Welcome tour', text: 'Try opening, closing and tucking the real island, then name Pip.' },
      { icon: 'bell', title: 'Notifications by source', text: 'Needs you, done, connectors, focus: on or off each.' },
      { icon: 'backup', title: 'Careful with your files', text: 'Every config it touches gets a backup; uninstalling takes Pebble out again.' }
    ]
  },
  how: {
    kicker: 'Get started',
    title: 'Up and running in a minute',
    steps: [
      { title: 'Download and run', text: 'Get the installer for Windows 10 or 11. No admin rights needed. It is not code-signed yet, so Windows may ask once: More info, then Run anyway.' },
      { title: 'Pebble finds your agents', text: 'On start it connects every agent it finds on your PC. Restart sessions that were already running.' },
      { title: 'Work as usual', text: 'Point at the island, or press Ctrl+Alt+P. When an agent needs you, the island tells you, and you answer right there.' }
    ]
  },
  faq: {
    kicker: 'Questions',
    title: 'Good to know',
    items: [
      { q: 'Is Pebble free?', a: 'Yes. Pebble is free and open source under the MIT license. No account, no subscription.' },
      { q: 'Which agents does it work with?', a: 'Claude Code (also inside the Claude app), Codex, Gemini CLI, Cursor, OpenCode, Aider and DeepSeek Harness, plus any agent that speaks MCP. Claude Code\'s permissions, questions and plans are answered from the island; the others show what they do and tell you when they wait for you in their own window.' },
      { q: 'Will it slow my PC down?', a: 'Hardly. At rest the island draws no frames. With an agent working it uses about 6% of one CPU core, and about 0.1% while tucked away. When you are away or in a game, what nobody needs pauses.' },
      { q: 'What about my privacy?', a: 'Pebble has no server of its own: no account, no analytics, no tracking. It talks to a service only for a feature you switch on, such as lyrics, weather or the AI you pick for the chat. Keys are encrypted for your Windows account.' },
      { q: 'Why does Windows warn me about the installer?', a: 'The installer is not code-signed yet, so SmartScreen may show "Windows protected your PC" the first time. Choose More info, then Run anyway. The source code is all on GitHub.' },
      { q: 'Is there a Microsoft Store version?', a: 'It is on its way, listed as Pebble Pet. Until then, download it from GitHub: it updates itself.' }
    ]
  },
  cta: { title: 'Give your agents a home', lead: 'Free, open source and light. Pip is waiting.' },
  footer: {
    tagline: 'A notch-style island for Windows that follows your AI coding agents.',
    links: [
      { label: 'GitHub', href: 'https://github.com/YousefYGhanem/Pebble' },
      { label: 'Releases', href: 'https://github.com/YousefYGhanem/Pebble/releases' },
      { label: 'Privacy policy', href: 'https://github.com/YousefYGhanem/Pebble/blob/main/PRIVACY.md' },
      { label: 'Security policy', href: 'https://github.com/YousefYGhanem/Pebble/blob/main/SECURITY.md' },
      { label: 'MIT license', href: 'https://github.com/YousefYGhanem/Pebble/blob/main/LICENSE' }
    ],
    license: 'Pebble is free and open-source software under the MIT license.',
    notAffiliated: 'Not affiliated with Anthropic, OpenAI, Google or Microsoft. Product names are trademarks of their owners and are used only to say what Pebble works with.',
    pip: 'Poke Pip',
    developer: { madeBy: 'Made by', name: 'Yousef Ghanem', cta: 'Check out the developer', href: 'https://yousefyghanem.github.io/' }
  }
}

export default en
