---
name: clarity-preview
description: Start, stop, or check the ClarityKit preview server for the CURRENT project (serves the project's diagram/prototype site over http://localhost, survives reboots of the conversation). INVOKE ONLY WHEN THE USER EXPLICITLY ASKS to start/stop/restart the preview server (e.g. "start the preview server", "open the preview"). Never start a server on your own initiative.
---

# clarity-preview — preview server lifecycle (manual only)

One server per project. The server is detached (survives conversation/process-group
termination), registered, and verified. All mechanics live in the `clarity server` command —
never hand-roll `nohup`/`setsid` commands.

**The server takes no directory argument.** Its root is derived, not chosen: it always serves
`<projectRoot>/docs/clarity` where the project root is the nearest ancestor containing
`.git` (fallback: the current directory). You cannot point it at the wrong directory because
you never pass one. Just make sure you run it from somewhere inside the user's project.

## Commands

```bash
clarity server start    # build site, start detached, verify HTTP 200, print URL
clarity server status   # list all registered servers with liveness
clarity server stop     # stop this project's server, free the port
```

- **start** is idempotent: already-running → rebuilds the site and re-reports the URL.
  After a machine reboot, just `start` again.
- Port allocation is deterministic per project root (hash-based, 8400–8799, collision-probed)
  so different projects never collide.
- The registry lives at `~/.claritykit/servers.json` — one entry per project staging dir.

## Rules

- **If `clarity` is not found**: run `export PATH="$HOME/.local/bin:$PATH"` and retry ONCE.
  If it is still missing, STOP and tell the user the ClarityKit CLI is not installed/on PATH
  (see README Install). **Never improvise alternatives** — no nohup, no setsid, no
  hand-rolled `node server.mjs serve`, no relative tool paths. A missing CLI is an install
  problem for the user to fix, not a problem to work around.
- **Only serve the current project.** Run the commands from inside the project the user is
  working in — the derivation does the rest.
- **Verify before reporting.** Only tell the user the URL after the tool confirms HTTP 200 —
  `clarity server start` does this itself; if it reports failure, read the printed log path
  and debug from there.
- If the user says "the preview is gone / can't open", run `status` first, then `start`.
- Artifact updates (`clarity publish` runs by other skills) are picked up live — no
  restart needed; the user just refreshes the browser.
