---
name: clarify-data
description: Define what the system knows and what crosses its boundaries — a conceptual entity diagram, field-level ER + YAML contract sheet when persistence exists, endpoint map / cross-boundary sequences when interfaces exist; error taxonomy cross-checked against failure scenarios. Invoke ONLY when the user names clarify-data or clarity-flow enters the data step; never self-activate from a data-model remark.
---

# clarify-data — entities, fields, and boundaries

Answers: **what must the system remember (and who owns each concept), and what exactly
crosses every boundary** — fields, operations, errors. This is the stage where "may be
absent" stops being vague and becomes a decided claim.

## Entry / skip

- **Enter** when the system persists anything OR exposes any interface (API, file
  format, IPC, import/export, cross-process events). Almost every real system does.
- **Skip — recorded, never silent** — only when stateless AND interface-free (a pure
  in-memory transform). Say the skip out loud; it is rarer than it feels.

## Artifacts (project-level in `docs/clarity/data/`)

The contract sheet lives at `docs/clarity/data/contracts.yaml` — UNLESS a contract is
owned by exactly one behavior module (e.g. that module's private file format), in
which case it may live at `docs/clarity/behaviors/<name>/contracts.yaml` instead.
Never split one boundary's contract across locations.

| Artifact | Status | Trigger |
|---|---|---|
| conceptual entity diagram (`erDiagram`, relationships only, NO attribute blocks; entity names + relationship labels in the user's language) | **necessary** | the system persists anything — the user reviews THIS diagram; it forces: what exists, what connects to what, who owns each concept. > ~12 entities → split by domain. Interface-only systems (no persistence): optional — contracts + endpoint map carry the structure |
| `contracts.yaml` (the contract sheet below) | **necessary** | persistence or any interface exists |
| field-level `erDiagram` (PK/FK, cardinality, attribute blocks) | **necessary** | persistence exists — derived FROM contracts.yaml; implementation-facing, the user need not read it line by line |
| API endpoint map (`flowchart`: gateway → modules → routes + purpose) | conditional | the system exposes an API to a client or third party. It answers "which endpoints exist"; field-level request/response detail lives in contracts.yaml, NOT in the diagram |
| cross-boundary `sequenceDiagram` | conditional | each external integration with failure/retry semantics: decides timeout, retry policy, idempotency, and what the user sees when the far end is dead |
| information-flow diagram (`flowchart`: each class of information — where it comes from, where it is stored, who/what can see it) | optional | privacy / local-first / sync decisions matter; an ER diagram cannot express this |
| `classDiagram` | optional | in-memory domain logic (not storage) is genuinely complex |

Optional diagrams pass the "which decision does this force" test when proposed; default
≤ 2 per module.

## The contract sheet (`contracts.yaml`)

```yaml
entities:
  <entity>:                       # user-language concept, matches the conceptual diagram
    owner: <component/boundary>   # who owns its truth
    fields:
      <field>: { type: <type>, cardinality: one|maybe|many|maybe-many,
                 absent_means: <one line — required for maybe / maybe-many> }
operations:                       # per boundary — what crosses it
  <operation>:
    boundary: <api|ipc|file|internal>
    input:  { <field>: <type>, ... }
    output: { <field>: <type>, ... }
    errors: [ <error_id>, ... ]
errors:
  <error_id>:
    meaning: <one line>
    user_sees: <what the user experiences>   # required when the error can surface —
                                             # the validator WARNS; resolve it during
                                             # the cross-check, don't leave it hanging
```

**Optionality is where hidden decisions live.** "May be absent" is a behavioral claim
about every consumer — each `maybe`/`maybe-many` field needs an `absent_means` answer
the user approves (usually via a concrete scenario that exercises the absence).

## The error-taxonomy cross-check (both directions, mandatory)

- every error an operation can produce ↔ a failure scenario that consumes it (from the
  behavior step, if run): errors with no consumer get cut;
- every failure scenario with no named error gets one.
Run this check before presenting; report the result in one line.

## Method

1. **Batch-interview** entities and boundaries (what must be remembered? what crosses
   out? what comes in?). Draw the **conceptual entity diagram first** and get it
   approved — it is the cheapest artifact to correct.
2. **Write `contracts.yaml`** per boundary; derive the field-level ER from it (quoted
   relationship labels; entity names in English or the user's language — both verified
   to parse on the pinned mermaid).
3. **Conditional/optional artifacts** per triggers above.
4. **Error-taxonomy cross-check**, then `clarity publish` (check-then-build). Follow
   `references/mermaid-safe-syntax.md` and `references/diagram-selection.md` (two
   levels up). `%% title:` every diagram.
5. **Iterate until approved.** Note for hand-off: the implementing agent consumes
   `contracts.yaml` as ground truth — it is the artifact this step exists to produce.

## Modifying existing artifacts

`contracts.yaml` is the source of truth; the field-level ER is derived. Change order:
edit contracts.yaml → `clarity validate` → regenerate the field-level ER (never
hand-diverge it) → `clarity publish`. Mutating an existing field's shape is a
back-jump-level decision (existing consumers break) — surface it, don't slip it in.

## Paths (derived, never chosen)

All artifacts live in the staging dir (`clarity root`). All tools via the `clarity`
CLI; if not found, retry once after `export PATH="$HOME/.local/bin:$PATH"`, then stop
and report — never improvise alternatives.

## Presentation contract

The user reviews the **conceptual** diagram and the error taxonomy ("what the user
sees" per failure class) in the conversation; the field-level ER and contracts.yaml are
implementation-facing archives. Never "see the yaml" for decisions — surface each
decision (ownership, optionality semantics, error surface) as a concrete scenario.

## Quality bar

- Every conceptual entity is named something the user actually says (no
  "ContentAggregationService").
- Every `maybe`/`maybe-many` field has an approved `absent_means`.
- Error cross-check passed in both directions; result stated.
- Field-level ER is derived from (never contradicts) contracts.yaml.
