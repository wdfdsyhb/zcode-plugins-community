---
name: zcode-goal-task-en
description: English guide for ZCode Goal Mode, Task & File Management, and Edit History. /goal command, automatic verification, task views, task groups, file tree, Repo Wiki, message editing. Use whenever goal mode, /goal, objective, task management, task group, file tree, Repo Wiki, edit history, message editing, or /compact is mentioned.
---

# Goal Mode, Task Management and Edit History

## Goal Mode (/goal)

For long-running, complex tasks, set an explicit objective with `/goal`. Once set, the Agent iterates toward the goal: at the end of each iteration it runs **automatic goal verification** — if the goal isn't yet met, it continues with another round, and the task only finishes once the goal is verified.

**Best for:** Work that's easy to state in one sentence but takes many rounds:
- "Refactor the whole module and keep tests passing"
- "Fix all TypeScript compile errors"

### Commands

```
/goal <objective>         Set the session goal
/goal replace <objective> Replace the current goal
/goal pause               Pause the goal
/goal resume              Resume the goal
/goal clear               Clear the goal
```

**Tip:** Make the objective specific and verifiable — e.g. "Fix all TypeScript errors and make pnpm test pass". The clearer the success criteria, the more accurate each round's verification.

### Combine with Execution Modes

Goal Mode works alongside execution modes: the goal defines when work counts as done, the execution mode defines how many actions need confirmation. Pair with Full Access or Auto Edit for long goal-driven tasks.

---

## Task & File Management

As tasks pile up, the left sidebar offers management features.

### Task Views

| View | Description |
|------|-------------|
| **Grouped** | Organize tasks into custom groups (topic, priority, phase) |
| **Workspace** | Keep tasks under their project |
| **Timeline** | Browse recent work in reverse chronological order |

### Task Groups

- **New Group** to create, pick from 7 colors (gray/red/orange/yellow/green/blue/purple)
- Drag-and-drop tasks into groups, or right-click → Move to Group
- Right-click → Ungroup & Delete removes only the group; tasks are kept

### Workspace File Tree

Click the **file tree icon** on a workspace card.

- **Search:** Real-time filter by file name/path
- **Changed files only:** Git-changed files — great for code review/pre-commit
- **Git status markers:** added/modified/deleted/renamed
- **Drag into chat:** Drag a file into chat to insert a reference

**Tip:** Combine "Show changed files only" + "Add to Chat" to feed this round's modified files to the agent.

### Repo Wiki

Repo Wiki at the top of the file tree generates a structured document for the current repository: directory responsibilities, configuration conventions, build/test entry points. Regenerate when the repo changes.

---

## Edit History

Lets you revise messages already sent to ZCode Agent. When an instruction is unclear, missing a path, or needs a different direction, edit the original message **instead of starting over**.

### Usage

1. Hover over your message in the conversation history
2. Click the **pencil icon** on the right
3. Revise the text, add files via `@`, commands via `/`
4. Click **Send** to continue, or **Cancel** to keep the original

**Rules:**
- Only user messages can be edited (not Agent responses)
- Only the last turn's message can be edited
- Editing is unavailable while the task is running

### Common Scenarios

- Correct a requirement (wrong/incomplete instruction)
- Add key context (file path, error log, API parameter)
- Change task direction ("analyze this" → "fix this")
- Avoid repeated setup (keep existing context)
