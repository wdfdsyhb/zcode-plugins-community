# Devin (experimental — plugins are in closed beta)

Devin's plugin system is in **closed beta** (request access via
[support@cognition.ai](mailto:support@cognition.ai)); this packaging follows the current
documented format and may change with it. Devin loads existing Claude plugins as-is —
it falls back to `.claude-plugin/plugin.json`, which this repo already carries — so
ClarityKit installs without any Devin-specific manifest.

## Install (Devin CLI / local sessions)

```bash
devin plugins install https://github.com/maxi3777/claritykit
devin plugins list
```

Skills are exposed as `/claritykit:clarity-flow`, `/claritykit:clarify-behavior`, …

**Org distribution (optional):** an admin can add the repo to the managed plugin
manifest on Settings → Resources → Plugins as a required or optional plugin source
(`git` URL) — every session in scope then gets it automatically.

**The CLI** needs node ≥ 18 in the session environment (Devin sandboxes have it). In
CLI/local sessions:

```bash
npm install -g github:maxi3777/claritykit
```

In cloud sessions the plugin is fetched per session; install the CLI as a setup step or
let the skills surface the STOP-and-report path when `clarity` is missing.

## Update

Merging to the repo's default branch **is** the release — new sessions pick the plugin
up automatically. For a local/CLI plugin install, re-run `devin plugins install` (linked
installs pick up edits on the next session). The separately-installed CLI follows the
same rhythm: re-run `npm install -g github:maxi3777/claritykit`, then `clarity version`.

## Verify

`clarity doctor` passes; `/claritykit:clarity-flow` is listed among plugin skills.
