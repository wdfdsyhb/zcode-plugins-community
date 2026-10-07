---
name: clarify-behavior
description: Pin down a module's behavior before implementation — scenario episodes, a YAML statechart for complex behavior, hand-crafted diagram views for user approval, acceptance criteria content. Invoke ONLY when the user names clarify-behavior or clarity-flow enters the behavior step; never self-activate from talk about features or flows.
---

# clarify-behavior — behavior you can approve before code exists

Called when a module's behavior is fuzzy. Produces ClarityKit artifacts under
`docs/clarity/behaviors/<name>/` (scaffold with `clarity init <name>` — names are
lowercase, digits, hyphens): **scenario episodes**, `behavior.yaml` (complex modules),
diagram views, and acceptance criteria *content* for the governing workflow's spec/plan
files.

## Scenario episodes first (both tiers)

Before any model or diagram: 3–6 concrete episodes, each with a named (fictional) user,
real-ish inputs with real numbers, and a specific outcome — the happy path plus the 2–3
most informative unhappy paths (empty state, mid-operation failure, malformed input).
**Every unhappy path has a DECIDED recovery, not a described one** — "the system shows
an error" is not a decision; "Kayla sees which row failed and keeps rows 1–11" is.
Measurable constraints ("responds within ~2s") live inside the scenarios, not in a
separate NFR table. Scenarios are the input contract for architecture (behavior-first
order) and the review medium the user actually judges.

## Which tier does this module need?

- **Complex interactive behavior** (multiple states, async work, failure/retry/cancel
  paths, guarded branching) → build the YAML behavior model. It pays for itself:
  machine-checkable (dead ends, missing failure paths), drives UI prototypes, gives
  acceptance its coverage list.
- **Simple behavior** (pure display, one-shot command, linear flow) → skip the YAML; a
  hand-crafted `flowchart` or short state diagram plus criteria is enough. Say which
  tier you chose and why.

## The source-of-truth rule (YAML tier)

`behavior.yaml` is the machine contract. Two kinds of diagrams live beside it, with
different jobs:

- **Machine views — generated, mandatory.** Run `clarity render
  docs/clarity/behaviors/<name>/behavior.yaml` immediately after `clarity validate`
  succeeds, and re-run it after **every** YAML edit. It writes
  `generated-diagrams/overview.mmd` (events + guards — the completeness baseline:
  every state, every transition, what the user reviews coverage against) and
  `generated-diagrams/detailed.mmd` (edges carry actions, states carry
  entry/exit/invoke notes — the debugging and derivation view). They are mechanical
  full renders: publish them as-is, never hand-edit them. In the preview site they
  nest under the module's page (a separate sub-page linked from it).
- **Hand views — selective, decision-driven.** Diagrams you design for the user's
  decision; never a mechanical field-dump, never the full machine. **Views subtract,
  never rearrange**: you may drop states/transitions/guards/actions and collapse a
  composite into one node, but you may not move a state into a different group or add
  structure the model doesn't have. If the honest topology looks bad, fix the model —
  not the view. If a view and the YAML disagree, fix one explicitly and say which.

The schema lives in `references/behavior-model-schema.md` (two levels up). Read it
before writing your first model.

## Diagrams

| Diagram | Status | Trigger |
|---|---|---|
| behavior overview view (`stateDiagram-v2`, states + labeled transitions) | **necessary** | state-like behavior (a state machine exists) |
| happy-path flow view (`flowchart`, the main scenario as a linear process, ≤ ~10 nodes, decision-free where possible) | **necessary** | state-like behavior — companion to the state view: the same main scenario readable as steps, for readers who think in flows rather than states |
| process flowchart | **necessary** | simple/process-like behavior (no state machine) — this IS the overview |
| failure-path view (only non-happy paths, guards shown) | conditional | the model contains async work or failure/retry/cancel paths |
| decision tree (`flowchart`, condition nodes phrased as questions) | optional | rule-dense branching (validation chains, rule engines); > ~15 leaves → a decision TABLE instead |
| module map (hand-drawn `flowchart` of how sub-behaviors relate) | optional | the behavior splits into sub-modules |
| single-scenario `sequenceDiagram` | optional | one tricky user ↔ system ↔ external sequence must be verified |

Optional diagrams pass the "which decision does this force" test when proposed; default
≤ 2 per module. Size limit (hand views only — machine views are exempt, completeness
is their job): > ~10 states or > ~15 transitions in one view → split (composite
collapse, scenario split, or sub-modules). **If a hand view drifts toward the full
machine — every state plus every transition — stop**: completeness belongs to the
generated machine views; a hand view exists to force one decision. `clarity check`
warns on oversized hand views and on missing/stale machine views.

## Method

1. **Write the scenario episodes** (above); batch questions about gaps you cannot
   reasonably default. Archive the episodes at the top of `views.md` — acceptance
   re-reads them later.
2. **Draft the behavior model** (YAML tier): states, events (with sources), guards,
   actions, actors. Cover unhappy paths: failure, retry, cancel, empty input, offline.
   **Give every event and state a `label` in the user's language** — views display
   labels, not raw ids.
3. **Validate, then render the machine views** (YAML tier):
   `clarity validate docs/clarity/behaviors/<name>/behavior.yaml`.
   Fix every error; resolve every warning (resolve = fix it in the model; when a warning
   is genuinely acceptable, escalate = surface it to the user with your recommendation
   and record the outcome — never drop it silently). Then
   `clarity render docs/clarity/behaviors/<name>/behavior.yaml` →
   `generated-diagrams/overview.mmd` + `generated-diagrams/detailed.mmd`
   (see the source-of-truth rule). Both go into the preview via `clarity publish`.
4. **Design the views** per the table above — ask: what decision is the user making
   right now? Then draw the smallest set that supports it.
5. **Verify + publish.** Every published diagram carries `%% title:` (+ `%% caption:` /
   `%% group:` when useful). `clarity publish` (check-then-build) — repair loop max 3
   iterations on check failures, then show the user the raw error.
6. **Iterate until the user explicitly approves the behavior.** Behavior changes always
   go through the YAML first, then views are redrawn.
7. **Emit acceptance criteria content** — one Given/When/Then per transition (YAML tier)
   or per branch (light tier) — plus the scenario episodes, for the governing workflow
   to file in its spec/plan.

## Modifying existing artifacts

`behavior.yaml` is the source of truth; views and prototypes are derived from it.
Change order: edit the YAML → `clarity validate` → `clarity render` (refresh the
machine views) → redraw affected hand views → `clarity publish` → update any
prototype. Never hand-patch a view to diverge from the model, and never hand-edit a
generated machine view.

## Paths (derived, never chosen)

All artifacts live in the staging dir (`clarity root`); create the module directory
with `clarity init <name>`. All tools via the `clarity` CLI; if not found, retry
once after `export PATH="$HOME/.local/bin:$PATH"`, then stop and report — never
improvise alternatives.

## Presentation contract

Everything the user needs to DECIDE appears in the conversation: the scenario
walkthrough (especially unhappy paths), the edge cases you found, the questions. Never
"see the md file for details". Refer to diagrams by their exact browser titles.

## Quality bar

- Every user-observable outcome of every event is modeled (no "and then magic happens").
- Every `invoke` has `onError`; long-running states have a cancellation path.
- Guards/actions are named semantics, never expressions.
- Every unhappy-path scenario has a decided recovery the user approved.
- Criteria cover 100% of transitions/branches, including failure and cancel paths.
