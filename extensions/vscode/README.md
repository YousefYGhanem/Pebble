# Pebble for VS Code and Cursor

- **Jump to the exact terminal tab**: Pebble's "Jump to terminal" brings VS Code (or Cursor) forward *and* shows the
  terminal tab whose shell runs the agent.
- **Long commands** (off by default, setting `pebble.notifyLongCommands`): Pebble tells you when a terminal command that
  ran at least `pebble.minSeconds` finishes. Leave it off if you added Pebble to your shell (tray → Terminals).

Package and install (from this folder):

```
npx @vscode/vsce package
code --install-extension pebble-0.5.0.vsix
cursor --install-extension pebble-0.5.0.vsix
```
