# Store listings

`npm run pack:extensions` writes the files to upload into `dist/extensions/`. Uploading is done by hand from each
store's dashboard (each needs your own developer account). The texts below are ready to paste.

## Pebble for chat sites (Chrome Web Store, Microsoft Edge Add-ons)

Upload `pebble-chat-<version>.zip` to both. Chrome charges a one-time $5 developer fee; Edge is free.

**Name:** Pebble for chat sites

**Short description (132 characters max):**
See in Pebble's island when claude.ai, ChatGPT, Gemini or DeepSeek has answered, and reply without switching windows.

**Description:**
Pebble is a free, notch-style island for Windows that follows your AI tools. This extension connects your chat tabs to it:

- The island shows when an answer is still being written, and tells you when it is done or asks you something.
- Reply from the island: Pebble types your reply into the chat, only when the message box is empty (a draft is never
  overwritten), and never sends anything twice by itself.
- Works with claude.ai, ChatGPT, Gemini and DeepSeek.

Experimental. It reads those sites in your own browser and types for you, which the sites' terms may not allow
(automated access): use it at your own risk. Not affiliated with Anthropic, OpenAI, Google or DeepSeek.

Needs the Pebble app for Windows (https://github.com/YousefYGhanem/Pebble). Pair it once with the key from Pebble's
Settings → Pip's chat → Chat apps.

**Category:** Productivity · **Language:** English

**Single purpose (Chrome asks for this):** Show the state of the user's open AI chat tabs in the Pebble desktop app on
the same PC, and type the user's reply from that app into the chat.

**Permission justifications:**
- `storage`: keeps the pairing key and port you enter in the popup.
- Host `http://127.0.0.1/*`: talks to the Pebble app on your own PC. Nothing is sent anywhere else.
- Content scripts on claude.ai, chatgpt.com, gemini.google.com, chat.deepseek.com: read whether an answer is being
  written and its text, and type your reply into the message box.

**Remote code:** No. **Data use:** see the privacy text below. It does not sell, transfer or use data for anything else.

**Screenshots (1280×800):** the island showing a finished claude.ai answer, the reply box in the island, the popup.

## Pebble (VS Code Marketplace, Open VSX for Cursor)

Upload `pebble-<version>.vsix` (built from `extensions/vscode` with `npx @vscode/vsce package`). Publishing needs a
publisher id named `pebble` (or change `publisher` in `extensions/vscode/package.json`).

**Description:** Lets Pebble's island jump to the exact terminal tab where your AI agent (Claude Code, Codex, Gemini
CLI…) runs. Needs the Pebble app for Windows.

## Pebble (Microsoft Store)

Product type in Partner Center: **MSIX or PWA app**. Identity: `YousefGhanem.PebblePet`, publisher
`CN=75D4754E-F120-440E-A79A-0581F3A0BAAE` (in `electron-builder.yml` under `appx:`).

**Building the package:** `npm run dist:store`. On a PC where Windows blocks electron-builder's bundled
`makeappx.exe` ("spawn UNKNOWN"), the package files are still prepared in `dist/store/__appx-x64`; pack them with the
Windows SDK's own tool:

```
"C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\makeappx.exe" pack /o /f dist\store\__appx-x64\mapping.txt /p "dist\store\Pebble <version>.appx"
```

Upload the `.appx` unsigned: the Store signs it.

**What the Store package does differently (done):**
- Its data lives in `%USERPROFILE%\.pebble` instead of `%APPDATA%\Pebble`. A packaged app's writes to AppData are
  virtualized, so coding tools would not see the hook token and scripts; the user's own folder is not. (Turning
  virtualization off needs the restricted capability `unvirtualizedResources`, which certification denied in Nov 2026.)
  The native helper and the VS Code extension look in both places.
- Agents' hooks and terminals run a copy of `pebble-native.exe` in `%USERPROFILE%\.pebble\native\<version>`, because
  programs outside the package cannot start an exe inside WindowsApps.
