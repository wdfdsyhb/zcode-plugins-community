---
description: Token Meter — show or control the floating window with live output speed (tokens/sec) and prompt-cache hit rate
argument-hint: [status|start|stop|toggle]
allowed-tools: Bash
---

Run the Token Meter control script and report its output:

```
powershell -NoProfile -ExecutionPolicy Bypass -File "${CLAUDE_PLUGIN_ROOT}\scripts\meter.ps1" -Action "$ARGUMENTS"
```

When `$ARGUMENTS` is empty the script defaults to `status`.

Reply with the command's single-line output only.
