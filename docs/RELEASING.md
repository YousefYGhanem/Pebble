# Releasing Pebble

## Once

1. Create the GitHub repository **YousefYGhanem/Pebble** (public) and push this folder to it. The owner and name are
   also in `electron-builder.yml` (`publish`) and `package.json` (`repository`); change both if the repo moves.
2. Nothing else: the release workflow uses GitHub's built-in token.

## Every release

1. Raise `"version"` in `package.json` (for example `0.2.0`).
2. Commit, then tag and push: `git tag v0.2.0 && git push --tags`.
3. The **Release** workflow (`.github/workflows/release.yml`) tests, builds the native helper and the installer, and
   publishes `Pebble Setup 0.2.0.exe` with `latest.yml` as a GitHub Release.
4. Installed copies check a minute after they start and every 6 hours, download the new version in the background and
   install it when Pebble restarts (tray → *Restart to update*, or Settings → General → Updates).

To build an installer on this PC without publishing: `npm run dist` → `dist/Pebble Setup <version>.exe`.

## Installing and removing

- The installer is per-user (no admin rights) and goes to `%LOCALAPPDATA%\Programs\Pebble`. It can be moved during
  setup.
- Uninstalling first closes Pebble, then runs `Pebble.exe --remove-hooks`: Pebble is taken out of every agent (Claude
  Code, Codex, Gemini CLI, Cursor, OpenCode, Aider), out of the shells it was added to, and out of Windows start-up.
  Updates do not do this. Your settings, themes and outfits stay in `%APPDATA%\Pebble`; delete that folder to remove
  them too.

## Code signing (not set up yet)

The installer is unsigned, so Windows SmartScreen shows "Windows protected your PC" on the first run (More info → Run
anyway). To sign later, either:

- **A certificate** (`.pfx`): add the repository secrets `CSC_LINK` (the file, base64) and `CSC_KEY_PASSWORD`, and pass
  them as environment variables to the `npm run release` step. electron-builder signs when they are present.
- **Azure Trusted Signing**: add `azureSignOptions` under `win:` in `electron-builder.yml` with your account's
  endpoint, account and profile names, and the `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_CLIENT_SECRET` secrets.

Once signed, set `win.publisherName` so updates check the signature too.

## Store packages

`npm run pack:extensions` writes the browser extension zip and the VS Code extension to `dist/extensions/` (the release
workflow attaches them to the run). Listings and privacy text: [STORES.md](STORES.md).
