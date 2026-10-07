# Releasing ClarityKit

Version discipline matters because plugin caches key on it: Codex's plugin cache keys on
the `version` field, ZCode offers updates only when the marketplace entry version bumps,
and OpenCode/Bun pin the resolved git commit. A release with a stale version string
silently ships old content to users who "updated".

## Checklist

1. Bump the version in **all six files / eight slots** (they must match):
   - `package.json` → `version`
   - `plugin.json` (root, Agent Plugins standard — Cursor) → `version`
   - `.zcode-plugin/plugin.json` → `version`
   - `.claude-plugin/plugin.json` → `version`
   - `.claude-plugin/marketplace.json` → `plugins[0].version` and `metadata.version`
   - `.codex-plugin/plugin.json` → `version`

   `clarity doctor` fails on any mismatch (check #1) — run it before tagging.
2. Sanity-run: `node tests/test-plugin-entry.mjs` (OpenCode plugin loads via `main`;
   also asserts all manifest slots agree), `node tests/test-negative.mjs` (negative
   fixtures), `node tests/test-preview-js.mjs` + `node tests/test-preview-dom.mjs`
   (preview client), `clarity doctor`, `clarity status`, and the examples regression
   (`clarity validate examples/behaviors/save-bookmark/behavior.yaml`,
   `clarity validate examples/data/contracts.yaml`, `node tools/check.mjs examples`,
   `node tools/preview.mjs examples`).
3. Commit, then tag: `git tag vX.Y.Z && git push --tags`.
   OpenCode pins via `#vX.Y.Z`; Claude Code marketplace updates follow the repo default
   branch; Codex/ZCode users update via their plugin browsers after the version bump;
   Pi users move their pin (`pi install git:github.com/maxi3777/claritykit@vX.Y.Z`);
   Devin sessions pick up the default branch automatically.
4. If tool dependencies changed: `cd tools && npm install` to refresh `package-lock.json`
   (the CLI self-bootstrap uses `npm ci`, which requires an up-to-date lockfile).
5. Cursor public Marketplace (one-time, then per-release): submit/update the listing at
   cursor.com/marketplace/publish — every listing update is manually reviewed. Until the
   listing exists, users install via `~/.cursor/plugins/local` or a team marketplace
   (see docs/install/cursor.md).

## Notes for users updating

The `clarity` CLI ships inside the plugin/clone (`tools/`), so it updates together with
the skills on every path — verify with `clarity version` after updating. Harnesses whose
plugins have no PATH injection (Codex, Cursor, ZCode, Pi) installed the CLI separately
(`npm install -g github:maxi3777/claritykit` or a symlink) and re-run that one command
— symlink installs update with `git pull` automatically. Details: docs/install/README.md.

- **OpenCode:** restart; if the old version persists, clear the plugin/package cache.
- **Claude Code:** `/plugin marketplace update claritykit`, restart.
- **Codex / ZCode:** update from the plugin browser (ZCode: refresh the marketplace
  first — updates are offered only when the marketplace entry version bumps).
- **Cursor:** team marketplace → Refresh (or Auto Refresh); local install → `git pull`.
- **Devin:** merging to the default branch is the release; new sessions pick it up.
- **Pi:** `pi update --extensions`, or move the pin with `pi install git:…@vX.Y.Z`.
- **Symlink/generic installs:** `git pull` is enough.
