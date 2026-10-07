---
name: clarify-direction
description: Frame a rough direction into a one-page brief — who the user is, the job and today's workaround, observable success, at least three explicit non-goals — so the project doesn't solve the wrong problem. Invoke ONLY when the user names clarify-direction or clarity-flow enters the direction step; never self-activate from a vague idea.
---

# clarify-direction — make the direction falsifiable

Answers ONE question: **who abandons what current behavior to use this, and to what
observable end?** Not requirements — identity. This is the cheapest stage with the
largest blast radius: everything downstream inherits its conclusions, and skipping it
doesn't defer the decisions, it silently delegates product identity to the
implementation phase.

## Entry / skip

- **Enter** when the idea is a direction ("I want to build X because Y") rather than a
  settled brief.
- **Skip — recorded, never silent** — when the user's opening message already pins
  user, job, non-goals, and what success looks like; or in re-entry mode (new feature
  in an existing designed system), where a 5-line feature brief replaces this stage
  (recorded in the flow's `direction` step note when the flow is active).

## Method

1. **Interview in ONE batch** (skip what the idea already answers): Who is it for —
   specific enough to exclude someone? What do they do today instead (the current
   workaround), and why isn't that good enough? What would "this worked" look like,
   observably, a few months in? What should it deliberately NOT do?
2. **If user + job are fuzzy, offer 2–3 genuinely divergent framings** — different
   users or different jobs, not variations of one guess. The user picking one IS the
   decision this stage exists to force. One polished proposal invites editing;
   divergent options force choosing.
3. **Write the one-pager** (template below) to `docs/clarity/direction/one-pager.md`,
   with its full decision-grade content in the conversation.
4. **Optional diagram — impact map ONLY when the direction itself is contested** (the
   user or you are unsure the project is worth building): a `flowchart TD` arguing
   goal → actors → behavior shifts → deliverables. It must advance that argument; if
   the direction is agreed, an impact map is decoration — don't draw it.
5. **Verify + publish** (shared conventions): if any diagram was drawn, `clarity publish`
   (check-then-build).
6. **Iterate until explicit approval — non-goals item by item.** The non-goals are the
   real decision; the rest is scaffolding for them.

## Modifying existing artifacts

`one-pager.md` is the source of truth for direction. Editing it re-opens the non-goals:
every added/removed non-goal needs explicit user re-approval, and downstream briefs
(requirements, candidates) inherit the change — mention what it invalidates.

## One-pager template

```markdown
# <Name> — Direction

## User
One sentence, specific enough to exclude someone.

## Job & current workaround
What they achieve with this — and what they use today instead, and why it hurts.

## Observable success
"In N months we'd know this worked if ___" — something checkable, not a feeling.

## Non-goals (deliberately NOT solving)
1. ...   2. ...   3. ...   (at least three)

## Why now / biggest risk
One line each.
```

## Quality bar

- The user sentence excludes someone (if it can't, it's too vague).
- ≥3 non-goals, each explicitly accepted by the user.
- Success is checkable in the world, not a sentiment ("users love it" fails).
- The current workaround and its inadequacy are stated (no workaround = adoption risk;
  fine workaround = question the build).

## Shared conventions

Same as all ClarityKit capabilities: derived paths (`clarity root`), presentation
contract (`%% title:` directives, decide in conversation, files archive), `clarity
publish` to verify+publish diagrams. All tools via the `clarity` CLI (never relative
tool paths). If missing: `export PATH="$HOME/.local/bin:$PATH"`, retry once, then STOP
and report — never improvise.
