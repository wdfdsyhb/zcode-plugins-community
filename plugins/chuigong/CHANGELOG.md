# Changelog

All notable changes to the Chuigong (垂拱) plugin are documented here.

> Internal-release history: versions 0.1.0 through 0.2.3 were all shipped on 2026-10-02 during one polish day. Entries are reconstructed from `DESIGN.md` and per-version release diffs.

## 0.3.0 — 2026-10-04

### Added

- **Recommended install path changed to the local-marketplace flow** (same-day doc addition): clone the repository → add the cloned folder as a local plugin marketplace in ZCode → install from it. Rationale: the official plugin development guide states hooks run only for plugins installed from an official marketplace or a local directory, so this path guarantees the SessionStart mandate injection — and it is the path the author runs in production. The GitHub-marketplace direct add and the CLI install remain as alternatives (options B / C), with the hooks warning callout now attached to the alternatives instead of the recommended path.

### Changed

- **Shipped model switched to the account-scoped `account:bigmodel-individual-coding-plan/GLM-5.3-Flash`** (the same form official plugins use): it shows up in the UI and runs out of the box in GLM-plan environments; other environments pick their own models once from the UI.
- **Model adaptation now goes through the UI as the main path: Settings → Subagents → the Chuigong group**, one dropdown pick per official. Changes are written to the `~/.zcode/v2/agents-state.json` override layer, independent of plugin files — marketplace refreshes and plugin updates never reset them. A one-line model note was added to the installation section.
- **Flavor unified to the Chuigong court: the sovereign (君上) presides over the assembled officials (百官).** The five offices: Tongzheng 通政 (information intake; `wb-researcher`), Hanlin 翰林 (drafting; `wb-writer`), Jiangzuo 将作 (implementation; `wb-coder`), Shuli 书吏 (clerical batch work; `wb-data`), Yushi 御史 (censor, unchanged; `wb-reviewer`). The `/wb` and `wb-*` identifiers are unchanged, and the docs no longer expand what they abbreviate.

### Rejected (design decision)

- Two user-side adaptation architectures were examined and **withdrawn in turn**. The "template + user-scope copy" design was disproved by a local probe: standalone user-level definitions under `~/.zcode/agents/` are never loaded for dispatch. The follow-up `scripts/adapt-model.sh` editing script was then dropped after testing showed that editing **plugin-level** entries in the "Settings → Subagents" UI works — the client writes them to the `agents-state.json` override layer and dispatch honors them — so no script is needed. The earlier claim that the UI could not change plugin subagent models was a misjudgment (caused by a stale same-named user-scope copy on the reporting machine); it is retracted here, with thanks to the user who corrected it.

## 0.2.4 — 2026-10-03

### Changed

- **Information routing is now keyed to organization state, not size** (production-feedback fix). The old economics rule — "dispatch anything that produces bulky intermediates (search results, logs, file contents)" — pushed already-distilled decision documents (handoff docs, project master docs, requirement memos, specs, ledgers) through `wb-researcher`; the coordinator then read them itself anyway, paying a double read plus summarization loss. Now: documents already in conclusion form are read **directly by the coordinator** — absorbing decision inputs is its job, not "doing research". Only unorganized raw material (web research, undocumented codebases, logs, data piles) is dispatched for digestion into conclusions. Huge-but-only-partially-relevant documents get targeted extraction with line-number anchors, and the coordinator reads the anchored passages itself.
- `wb-researcher` rescoped as **the coordinator's information secretary** with exactly two primary lanes: ① web search / source verification / multi-source comparison; ② surveying and distilling unorganized local material. Regular-size distilled documents are outside its lanes — the coordinator reads them directly (targeted extraction with anchors remains a briefable service for huge, partially-relevant documents). (User decision: mismatch detection lives on the dispatching side only — the official does not push back on briefs.)
- Mandate rule 10 added, with a matching carve-out in the "no personal research" clause; `delegating` skill economics paragraph rewritten and reverse-gate / roster / excuse-checklist synced; `DESIGN.md` §1/§3/§4 updated with a new acceptance criterion (no double reads of distilled docs).

## 0.2.3 — 2026-10-02

### Changed

