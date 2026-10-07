# ClarityKit

A **toolbox** of skills + tools, plus an **optional, explicitly-activated design flow**,
that turns vague design into reviewable artifacts — diagrams, behavior models, data
contracts, interactive HTML prototypes — so the user keeps control of product behavior
and UX while vibe coding.

All skills share one invocation rule: the user names the skill (in any language), or
the clarity-flow flow walks into its step — none of them self-activates from topic
overlap. They work in any order, inside any governing workflow (e.g.
[superpowers](https://github.com/obra/superpowers)) or a bare conversation. When the
user explicitly asks for it, the **clarity-flow** skill composes the same capabilities
into a staged design flow — running standalone or as a sub-flow of a host workflow's
thinking stage:

```
direction → requirements → behavior ⇄ architecture (chosen order) → data & contracts → ui → commission
```

The flow judges each step's necessity right before entering it (invoke directly when
needed; ask only when proposing to skip), tracks progress in `docs/clarity/flow.yaml`
(the resume point for future sessions), and closes with a signed delegation ledger —
what the implementing agent may decide alone vs. what forces a return.

## Skills

| Skill | Role |
|---|---|
| `clarity-flow` | The explicit design flow. Owns ordering, step necessity, flow.yaml, back-jumps, and the closing delegation ledger |
| `clarify-direction` | Rough direction → one-page frame: user, job, workaround, observable success, ≥3 non-goals |
| `clarify-requirements` | Idea → decidable brief + scope mindmap (+ optional story map / priority quadrant) |
| `clarify-architecture` | 2–3 stack candidates as diagrams + verified compatibility → ADR content; collapses to an ownership note for single-process tools |
| `clarify-behavior` | Behavior → scenario episodes + YAML statechart + hand-crafted views + acceptance criteria |
| `clarify-data` | What the system remembers and what crosses its boundaries: conceptual entity diagram, field-level ER + `contracts.yaml`, endpoint maps, error taxonomy |
| `clarify-ui` | Interactive grayscale HTML prototype (real logic, no backend, no visual design) |
| `clarify-acceptance` | Transition-coverage checklist + UX comparison (feeds the workflow's verification step) |
| `clarity-preview` | start/stop/status of the per-project preview server (You can choose not to use it and instead opt for another live server or simply open the HTML file directly. Also it can be used in other sessions as long as they belong to the same project.) |

## Principles

1. **Toolbox first; the flow is optional and explicit.** Every capability produces an
   artifact the user reviews and approves. `clarity-flow` activates only when the user
   asks for it by name — plain design discussions never trigger flow ceremony.
2. **Determinism over flexibility — the AI judges content, never routes artifacts.**
   Anything derivable is derived by tools: the project root (nearest `.git` upward), the
   staging dir (`<root>/docs/clarity/`), the server root, port allocation. The one
   exception — `flow.yaml` — is AI-maintained but CLI-validated on every command.
3. **Staging vs. handoff.** ClarityKit owns `docs/clarity/` as its staging area — fixed,
   never overridden. The ADR is the one handoff artifact: a governing workflow may file
   it in its own structure; otherwise it goes to `docs/adr/` with automatic numbering
   (`clarity adr`).
4. **Presentation contract.** Decision-grade content lives in the conversation; the user
   never has to open a file to decide. Published diagrams carry `%% title:` /
   `%% caption:` / `%% group:` directives so browser pages are self-explanatory; md
   files are archives for future agents.
5. **Every diagram forces a decision.** Necessary diagrams force the step's core
   decision; optional diagrams (impact map, story map, quadrant, deployment, decision
   tree, info-flow, journey…) force a specific side decision and are chosen per module
   with triggers — see `references/diagram-selection.md`, which also lists deliberately
   excluded diagram types with reasons.
6. **Behavior models and contract sheets are machine contracts; diagrams are human
   communication.** YAML is validated and drives prototypes/coverage; Mermaid views are
   hand-crafted for the decision at hand and always verified by `clarity check`.
7. **The preview site accumulates; the server is managed.** One stable index,
   per-directory pages, prototype links. Server lifecycle is deterministic (detached,
   registered, verified) and user-invoked.

## Layout

```
claritykit/
├── skills/            clarity-flow + seven clarify-* capabilities + clarity-preview
├── references/        behavior-model-schema.md / diagram-selection.md / mermaid-safe-syntax.md
├── tools/             clarity (CLI) · cli.mjs · server/preview/check/render/validate/status/versions · lib/
└── examples/          a complete reading-list project walked through the whole flow
```

## Install

ClarityKit ships as a plugin for OpenCode, Claude Code, Codex, Cursor, ZCode, Devin
(closed beta), and any [Agent Plugins](https://agent-plugins.org)-compatible client —
Pi installs it as a Pi package — and as plain skill directories + CLI for everything
else. The `clarity` CLI comes along on every path. Full per-agent guides (scopes,
pinning, **updating**, uninstalling, fallbacks): **[docs/install/](docs/install/README.md)**.

Quickstart:

```bash
# OpenCode — opencode.json (global or project):
{ "plugin": ["claritykit@git+https://github.com/maxi3777/claritykit.git"] }

# Claude Code:
/plugin marketplace add maxi3777/claritykit
/plugin install claritykit@claritykit

# Codex:
codex plugin marketplace add maxi3777/claritykit

# Cursor (Agent Plugins standard — local plugin):
ln -s ~/agent-kits/claritykit ~/.cursor/plugins/local/claritykit

# ZCode: 
Settings → Plugins → Add marketplace → maxi3777/claritykit
# Devin: 
devin plugins install https://github.com/maxi3777/claritykit
# Pi:    
pi install git:github.com/maxi3777/claritykit@v2.1.0

# Any other agent (clone + symlink — always works): 
see docs/install/generic.md
```

Verify any install with `clarity version` + `clarity doctor` (the CLI self-installs its
tool dependencies on first run). Maintainers: see [RELEASING.md](RELEASING.md) for the
version-bump discipline.

## How to use

**Every ClarityKit skill is manually invoked — none self-activates.** "Manual" means
*the user asks for it in conversation*: name the skill in any language, in plain words —
"Break down the data contract using clarify-data" is as manual as a `/skill` command. You don't need a
slash command; you need to *tell the agent* which skill to run. Two ways in:

1. **Name the skill directly** — works for all nine skills, anywhere (bare conversation,
   inside any workflow).
2. **Invoke `clarity-flow`** — the flow's steps (direction → requirements →
   behavior/architecture → data → ui → commission) then activate **automatically** as the
   flow walks them; you never invoke the step skills yourself.

Examples — telling the agent to run a skill:

```text
Use clarify-direction to frame this idea before we build anything.
Run clarify-requirements — turn this rough list into a decidable brief.
Take the checkout module through clarify-behavior.
clarify-architecture: give me three stack candidates for this, versions verified.
Use clarify-data to pin down what we store and what the API returns.
clarify-ui — prototype the upload flow so I can click through it.
Before we accept this, run clarify-acceptance on the save-bookmark module.
clarity-preview: start the preview server.
```

`clarity-flow` — several ways to invoke it:

```text
# 1. plain:
I want to develop an application, and here are my ideas/requirements..., use clarity-flow on this project.

# 2. as a sub-flow of a host workflow(optional):
..., use clarity-flow as a sub-flow.

# 3. architecture-first — when hard platform constraints dominate(optional):
..., use clarity-flow, architecture-first.
```

While no skill is named, ClarityKit stays silent: plain design discussion never
triggers flow ceremony.

## CLI

All tools are used through `clarity` — from anywhere inside the user's project. The project
root is derived (nearest `.git` upward, fallback: cwd); the staging dir is always
`<root>/docs/clarity/`. Commands that operate on the staging dir take **no directory
argument** — paths are derived, never chosen. Every command also validates
`docs/clarity/flow.yaml` when it exists (AI-maintained flow state; problems are reported
as `flow.yaml:` lines).

```bash
clarity doctor                     # diagnose the installation (PATH, node, deps, registry, flow.yaml)
clarity status                     # project snapshot: flow progress, artifact inventory,
                                    # preview server + site freshness — run this first in a session
clarity root                       # print derived project root + staging dir
clarity init                       # scaffold the staging layout (7 canonical buckets)
clarity init <name> [<name>]     # scaffold docs/clarity/behaviors/<name>/ (one call, many)
clarity adr                        # print next ADR path: docs/adr/ADR-NNN-<title>.md
clarity validate <model.yaml>      # lint a behavior model or contract sheet (auto-detected)
clarity render <behavior.yaml>     # generate machine views (generated-diagrams/*.mmd; scoped with --scope)
clarity check                      # verify every diagram in the staging dir parses
clarity publish                    # check, then on success build/update the preview site
clarity preview                    # build/update the preview site (skips the check)
clarity versions <spec...>         # batch-verify current versions (npm packages, gh:owner/repo)
                                    # for architecture compatibility analysis
clarity server start|stop|status   # per-project preview server — takes NO directory argument
```

The underlying `tools/*.mjs` scripts remain directly callable for tool-layer use (e.g.
`node tools/check.mjs <dir>` on an arbitrary directory), but skills and day-to-day work go
through `clarity` and never pass paths.

## License

MIT License
