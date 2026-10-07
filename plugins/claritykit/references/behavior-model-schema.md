# Behavior Model Schema v0.1

A behavior model is the **machine contract** for a module's interaction behavior.
It uses statechart semantics (hierarchy, parallel regions, guards, actions, actors) serialized
as constrained YAML, so that it is writable by agents, parseable by tools, and checkable for
behavioral holes (dead ends, missing failure paths).

Build one for **complex interactive modules** (multiple states, async work, failure/retry/
cancel paths). Simple modules don't need it — a hand-crafted diagram plus acceptance criteria
is enough.

Consumers of the model: the validator, UI prototypes (which mirror it 1:1), and acceptance
coverage checklists. **Mermaid diagrams for human review are hand-crafted views designed for
the decision at hand** — `clarity render` produces only mechanical drafts (useful as a
starting point for large models and for debugging). If a view and the model disagree, fix one
explicitly; the model wins for behavior, the view wins for presentation.

File convention: `docs/clarity/behaviors/<name>/behavior.yaml` inside the derived staging dir — fixed, never negotiated. Scaffold with `clarity init <name>`.

---

## Top-level structure

```yaml
machine:
  id: <kebab-case-id>          # required
  initial: <state-key>         # required, must exist in states
  context:                     # optional extended state (data, not behavior)
    <name>: { type: <type>, initial: <value>, description: <text> }

events:                        # required, first-class registry — no anonymous events
  <EVENT_NAME>:                # UPPER_SNAKE_CASE
    source: user | system | actor | timer | external
    description: <text>
    label: <text>              # required in practice (validator warns): human-facing
                               # name shown in diagrams (any language — e.g. "choose
                               # file"). Fallback: the raw id.

guards:                        # optional registry, named conditions
  <guard_name>:                # snake_case
    description: <text>        # semantics only; the algorithm lives in code
    label: <text>              # optional: diagram display text

actions:                       # optional registry, named side effects
  <action_name>:               # snake_case
    description: <text>
    label: <text>              # optional: diagram display text (detailed view)

actors:                        # optional registry, async services invoked by states
  <actor_name>:                # snake_case
    type: service
    description: <text>

states:                        # required
  <state-key>: { ... }
```

## State node

```yaml
states:
  uploading:
    description: Upload is in progress      # recommended: human-facing meaning
    label: <text>                           # diagram display text (validator warns when
                                             # missing on states — views display labels)
    type: atomic | compound | parallel | final | history   # default: atomic
    entry: [ <action_name>, ... ]           # optional, on state entry
    exit:  [ <action_name>, ... ]           # optional, on state exit

    on:                                     # event → transition (atomic/compound states)
      CANCEL:
        target: idle                        # required
        guard: can_retry                    # optional, must exist in guards
        actions: [ notify_user ]            # optional, must exist in actions

    invoke:                                 # optional, start an actor on entry (atomic states)
      src: upload_service                   # must exist in actors
      onDone: { target: completed }         # transition shape, same as `on`
      onError: { target: failed, actions: [ increment_retry ] }

    initial: viewing                        # compound states only: initial child
    states:                                 # compound/parallel states only: child states
      viewing: { ... }
      modifying: { ... }
```

### Rules per type

| type | must have | must NOT have |
|---|---|---|
| atomic (default) | — | `states`, `initial` |
| compound | `initial`, `states` | `invoke` |
| parallel | `states` | `initial`, `invoke` |
| final | nothing | `on`, `invoke`, `states`, `entry`/`exit` allowed but discouraged |
| history | — | `on`, `invoke` |

### Nested targeting

Child states are addressed with dot paths: `editing.modifying`. A transition may target a
sibling (`idle`), a child (`editing.modifying`), or a parent (`editing` — enters its `initial`).

## Transition fields

| field | meaning |
|---|---|
| `target` | destination state key or dot path (required) |
| `guard` | named condition; transition only fires when true. Omit = always allowed |
| `actions` | named side effects executed during the transition, in order |

Multiple transitions on the same event are allowed when they carry **different guards**
(else the model is ambiguous — validation error).

## Design constraints (normative)

1. **Events are first-class.** Every event used in `on:` must be declared in `events:` with a
   `source`. This prevents event sprawl and makes the user-facing surface auditable.
2. **No expressions in the model.** Guards and actions are *named semantics*, not code.
   `guard: can_retry` — yes. `guard: "retryCount < 3 && role === 'admin'"` — never.