- Pebble's own updater is off (the Store updates it). It starts with Windows through a startup task, which you
  switch in Windows Settings → Apps → Startup (Pebble's own "Start with Windows" switch does not apply there).

**When submitting, Partner Center asks why for the restricted capabilities:**
- `runFullTrust`: "Pebble is a desktop app (Electron) with a native helper for audio, windows and notifications."

**Product declarations:** tick "This product incorporates generative AI features" (Pip's chat; policy 11.16).

**Before the first submission, test the package** with a Partner Center *package flight* (a private test group with
only you): install from the Store link, then check that an agent reaches the island, Start with Windows, the native
helper (music, volume), and uninstalling.

**After that (needs the package identity):** island notifications. Windows lets an app read your other notifications
(`UserNotificationListener`) only when it is a packaged app and you allow it once. The Store version would show them as
peeks on the island; the regular installer keeps working without them.

**Privacy policy URL:** https://github.com/YousefYGhanem/Pebble/blob/main/PRIVACY.md
**Website:** https://github.com/YousefYGhanem/Pebble · **Support:** https://github.com/YousefYGhanem/Pebble/issues
**Category:** Productivity (subcategory: none) · **Languages:** English, Arabic · **Price:** free
**Screenshots:** `docs/store/*.png` (8, 1920×1080; `npm run capture` then `npm run store-shots` to redraw). Logos are in
the package (`build/appx`, drawn by `npm run icon`); for the listing's own logo use `build/appx/LargeTile.png`.

### Listing, English

**Product name:** Pebble Pet

**Short description:**
A notch-style island for Windows that follows your AI coding agents and answers their questions, with Pip, music,
files, focus and your day around it.

**Description:**
Pebble Pet puts a small island at the top of your screen. It follows your AI coding agents (Claude Code, Codex, Gemini
CLI, Cursor, OpenCode, Aider and DeepSeek Harness) and shows what each one is doing, live. When an agent needs you,
the island grows into a card: allow or deny a command, answer its question, or review its plan, without switching
windows. When it is done, you know.

Pip, a little character who lives in the island, keeps you company: he reacts to your agents, dances to your music,
falls asleep when you are away, and earns outfits as you work.

Open the island for more:
- Home: your day at a glance, with your agents' work, the next prayer, screen time and quick controls
- Music: what plays in any app, with timed lyrics and each app's own volume
- Files: a shelf for files, snips of your screen, and sending files from your phone
- Pip's page (Ctrl+Alt+K): one box for everything. Sums, units, currencies, the time anywhere, timers and translations
  answer as you type; anything else goes to Pip, a free AI that needs no account (or your own Claude Code, Codex or API
  key). He reads answers aloud, with natural voices in 50+ languages if you choose them.
- Clipboard, Notes and To-do with reminders, a Focus timer with calm sounds, and connectors (GitHub with your pull
  requests' CI, weather, your calendar with a Join button, live scores, news, countdowns, local dev servers)
- Game strip: CPU and GPU use and temperatures over full-screen games (Ctrl+Alt+G)

Kind to your PC and your privacy: it rests while you are away, in a game or when you tuck it away. No account, no
analytics, no ads. English and Arabic.

**Features** (one per line, up to 20):
- Follows Claude Code, Codex, Gemini CLI, Cursor, OpenCode, Aider and DeepSeek Harness
- Answer permissions, questions and plans from the island
- Claude plan usage with warnings before you hit a limit
- Pip, a companion who reacts to your work
- Pip's page: instant answers, timers, translations and a free AI chat
- Read answers aloud, with natural voices in 50+ languages
- Game strip: CPU and GPU readings over full-screen games
- Music with timed lyrics and per-app volume
- File shelf, screen snips and phone drop
- Clipboard history, notes and to-dos with reminders
- Focus timer with focus sounds
- Water and stand-up reminders, prayer times, screen time
- Connectors: GitHub CI, weather, calendar, live scores, news, countdowns
- Themes, including one that follows Windows light or dark
- English and Arabic

**Search terms** (up to 7): notch, dynamic island, AI agents, Claude Code, AI assistant, game overlay, desktop pet

**What's new in this version:** copy the first line and the headings of `docs/releases/v<version>.md`.

### Listing, Arabic

**اسم المنتج:** Pebble Pet

**وصف قصير:**
جزيرة بأسلوب النوتش لويندوز تتابع وكلاء البرمجة بالذكاء الاصطناعي وتجيب عن أسئلتهم، ومعها بيب والموسيقى والملفات
والتركيز ويومك.

**الوصف:**
يضع Pebble Pet جزيرة صغيرة أعلى شاشتك. تتابع وكلاء البرمجة بالذكاء الاصطناعي (Claude Code وCodex وGemini CLI وCursor
وOpenCode وAider وDeepSeek Harness) وتعرض ما يفعله كل منهم مباشرة. وحين يحتاجك وكيل، تكبر الجزيرة إلى بطاقة: اسمح
بأمر أو ارفضه، أجب عن سؤاله، أو راجع خطته، دون أن تنتقل بين النوافذ. وحين ينتهي، تعرف.

بيب، شخصية صغيرة تعيش في الجزيرة، يرافقك: يتفاعل مع وكلائك، ويرقص على موسيقاك، وينام حين تغيب، ويكسب أزياء أثناء
عملك.

افتح الجزيرة لترى المزيد:
- الرئيسية: يومك في لمحة، مع عمل وكلائك والصلاة القادمة ووقت الشاشة وأزرار سريعة
- الموسيقى: ما يُشغَّل في أي تطبيق، مع كلمات متزامنة ومستوى صوت كل تطبيق
- الملفات: رف للملفات، وقص أجزاء من الشاشة، وإرسال الملفات من هاتفك
- صفحة بيب (Ctrl+Alt+K): مربع واحد لكل شيء. الحسابات والوحدات والعملات والوقت في أي مدينة والمؤقتات والترجمة تُجاب
  أثناء الكتابة، وما عدا ذلك يذهب إلى بيب، ذكاء اصطناعي مجاني بلا حساب (أو Claude Code أو Codex أو مفتاح API الخاص
  بك). ويقرأ الإجابات بصوت عالٍ، بأصوات طبيعية بأكثر من 50 لغة إن اخترتها.
- الحافظة والملاحظات والمهام مع التذكيرات، ومؤقت تركيز بأصوات هادئة، وموصلات (GitHub مع فحوص طلبات الدمج، والطقس
  وتقويمك مع زر الانضمام والنتائج المباشرة والأخبار والعد التنازلي وخوادم التطوير المحلية)
- شريط الألعاب: استخدام المعالج وكرت الشاشة وحرارتهما فوق الألعاب بملء الشاشة (Ctrl+Alt+G)

لطيف مع جهازك وخصوصيتك: يرتاح حين تغيب أو تلعب أو تخفيه. بلا حساب، بلا تتبع، بلا إعلانات. بالعربية والإنجليزية.

**الميزات:**
- يتابع Claude Code وCodex وGemini CLI وCursor وOpenCode وAider وDeepSeek Harness
- أجب عن الأذونات والأسئلة والخطط من الجزيرة
- استخدام خطة Claude مع تنبيهات قبل بلوغ الحد
- بيب، رفيق يتفاعل مع عملك
- صفحة بيب: إجابات فورية ومؤقتات وترجمة ومحادثة ذكاء اصطناعي مجانية
- قراءة الإجابات بصوت عالٍ، بأصوات طبيعية بأكثر من 50 لغة
- شريط الألعاب: قراءات المعالج وكرت الشاشة فوق الألعاب بملء الشاشة
- موسيقى بكلمات متزامنة ومستوى صوت لكل تطبيق
- رف ملفات وقص الشاشة وإرسال من الهاتف
- سجل الحافظة والملاحظات والمهام مع التذكيرات
- مؤقت تركيز بأصوات تركيز
- تذكير بشرب الماء والوقوف، ومواقيت الصلاة، ووقت الشاشة
- موصلات: فحوص GitHub والطقس والتقويم والنتائج المباشرة والأخبار والعد التنازلي
- سمات، منها واحدة تتبع الوضع الفاتح أو الداكن في ويندوز
- العربية والإنجليزية

**كلمات البحث:** نوتش، جزيرة، وكلاء الذكاء الاصطناعي، Claude Code، مساعد ذكي، شريط الألعاب، رفيق سطح المكتب

## Privacy (for both listings)

Pebble's extensions work only on your own computer. The chat extension reads, in the four chat sites, whether an
answer is being written and the text of the last answer, and sends that to the Pebble app at 127.0.0.1 (your own PC).
It types a reply only when you send one from the Pebble app. Nothing is sent to the developer or any other server, and
nothing is stored except the pairing key and port you enter. The VS Code extension receives a request from the Pebble
app on your PC to show a terminal tab, and sends nothing anywhere.
