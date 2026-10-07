# OpenCode

## Native plugin install (recommended)

Add ClarityKit to the `plugin` array in `opencode.json` — global
(`~/.config/opencode/opencode.json`) or project-level (`<project>/opencode.json`):

```json
{
  "plugin": ["claritykit@git+https://github.com/maxi3777/claritykit.git"]
}
```

Restart OpenCode. The plugin registers all nine skills through OpenCode's plugin manager
(no symlinks, no skills config) and best-effort symlinks the `clarity` CLI into
`~/.local/bin/`.

Pin a version (recommended for teams):

```json
{
  "plugin": ["claritykit@git+https://github.com/maxi3777/claritykit.git#v1.0.0"]
}
```

**Update:** restart OpenCode (re-run after pulling). Some OpenCode/Bun versions cache the
resolved git commit — if an update doesn't appear, clear OpenCode's package cache and
restart OpenCode.

Clear OpenCode's package cache:

```bash
rm -rf ~/.cache/opencode/packages/claritykit@git+https:
```

**Uninstall:** remove the line from `opencode.json`, restart. Optionally remove
`~/.local/bin/clarity` if it points into the plugin cache.

## Fallback: symlink install

```bash
git clone https://github.com/maxi3777/claritykit.git ~/agent-kits/claritykit
ln -s ~/agent-kits/claritykit/skills/* ~/.config/opencode/skills/   # or .opencode/skills/
mkdir -p ~/.local/bin && ln -s ~/agent-kits/claritykit/tools/clarity ~/.local/bin/clarity
```

## Verify

`clarity doctor` passes; the `skill` tool lists the nine claritykit skills.

Windows note: git-backed plugin specs have known issues on some Windows OpenCode builds
(Bun not finding `git.exe`, cache paths). WSL is unaffected. If install fails, use the
symlink fallback with a system-npm `git clone`.
