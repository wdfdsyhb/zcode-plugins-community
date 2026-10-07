---
name: clarify-requirements
description: Sharpen a vague idea into a decidable requirement brief with a scope mindmap (story map / priority quadrant when scope or priorities must be fought out). Invoke ONLY when the user names clarify-requirements or clarity-flow enters the requirements step; never self-activate from fuzzy requirements in conversation. Does not own where requirement documents are saved.
---

# clarify-requirements — make the idea decidable

Called when an idea is too vague to design from. Produces: (a) a requirement brief
whose *content* the governing workflow or conversation owns, and (b) ClarityKit
artifacts under `docs/clarity/requirements/`.

## Depth criterion (the point of this capability)

Done = **sharp enough that the NEXT step is decidable** — in behavior-first order that
means scenarios can be written (users, data shape/volume, offline/online, realtime,
auth, scale, integrations all answered); in arch-first order it means stack selection
is decidable (platform and constraints answered). When both are decidable, you're done.

**Do NOT discuss frameworks or architecture here.** Capture user-raised technology as a
constraint ("user prefers X") and move on — comparison is `clarify-architecture`'s job.

## Diagrams

| Diagram | Status | Trigger |
|---|---|---|
| scope `mindmap` (root = goal, level 1 = capability areas, 3–4 levels) | **necessary** | always — it is the brief's table of contents |
| story map (`flowchart LR` of TB subgraphs: activity columns → prioritized stories, MVP line) | optional | scope must be decomposed AND prioritized to pick an MVP; > ~20 stories → use a plain table instead (the diagram stops being readable) |
| priority `quadrantChart` (2 dominant trade-off axes, ≤ ~10 items) | optional | > 5 competing stories AND two axes genuinely dominate the trade-off — otherwise a table beats it |

Optional diagrams carry the "which decisions does this force" test: name what each one
decides when you propose it. Default ≤ 2 optional diagrams per invocation.

## Method

1. **Ask in batches.** The smallest set of high-leverage questions, batched in one
   message: Who uses it? What does "done" look like? What data does it touch? Offline?
   What must it NOT do? Skip what the idea already answers.
2. **Write the brief content** (structure below) into the conversation or wherever the
   governing workflow keeps requirements. In a bare conversation (no governing
   workflow), also archive the brief — with the mindmap embedded — as
   `docs/clarity/requirements/brief.md`, and list it among the flow artifacts if the
   flow is active.
3. **Draw the scope mindmap**; propose optional diagrams with triggers and your
   recommendation — the user confirms in one reply (in flow mode this rides along the
   step-entry interaction, never a separate round-trip).
4. **Verify + publish.** Write artifacts under `docs/clarity/requirements/`, then run
   `clarity publish` (check-then-build). Follow `references/mermaid-safe-syntax.md`
   (two levels up). Every diagram gets a `%% title:` directive.
5. **Iterate until the user explicitly approves** the brief.

## Modifying existing artifacts

The brief is the source of truth; the mindmap must mirror it 1:1. On any requirement
change: edit the brief first, then the mindmap, then `clarity publish` again. Added
scope items need explicit "in scope" confirmation; removals go to "Out of scope" with
the user's nod — never silently dropped.

## Paths (derived, never chosen)

- ClarityKit artifacts live in `docs/clarity/requirements/` inside the staging dir
  (`clarity root` shows it). All tools via the `clarity` CLI; if missing, retry once
  after `export PATH="$HOME/.local/bin:$PATH"`, then stop and report — never improvise.

## Presentation contract

Everything the user needs to DECIDE appears in the conversation (goal, scope in/out,
key requirements, open questions with defaults). Never "see the md file" — files are
archives. Refer to diagrams by exact browser titles.

## Brief structure (content template)

```markdown
# <Name> — Requirement Brief

## Goal
One paragraph: who achieves what, and why it matters.

## Users & scenarios
Primary personas; the 2–4 core scenarios in one line each.

## Scope
### In scope
### Out of scope (explicit non-goals)

## Functional requirements
Numbered, one observable user behavior each ("the user can …").

## Constraints & non-functionals
Platform, data volume/shape, offline/online, realtime, auth, performance,
integrations, user-stated preferences.

## Open questions & risks
Each with a proposed default, so the user can answer with "ok".

## Scope map
(mermaid mindmap)
```

## Quality bar

- Requirements are observable user behavior, not implementation.
- "Out of scope" is filled in — no non-goals, not shaped.
- The mindmap matches the functional requirements 1:1.