3. **Context is data, not behavior.** If you are tempted to encode a mode as context,
   make it a state instead.
4. **Every `invoke` must declare `onError`.** Async work can fail; the model must say what happens.
5. **Long-running invoked states should handle a cancellation event** (validation warning).
6. **Final states are absorbing.** No outgoing transitions.
7. **State keys are unique across the whole model**, including nested states — Mermaid
   resolves state names globally, so duplicate keys render incorrectly.

## Validation rules

### Structural (errors — must fix)

- `machine.id`, `machine.initial` present; `initial` exists in `states`
- every `target` resolves to an existing state (including dot paths)
- every event used in `on:` is declared in `events:`
- every `guard`/`action`/`actor` referenced is declared in its registry
- type constraints from the table above hold
- no duplicate unguarded transitions for the same (state, event) pair
- `invoke` without `onError`

### Behavioral (warnings — review with the user)

- unreachable states (no path from `initial`; parallel regions enter all children)
- dead-end states that are not `final`
- invoked states with no cancellation path
- declared events never used in any transition

### Consistency (informational)

- each acceptance criterion in the behavior spec should map to at least one
  (state, event, target) triple; each transition should map to at least one test case

## Scaling: keeping diagrams readable

Diagrams exist for human approval. A diagram the user cannot read at a glance has failed,
no matter how correct it is.

**The model being bigger than any single view is normal — and fine.** Do not blur the
model to make one view fit (merging failure states, dropping cancel paths). The answer
is more views: the generated machine views carry the full machine, hand views select
from it, and the strategies below split large machines.

**Size limits (soft, hand views):** > ~10 states or > ~15 transitions in one rendered
view → split. Generated machine views (`clarity render`) are exempt — completeness is
their job; `clarity check` enforces the distinction.

**Split strategies, in order of preference:**

1. **Composite states.** Group sub-behavior into compound states; the overview renders the
   collapsed hierarchy and stays small. Cheapest and keeps one model.
2. **Scoped views.** `clarity render docs/clarity/behaviors/<name>/behavior.yaml --scope <state.path>` renders only
   that subtree, with cross-boundary transitions listed as trailing comments — a good draft
   base for a hand-crafted per-module view. One model, several focused views.
3. **Sub-modules.** If the module is really several behaviors, split it: each sub-module gets
   its own `docs/clarity/behaviors/<sub>/behavior.yaml`; the parent directory holds a short
   spec and a hand-authored `flowchart` of how the modules relate. Machines communicate
   through events — document cross-machine events in both models.

Also prefer several diagrams over one crowded one for **scenarios**: happy path and failure
paths can be separate scoped or hand-drawn views.

## Full example

```yaml
machine:
  id: file-upload
  initial: idle
  context:
    retryCount: { type: number, initial: 0, description: Consecutive failed attempts }

events:
  FILE_SELECTED: { source: user, description: User picked a file in the chooser }
  VALIDATION_DONE: { source: system, description: Client-side validation finished }
  CANCEL: { source: user, description: User cancelled the operation }
  RETRY: { source: user, description: User requested another attempt }

guards:
  file_valid: { description: The selected file passes type and size checks }
  can_retry: { description: Retry is allowed while retryCount is below the limit }

actions:
  record_file: { description: Remember the selected file reference }
  increment_retry: { description: Increase retryCount by one }
  notify_user: { description: Surface a human-readable outcome message }

actors:
  upload_service: { type: service, description: Streams the file to storage and reports progress }

states:
  idle:
    description: Waiting for the user to pick a file
    on:
      FILE_SELECTED: { target: validating, actions: [ record_file ] }

  validating:
    description: Checking file type and size
    on:
      VALIDATION_DONE:
        - { target: uploading, guard: file_valid }
        - { target: rejected }

  uploading:
    description: Upload is in progress
    invoke:
      src: upload_service
      onDone: { target: completed }
      onError: { target: failed, actions: [ increment_retry ] }
    on:
      CANCEL: { target: idle, actions: [ notify_user ] }

  rejected:
    description: The file cannot be accepted
    on:
      FILE_SELECTED: { target: validating, actions: [ record_file ] }
      CANCEL: { target: idle }

  failed:
    description: The upload did not complete
    on:
      RETRY: { target: uploading, guard: can_retry }
      CANCEL: { target: idle, actions: [ notify_user ] }

  completed:
    type: final
    description: The file is stored
```
