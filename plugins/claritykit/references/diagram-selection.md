# Diagram Selection Guide

Choosing the right Mermaid diagram for the decision being made. Diagrams are **views
for human review** — every diagram must force a specific decision; a diagram nothing
contradicts is decoration and gets deleted.

## Golden rules

1. **One decision, one diagram.** Each diagram helps the user make exactly one
   decision. Default to 1–2 key diagrams per document; more means you haven't isolated
   the decision.
2. **Name the decision a diagram forces.** Necessary diagrams force the step's core
   decision; optional diagrams force a specific side decision (see triggers below).
   If you can't name it, don't draw it.
3. **Diagrams are views, not dumps.** Never render every field of a model. Conceptual
   view for the user; field-level detail for the implementer (derived, not duplicated).
4. **Per-module choice.** In multi-module work, each module chooses its own optional
   diagrams (and whether it needs the heavy tier at all). Default ≤ 2 optional
   diagrams per module; more only if the user asks.
5. **Always deliver via the preview site** — `clarity publish` (check-then-build) with
   `%% title:` (+ `%% caption:` / `%% group:`) directives; verification failures block
   the build.
6. **Size limits:** > ~10 states / ~15 transitions / ~12 entities / ~20 stories in one
   view → split (by domain, by scenario, by composite collapse) or switch to a table.
   Splitting is the remedy, not layout tweaking.

## The ClarityKit diagram set (stage × diagram)

### direction (clarify-direction)

| Diagram | Status | Trigger | Watch out |
|---|---|---|---|
| impact map (`flowchart TD`: goal → actors → behavior shifts → deliverables) | optional | the direction itself is contested — the map must ARGUE for it | an impact map on an agreed direction is ceremony; skip |

No necessary diagrams — this stage's artifact is prose. Boxes this early are premature
commitment.

### requirements (clarify-requirements)

| Diagram | Status | Trigger | Watch out |
|---|---|---|---|
| scope `mindmap` (root = goal, level 1 = capability areas) | necessary | always | 3–4 levels max; details collapse into the brief text |
| story map (`flowchart LR`, TB subgraphs = activity columns, priorities labeled) | optional | decompose + prioritize to pick an MVP | flowchart approximation is rough; > ~20 stories → plain table |
| priority `quadrantChart` | optional | > 5 competing items AND two axes dominate | ≤ ~10 points (more = unreadable); coordinates are estimates 0–1, not measurements; > 2 criteria → table |

### architecture (clarify-architecture)

| Diagram | Status | Trigger | Watch out |
|---|---|---|---|
| layered `flowchart` per candidate (subgraphs per boundary) | necessary | always | — |
| critical-flow `sequenceDiagram` | necessary | leading candidate at minimum | one scenario per diagram; happy path and failure paths are SEPARATE diagrams |
| system context `flowchart` (whole system = one box; actors/externals around) | conditional | external systems/integrations exist | draw once, before candidates — it frames them all |
| deployment `flowchart` (subgraphs = zones) | optional | multi-machine/cloud actually planned | approximate topology; cloud-native detail belongs elsewhere |

### behavior (clarify-behavior)

Pick ONE path through the table by tier — state-like modules draw the first two;
process-like modules draw the third:

| Diagram | Status | Trigger | Watch out |
|---|---|---|---|
| behavior overview view (`stateDiagram-v2`) | necessary | state-like behavior (a state machine exists) | states + labeled transitions only; hide technical detail |
| happy-path flow view (`flowchart`, main scenario as a linear process) | necessary | state-like behavior — companion to the state view, for readers who think in steps | ≤ ~10 nodes, decision-free where possible |
| process `flowchart` | necessary | process-like behavior (no state machine) — this IS the overview | — |
| failure-path view | conditional | async / failure / retry / cancel paths exist | guards shown; happy path omitted |
| decision tree (`flowchart`, condition nodes as questions) | optional | rule-dense branching | > ~15 leaves → decision TABLE instead |
| module map (`flowchart`) | optional | module splits into sub-modules | — |
| single-scenario `sequenceDiagram` | optional | one tricky user↔system↔external sequence | — |

### data & contracts (clarify-data)

