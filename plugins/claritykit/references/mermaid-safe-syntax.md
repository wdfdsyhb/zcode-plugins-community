# Mermaid Safe Syntax & Verification

Rules that keep every Mermaid diagram in ClarityKit renderable without AI debugging sessions.
Applies to **hand-authored** diagrams (expressive docs) and constrains **generated** ones
(`clarity render` already follows them).

## Version policy

- The preview page and `clarity check` use the **same pinned mermaid version**
  (the one installed in `tools/package.json`; preview.mjs reads it automatically).
- Never change the pinned version ad hoc. If an upgrade is needed: bump
  `tools/package.json`, run `cd tools && npm install` (dependencies live ONLY in
  `tools/`), then re-run `clarity check` in every project with a `docs/clarity/`
  directory.
- The renderer additionally avoids syntax known to break mermaid v10, so diagrams also survive
  older viewers (e.g. some editor plugins).

## The one workflow rule

**Run `clarity publish` before presenting any document containing Mermaid.**
publish runs check.mjs (the real mermaid parser over every `.mmd` file and every
```` ```mermaid ```` block — deterministic, no AI guessing) and only builds the preview
site when everything parses. A diagram that fails does not get shown to the user; it
gets fixed first.

### Repair loop (bounded, cheap)

1. Run `check.mjs` → collect exact file + parser error.
2. Fix against the safe-subset table below (most failures are table rows).
3. Re-run `check.mjs`. **At most 3 fix iterations.**
4. Still failing → stop, show the user the raw diagram + the parser error, ask how to proceed.
   Do not burn the main context on long debugging — if investigation is genuinely needed,
   delegate it to a subagent whose prompt contains only: the failing diagram, the parser
   error, and this reference.

## Safe subset (hand-authoring rules)

### Universal

- Quote any label containing spaces, brackets, or punctuation in flowcharts:
  `A["text (with) stuff"]`. Prefer plain ASCII or CJK text inside quotes.
- One statement per line; no trailing comments after statements (comments are own lines: `%% …`).
- Avoid `:` inside edge/transition labels (stateDiagram v10 parses it as a separator;
  use a fullwidth `：` or rephrase).
- Keep diagram size under control (see "Size limits" in diagram-selection.md).

### stateDiagram-v2

Applies to every hand-authored state diagram — including hand-crafted views derived
from a behavior model (`clarity render` output follows these rules by construction).

- **Declare every state before the first transition.** All `id : label` lines and
  `state id { ... }` composite blocks come before any `-->` line. Two reasons:
  (1) nodes implicitly created by transitions, interleaved with a composite block,
  trigger a mermaid **layout bug** — outside nodes get dragged onto the composite's
  boundary and edge labels get clipped (renders wrong despite parsing clean);
  (2) declaration order drives layout order — declare in roughly narrative order
  (initial → main flow → failure → terminal).
- **Composite states declare in two lines: description first, bare block after.**
  `editing : 编辑中` on its own line, then `state editing { ... }`. NEVER
  `state editing : 编辑中 {` — a description in the block header parses clean but
  renders **two phantom nodes** (one for the id, one for the label) with wrong
  edges drawn.
- **Composite blocks are declarations only — no edges inside, ever.** The
  composite's initial child is a plain top-level edge (`editing --> viewing`)
  emitted among the other transitions, right after the first edge entering the
  composite; never an inner `[*] -->` (intra-block edges trigger layout bugs that
  parse clean).
- `clarity check` warns on all three textual violations: declaration after the
  first transition, description in a block header, any transition inside a block.
- Declare descriptions as `id : text` **without** the `state` keyword —
  `state X : text` silently drops the description in mermaid v11.
- Never put a bare `state X` line directly before a composite `state Y { ... }` block
  (parser bug: it swallows the next statement).
- Put all `note right of X … end note` blocks **after** every state declaration and
  transition, at the end of the file — interleaved notes can fail rendering with
  `No such shape: undefined`.
- `onDone(actor)` style labels are fine; `onDone: actor` is not (colon rule).

### erDiagram (conceptual + field-level)

- **Always quote relationship labels**: `USER ||--o{ PROJECT : "owns"`. Quoted CJK
  labels parse on the pinned version, but quoting is mandatory insurance (unquoted
  non-ASCII broke on older v11 minors).
- Entity names may be CJK/user-language (verified parsing on the pinned version) —
  use exactly this for conceptual diagrams so non-technical reviewers read their own
  words. Field-level ER usually uses English table names.
- Conceptual diagrams are relationship lines ONLY — no attribute blocks.
- Attribute blocks (field-level only): `type name PK/FK/UK` per line inside
  `ENTITY { ... }`; no comments inside blocks.
- No cardinality notation other than the standard `||`, `o{`, `}o`, `||--o{` forms.

### quadrantChart

- Axis labels quoted: `x-axis "低紧急度" --> "高紧急度"`; quadrant names quoted.
- Points: `"名称": [0.x, 0.x]` — values are 0–1; ≤ ~10 points.
- CJK titles and point names parse on the pinned version.

### journey

- Section/task syntax only; scores are integers 0–5. Commas inside task text break rows —
  rephrase or use `;`-separated actor lists carefully.

### flowchart

- Node ids: alphanumerics only (`A`, `node1`); display text goes in brackets/quotes.
- Subgraphs: `subgraph Title ... end`, unique ids if referenced by edges.

### sequenceDiagram

- Participants first (`participant A as User`), messages after; avoid nested `alt` deeper
  than 2 levels — split into two diagrams instead.

### mindmap

- Indentation defines hierarchy; don't mix `mindmap` with other diagram syntax.
- Node shape: plain (just the text) or cloud `)text(`.
  The root node is recommended to be cloud.
  **Do NOT use the circle root `root((text))`** — its label renders offset from
  the circle on the pinned version. That is a renderer bug, not a syntax error.

## When the parser error is cryptic

Bisect: render halves of the diagram until the failing statement is isolated, then compare
against the table above. This is mechanical work — a good subagent task.
