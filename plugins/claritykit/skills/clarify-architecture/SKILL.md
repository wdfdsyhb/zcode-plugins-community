---
name: clarify-architecture
description: Present 2-3 architecture/stack candidates as layered diagrams, with verified version compatibility and a comparison table, so the user can choose; produces ADR content. Invoke ONLY when the user names clarify-architecture or clarity-flow enters the architecture step; never self-activate from a stack question in passing.
---

# clarify-architecture — architecture options the user can actually judge

Called when stack/framework/dependency or boundary decisions must be made. Produces:
(a) visual option comparisons as ClarityKit artifacts under `docs/clarity/architecture/`,
and (b) ADR *content* the governing workflow files wherever it keeps decisions.

## What differs by flow order

- **behavior-first** (flow default): approved scenarios exist — derive decision points
  FROM them; the architecture must serve the pinned behavior. Cite scenarios when
  justifying candidates.
- **arch-first**: derive decision points from the requirement brief; after the stack is
  chosen, behavior modeling proceeds under its constraints.
- Ad hoc: derive from whatever requirements context exists.

## Diagrams

| Diagram | Status | Trigger |
|---|---|---|
| layered architecture `flowchart` per candidate (subgraphs per boundary: UI / service / data / external) | **necessary** | always, one per candidate |
| critical-flow `sequenceDiagram` | **necessary** | at least for the leading candidate ("leading" = YOUR current recommendation, named as such); per candidate when they differ structurally in how they handle the riskiest scenario |
| system context diagram (`flowchart`: the whole system one box, external actors + external systems around it) | conditional | external systems / integrations exist — draw it ONCE before the candidates; it frames what every candidate must satisfy |
| deployment `flowchart` (subgraphs = zones/nodes) | optional | multi-machine / cloud deployment is actually planned |

Optional diagrams pass the "which decision does this force" test when proposed.

## Method

1. **Derive decision points** from the requirements/scenarios at hand: platform, UI
   framework, state/data layer, persistence, key dependencies. Only decisions the
   requirements actually force.
2. **Form 2–3 candidate stacks**, each a coherent combination covering every decision
   point. Prefer boring, well-tested technology; honor user-stated constraints.
3. **Draw the context diagram** (when triggered), then per candidate the layered
   flowchart + critical-flow sequence.
4. **Compatibility analysis per candidate** — the core value:
   - version compatibility between pieces (**verify current versions with
     `clarity versions <npm-pkgs... gh:owner/repo...>` — one batched call; never trust
     memory for version numbers**. If the call fails (offline, rate limit): say so,
     mark the affected cells "unverified", and ask the user before proceeding)
   - ecosystem maturity / maintenance status
   - platform constraints (OS, runtime, bundle size)
   - license fit when relevant
   - how each candidate handles the hardest requirement
5. **Comparison table** (not a diagram): rows = decision points + compatibility
   findings, columns = candidates — plus your explicit recommendation with a one-line
   reason.
6. **Verify + publish.** Hand-authored Mermaid follows `references/mermaid-safe-syntax.md`
   (two levels up). Every diagram gets `%% title:`; per-candidate diagrams get
   `%% group: <candidate>`. Then `clarity publish` (check-then-build).
7. **The user picks.** Answer questions, revise if new constraints appear — and
   re-run `clarity publish` after any revision so the site matches what was decided.
   Then write the ADR content (structure below). Filing: in a bare conversation write
   it to the fixed handoff destination — `clarity adr` prints the next
   `docs/adr/ADR-NNN-<title>.md` path (numbering automatic; never pick a number
   yourself).

## Modifying existing artifacts

Once the ADR is written it is the record — never rewrite history in candidate docs.
New constraints after the decision: write a follow-up ADR superseding the old one
(link it), rather than editing the original. A not-yet-decided comparison may be
revised freely.

## The collapsed case (small tools)

A single-process, single-user tool with no external integrations does not need
candidates — write a three-line **ownership note** instead: one component owns
everything; state lives at `<where>`; invariants: `<list>`. That note IS this
capability's artifact; say so instead of staging a ceremony.

## Paths (derived, never chosen)

- All artifacts live in the staging dir `<projectRoot>/docs/clarity/` (`clarity root`).
  All tools via the `clarity` CLI; if not found, retry once after
  `export PATH="$HOME/.local/bin:$PATH"`, then stop and report — never improvise
  alternatives.

## Presentation contract

Everything the user needs to DECIDE appears in the conversation: each candidate's
essence, the compatibility findings, the comparison table, and your explicit
recommendation. Never "see the md file for details" — files are archives. Refer to
diagrams by exact browser titles.

## ADR content template

```markdown
# ADR-<NNN>: <decision title>

## Status
Accepted — <date>

## Context
Link to requirements. Decision points. Forces at play.

## Decision
The chosen stack, point by point, with the architecture diagram and the critical
data-flow sequence diagram.

## Compatibility notes
Verified facts this decision relies on (versions checked, dates).

## Alternatives considered
Each rejected candidate + the concrete reason it lost.

## Consequences
What becomes easy, what becomes hard, what we are locked into.
```

## Rules

- Never a single "take it or leave it" option — at least two candidates (or the
  explicitly-recorded collapsed case).
- The user decides; you recommend — explicitly and honestly.
- Diagrams show structure and flow; the table shows comparison; prose shows reasoning.
