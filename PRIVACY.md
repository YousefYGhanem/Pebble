# Pebble privacy policy

*Last updated: 13 November 2026. Applies to Pebble (also listed as "Pebble Pet") from GitHub and the Microsoft Store.*

**In short:** Pebble has no server and no account. It collects nothing about you for itself: no analytics, no
tracking, no ads. What it keeps stays on your PC. It goes online only for features you use, and then only to that
feature's own service.

## What stays on your PC

Pebble keeps its data in `%APPDATA%\Pebble` on your computer, and nowhere else:

- your settings, themes and Pip's outfits
- notes, to-dos, the file shelf list, today's agent summary and today's screen time
- the history of your agents' finished turns
- a log for troubleshooting (keys and tokens in it are masked)
- the chat with Pip and the window screenshots you show him (until you clear the chat)

Clipboard history stays in memory only and is never written to disk; copies that password managers mark as private
are skipped. API keys and connector secrets are encrypted for your Windows account.

Pebble's developer never receives any of this. Uninstalling removes Pebble; delete `%APPDATA%\Pebble` to remove
your data too.

## What goes online, and only when you use it

| Feature | Service | What is sent |
| --- | --- | --- |
| Pip's chat | the AI provider you choose (Anthropic, OpenAI, Google, DeepSeek, or your Claude Code / Codex sign-in) | your messages, and a window's picture and text when you show him one |
| Claude plan usage | Anthropic | the Claude sign-in Claude Code keeps on your PC, to read your plan's limits (and to renew it when it expires) |
| Lyrics | LRCLIB (lrclib.net) | the playing song's title, artist, album and length |
| Prayer times, Weather | Open-Meteo | the name of your city when you look it up; for weather, its coordinates |
| Live scores | ESPN | the leagues you follow |
| Other connectors you switch on (GitHub, calendar, news feeds, a value to watch…) | the service you point them at | what that connector needs, with the key you give it |
| Updates (GitHub version only) | GitHub | a check for a new version |

Prayer times are worked out on your PC. Screen time is counted on your PC and never sent anywhere.

## On your network

The **phone drop** (Files page) opens a page on your own Wi-Fi only while you use it, for at most an hour, behind a
random key in its QR code, so your phone can send and receive files. Nothing passes through the internet.

Pebble also listens on your PC itself (127.0.0.1, not reachable from other computers) so your coding agents can
report to it, protected by a secret token.

## Children

Pebble is a general-purpose tool and does not knowingly collect information from anyone, including children.

## Changes and contact

Changes to this policy are published here, in Pebble's repository, with the date above. Questions:
[open an issue](https://github.com/YousefYGhanem/Pebble/issues), or for anything sensitive, the private report in
[SECURITY.md](SECURITY.md).
