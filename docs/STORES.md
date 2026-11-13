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
"C:\Program Files (x86)\Windows Kitsin.0.26100.0d\makeappx.exe" pack /o /f dist\store\__appx-x64\mapping.txt /p "dist\store\Pebble <version>.appx"
```

Upload the `.appx` unsigned: the Store signs it.

**What the Store package does differently (done):**
- `build/appxmanifest.xml` (electron-builder's own, plus one line) turns off file-write virtualization, so
  `%APPDATA%\Pebble` (the agents' hook token, hook scripts, settings) is the real folder that coding tools read. This
  needs the restricted capability `unvirtualizedResources`.
- Agents' hooks and terminals run a copy of `pebble-native.exe` in `%APPDATA%\Pebble
ative\<version>`, because
  programs outside the package cannot start an exe inside WindowsApps.
- Pebble's own updater is off (the Store updates it). It starts with Windows through a startup task, which you
  switch in Windows Settings → Apps → Startup (Pebble's own "Start with Windows" switch does not apply there).

**When submitting, Partner Center asks why for the restricted capabilities:**
- `runFullTrust`: "Pebble is a desktop app (Electron) with a native helper for audio, windows and notifications."
- `unvirtualizedResources`: "Pebble writes hook settings and a token in its AppData folder that coding tools on the same
  PC (Claude Code, Codex, Gemini CLI) read to report to it; with virtualization they would not see them."

**Before the first submission, test the package** with a Partner Center *package flight* (a private test group with
only you): install from the Store link, then check that an agent reaches the island, Start with Windows, the native
helper (music, volume), and uninstalling.

**After that (needs the package identity):** island notifications. Windows lets an app read your other notifications
(`UserNotificationListener`) only when it is a packaged app and you allow it once. The Store version would show them as
peeks on the island; the regular installer keeps working without them.

**Listing texts:** the README's first paragraph and feature list; screenshots from `docs/screens/`.
**Category:** Productivity · **Languages:** English, Arabic · **Price:** free

## Privacy (for both listings)

Pebble's extensions work only on your own computer. The chat extension reads, in the four chat sites, whether an
answer is being written and the text of the last answer, and sends that to the Pebble app at 127.0.0.1 (your own PC).
It types a reply only when you send one from the Pebble app. Nothing is sent to the developer or any other server, and
nothing is stored except the pairing key and port you enter. The VS Code extension receives a request from the Pebble
app on your PC to show a terminal tab, and sends nothing anywhere.
