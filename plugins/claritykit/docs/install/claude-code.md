# Claude Code

## Marketplace install (recommended)

The ClarityKit repository is itself a marketplace (`.claude-plugin/marketplace.json` at the
repo root):

```
/plugin marketplace add maxi3777/claritykit
/plugin install claritykit@claritykit
```

The plugin's `bin/` directory is added to the Bash tool's PATH automatically, so the
`clarity` CLI works with zero PATH setup — first run self-installs its tool dependencies.

Skills are namespaced: `/claritykit:clarify-behavior`, `/claritykit:clarity-preview`, etc.

**Update:** `/plugin marketplace update claritykit` (then restart). Marketplace/plugin
versions track git tags; the plugin version is bumped every release.

**Uninstall:** `/plugin uninstall claritykit@claritykit`; optionally
`/plugin marketplace remove claritykit`.

**Scope:** plugins install at user scope (available in every project). For project-only
use, run Claude Code with `claude --plugin-dir <local-checkout>` or use the symlink
fallback at project level.

## Fallback: symlink install

```bash
git clone https://github.com/maxi3777/claritykit.git ~/agent-kits/claritykit
ln -s ~/agent-kits/claritykit ~/.claude/skills/claritykit    # discovered as claritykit@skills-dir
```

or link individual skills (`ln -s ~/agent-kits/claritykit/skills/* ~/.claude/skills/`) plus
the CLI (`ln -s ~/agent-kits/claritykit/tools/clarity ~/.local/bin/clarity`).

## Verify

`clarity doctor` passes inside a git project; `/help` → Custom commands lists the
claritykit skills.
