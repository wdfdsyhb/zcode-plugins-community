# Cursor

ClarityKit packages as an [Agent Plugins](https://agent-plugins.org) standard plugin —
a root `plugin.json` + `skills/` — which Cursor loads natively alongside its own plugin
format. No Cursor-specific manifest is needed.

## Install

The public Cursor Marketplace listing is pending review; until it appears, use the local
path (works on every plan) or a team marketplace (Teams/Enterprise):

**Local plugin (recommended for now):**

```bash
git clone https://github.com/maxi3777/claritykit.git ~/agent-kits/claritykit
mkdir -p ~/.cursor/plugins/local
ln -s ~/agent-kits/claritykit ~/.cursor/plugins/local/claritykit
```

Restart Cursor (or run **Developer: Reload Window**). The skills appear in
**Customize → Agent Decides** and can be invoked with `/clarity-flow`, `/clarify-behavior`,
… in chat.

**Team marketplace (Teams/Enterprise):** Dashboard → Plugins → Add Marketplace — import
the GitHub repo, and the plugin installs for the team (Default Off / Default On /
Required modes available).

**The CLI is separate** (Cursor plugins have no PATH injection):

```bash
npm install -g github:maxi3777/claritykit    # installs the `clarity` command from git
# or, pointing at the clone above (then it updates with git pull):
ln -s ~/agent-kits/claritykit/bin/clarity ~/.local/bin/clarity
```

## Update

- Local plugin: `git pull` in the clone — plugin content and (with the symlink CLI) the
  CLI itself update in one step.
- Team marketplace: **Refresh** in the marketplace panel (or enable Auto Refresh).
- If the CLI was installed via `npm install -g`: re-run that command.
- Verify: `clarity version` prints the expected release.

## Fallback: plain skills directories

Loading the skills without the plugin wrapper still works:

```bash
ln -s ~/agent-kits/claritykit/skills/* ~/.cursor/skills/     # global
# or: ln -s ~/agent-kits/claritykit/skills/* .cursor/skills/  # project-local (commit to share)
```

`~/.cursor/skills/` (or `.cursor/skills/`) discovery predates plugins; everything else
(CLI install, verification) is identical.

## Verify

`clarity doctor` passes; `/clarity-flow` appears as a skill command in chat.