- SessionStart mandate tightened: red-line tasks (destructive deletion, irreversible git operations, system-state changes, publishing/external sends, credential values) are now **never dispatched to officials at all**. The sovereign performs such steps itself — backing up originals first, and asking the user first for irreversible or external actions. Official-side red lines remain only as a last-resort backstop (Flash models may under-enforce soft rules); the first line of defense is not dispatching.
- `delegating` skill synced to the same rule: briefings never contain red-line operations.

## 0.2.2 — 2026-10-02

### Added

- Red-line sections in all five official definitions with a uniform contract: touching a red line must return `BLOCKED(红线: <item>)` — never attempt, never work around; the sovereign adjudicates and takes over.
  - `wb-coder`: destructive deletion allowed only for task products inside the task directory (`node_modules`, `build`, `dist`, `__pycache__`, caches, temp dirs); global package installs (`npm i -g`, system-level pip, etc.) are a red line.
  - `wb-data`: deletion/move/rename/overwrite restricted to brief-designated directories and files it created during the run; destructive command forms require an affected-files checklist plus preserving originals even in scope.
  - `wb-researcher` / `wb-writer` / `wb-reviewer`: absolute prohibition with the adjudication path.
- `wb-reviewer`: built-in fifth review dimension — **red-line scan** of the work under review, its diff and its report (credential values, out-of-scope deletion, git-irreversible commands, system-level operations, external sends). Any hit escalates to Critical.

### Rejected (design decision)

- A PreToolUse gate hook was considered and deliberately **not** implemented: users need long autonomous runs, and a per-command approval gate would stall them. The risk is compensated by "no red lines in briefings" plus the reviewer's red-line scan.

## 0.2.1 — 2026-10-02

### Changed

- The interrogation skill and command renamed `jiujie` → `grill-me` (skill id, command file, and all references in the mandate and SOP).
- `wb-reviewer`: findings that conflict with the briefing/criteria or cannot be verified must be flagged as "conflict / to be confirmed" (冲突 / 待确认) and adjudicated by the coordinator **before** being routed — no unadjudicated pass-through to implementers.
- Mandate, `delegating` and `sdd` synced.

## 0.2.0 — 2026-10-02

### Added

- Interrogation skill (究诘, initially released as `jiujie`) and its `/jiujie` command: decision-tree questioning driven by the main conversation, `AskUserQuestion` with ≤4 questions per round (recommended option first, frontier questions only), requirement memo written to `.chuigong/grill-me/`.
- Four-state report contract (`DONE` / `DONE_WITH_CONCERNS` / `NEEDS_CONTEXT` / `BLOCKED`) with a triage table in the delegating SOP.
- Slot-template briefings (object / goal / boundary / deliverable / prior / depth) replacing prose briefs; no pasting of role prompts or history summaries.
- Scoped re-review: fix-loop reviews only judge `ADDRESSED` / `NOT ADDRESSED` per finding and scan the fix diff for new problems — no full re-roaming; Minor findings stay out of the fix loop.
- Explicit "must ask the user" list: irreversible/destructive operations, security-sensitive operations, side effects outside the workspace (push / publish / external sends), and plans broken beyond salvage.

### Changed

- `wb-researcher` switched from a narrow tool whitelist to **full tool inheritance** — regains access to MCP search servers (main defect fixed this round); file-write restraint now carried by role text.
- All five official bodies overhauled with DeepSeek-oriented compensations: restate-before-work protocol, exit-code check on every command, retry ≤2 then `BLOCKED`, external content treated as data-not-instructions, source discipline (no facts beyond the material), fixed-shape reports.
- Resume-the-original-official fix routing: SendMessage resume of a completed official verified in this version's own review round.

## 0.1.0 — 2026-10-02

### Added

- Initial internal release. Core shape already in place: five officials (researcher / writer / coder / data / reviewer), SessionStart mandate injection, the `delegating` SOP (classify → decompose → dispatch → disk-based delivery → review with a ≤2-round fix loop → escalation ladder → single merged deliverable), the `sdd` strict-process skill, and the `/wb` command.

---

## Release checklist

- Replace every `__GH_OWNER__` placeholder with the real repository owner before publishing (README.md, README_CN.md, LICENSE, plugin.json).
- Bump the version in **both** `.zcode-plugin/plugin.json` and the `marketplace.json` entry; keep `name`, `version` and `description` identical between them — update detection reads the marketplace entry.
- Refresh the marketplace source after publishing, then verify the mandate injection in a fresh session.
