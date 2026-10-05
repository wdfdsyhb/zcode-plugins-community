---
name: zcode-best-practices-en
description: English guide for ZCode best practices and diagnostics (diagnosing). Skill writing, efficient usage, troubleshooting guide, symptom → cause → solution mapping. Use whenever best practice, diagnose, diagnostics, troubleshoot, troubleshooting, skill not triggering, MCP not connecting, command not working, hook not triggering, or plugin not installing is mentioned.
---

# Best Practices and Diagnostics

## ZCode Usage Best Practices

### 1. Write the Description Right

The description is the skill's **primary triggering signal**. Both *what* it does and *in what context* belong here. Models tend to under-trigger, so write descriptions **pushy**.

### 2. Use Progressive Disclosure

- Keep metadata (name + description) short
- Keep the SKILL.md body **under 500 lines**
- Split details into `references/`, tell the model when to read them

### 3. Test the Draft, Iterate

Try 2-3 **realistic test prompts** — with concrete file paths, column names, even typos. Review outputs with the user.

### 4. Stay Lean

If a skill makes the model do busywork (re-reading files, writing throwaway scripts), that's a sign of **over-prescription**. The fix is to cut, not to add more rules.

### 5. Generalize from Feedback

The skill must work on inputs neither of you has seen. If a stubborn overfit rule resists, try a different framing or metaphor instead of layering more constraints.

### 6. Location Choice

| Need | Location |
|------|----------|
| Personal, all projects | `~/.agents/skills/` |
| Team/project shared | `<repo>/.agents/skills/` |
| Shared across tools | `~/.agents/skills/` |
| Override (ZCode only) | `.zcode/skills/` |

---

## Diagnostics

When an extension resource isn't working, ZCode ships diagnostic skills with a symptom → cause → check → fix workflow.

### Symptom → Skill Mapping

| Symptom | Diagnostic Skill |
|---------|-----------------|
| Skill not discovered / not triggering / shadowed | `diagnosing-skills` |
| MCP server not connecting / tools missing | `diagnosing-mcp` |
| `/command` missing, overridden, erroring | `diagnosing-commands` |
| Hook not triggering, script not running | `diagnosing-hooks` |
| Plugin not listed, failing to install | `diagnosing-plugins` |

### Common Issues and Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Skill doesn't trigger | Weak description | Make description pushy; add context/trigger words |
| Wrong skill loads | Higher-precedence shadow copy | Check `.zcode/skills` shadow copy |
| Context bloats | All details in SKILL.md | Move to `references/` |
| Model writes scripts repeatedly | Helper reinvented each time | Put permanent script in `scripts/` |
| Update not working | Plugin cache read-only | Copy to `~/.agents/skills/` |

### Configuration Sources (User vs Workspace)

| Resource | User scope | Workspace scope |
|----------|------------|-----------------|
| Skills | `~/.zcode/skills/`, `~/.agents/skills/` | `<repo>/.zcode/skills/`, `<repo>/.agents/skills/` |
| Commands | `~/.zcode/commands/` | `<repo>/.zcode/commands/` |
| MCP | `~/.zcode/cli/config.json` → `mcp.servers` | `<repo>/.zcode/config.json` → `mcp.servers` |
| AGENTS.md | `~/.zcode/AGENTS.md` | `<repo>/AGENTS.md` |

### Conflict Rules Summary

- **Skills:** First found wins (user scope takes priority)
- **Commands:** First match wins, duplicates ignored
- **MCP:** User overrides workspace
- **AGENTS.md:** User first, then workspace; workspace narrows/overrides
