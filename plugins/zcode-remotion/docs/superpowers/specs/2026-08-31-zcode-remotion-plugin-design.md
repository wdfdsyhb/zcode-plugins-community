# ZCode Remotion Plugin — Design Spec

Date: 2026-08-31
Status: Approved (chat review) — pending user spec review
Target: Official ZCode Marketplace submission

## 1. Problem & Goal

Remotion ships first-party Agent Skills for Codex, Claude Code, Cursor and Kimi Code, but has no native ZCode plugin. Goal: a ZCode plugin that gives users the same — or better — one-pass video creation experience ("install → ask for a video → get an MP4"), at a quality the official ZCode marketplace accepts on first review.

Non-goals:

- No MCP servers, no hooks, no `userConfig` (zero-config plugin; smallest possible security surface).
- No vendoring of Remotion's skill content (licensing, see §3).
- No translation of official skill bodies (English stays canonical; our own content is English with bilingual trigger descriptions).

## 2. Key Research Findings

1. **Remotion official skills**: 12 slash-command skills (`remotion-best-practices`, `-create`, `-markup`, `-studio`, `-render`, `-maps`, `-captions`, `-saas`, `-interactivity`, `-docs`, `-upgrade`, `-multimedia`), maintained in `remotion-dev/remotion` at `packages/skills`, distributed via `npx skills add remotion-dev/skills` (agentskills.io convention).
2. **License constraint (decisive)**: the Remotion repo (including `packages/skills`, which has no separate license and is `private: true`) uses the custom "Remotion License": free tier grants use/modification to eligible entities, but **copying or modifying Remotion code to distribute your own derivative is not allowed**. Vendoring SKILL.md bodies into our plugin and publishing them would be redistribution — unacceptable legally and for marketplace review.
3. **ZCode native discovery (decisive)**: ZCode scans user-scope `~/.zcode/skills/` and `~/.agents/skills/`, plus workspace `.zcode/skills/` and `.agents/skills/` — the latter is exactly where the official `npx skills add` CLI installs. Official content can therefore be delivered to ZCode users **through the official channel, fetched by the user**, with our plugin never redistributing it.
4. **ZCode plugin spec**: `.zcode-plugin/plugin.json` (only required file) + optional `skills/`, `commands/`, `agents/`, `hooks/`, `.mcp.json`. Skills need SKILL.md with `name` + `description` (≤1024 chars; description quality drives auto-triggering). Marketplace = repo with `marketplace.json`; update detection keys off the version in `marketplace.json`. Official guidance: start with skills-only plugins.

## 3. Architecture: Official Content via Official Channel, Plugin as Integration Layer

```
User installs plugin
  → says "make me a video" (or runs /remotion-setup)
  → router skill auto-triggers
  → bootstrap: npx skills add remotion-dev/skills   (user fetches from Remotion directly)
  → 12 official skills land in ~/.agents/skills/ (or <repo>/.agents/skills/)
  → ZCode discovers them natively; /remotion-* commands live immediately
  → router skill continues: scaffold project → preview → still-frame check → render → verify MP4
```

Licensing posture: the plugin contains only original MIT-licensed content. Official skills are fetched by the user's own machine from Remotion's official installer; a NOTICE file documents this. Nothing of Remotion's is redistributed by us. The "stay in sync with upstream" problem disappears: users can re-run the official installer anytime via `/remotion-update`.

## 4. Plugin Components (all original content, English, bilingual descriptions)

```
zcode-remotion/                        # repo root = marketplace root
├── .zcode-plugin/plugin.json          # name: remotion, version, component declarations
├── skills/
│   └── remotion/SKILL.md              # router + core workflow (the single auto-trigger entry)
├── commands/
│   ├── remotion-setup.md              # bootstrap official skills + post-install self-check
│   ├── remotion-doctor.md             # environment health check & triage
│   └── remotion-update.md             # re-run official installer + upgrade project deps
├── scripts/verify-plugin.mjs          # static verification (CI-enforced)
├── .github/workflows/ci.yml           # verify + link check on PR
├── .github/workflows/drift-check.yml  # weekly upstream drift alarm (issue only, no auto-edit)
├── marketplace.json                   # version mirrors plugin.json (verified by script)
├── LICENSE / NOTICE / CHANGELOG.md / CONTRIBUTING.md / README.md
└── docs/                              # spec + verification report
```

### skills/remotion/SKILL.md — router + core workflow

One skill, the only auto-trigger entry (avoids 12 competing descriptions → mis-triggering; official skills handle domain depth after bootstrap). Contents:

