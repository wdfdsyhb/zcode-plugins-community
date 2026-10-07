---
name: clarity-flow
description: The ClarityKit design flow — activate ONLY when the user explicitly asks for it (mentions clarity-flow / the ClarityKit design flow, in any language; a governing host workflow calling for ClarityKit counts as the ask). Runs standalone or as a clarification sub-flow inside a host workflow's thinking stage (e.g. superpowers brainstorming, planning before an implementation plan). Walks direction → requirements → behavior/architecture (chosen order) → data → ui → commission, judging each step's necessity before entering it, keeping docs/clarity/flow.yaml as the resume point, closing with a signed delegation ledger. Every other ClarityKit skill is invoked the same way — the user names it, or this flow enters its step; none self-activates.
---

# clarity-flow — the explicit ClarityKit design flow

An optional, explicitly-activated flow that composes the ClarityKit toolbox into a
progressive path: from a rough direction to an implementation-ready design. This skill
owns **process** (ordering, necessity judgment, resume state, the closing ledger); the
clarify-* skills own **content**. It never self-activates and never hijacks a plain
design conversation.

## Activation — the only way in

Activate when — and only when — the user explicitly asks for the ClarityKit flow (any
language, any name for it: "use clarity-flow", "walk the ClarityKit stages"). A
governing host workflow whose own instructions call for ClarityKit counts as the
explicit ask. Discussing requirements or architecture without that explicit ask is
NOT activation — answer in plain conversation; no skill runs and no skip ceremony
applies.

On activation, decide three things. These three decisions together cost **at most one
confirmation round** (the defaults usually need none — later steps have their own,
separate interaction points):

1. **Entry mode.**
   - **greenfield** (default): a new product/project. Start at `direction`.
   - **re-entry**: a new feature inside an existing, already-designed system (user says
     so, or the staging dir holds prior approved artifacts). Do NOT redo direction or
     requirements — mark them `given` in flow.yaml, consult existing artifacts read-only
     as constraints, and enter at `behavior` (or `data` when the feature is
     data-shaped). Changes to existing artifacts are additive deltas; mutating existing
     behavior is a back-jump, not an edit.
2. **Middle order.** The two legal orders through the middle are:
   - **behavior-first** (DEFAULT): scenarios pin what the system must do before
     technology shapes it. Use unless the user says otherwise.
   - **arch-first**: the user states it, or hard technology constraints dominate
     (mandated platform, integration that forces the stack).
   If the user did not state a preference, proceed with the default and attach one line:
   "behavior-first chosen by default — say the word if you want architecture first."
