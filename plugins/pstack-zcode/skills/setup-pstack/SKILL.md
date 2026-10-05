---
name: setup-pstack
description: Configure which subagent types pstack uses per role. Detects the agent types available in this session and writes ~/.zcode/pstack-roles.md, an override layer the skills read. Use for /setup-pstack, "configure pstack agents", or changing pstack's subagent choices.
---

# Setup pstack

Write `~/.zcode/pstack-roles.md`, a plain file the pstack skills read on demand, that sets pstack's subagent type per role. The skills read it and fall back to their inline defaults when a line is absent, so this is an override layer, not a requirement.

ZCode runs every subagent on the session model; there is no per-role model choice. What this file configures is the **subagent type** each role fans out to, which is where diversity comes from: a reviewer type reads a diff differently than an architect type or a general-purpose delegate.

## Steps

### 1. Detect available subagent types

Enumerate the `subagent_type` values you can pass to an `Agent` call in this session. The dependable sources, in order:

1. Built-ins always present: `general-purpose`, `Explore`, `code-architect`, `code-explorer`, `code-reviewer`.
2. Types contributed by enabled plugins and declared in this session (pstack itself contributes `poteto-agent` and `comment-sicko`).
3. Agent definitions ZCode scans outside plugins (for example `~/.zcode/cli/agents/`).

Never write a type you have not confirmed exists. A role line pointing at a type the `Agent` tool rejects breaks every delegation that reads it.

### 2. Load current state

The default role-to-type mapping is the shape shown in step 5 below. If `~/.zcode/pstack-roles.md` already exists, read it and treat its values as the current choices. Otherwise start from those defaults.

### 3. Map and confirm

Show every role with its current type, marking any type not in the detected set as needing a choice. Ask whether to accept as-is or change specific roles, offering the detected types as the options. Prefer `AskUserQuestion` over free text. For panel roles (how critics, arena runners, architect runners, interrogate reviewers) the value is a list, and one subagent runs per entry, so the list length sets the fan-out; entries may repeat a type when you want volume over diversity. `arena cross-judge pool` is also a list, and Arena picks one value from it. `swarm workers` is the default type for every worker unless a race or comparison assigns another per arm.

### 4. Validate

Every type written must be in the detected set. If a chosen type is not available, stop and ask again.

### 5. Write the file

Write `~/.zcode/pstack-roles.md`, overwriting the whole file so re-runs stay idempotent. Shape:

```markdown
# pstack per-role subagent choices (overrides skill defaults)

One line per role, `role: type[, type...]`. Delete a line to fall back to the skill default.

feature, refactoring: poteto-agent
bug-fix: poteto-agent
perf-issue: poteto-agent
hillclimb: poteto-agent
judgment and prose: general-purpose
hardest tasks: poteto-agent
how explorer: Explore
how explainer: general-purpose
how critics: code-reviewer, poteto-agent, general-purpose
why investigators: Explore
why synthesizer: general-purpose
reflect tooling: code-reviewer
reflect judgment, divergent, synthesizer: general-purpose
arena runners: poteto-agent, code-reviewer, general-purpose
arena cross-judge pool: code-reviewer, general-purpose
swarm workers: poteto-agent
architect runners: code-architect, poteto-agent, general-purpose
interrogate reviewers: code-reviewer, code-architect, general-purpose
```

### 6. Confirm

Re-read the file you wrote and echo the final table to the user. State the fallback rule (absent line = skill default) and that rerunning `/setup-pstack` is always safe.

### 7. Offer a verification skill (optional)

Check whether the project has a way to drive the real app for proof (a `verify-*` skill, or an existing harness). If not, offer once: "want a project-local verification skill, so agents can drive the app the way a user does and prove changes work? I can generate one with /create-verification-skill." On yes, invoke `/create-verification-skill` (resolves wherever pstack is installed — workspace, user, or plugin). On no, move on without pushing.