1. **Trigger contract**: when to load this skill (any video/animation request; Chinese or English).
2. **Bootstrap gate**: if official skills not present in `~/.agents/skills` or `<repo>/.agents/skills`, run the installer before proceeding (never silently skip). Install scope: **user scope `~/.agents/skills/` by default** (available across all workspaces; higher discovery precedence), with an explicit opt-in for workspace scope `<repo>/.agents/skills/` when the user wants skills pinned to one project.
3. **Environment pre-flight**: Node ≥ 18 check, package-manager detection (bun > pnpm > npm > yarn, respect lockfiles), platform notes (Windows path/PowerShell quirks, macOS, Linux).
4. **Routing table**: map intent → official skill (`/remotion-create`, `/remotion-markup`, `/remotion-studio`, `/remotion-render`, …), tolerant to upstream renames (prefix match + link to official index).
5. **No-rework render loop**: render a still frame first (`--frames=1`), show user, get confirmation, then full render; verify output (duration, dimensions, file exists).
6. **Failure triage table**: common Remotion errors → cause → fix → escalate to `/remotion-doctor`.

### Commands

- `/remotion-setup` — run installer, verify discovery, print report of what became available. Idempotent.
- `/remotion-doctor` — check Node version, package manager, Chrome Headless Shell presence, Remotion package versions in current project, license tier hint; print pass/fail table + next actions.
- `/remotion-update` — re-run official skills installer (refresh) + upgrade Remotion deps in the current project if one exists.

### plugin.json / marketplace.json

- `name: remotion` (matches `^[a-z0-9][a-z0-9._-]{0,127}$`); version synced across both files (enforced by verify script).
- Marketplace entry with category/tags, bilingual description, repository/homepage links.
- No dependencies on other plugins.

## 5. User Experience Standards

- **Zero config, zero trust overhead**: no hooks/MCP/config; security review is trivial.
- **One-sentence cold start**: user never needs to know `/remotion-setup` exists; saying "帮我做个10秒的产品宣传视频" must bootstrap everything and complete the journey.
- **Bilingual auto-trigger**: skill description covers Chinese and English trigger vocabulary (视频/动画/渲染/字幕/宣传片/video/animation/render/caption/promo…).
- **No-rework visual gate**: still-frame confirmation before expensive renders; output verification after.
- **Failure = diagnosis**: every failure path ends in the triage table or `/remotion-doctor`, never a dead end.

## 6. Testing & Verification (three layers)

1. **Static verification** (`scripts/verify-plugin.mjs`, CI-blocking):
   - plugin.json valid (name regex, declared components exist);
   - SKILL.md frontmatter: required fields, description ≤1024 chars, describes trigger conditions;
   - command filenames match `^[a-z0-9][a-z0-9_:-]{0,63}$`, have descriptions;
   - marketplace.json version == plugin.json version;
   - no placeholder text (TBD/TODO/FIXME) in shipped files;
   - all http(s) links in README + skills resolve (200).
2. **Real-client install test** (manual checklist, `docs/verification-report.md`):
   - local marketplace.json → Settings → Plugins → add market → install → enable;
   - `/remotion-setup`, `/remotion-doctor`, `/remotion-update` visible and run;
   - trigger matrix: ≥10 real-world prompts (mixed Chinese/English) each load the router skill;
   - after bootstrap, all 12 official skills appear in `/` menu.
3. **End-to-end user-journey audit (one-pass requirement)** from a clean state:
   install → "make me a video" → project scaffold → Studio preview → still-frame confirm → render → verify MP4 (exists, duration, dimensions). Timed; results + Remotion version recorded in `docs/verification-report.md` and README ("tested against Remotion 4.0.x").

## 7. Release & Maintenance

- Versioning: semver; CHANGELOG per release; bump both json files (verified).
- CI: PR gate = verify-plugin + link check. Weekly drift-check compares our integration-layer claims against upstream release notes; opens an issue (never auto-edits).
- Publishing: push repo (marketplace.json at root) → submit to ZCode official marketplace per official process.
- Community files: README (animated demo GIF, 3-step install, skill table, FAQ, troubleshooting), CONTRIBUTING, LICENSE (MIT), NOTICE (upstream attribution + license pointer).

## 8. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| `npx skills` CLI behavior differs from assumption (install path, names, update subcommand) | First implementation step is a spike that runs the real CLI and records actual behavior; fallback = setup downloads upstream skill files verbatim into `.agents/skills/` (user-side fetch, still no redistribution by us) |
| Upstream renames/adds skills; routing table goes stale | Prefix-based tolerant routing + link to official index; weekly drift-check |
| Users without Node try to install | Doctor/setup give clear, actionable install guidance |
| Upstream license changes | drift-check watches LICENSE.md; NOTICE points users at it; hard stop if redistribution terms change |

## 9. Decisions Log

- Scope: all 12 official skills — delivered via official installer, not vendored (license audit forced the change from "port official content"; user approved revised architecture 2026-08-31).
- Components: skills + commands only; no hooks/MCP (user requirement: keep sync with upstream; solved structurally by official-channel delivery).
- Language: English content, bilingual descriptions (decided).
- Sync strategy A (repo-side sync script + GitHub Actions) was superseded by the no-vendoring architecture: nothing of upstream ships in the repo, so content sync is delegated to the official installer via `/remotion-update`.