3. **Scaffold.** Run `clarity init`, then write `docs/clarity/flow.yaml` (schema below),
   announce the flow in two lines (steps + order + where you're entering), and enter the
   first step immediately. No opening ceremony beyond that.
   In re-entry mode, put the 5-line feature brief (what job, for whom, one non-goal)
   into the `direction` step's `note` so it survives across sessions.
   (Later `clarity init <name>` calls for behavior modules: names are lowercase,
   digits, hyphens.)

## Inside a host workflow — sub-flow mode

ClarityKit's natural habitat is the thinking stage before implementation: requirements
discussion, design brainstorming, or the moment before an implementation plan is
written — frequently inside a host workflow (e.g. superpowers brainstorming, a
spec-driven process, a planning phase). When activated there, this flow runs as a
SUB-FLOW of the host's thinking stage:

- The **host owns the session** — when we enter, when we leave, what happens before and
  after. Never restructure, extend, or shortcut the host's own stages.
- **clarity-flow owns the clarification inside** — steps, artifacts, flow.yaml, the
  closing ledger.
- **Two output layers.** ClarityKit artifacts (diagrams, models, contracts, ADR,
  commission.md) stay in `docs/clarity/` as the design record; the HOST's deliverables
  (its spec, plan, or ticket documents) receive the conclusions. Write the host's
  format as the primary output — never force the host to adopt ClarityKit files.
- **Exit hands upward.** When commission is signed, hand the delegation ledger and
  risk list to the host so its plan absorbs them; announce the SUB-FLOW complete,
  never the host workflow itself.

## The flow

```
direction → requirements → { behavior ⇄ architecture } → data → ui → commission
```

| Step | Skill | Core question | Skip condition (record it — never silent) |
|---|---|---|---|
| direction | clarify-direction | who is this for, what job, what non-goals | user's opening message already pins user, job, ≥3 non-goals, and observable success |
| requirements | clarify-requirements | what does it do, in what priority order | brief already decidable for the next step |
| behavior | clarify-behavior | what happens, end to end, including failure | no user-visible behavior worth reviewing (a pure internal transform). Linear/simple behavior is NOT a skip — run it in light tier (one flowchart + criteria) |
| architecture | clarify-architecture | what are the parts, what stack | stack already fixed / only one viable option. Single-process tools collapse to an ownership note — record the step `done` with the note as its artifact, NOT `skipped` |
| data | clarify-data | what is remembered, what crosses boundaries | stateless AND interface-free |
| ui | clarify-ui | does the UX feel right before we build it | no interactive UI to judge (pure backend, CLI, library, batch job); the prototype skill itself decides depth |
| commission | (this skill — no separate skill) | what did we NOT decide, who decides it | NEVER skippable |

The middle pair (behavior, architecture) runs in the chosen order; `data` follows both,
then `ui`, then `commission`. In re-entry mode, architecture usually records `skipped`
with note "stack fixed by the existing system" — or runs as a delta when the feature
adds a component.

## The step-entry loop (the heart of this skill)

For the next pending step, BEFORE invoking its skill:

1. **Judge necessity** against the skip condition above + the skill's entry criteria.
2. **Necessary → invoke the skill directly.** No permission round-trip. The skill's own
   batched interview already contains the one interaction point where the user weighs
   in — including which optional diagrams to draw (each with your recommendation and
   reason; default at most 2 optional diagrams per module, more only if the user asks).
3. **Want to skip → one batched question**, nothing else in it:
   > I propose skipping **behavior** for this module — it's a one-shot transform with no
   > state. OK to skip? (If we run it, I'd also draw the failure-path view because ___.)
   The user's single reply decides. On confirmation: record `skipped` + one-line reason
   in flow.yaml, move on, never re-litigate.
4. **Per-module granularity (behavior only).** `behavior` is evaluated and entered per
   module — one module may need the YAML tier while another needs a one-diagram light
   tier; different modules may choose different optional diagrams. `data` and `ui` run
   ONCE each, project-level, after the middle pair.

When a step's skill reports user approval: set its status `done`, list its artifacts
(relative to the staging dir), and add a one-line note of what was decided. Then repeat
the loop. **flow.yaml is updated immediately at every status change** — it is the resume
point for any future session.

## Back-jumps — reopen decisions, not stages

When a later step invalidates an earlier conclusion (a scenario no component can own; a
contract that doesn't fit its boundary; an error with no recovery scenario):

1. Name the **specific decision** that flipped, never "redo the stage".
2. Estimate the blast radius ("this invalidates field X and state Y — small touch").
3. Set the CURRENT step back to `pending` (or `done` if its other decisions survive),
   then set the owning step's status to `active` with a note — never leave two steps
   `active` (the validator rejects that). Redo only the invalidated decisions and their
   artifacts; when the redo is approved, re-enter the step you left.
4. **Downgrade valve**: the user may refuse the jump and accept the flaw — then it goes
   on the commission risk list as accepted, and the flow moves on.
5. **Thrash rule**: any decision that flips twice is being made at the wrong layer or
   with missing information — either commission a probe against it or escalate one
   level up (a twice-flipped structure decision is usually a disguised behavior
   decision). This rule is mandatory; it is the anti-loop governor.

## Commission — the terminal step (this skill performs it)

Never skipped, never delegated. Cheap, because it mostly assembles what the flow already
surfaced. Write `docs/clarity/commission.md`:

1. **Delegation ledger** — two lists:
   - the implementing agent may decide autonomously (library choices within constraints,
     internal naming, error message wording, standard UI states, anything inside a
     stated constraint);
   - forces a return to the user (anything touching a contract, a persistent field, an
     unrecoverable transition, a new dependency, a non-goal boundary).
2. **Risk list** — top 3–5 risks as "if we're wrong about X, we redo Y", each with an
   explicit **accept** or **probe** decision. A probe is a targeted spike (one risky
   algorithm, one hostile-input test), never a whole-product prototype.
3. **Consistency sweep** — scenarios ↔ behavior models ↔ contracts ↔ diagrams agree;
   `clarity check` green; every open question is either closed or on the ledger.

Present both lists in the conversation. The user signs off line by line — that signature
is the terminal act. Then: mark commission `done` in flow.yaml and run
**`clarity publish`** once so the site's progress chips show the finished flow
(commission itself produces no diagrams — this closing publish is the only one it
needs), and announce the flow complete. Until the signature lands,
"implementation-ready" is an assertion, not a fact.

## flow.yaml — schema (you maintain it; the CLI validates it)

```yaml
# TEMPLATE — pick ONE value from each a|b|c union; see examples/flow.yaml for a
# filled-in one. The validator errors on the literal union strings.
flow:
  id: <kebab-case>            # project or module scope
  order: behavior-first | arch-first
steps:
  direction:      { status: pending|active|done|skipped|given, artifacts: [...], note: <one line> }
  requirements:   { ... }
  behavior:       { ... }
  architecture:   { ... }
  data:           { ... }
  ui:             { ... }
  commission:     { status: ..., artifacts: [commission.md] }
```

- `artifacts` paths are relative to the staging dir. `given` means settled elsewhere
  (re-entry): consulted read-only, not performed.
- Edit the file directly with your file-editing tool. Every `clarity` command validates
  it and prints problems as `flow.yaml:` lines — repair them promptly (they are usually
  a stale artifact path or a missing note).
- On any session where the flow was previously activated: run **`clarity status`** first
  — one call printing flow progress, the active step with its note, the artifact
  inventory, preview state, and site freshness. Resume from there; do not re-derive
  state by listing directories or reading files one by one.

## Shared conventions (all ClarityKit capabilities)

- **Invocation is explicit everywhere.** Each capability runs only when the user names
  it or a governing flow walks into its step — never self-activated from topic overlap.
  In plain design conversation, answer plainly.
- **Paths are derived, never chosen.** Artifacts live in the staging dir
  `<projectRoot>/docs/clarity/` (run `clarity root`). The ADR is the one handoff
  artifact (`clarity adr` → `docs/adr/`, automatic numbering).
- **Presentation contract.** Decision-grade content lives in the conversation; files
  are archives for future agents. Published diagrams carry `%% title:` (plus
  `%% caption:` / `%% group:` when useful); refer to diagrams by exact browser title.
- Every diagram is verified + published with **`clarity publish`** (check-then-build).
  Never start the preview server yourself — that is the user-invoked
  `clarity-preview` skill.
- All tools run through the `clarity` CLI — never relative tool paths. If `clarity` is
  not found: `export PATH="$HOME/.local/bin:$PATH"` and retry ONCE; still missing →
  STOP and tell the user to finish the ClarityKit install. Never improvise alternatives
  (nohup, setsid, hand-rolled servers).
