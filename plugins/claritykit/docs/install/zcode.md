# ZCode

ClarityKit ships a native ZCode plugin manifest (`.zcode-plugin/plugin.json`) plus the
Claude-compatible manifests, so the repo installs directly as a ZCode plugin.

## Install

Open a workspace, then **Settings → Plugins → Create → Add marketplace** and point it at
the GitHub repository:

```
maxi3777/claritykit
```

ZCode reads the repo's marketplace manifest and lists the plugin. Click **Install** on
the card — skills register into the workspace immediately (invoke with `/` in the input
box, under the **Skills** group; they can also trigger automatically when relevant).

**The CLI is separate** (ZCode plugins have no PATH injection):

```bash
npm install -g github:maxi3777/claritykit    # installs the `clarity` command from git
```

## Update

1. **Marketplace sources** panel (gear icon above the search box) → **Refresh this
   marketplace**.
2. **Manage installed** → **Check for updates** → update when badged.

ZCode compares the marketplace entry's `version` against the installed plugin's
`version` — every ClarityKit release bumps both, so a refresh + check always offers the
new version. If the CLI was installed via `npm install -g`, re-run that command; then
verify with `clarity version`.

## Fallback: local directory marketplace

If GitHub is unreachable or you want a pinned clone: clone the repo anywhere, then
**Create → Add marketplace** pointing at the clone directory (ZCode accepts local
marketplace paths). Update = `git pull` + refresh the marketplace.

## Verify

`clarity doctor` passes; `/clarity-flow` appears under **Skills** in the `/` menu.
