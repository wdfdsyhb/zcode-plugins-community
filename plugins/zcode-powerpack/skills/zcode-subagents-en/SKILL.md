---
name: zcode-subagents-en
description: English guide for ZCode Subagents. General-purpose subagent, Explore (read-only search), custom subagent creation (Beta), launching via Agent tool, foreground/parallel execution. Use whenever subagent, general-purpose, Explore, custom subagent, Agent tool, parallel research, or isolated context is mentioned.
---

# Subagents

A subagent is a specialized agent that the primary Agent launches to handle work in its own **isolated context**, then summarizes results back into the main conversation. ZCode ships with built-in `general-purpose` and `Explore` subagents.

## Built-in: General-Purpose

The default built-in subagent. **Has access to all tools.** Good fit when the primary Agent needs an isolated context that can read, edit, run commands, or carry a self-contained piece of work forward.

**Good tasks:**
- Implementing a small feature or fixing a clear issue independently
- Organizing files, running verification commands, reporting results
- Splitting parallel documentation/code/config work into a separate task

## Built-in: Explore

A **read-only** file-search and codebase-research specialist for broad code search, call-chain investigation, architecture discovery, and evidence gathering.

**Rules:**
- Does not create, modify, move, or delete files
- Uses read and search tools (file reading, file name matching, regex search)

**Good tasks:**
- Finding where a capability is implemented
- Mapping module entry points, call chains, key dependencies
- Researching related code and risks before changes
- Searching across multiple directories/naming patterns in parallel

**Usage:** Ask for it directly in your prompt:
> "First use Explore to research this module's call chain, then summarize the main entry points and risks."

## Custom Subagents (Beta)

> Beta — User-level custom subagents are rolling out. Capability and scope may change.

Create your own subagents from **Settings → Subagents**. Package a reusable role (a reviewer, test writer, docs researcher) with its own model, tool permissions, and instructions.

### Creation

1. Settings → Subagents → **New** (top-right)
2. Fill in: name, color, model, description, available tools, system prompt
3. Save — ZCode writes it to `~/.zcode/agents/<name>.md`
4. The Agent runtime loads it on the next run

### Usage

Once enabled:
- Let the Agent pick it automatically
- Reference it with `@` in the chat box

### Limits

- **User-level only:** Global under `~/.zcode/agents/`. Workspace/project-level not available yet
- **Built-in roles are read-only:** `general-purpose` and `Explore` cannot be edited/deleted; their names cannot be reused
- **Foreground execution:** Several launched together run in parallel; the main task waits for them. Background execution not enabled yet
