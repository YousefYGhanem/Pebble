# Security policy

## Supported versions

Only the latest release gets security fixes. Pebble updates itself, so staying on the newest version is the fix.

| Version | Supported |
| --- | --- |
| 0.4.x (latest) | Yes |
| older | No |

## Reporting a vulnerability

Please report privately, not in a public issue:
**[Report a vulnerability](https://github.com/YousefYGhanem/Pebble/security/advisories/new)** (GitHub's private
reporting; only the maintainer sees it).

Include what you can: the Pebble version (next to its name in Settings), what an
attacker needs (same PC, same network, a web page, a plugin), the steps, and what they gain. A proof of concept helps.
Please do not include real tokens or personal data.

Pebble is maintained by one person. You can expect:

- a reply within **7 days**, saying whether it is confirmed;
- a fix in a release as soon as it is ready, usually within **30 days** for serious issues;
- credit in the release notes and the advisory, if you want it.

Please give us that time before sharing details publicly.

## What counts

Pebble runs on your own PC. These are in scope:

- **The local agent server** (127.0.0.1): anything that lets another program or a web page post as an agent, read
  sessions or answer questions without the hook token.
- **The phone drop** (your local network, at most an hour, behind a random key): reading or writing files beyond what
  it is for, or reaching it without the key.
- **The island and Settings windows**: a way for agent text, a web page, lyrics, a connector's data or a file name to
  run code or open files.
- **Secrets**: API keys, connector secrets, the hook token, or the Claude sign-in Pebble reads for plan usage leaking
  to a log, a file, another program or the network.
- **The native helper and the CLI**: input that makes them run commands or touch files they should not.
- **Updates**: anything that makes Pebble install something that is not an official release.

Not in scope:

- A **plugin you add yourself** runs code with your Windows rights; its permission list says what it intends, not a
  limit (the approval dialog says so). Built-in connectors are in scope.
- Something that needs an attacker who already controls your Windows account.
- The installer not being code-signed yet (Windows shows "Windows protected your PC"); signing is planned.
- Bugs in Claude Code, Codex or the other agents themselves; report those to their makers.

## Privacy

What Pebble sends where is listed in the [README](README.md#privacy). If you find it sending something it should not,
that is a security report too.
