# Releasing Pebble

## Once

1. Create the GitHub repository **YousefYGhanem/Pebble** (public) and push this folder to it. The owner and name are
   also in `electron-builder.yml` (`publish`) and `package.json` (`repository`); change both if the repo moves.
2. Nothing else: the release workflow uses GitHub's built-in token.

## Every release

1. Raise `"version"` in `package.json` (for example `0.2.0`).
2. Commit, then tag and push: `git tag v0.2.0 && git push --tags`.
3. The **Release** workflow (`.github/workflows/release.yml`) tests, builds the native helper and the installer, and
   publishes `Pebble Setup 0.2.0.exe`, `latest.yml` and the browser extension zip as a GitHub Release (a draft until
   everything is uploaded).
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

## Code signing (SignPath, waiting for approval)

The installer is unsigned until SignPath is set up, so Windows SmartScreen shows "Windows protected your PC" on the first
run (More info → Run anyway). The release workflow already signs through SignPath ([build/sign.cjs](../build/sign.cjs))
as soon as its secrets exist:

1. Apply at https://signpath.org (the SignPath Foundation signs open-source projects for free). Name this repository and
   say releases are built by GitHub Actions.
2. Once approved, add these repository secrets (Settings → Secrets and variables → Actions): `SIGNPATH_API_TOKEN`,
   `SIGNPATH_ORGANIZATION_ID`, `SIGNPATH_PROJECT_SLUG`, `SIGNPATH_POLICY_SLUG`.
3. Add `publisherName` under `win:` in `electron-builder.yml`: the subject of the certificate SignPath signs with. Updates
   then also check that a new version is signed by the same publisher.

The next tag is then signed. SignPath may ask for its own GitHub Action instead of the PowerShell submission used here;
build/sign.cjs is the one place to change.

## After each release: antivirus false positives

Until the installer is signed, some antivirus programs flag new builds. After a release, upload
`Pebble-Setup-<version>.exe` and `pebble-native.exe` (from `%LOCALAPPDATA%\Programs\Pebble\resources\native`) at
https://www.microsoft.com/wdsi/filesubmission as "incorrectly detected" (software developer). Microsoft usually clears
them within a few days, which also helps SmartScreen. Signing (above) is the lasting fix.

## Release notes

Write them in `docs/releases/v<version>.md` before tagging; the workflow uses that file (else GitHub's list of changes).

## Microsoft Store

Pebble is on the Store as **Pebble Pet** (product ID `9PJNR7CT4ZN7`,
https://apps.microsoft.com/detail/9PJNR7CT4ZN7). Every tag also builds the Store package: the run keeps it as the
`store-package` artifact (`Pebble.msix`), and uploads it to Partner Center and submits it for certification once these
are set up (once):

1. **Entra app:** at https://entra.microsoft.com → App registrations → New registration (any name, e.g. "Pebble
   releases"). Note its *Application (client) ID* and the *Tenant ID* (Overview). Under Certificates & secrets, add a
   client secret and copy its value at once (it is shown only once; it expires, so renew it when it does).
2. **Partner Center:** Account settings → User management → Microsoft Entra applications → Add the app, role
   **Manager**. The *Seller ID* is under Account settings → Identifiers.
3. **GitHub:** repository Settings → Secrets and variables → Actions, add `PARTNER_CENTER_TENANT_ID`,
   `PARTNER_CENTER_SELLER_ID`, `PARTNER_CENTER_CLIENT_ID`, `PARTNER_CENTER_CLIENT_SECRET`.

The Store version appears after Microsoft's certification (usually within a few days). Publishing replaces a draft
submission you started in Partner Center, so finish or discard drafts before tagging. Without the secrets, download the
artifact from the run and upload it in Partner Center by hand (Submission → Packages).

## Store packages

`npm run pack:extensions` writes the browser extension zip and the VS Code extension to `dist/extensions/` (the release
workflow attaches them to the run). Listings and privacy text: [STORES.md](STORES.md).