| Diagram | Status | Trigger | Watch out |
|---|---|---|---|
| conceptual entity diagram (`erDiagram`, NO attribute blocks, user-language entity names + quoted relationship labels) | necessary | the system persists anything (interface-only systems: optional) | the USER reviews this one; > ~12 entities → split by domain |
| field-level `erDiagram` (PK/FK/attributes) | necessary | persistence exists | derive from contracts.yaml; quoted relationship labels |
| API endpoint map (`flowchart`: gateway → modules → routes) | conditional | external/cross-boundary API exists | endpoints + purpose only; field detail lives in contracts.yaml |
| cross-boundary `sequenceDiagram` | conditional | external integration with failure/retry semantics | decides timeout, retry, idempotency, dead-far-end UX |
| information-flow `flowchart` (info class → source → storage → visibility) | optional | privacy / local-first / sync decisions | ER cannot express visibility — this is the only view that can |
| `classDiagram` | optional | complex IN-MEMORY domain logic | for storage shape use ER, not class diagrams |

### ui (clarify-ui)

| Diagram | Status | Trigger | Watch out |
|---|---|---|---|
| `journey` | optional | judging experience ACROSS modules/stages | scores are integers 0–5 and force honest UX thinking; one journey per persona |

### Readability craft for state views (hand views)

A state view that parses is not a state view that reads. The failures look like:
fan-in spaghetti around one hub, edge crossings from box-in-box clustering, labels
longer than the edges. Craft rules:

- **Hub states (≥ ~4 incoming edges)**: don't draw the fan flat. Group the sources
  (composite block, mirroring the model's own grouping) or split the view — the
  failure-path view exists exactly for this.
- **Back-and-forth pairs** (retry, confirm) are fine in isolation; a *chain* of them
  means you're redrawing the whole machine — that's the generated machine view's job.
- **Views subtract, never rearrange.** You may drop states/transitions/guards/actions
  and collapse a composite to one node; you may NOT move a state into a different
  group or invent structure. If the honest topology looks bad, fix the model.
- **Declare in narrative order** — initial → main flow → outcomes → failure →
  recovery. Declaration order drives layout order in mermaid.
- **Edge labels stay short** (≤ ~6 characters ideal); guards in brackets. If a label
  needs a sentence, the transition is probably two.

## Excluded from ClarityKit practice (with reasons — do not reintroduce casually)

- `gantt`, `timeline`, `gitGraph`, CI/CD `flowchart`, package/module-structure diagrams —
  project-management and delivery-engineering artifacts; they force no design decisions
  for a human+AI pair and rot fastest.
- `requirementDiagram` — traceability matrices serve org-boundary trust (outsourcing,
  audit); in a two-party conversation the trace already exists in flow.yaml +
  cross-checks. Also: no CJK support, brittle parser constraints.
- `sankey-beta` — needs real volume statistics; design phase has none.
- `xychart-beta` — option comparison with > 2 criteria is a table; fake quantified
  scores imply precision that doesn't exist.
- `quadrantChart` inside architecture — same reason; comparison table wins.

If the user explicitly asks for one of these, that is their call — draw it, but note
the trade-off once.

## Authoring tips per type

- **stateDiagram-v2**: label transitions with the event label only in overview; add
  `[guard] / action` in detailed views. Composite states hide sub-behavior in overviews.
- **flowchart**: top-to-bottom for processes; decision nodes phrased as questions;
  subgraphs for lanes/boundaries; unique subgraph ids when referenced by edges.
- **sequenceDiagram**: participants ordered user → frontend → system → external; one
  scenario per diagram; `alt`/`else` sparingly, never nested > 2.
- **erDiagram**: entity names may be the user's language (verified on the pinned
  mermaid); ALWAYS quote relationship labels; attribute blocks only in field-level ER.
- **mindmap**: indentation defines hierarchy; root is plain text or cloud `root)text(`
  — never circle `root((text))` (label renders offset from the circle on the pinned
  version; parses clean, so check cannot catch it); child shapes `id[text]` safe.
- **journey**: sections = stages; one per persona; scores 0–5.
- **quadrantChart**: axis labels quoted; ≤ ~10 points; remember coordinates are
  judgments, not data.
