# Reading List — Commission

> Fixture: the terminal step of clarity-flow. The ledger and risk list below are the
> two artifacts; the user signs off line by line.

## Delegation ledger

### The implementing agent may decide autonomously

- UI component structure, internal naming, error message wording (zh-CN).
- Exact SQLite schema details beyond `contracts.yaml` (indices, normalization) as
  long as the contract fields and their cardinalities hold.
- Debounce timing for search input (within the ~300ms budget).
- Sync retry backoff curve under the `can_retry` limit semantics.
- Grayscale prototype reuse decisions (throwaway per clarify-ui rules).

### Forces a return to the user

- Any change to `contracts.yaml` (field shape, cardinality, absent_meaning, errors).
- Any new runtime dependency or new external service.
- Any mutation of the sync conflict policy (last-write-wins → anything else).
- Anything touching the direction non-goals (social, third-party sync, ranking).
- Browser storage eviction workaround if it requires an account or upload.

## Risk list (top 3, each accepted or probed)

| Risk | If we're wrong… | Decision |
|---|---|---|
| Browser evicts SQLite storage under quota pressure | we lose the user's library → redo storage layer | **probe**: early spike — request persistent storage, fill 300MB, survive browser restart |
| Snapshot fetcher fails on most real sites | full-text search covers a minority of saves → product value drops | **accept** (v1): link+title fallback is designed in; revisit with failure-rate data |
| Sync conflicts corrupt bookmarks (two devices, same item) | user trust breaks → redo sync engine | **accept**: single-user two-device LWW risk is small; `conflict` error path exists |

## Consistency sweep

- scenarios ↔ `save-bookmark/behavior.yaml` ↔ `data/contracts.yaml` ↔ views: aligned
  (offline/peer-down/conflict each have a scenario, a state path, and an error).
- `clarity check`: all diagrams parse. `clarity validate`: both models valid.
- Open questions: none unowned — highlighting deferred (requirements risk list).
