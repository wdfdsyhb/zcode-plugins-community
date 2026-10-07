---
name: clarify-ui
description: Build an interactive HTML prototype — a functional shell with real interaction logic, no backend, no visual design — so the user can feel the UX before implementation, and iterate until approved. Invoke ONLY when the user names clarify-ui or clarity-flow enters the ui step; never self-activate from a passing mockup request.
---

# clarify-ui — feel the app before building it

Called when a UI's experience must be judged by using it, not by reading about it. Produces
`docs/clarity/prototypes/<name>/index.html` + `ui-notes.md` in the staging dir (see
Paths), and registers the prototype in the preview site.

## What the prototype is

- A **single self-contained HTML file** (inline CSS/JS, placeholder data, no build step, no
  network calls) that opens straight in a browser — or via the preview server.
- **Behaviorally faithful** to the approved behavior spec: if a `behavior.yaml` exists, every
  state, event, guard-outcome and transition is observable, and the embedded state machine
  mirrors the YAML 1:1 (state names identical). Actors are simulated with timers/promises;
  failures and cancellations must be triggerable (small dev panel: "simulate failure",
  "simulate slow network").
- **Visually neutral**: grayscale, system fonts, boxes and labels. Layout, hierarchy, copy and
  interaction — real. Colors, icons, animation, branding — absent.

## Method

1. **UI interview (batch the questions).** Layout preferences? Navigation pattern? Reference
   apps the user likes? Density? Pet peeves? Record answers in `ui-notes.md`.
2. **Implement the prototype.** One HTML file; states rendered as the UI the user sees in that
   state; controls wired to events; dev panel for actor outcomes.
3. **Publish.** Run `clarity publish` — the prototype appears in the site index alongside
   the diagrams. Works with zero diagrams in the staging dir too (check is vacuously
   green; the site still builds). Never start the server yourself — that's the
   user-invoked `clarity-preview` skill. In conversation, walk the user through which
   flows to try, especially failure, retry and cancel paths — the conversation is the
   guide, the browser is the experience; don't point at files for explanation.
4. **Iterate until the user explicitly approves.** Two kinds of feedback:
   - **Behavioral** ("cancel should keep the file selected") → if a `behavior.yaml` exists,
     change it FIRST, re-validate, redraw affected views, then update the prototype. The model
     stays the source of truth.
   - **Presentational** ("search should be at the top") → change the prototype + `ui-notes.md`.
5. On approval: record it in `ui-notes.md`. What happens next (implementation, and how the
   prototype informs it) is the governing workflow's call.

## Paths (derived, never chosen)

- All artifacts live in the staging dir `<projectRoot>/docs/clarity/` — for this capability,
  `docs/clarity/prototypes/<name>/` (`clarity root` shows the derived root). Never invent
  or negotiate other locations.
- All tools via the `clarity` CLI (never relative tool paths). If missing:
  `export PATH="$HOME/.local/bin:$PATH"`, retry once, then STOP and report — never
  improvise.

## Modifying existing artifacts

The prototype and `ui-notes.md` record presentation decisions; behavioral feedback
goes through `behavior.yaml` first (the model is the source of truth), then the
prototype is updated to match.

## Fidelity checklist (verify before presenting)

- [ ] Every specified state has a distinct, labeled UI representation
- [ ] Every user-sourced event has a working control
- [ ] Every actor outcome (done/error) can be simulated from the dev panel
- [ ] Guard outcomes are demonstrable (e.g. retry limit reached → retry disabled)
- [ ] No real backend calls, no external assets, opens offline
- [ ] Grayscale only

## Optional diagram

A `journey` (cross-module UX review: stages, actions, satisfaction scores — scores
force honest UX thinking) is optional when the user wants to judge the experience
across modules/stages, not just within this prototype. It must force a UX decision;
otherwise skip it.

## Rules

- The prototype is throwaway: production code does not reuse it; it is the layout/interaction
  reference.
- Never let prototype and behavior spec disagree. The spec wins — unless the user decides the
  behavior itself changes (then the spec changes first).

