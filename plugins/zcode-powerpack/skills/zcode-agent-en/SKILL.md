---
name: zcode-agent-en
description: English guide for the ZCode Agent (primary agent). Default agent, execution modes, AGENTS.md project instructions, workspace entry, adding context, and workflow suggestions. Use whenever ZCode Agent, agent, execution mode, plan mode, auto edit, full access, AGENTS.md, workspace, context, model picker or shift+tab is mentioned.
---

# ZCode Agent Guide

ZCode Agent is the default, self-developed primary agent in ZCode and the main entry point when creating a new task. It is deeply optimized for the GLM-5.2 model family.

## Workspace Entry

ZCode Agent natively understands the workspace, task list, file references, model picker, execution modes, and Git branch state.

Symbols you use in the input box:
- **`@`** → reference a file
- **`/`** → invoke a command
- **`$`** → invoke a skill
- **`#`** → link a past conversation

## Adding Context

The **`+`** button at the bottom-left of the input box lets you:
- Upload attachments / reference files
- Link past conversations
- Run commands

**Tip:** Describe the goal first, then add precise context with `@`, `#`, `/`, `$`. This order helps the Agent understand and complete the task faster.

## Project Instructions File (AGENTS.md)

For persistent instructions, use an `AGENTS.md` file. ZCode reads it at task start.

| Source | Path | Scope |
|--------|------|-------|
| User global | `~/.zcode/AGENTS.md` | Personal defaults for every workspace |
| Workspace | `<repo>/AGENTS.md` | Project-specific rules, version-controllable |

**Merge:** User global loads first, then workspace instructions. Workspace instructions are treated as the primary project source.

**Important:** `CLAUDE.md` is not continuously read at runtime; it's only used as a one-time migration source during onboarding. Copy existing content into `AGENTS.md`.

### What to put in AGENTS.md?
- Project stack, directory structure, important modules
- Code style, naming rules, validation commands to run before completion
- High-risk files, production configuration, permission-sensitive operations
- Collaboration preferences (plan first, avoid unrelated refactors)

## Execution Modes

Execution modes control whether the Agent plans first or proceeds more automatically.

Cycle modes with **Shift + Tab**.

| Risk level | Recommended mode | Description |
|------------|------------------|-------------|
| Critical file/command | Plan Mode / Confirm Before Changes | Plan first, then confirm |
| Routine edits | Default Mode | Standard flow |
| Clearly scoped task | Auto Edit / Full Access | Minimal interruption |

## Workflow Suggestions

1. **State the goal first:** Tell the Agent what to implement/fix/analyze. For long tasks, use Goal Mode.
2. **Add context:** `@` key files; attach screenshots, docs.
3. **Commands and skills:** Use `/` commands and `$` skills for repeatable work.
4. **Mode by risk:** Plan Mode for critical work, Auto Edit for routine.
5. **Stay continuous:** Keep asking follow-ups, adding constraints, reviewing changes in the same task.
