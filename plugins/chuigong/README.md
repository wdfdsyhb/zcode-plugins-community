# Chuigong 垂拱 — Hands-off Delegation for ZCode

[English](README.md) | [简体中文](README_CN.md)

**Chuigong** (Chinese: 垂拱, from the I Ching — "垂衣裳而天下治", "governing by folded hands") is a plugin for [ZCode](https://zcode.z.ai) that turns your main conversation into the sovereign: the sovereign only **decomposes, dispatches, adjudicates and summarizes**, while research, writing, coding, bulk data work and review are executed by five pre-configured official subagents (the Baiguan 百官, "the assembled officials") on the shipped GLM-5.3-Flash (changeable per official in **Settings → Subagents**) — so your expensive main-model quota goes to the sovereign's judgment, not to the officials' intermediate bulk. Install it in three steps: clone this repository, add the cloned folder as a local plugin marketplace in ZCode, then install the plugin (see [Installation](#installation)).

## Table of Contents

- [How it works](#how-it-works)
- [Components](#components)
- [Installation](#installation)
- [Usage](#usage)
- [Adapting to your own model](#adapting-to-your-own-model)
- [Project layout](#project-layout)
- [For plugin review](#for-plugin-review)
- [Known limitations](#known-limitations)
- [FAQ](#faq)
- [Versioning](#versioning)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgments](#acknowledgments)

## How it works

Main-session models are expensive, and their context window is the scarcest resource you have. Information is routed by organizational state, not by volume: decision documents that already hold conclusions — handover docs, project main docs, README/DESIGN, requirement memos, specs, ledgers, review packages — are read by the sovereign directly; they are the input for decomposition and adjudication, not "research". Unorganized raw material (search results, logs, data piles) is dispatched to an official to be digested into conclusions and returned; a document that is huge but only locally relevant is excerpted by an official with line-number anchors, and the sovereign reads just the key sections. Chuigong's answer is an economy of delegation:

1. **Roles are preset.** Every official's full role prompt ships with the plugin. Dispatching costs only a slot-filled briefing — a few dozen tokens.
2. **Deliverables land on disk.** Officials write their complete output to the file named in the briefing and return only a status plus at most five lines of key findings. The main context never sees the bulk.
3. **Officials cross-review.** Every deliverable goes to the censor (Yushi) with a criteria list from the sovereign; on FAIL, the sovereign adjudicates and routes the finding list back to the original official — at most 2 fix rounds (3 in the strict sdd process), then the sovereign takes over.
4. **Effort scaling.** Small task = one official; medium = 2–4 officials in parallel; large = 5 or more officials, batched at ≤5 with non-overlapping file ownership. Tightly coupled work is explicitly *not* split.

Officials report under a fixed four-state contract: `DONE` / `DONE_WITH_CONCERNS` / `NEEDS_CONTEXT` / `BLOCKED`. Failures climb an escalation ladder: retry with a sharper briefing → re-dispatch to another official or split the task → the sovereign does it itself and says so.

**Red lines.** Destructive deletion, irreversible git operations, system-state changes, publishing or sending data to external addresses, and credential values are **never dispatched to officials**. Officials hold a hard contract of their own: if a task ever touches a red line they must reply `BLOCKED(红线: <item>)` instead of improvising. The first line of defense is simpler still — such steps never enter a briefing, and the sovereign performs them itself (asking you first for irreversible or external actions).

## Components

| Component | Where | What it does |
|---|---|---|
| SessionStart hook | `hooks/` | Injects the sovereign mandate into every session (`startup` / `clear` / `compact`) — the single source of the "the sovereign only decomposes, dispatches, adjudicates and summarizes" rule |
| `delegating` skill | `skills/delegating/` | Default SOP: classify → decompose (effort scaling + reverse gate + file ownership) → slot briefing → four-state triage → review → escalation → merge |
| `sdd` skill | `skills/sdd/` | Strict process for serious tasks (multi-file code changes / high risk / irreversible): per-task implementer, per-task review, on-disk ledger, ≤3 fix rounds, branch-wide final review |
| `grill-me` skill | `skills/grill-me/` | Requirements interrogation (究诘): decision-tree questioning until no open decision remains; produces a requirement memo |
| `/wb` command | `commands/wb.md` | One-line entry into the delegation flow |
| `/grill-me` command | `commands/grill-me.md` | Start interrogation for a topic or the current task |

**The officials' roster** (all defined in `agents/`, shipped pinned to GLM-5.3-Flash — see [Adapting to your own model](#adapting-to-your-own-model)). The five hold court offices: Tongzheng (information intake), Hanlin (drafting), Jiangzuo (implementation), Shuli (clerical batch work), and Yushi (censor):

| Official | Role | Tool policy |
|---|---|---|
| `wb-researcher` (Tongzheng, information intake) | The sovereign's information secretary: web search, source verification, multi-source comparison; mapping and distilling unorganized local material (undocumented codebases, logs, directory trees, data piles); targeted excerpts of huge documents with line-number anchors | Inherits your full toolset — keeps MCP search servers; file writes constrained by role text |
| `wb-writer` (Hanlin, drafting) | Drafting, docs, reports, slides, spreadsheets (docx / pptx / xlsx / pdf) | Inherits your full toolset |
| `wb-coder` (Jiangzuo, implementation) | Code changes, scripts, fixes, refactors; mandatory self-test; commits only when briefed | `Bash` `Read` `Write` `Edit` `Grep` `Glob` |
| `wb-data` (Shuli, clerical batch work) | Bulk, mechanical file/data processing with count reconciliation | `Bash` `Read` `Write` `Edit` `Grep` `Glob` |
| `wb-reviewer` (Yushi, censor) | Acceptance review: PASS/FAIL verdict plus evidence-backed Critical / Important / Minor findings | Read tools + `Write` only for its own report; built-in red-line scan |

**Direct-read rule.** Decision documents already in conclusion form (handover docs, project main docs, README/DESIGN, requirement memos, specs, ledgers, review packages) are read by the sovereign directly: they are input for decomposition and adjudication, not "research", and having an official read them through only to re-narrate them is double reading. `wb-researcher`'s lanes are for unorganized material and for targeted excerpts of huge, only-locally-relevant documents.

## Installation

> **Model note:** the shipped model is GLM-5.3-Flash; to change it, pick another from the dropdown under **Settings → Subagents** — it takes effect immediately.

### A. Local marketplace source (recommended)

```bash
git clone https://github.com/rouyiemei/chuigong.git
```

1. Clone the repository to any local folder with the command above.
2. Go to **Settings → Plugins**, click **Create → Add plugin marketplace**, and select the cloned folder.
3. In the **Personal** section, find the Chuigong (垂拱) card → **Install**.
4. Verify: open a **new session** — the sovereign should open by proposing delegation instead of doing the work itself; type `/` and confirm `/wb` and `/grill-me` appear.

**Updating:** `git pull` inside the cloned directory, then click **Refresh marketplace** in the marketplace-sources panel.

Two reasons this path is recommended:

1. **Full hook functionality.** ZCode's plugin development guide states that hooks run only when a plugin is installed from an official marketplace or a local directory. A local-directory install therefore guarantees the SessionStart sovereign-mandate injection — the core mechanism Chuigong depends on.
2. **Production-proven.** This is the install path the author runs in production.

### B. GitHub marketplace direct add (alternative)

1. Open any workspace in ZCode.
2. Go to **Settings → Plugins**, click **Create → Add plugin marketplace**.
3. Enter `rouyiemei/chuigong` (or paste the repository URL). ZCode validates the marketplace and clones the repository.
4. In the **Personal** section, find the Chuigong (垂拱) card → **Install**.
5. Verify: open a **new session** — the sovereign should open by proposing delegation instead of doing the work itself; type `/` and confirm `/wb` and `/grill-me` appear.

### C. CLI (alternative)

```bash
zcode plugins marketplace add rouyiemei/chuigong
zcode plugins install chuigong@chuigong   # <plugin-name>@<marketplace-name>
```

Behind a proxy, set `ZCODE_HTTP_PROXY` for the ZCode process first — it is the only proxy variable ZCode honors (see [FAQ](#faq)).

> **Hooks and install source — read this if you rely on the sovereign mandate (applies to options B and C).**
> ZCode's plugin development guide states that hooks run only when a plugin is installed from an official marketplace or a local directory. Options B and C both install through this third-party GitHub marketplace, so the SessionStart mandate injection may not run (two official documents describe this differently; the actual behavior is not fully settled). Chuigong's core mechanism depends on that injection, so after installing, open a new session and confirm the sovereign actually hands work off. If the mandate is missing, switch to option A (local clone) — that is the guaranteed full-function path.

## Usage

```text
/wb Investigate how ZCode installs third-party plugins and write an
    evidence-backed report to ./docs/research/plugin-install.md
```

What happens:

1. The sovereign classifies the task (not a pure Q&A → delegation flow) and scales the effort (here: medium, 2–4 directions).
2. It dispatches `wb-researcher` with a slot briefing. The role prompt is preset, so the briefing is a few dozen tokens:

   ```text
   To: wb-researcher
   Goal: How ZCode third-party plugin installation works, with official sources
   Boundary: Official docs and client behavior only; no speculation; touch only the report file
   Deliverable: <absolute path to ./docs/research/plugin-install.md>
   Depth: medium
   ```

3. Tongzheng searches, writes the full report into the file, and returns: `DONE` · file path · key findings (≤5 lines).
4. The sovereign gives the criteria to `wb-reviewer` → PASS/FAIL verdict with evidence. On FAIL, the finding list goes back to Tongzheng (≤2 rounds), never silently dropped.
5. The sovereign reads the report file, merges it into a single deliverable, and reports who did what.

When the requirement itself is vague, don't execute — interrogate first:

```text
/grill-me Build a CLI that syncs my notes across machines
```

`grill-me` questions you in rounds: at most 4 multiple-choice questions per round (recommended option first, only "frontier" questions whose prerequisites are already settled), stopping once no open decision remains, then writing a requirement memo to `.chuigong/grill-me/<date>-<topic>.md`. The delegation flow resumes only after you confirm the memo. Interrogation never starts without your consent, and it never implements anything.

**Why this saves quota:** dispatching costs tens of tokens; unorganized raw material reaches the main context only after an official has digested it into conclusions on disk; the main context only ever sees statuses, findings, and the final deliverable — plus the decision documents it reads directly.

## Adapting to your own model

All five officials ship pinned to the account-scoped model `account:bigmodel-individual-coding-plan/GLM-5.3-Flash`. In GLM-plan environments it shows up in the UI and runs out of the box — no manual adaptation needed.

To use your own models: after installing, go to **Settings → Subagents → the Chuigong group** and pick a model for each of the five officials from the dropdown. The change is written to the `~/.zcode/v2/agents-state.json` override layer, independent of the plugin files — marketplace refreshes and plugin updates never reset it, so one setting holds for good; what each official actually runs is confirmed right in the same panel.

Any cheap, fast model preserves the economics — officials should be markedly cheaper than your main model. Two deliberate calibrations to keep in mind if you retune: `wb-data` intentionally runs without deep thinking (it is the fast, rules-driven lane), while `wb-reviewer` runs at the maximum thought level.

## Project layout

```text
chuigong/
├── .zcode-plugin/
│   └── plugin.json        # Plugin manifest: name, version, component paths
├── agents/                # Five official definitions (frontmatter: model, tools, thoughtLevel)
├── skills/
│   ├── delegating/        # Default delegation SOP
│   ├── sdd/               # Strict process: on-disk ledger, per-task review, ≤3 fix rounds
│   └── grill-me/          # Requirements interrogation
├── commands/
│   ├── wb.md              # /wb — enter the delegation flow
│   └── grill-me.md        # /grill-me — start interrogation
├── hooks/
│   ├── hooks.json         # SessionStart registration (matcher: startup|clear|compact)
│   ├── mandate.md         # The sovereign mandate — single source of truth
│   ├── session-start      # Bash script: reads mandate.md, emits JSON additionalContext
│   └── run-hook.cmd       # cmd/bash polyglot wrapper — finds Git Bash on Windows
├── marketplace.json       # Marketplace manifest — this repository IS a plugin marketplace
├── DESIGN.md              # Design document (Chinese): mechanisms and decisions in detail
├── README.md              # This file
├── README_CN.md           # Chinese readme
├── CHANGELOG.md           # Release history
└── LICENSE                # MIT
```

This plugin targets ZCode only; there is intentionally no `.claude-plugin/` compatibility manifest.

## For plugin review

The five items required by ZCode's official plugin documentation, each in its own section.

### Purpose

Chuigong is a delegation and orchestration plugin. At session start it injects a sovereign mandate that instructs the main conversation to decompose, dispatch, adjudicate and summarize; five official subagents and three process skills carry out the actual research, writing, coding, data processing and review.

### Dependencies

- ZCode, with support for plugin-provided subagents, skills, slash commands and hooks.
- **Windows:** Git Bash — the SessionStart wrapper looks for `C:\Program Files\Git\bin\bash.exe`, then the x86 install path, then `bash` on `PATH`. **macOS / Linux:** any bash.
- A subagent-capable model configured in ZCode. The shipped default is the account-scoped `account:bigmodel-individual-coding-plan/GLM-5.3-Flash`; to change it see [Adapting to your own model](#adapting-to-your-own-model).
- Optional: MCP web-search servers (e.g. tavily, exa) if you want `wb-researcher` to have web access.
- Nothing else: no runtime packages, no installers, no build step.

### Permissions

Once installed, the plugin registers:

- 5 subagents with per-agent tool policies — Tongzheng (information intake) and Hanlin (drafting) inherit your full toolset (including MCP servers); Jiangzuo (implementation) and Shuli (clerical batch work) are limited to `Bash` `Read` `Write` `Edit` `Grep` `Glob`; the censor (Yushi) gets read tools plus `Write`, which it may use only for its own report file.
- 3 skills, 2 slash commands, 1 SessionStart hook.

Role text constrains every official to write only the deliverable files named in its briefing. Subagents cannot dispatch further subagents and have no channel to address the user.

### Network access

The plugin ships no code that performs network requests. Any network activity happens through tools that officials inherit from your environment — for example your configured search MCP servers or CLI fetch tools — and only when a dispatched task calls for it. All officials' red lines forbid uploading or posting local data to external addresses, and forbid any publishing action.

### Side effects

- The SessionStart hook script reads `hooks/mandate.md` and prints JSON context; the injected text becomes part of the session context. No other execution happens in the hook.
- In projects where tasks run, the plugin may create a `.chuigong/` directory (sdd ledgers, grill-me memos) and writes deliverable or report files at paths named in briefings. Add `.chuigong/` to your project's `.gitignore`.
- If bash cannot be found on Windows, the hook exits silently: the plugin still loads, but mandate injection stays inactive (see [Known limitations](#known-limitations)).
- No registry, service or scheduled-task changes; no installs; no telemetry.

## Known limitations

1. **Hooks depend on the install source.** Per the official plugin development guide, hooks run only for plugins installed from an official marketplace or a local directory; a third-party GitHub marketplace install may leave the mandate injection inactive. See the callout under [Installation](#installation).
2. **Windows needs Git Bash for the hook.** Without it, the hook no-ops silently — no error, no injection.
3. **Subagents cannot ask you questions** (platform constraint). Requirement clarification is therefore done by the main conversation (`grill-me`); officials can only return `NEEDS_CONTEXT`.
4. **Subagents are stateless between tasks.** Anything a later official needs must travel in briefings or in files.
5. **Constraints are prompt- and policy-level, not a sandbox.** Officials operate with the permissions of your ZCode environment; the red-line system is an enforced discipline, not a security boundary. Do not hand the sovereign tasks whose accidental execution you cannot afford.
6. **Standalone user-level definitions under `~/.zcode/agents/` are never loaded for dispatch.** If your machine carries stale user-level copies that share names with Chuigong's officials, do not edit those — edit the plugin-level entries instead (the five under the Chuigong group in **Settings → Subagents**).
7. **Prefer third-party channels such as deepseek?** No plugin-file editing needed: just switch the five officials' models in the UI — the override layer is not reset by plugin updates.

## FAQ

**The plugin doesn't show up after I add the marketplace.**
Check that the marketplace was validated and listed with a plugin count in the marketplace-sources panel; that the repository root contains `marketplace.json`; and that cloning succeeded (proxy? see next item).

**No sovereign mandate in new sessions.**
Confirm the plugin is enabled; confirm the hook appears as a read-only entry under Settings → Hooks; and check the install source — if installed via a third-party GitHub marketplace, hooks may not run (see [Known limitations](#known-limitations)). Reinstalling via option A (local marketplace source) restores full functionality.

**Cloning fails behind a proxy.**
Set `ZCODE_HTTP_PROXY=http://host:port` for the ZCode process before adding the marketplace. ZCode honors only this variable; a bare `http_proxy` is ignored.

**An official fails with a model error.**
The shipped model is the account-scoped GLM-5.3-Flash and does not resolve outside GLM-plan environments. Go to **Settings → Subagents → the Chuigong group** and pick an available model for each of the five officials — the change takes effect immediately and is not reset by plugin updates. See [Adapting to your own model](#adapting-to-your-own-model).

**An official replied `BLOCKED(红线: ...)`.**
That is the safety contract working as designed. The sovereign should adjudicate: choose an approach without red-line operations or perform the step itself (asking you first where required) — and never instruct the official to work around the line.

**No update is offered after a new release.**
Version detection reads the `marketplace.json` entry, so releases must bump the version in **both** `.zcode-plugin/plugin.json` and the marketplace entry (see [Versioning](#versioning)), then refresh the marketplace source.

## Versioning

See [CHANGELOG.md](CHANGELOG.md). Release rule: bump the version in **two** places — `.zcode-plugin/plugin.json` and the `marketplace.json` entry — keeping `name`, `version` and `description` identical between them; update detection compares against the marketplace entry's version.

## Contributing

- Issues and pull requests are welcome. Most files here are prompt engineering — small, surgical diffs beat rewrites.
- Keep `README.md` and `README_CN.md` semantically in sync.
- When reporting a bug, state your install source (marketplace or local directory), OS, and whether the sovereign mandate appears in a new session.

## License

[MIT](LICENSE) — free to use, modify and redistribute.

## Acknowledgments

- [obra/superpowers](https://github.com/obra/superpowers) — the grill-me interaction pattern inspired this plugin's 究诘 (`grill-me`) skill, and its spec-driven development (SDD) workflow inspired the `sdd` skill. Differences: chuigong fixes every role to one cheap Flash model (no model selection or rotation), tightens fix rounds from 5 to 3, gates `sdd` behind explicit user consent, and uses plain diff files as review packages instead of helper scripts.
- The `delegating` SOP distills field-tested multi-agent rules from community plugins (superpowers, frugal) and Anthropic's official multi-agent guidance: effort scaling, findings routed to the sovereign, resume-the-original-official fix loops, and escalation ladders.
- The name: 《易·系辞》「黄帝尧舜垂衣裳而天下治」 — later condensed to 垂拱而治. The sovereign folds hands; the ministries get things done.
