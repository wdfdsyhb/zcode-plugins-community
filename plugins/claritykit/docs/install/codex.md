# Codex (experimental)

Codex's plugin marketplace is newer than the other agents' — this packaging works with the
current format but is marked experimental; the [symlink fallback](#fallback-symlink-install)
is the stable path.

## Marketplace install

```bash
codex plugin marketplace add maxi3777/claritykit
```

Then open the plugin browser (`/plugins`) and install `claritykit` from the `claritykit`
marketplace. (Repo-scoped equivalent: this repo's `.agents/plugins/marketplace.json` makes
the plugin visible to anyone who opens the repo in Codex.)

**The CLI is separate** (Codex plugins have no PATH injection):

```bash
npm install -g github:maxi3777/claritykit    # installs the `clarity` command from git
```

**Update:** bump the plugin version (done per release) and reinstall/update from the
plugin browser — Codex keys its plugin cache on the version field.

## Fallback: symlink install

```bash
git clone https://github.com/maxi3777/claritykit.git ~/agent-kits/claritykit
mkdir -p ~/.agents/skills
ln -s ~/agent-kits/claritykit/skills/* ~/.agents/skills/
npm install -g ~/agent-kits/claritykit       # or: ln -s ~/agent-kits/claritykit/tools/clarity ~/.local/bin/clarity
```

Codex follows **symlinked skill directories** (link the directory, not the SKILL.md file).
`~/.agents/skills/` is also read by Cursor — one install serves both.

## Verify

`clarity doctor` passes; `/skills` (or `$`) lists the nine claritykit skills.
