# Installing ClarityKit

ClarityKit ships as a plugin for many agent harnesses — OpenCode, Claude Code, Codex,
Cursor, ZCode, Devin (closed beta), and any client that loads the
[Agent Plugins](https://agent-plugins.org) open standard — and as a plain skills + CLI
kit for every other agent. Every path installs the same nine skills and the `clarity`
CLI they depend on.

Requirements: **node ≥ 18** and **npm** on the machine. The CLI self-installs its tool
dependencies on first run — no manual `npm install` step.

## Which path is yours?

| Harness | Install | Guide |
|---|---|---|
| OpenCode | `"plugin": ["claritykit@git+https://github.com/maxi3777/claritykit.git"]` in `opencode.json` | [opencode.md](opencode.md) |
| Claude Code | `/plugin marketplace add maxi3777/claritykit` → `/plugin install claritykit@claritykit` | [claude-code.md](claude-code.md) |
| Codex | `codex plugin marketplace add maxi3777/claritykit` | [codex.md](codex.md) |
| Cursor | plugin (Agent Plugins standard) — local, team marketplace, or public marketplace | [cursor.md](cursor.md) |
| ZCode | Settings → Plugins → Add marketplace → `maxi3777/claritykit` | [zcode.md](zcode.md) |
| Devin (closed beta) | `devin plugins install` — loads the Claude-compatible manifest as-is | [devin.md](devin.md) |
| Pi | `pi install git:github.com/maxi3777/claritykit` | [pi.md](pi.md) |
| Any other agent | clone + symlink (always works) | [generic.md](generic.md) |

Each guide documents install, project-level vs global scope, **updating**, and
uninstalling.

## Updating — the CLI travels with the skills

The `clarity` CLI lives in this same repository (`tools/`), so there is no separate CLI
to keep in sync: whatever installed the skills brought the CLI along, and one update
refreshes both. No startup script or hook is involved. After updating the plugin (or
`git pull`-ing a clone), verify:

```bash
clarity version   # prints e.g. `claritykit 2.1.0` — must match the release you expect
clarity doctor    # PASSes "plugin manifests agree on the version" plus env checks
```

The one exception: harnesses whose plugins have **no PATH injection** (Codex, Cursor,
ZCode, Pi) install the CLI separately — `npm install -g github:maxi3777/claritykit` or a
symlink. Those paths re-run that one command on update (or use the symlink form, which
then updates with `git pull` automatically). Details in each guide.

If an update wiped `tools/node_modules`, the CLI wrapper notices and reinstalls the
pinned dependencies automatically on the next run.

## Verify any installation

```bash
clarity doctor    # PASS on all checks
```

Then confirm the agent sees the nine skills: `clarity-flow`, `clarify-direction`,
`clarify-requirements`, `clarify-architecture`, `clarify-behavior`, `clarify-data`,
`clarify-ui`, `clarify-acceptance`, `clarity-preview`.

## Notes

- **The plugin unit is the whole repository.** Individual skill folders reference shared
  files (`references/`, `tools/`) — never copy a single skill directory on its own.
- **PATH caveat:** agents often run non-interactive shells where `~/.local/bin` is not on
  PATH. Claude Code is immune (its plugin `bin/` is injected automatically). Elsewhere, if
  `clarity doctor` reports a PATH FAIL, add `~/.local/bin` to the agent environment's PATH
  or symlink `clarity` into a directory already on PATH (e.g. `/usr/local/bin`).
- Skills instruct the agent to STOP and report — never improvise — when the CLI is missing,
  so a broken install surfaces immediately instead of degrading into hand-rolled process
  management.
