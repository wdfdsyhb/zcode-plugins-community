---
description: ZCode diagnostics guide - from symptom to solution.
argument-hint: "[describe your issue]"
skills: zcode-best-practices-en
---

Diagnose and resolve the user's ZCode issue. First identify the symptom, then present likely causes and solutions.

**Issue categories and diagnostic skills:**

| Symptom | Diagnosis |
|---------|-----------|
| Skill not discovered/triggering | Check description, verify discovery order, look for shadow copies |
| MCP server not connecting | Check config file, transport type, env variables |
| /command not working | Check frontmatter, overrides, argument substitution |
| Hook not triggering | Check hooks.enabled, event name, matcher, script executability |
| Plugin not listed/installing | Check marketplace source, plugin.json validity, enable state |

**Diagnostic approach:**
1. Clarify the symptom (what was expected, what happened?)
2. List possible causes (most common to least)
3. Provide a check method for each cause
4. Present solution steps in order

User's issue: $ARGUMENTS

If the issue isn't clear, ask clarifying questions first.
