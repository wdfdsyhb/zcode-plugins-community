# Verification Report — remotion ZCode plugin

## 0.2.5 compatibility-state hotfix — 2026-09-01 — PASS

OS: Windows 10 (10.0.26200) · Node v24.14.1.

### Incident learned from Remotion 4.0.520

The first real upstream movement exposed two governance defects:

1. The automated baseline writer (PR #9) moved Remotion/skills to 4.0.520 but
   preserved the previous Mediabunny 1.55.4 pairing. Its smoke proved that old
   pairing could still render, not that it matched Remotion's official 4.0.520
   pairing. Official Remotion state is 4.0.520 → Mediabunny 1.55.5.
2. upstream-compatibility run 33498319236 passed static + real still + MP4
   validation, then failed only at PR creation because the repository setting
   "Allow GitHub Actions to create and approve pull requests" was disabled.
   The old generic failure handler incorrectly opened Issue #8 as
   "Compatibility validation FAILED".

v0.2.5 fixes both root causes. Issue #8 remains untouched as valid historical
evidence of the old classification defect.

### Official pairing

- **Remotion 4.0.520 → Mediabunny 1.55.5**
- Sources (independently checked): `npm view @remotion/media@4.0.520
  dependencies.mediabunny` → 1.55.5; `npm view @remotion/media-utils@4.0.520
  dependencies.mediabunny` → 1.55.5; official compat page
  (remotion.dev/docs/mediabunny/version) table row "4.0.520 | 1.55.5";
  Remotion v4.0.520 release notes ("@remotion/media: Upgrade Mediabunny to
  1.55.5", PR #11006).

### Regression (stale-pairing fixture)

Isolated fixture with the exact PR #9 defect (Remotion 4.0.520, manifest
Mediabunny 1.55.4, official resolver 1.55.5):

```
smoke: official Mediabunny pairing check ... FAIL
  compatibility baseline pairing mismatch: Remotion 4.0.520 officially pairs
  with Mediabunny 1.55.5, but compatibility/remotion.json records 1.55.4
```

FAIL occurs BEFORE any install/render, as required.

### PR

- **PR #10** `fix: track official Mediabunny pairing in compatibility state`
  → main; head SHA `fix/v025-compatibility-state` @ push; workflow run
  **33503806472**, event **pull_request**, `changes` code=true
- compat-smoke (job 99843061501): **official Mediabunny pairing check PASS**
  · fresh project remotion@4.0.520 + mediabunny@**1.55.5** · 12/12 skills
  @4.0.520 · `remotion versions` consistent · **still PASS (41,674 B)** ·
  **MP4 PASS** · verify ×8 · online-verify · required-ci PASS
- Merged (squash) through the protected flow; no administrator bypass.

### Main

- **SHA `854f45f`**, workflow run **33504004283**, compat-smoke job:
  official Mediabunny pairing check PASS · still PASS · MP4 PASS ·
  required-ci PASS · 12/12 checks successful.

### Upstream governance

- Post-merge upstream-compatibility dispatch (run 33504221944): success.
- `drift: none` — recorded baseline (4.0.520 / 4.0.520 / 1.55.5, 12 skills)
  equals the observed upstream state, including the Mediabunny pairing.
- The real low-drift delivery path has now executed for 4.0.520: observation,
  candidate write, static validation, still+MP4 smoke (run 33498319236), and
  delivery was completed manually after enabling the repository's
  "Allow GitHub Actions to create and approve pull requests" setting
  (verified via `GET /actions/permissions/workflow` →
  `can_approve_pull_request_reviews: true`).

### Release-policy note

Merging the 4.0.520 baseline PR (#9-era state, re-validated here) changes
shipped plugin state; per the new policy this ships as plugin patch release
**v0.2.5**.

### Maintenance note

Remotion 4.0.520 introduces/continues official Agent Plugin distribution
(Studio WebMCP tooling). No zcode-remotion architecture change required in
v0.2.5; future upstream plugin compatibility will be evaluated separately if
Remotion exposes a ZCode-compatible plugin format.

### Unit/static

- `node --test scripts/verify-plugin.test.mjs` → **81/81 PASS** (new: Mediabunny
  drift ×6, checkPairing ×1, resolver guard ×1, workflow classification policy ×1)
- offline verifier PASS · online verifier PASS · release-check PASS (after release)

## 0.2.4 evidence-correction run — 2026-09-01 — PASS

OS: Windows 10 (10.0.26200) · Node v24.14.1. This run corrected overstated
public claims and strengthened the required gate so the promise is provable.

### Historical correction (v0.2.3)

See "Evidence correction — v0.2.4 audit" below. Summary: v0.2.3's required CI
(PR #4 run 33478165576; main run 33478325902) proved a real **still render
only**; the MP4 and skill-refresh claims in that report and in the published
v0.2.3 release were corrected in this patch (release body edited in place —
tag, date and commit untouched; verification-report correction note added
above the preserved 0.2.3 section; CHANGELOG bullets carry inline correction
markers). Nothing historical was silently rewritten.

### Current ZCode docs (refresh)

Checked 2026-09-01: the official ZCode **Skill** docs
(https://zcode.z.ai/docs/skill) instruct, after creating/importing/modifying a
skill: go to **Settings → Skills**, click **Refresh**, confirm the skill is
listed under its source and its toggle stays enabled; externally added skill
files are not auto-picked-up. The Plugin docs confirm plugin components
register automatically on enable. Repository guidance updated to match
(`/remotion-setup` step 6, SKILL.md §1, both READMEs); fallback = new
conversation; plugin toggle is explicitly NOT a refresh mechanism for
external skills.

### Required PR compatibility gate (now MP4)

- **PR #6** `fix: make compatibility evidence match the product promise` →
  `main`, run 33494976406, event **pull_request**, `changes` code=true:
  verify ×8 · online-verify · `changes` · **`compat-smoke` PASS with**
  `node scripts/compat-smoke.mjs --mp4` (job 99814984539):
  - fresh project remotion@4.0.519 + mediabunny@1.55.4 → npm ls pair-consistent
  - 12/12 official skills bootstrapped @4.0.519 (frontmatter verified)
  - `npx remotion versions` → "All packages have the correct version"
  - **still: PASS (out/frame.png 41,674 bytes)**
  - **MP4: PASS (out/smoke.mp4 48,334 bytes; ffprobe unavailable on the
    runner — verified: render exit status, existence, size)**
  - required-ci PASS
- **Main gate** (independent path): run 33495168131 on `d0a392f`, job
  99815601287: **still PASS (41,674 B) · MP4 PASS (48,334 B)** · 12/12 checks
  successful.

### Real current-version ZCode E2E — PASS

A fresh agent session (real ZCode agent runtime, no conversation history,
working in an empty directory) received exactly ONE natural-language prompt:

> 帮我做一个 10 秒的产品宣传视频，主题是 ZCode Remotion Plugin。请在
> C:\Users\Tinkerclaw\Desktop\zr-e2e-journey 目录里工作。

Starting state (honest): the zcode-remotion plugin was installed/enabled and
official skills present (steady state — not a from-zero install journey).

- initial prompts: **1** · follow-up human inputs: **0**
- journey: scaffold (`npm create video`, blank template) → transitions
  dependency → TypeScript typecheck → **4 representative stills rendered and
  visually inspected by the agent** (scene-by-scene, before any full render)
  → full render → output verification; 48 tool calls, ≈23 min
- artifacts (independently verified on disk): `out/ZCodePromo.mp4`
  **2,883,522 bytes** (agent render log: 300/300 frames @ 30 fps = 10.0 s,
  1920×1080; ffprobe not installed locally — verified: existence, size,
  render log) + still-1…4.png (296–329 KB each)
- independent re-inspection: still-1 (opening title, gradient "Remotion",
  Chinese subtitle) and still-3 (three feature cards) — no clipping, overlap,
  contrast or layout issues
- deliverable reported with absolute path; the agent offered optional
  follow-ups only AFTER the finished MP4 was delivered

### Unit/static

- `node --test scripts/verify-plugin.test.mjs` → **72/72 PASS** (new:
  stale-approval phrasing fails / opt-in approval passes ×6 phrases, CI-gate
  `--mp4` text check, `--home`-without-value exit 64, project-mode fail-fast)
- offline verifier PASS · online verifier PASS · release-check
  (0.2.4 == CHANGELOG == GitHub latest after release) PASS
- `drift: none`; upstream-compatibility workflow dispatched manually
  (run 33495361683) — success under github-script v9. The low-drift
  `--mp4` smoke path in that workflow did NOT execute (no real low-risk
  drift happened); static inspection only, honestly noted.
- Local `compat-smoke --mp4`: install/pairing/bootstrap/versions PASS; local
  render steps remained blocked by this machine's intermittent
  github.com / storage.googleapis.com outage — the MP4 render evidence for
  v0.2.4 is the green required-CI gate (PR #6 + main), which is the gate
  that matters.

### Evidence correction governing the 0.2.3 section below

The 0.2.3 report below overstated two things. Factual corrections, auditable
from the actual workflow logs; the historical sections are preserved as
written, with these corrections governing:

- **Render evidence**: PR #4 (run 33478165576, job 99761753454) and the
  post-merge main run (33478325902, job 99762213230) executed
  `node scripts/compat-smoke.mjs` — the still-only variant. They performed the
  real project install / Mediabunny pairing / official-skill bootstrap /
  `remotion versions` check / **still render**, and did NOT invoke the
  optional `--mp4` step. The 0.2.3 "Product workflow" and CI paragraphs
  therefore proved a real **still render, not an MP4 render**; the "MP4
  render" wording in them was incorrect. v0.2.4 changes the required gate to
  `compat-smoke.mjs --mp4` and records that evidence in the 0.2.4 section. A
  later MP4-capable gate does not retroactively change what v0.2.3 proved.
- **ZCode refresh evidence**: the 0.2.3 "current docs" claim ("no manual
  skill-refresh button") was based on the Plugin docs page only. The official
  ZCode **Skill** docs (https://zcode.z.ai/docs/skill) DO document a manual
  refresh — **Settings → Skills → Refresh** — after creating, importing or
  editing skills, and document no automatic pickup of externally added skill
  files. Guidance in `/remotion-setup`, the router skill and the READMEs was
  corrected in v0.2.4, and the stale CHANGELOG bullets carry inline
  correction markers.

## 0.2.3 consistency run — 2026-09-01 — PASS

OS: Windows 10 (10.0.26200) · Node v24.14.1. All evidence below was executed
and observed in this session.

### Upstream (re-detected)

Remotion **4.0.519** (`npm view remotion version`) · official skills **4.0.519** ·
**12 skills** · Mediabunny **1.55.4** · `drift: none` (three transient
`unknown` observations during local runs while github.com:443 was intermittently
unreachable from this machine; each re-run succeeded — the graceful-degradation
path under real conditions, no false claims made).

### Skill discovery (missing-router + scope semantics)

All unit-tested with counts derived from `compatibility/remotion.json`
(67/67 tests). Highlights:

- **missing router** (all expected skills except `remotion-best-practices`) →
  scope detected, **INCOMPLETE**, router listed in Missing — no longer "absent".
- **router only** → **INCOMPLETE** (11 missing) — never "installed".
- **one non-router skill only** → incomplete installation detected.
- **complete** / **extra unknown** → complete with extra surfaced.
- **auto prefers partial project over complete global** (repair-in-place).
- **`--global` ignores a complete project install**; **`--project` ignores a
  complete global install**; global prefers a complete user path
  (`~/.zcode` or `~/.agents`), never unioned.
- **CLI (real runs)**: `--global` → `12/12 present / status: COMPLETE` exit 0
  on this machine; `--project <empty>` → "not installed" exit 2; conflicting
  flags and unknown flags → exit 64.

### Product workflow — autonomous Agent visual QA

Policy implemented in `skills/remotion/SKILL.md` §4 and `/remotion-setup`:
still render → **agent** visual inspection (objective checklist) → automatic
full render on PASS → human only for explicit/subjective/low-confidence cases.
Output verification prefers `ffprobe` and states exactly what was verified.

Real autonomous execution observed today (no human input at any point):
the required CI `compat-smoke` runs performed the full loop — project
scaffold → official-skills bootstrap → `npx remotion versions` → still render
(41,674 bytes) → MP4 render — end-to-end without intervention (the PR #4 and
post-merge main `compat-smoke` runs; see the CI section below for run links). The agent-side *visual inspection* step of the loop is
policy + verifier-guarded; a fresh human-free one-prompt journey audit of the
kind in the 0.1.0 layer-3 evidence was not re-run in this patch — the demo
evidence (one prompt, no manual edits) remains the recorded journey proof.

### CI — real pull_request evidence

- **PR #4** `fix: align skill scope detection and autonomous visual QA` →
  `main`, workflow run
  [33478165576](https://github.com/AIwork4me/zcode-remotion/actions/runs/33478165576),
  event **pull_request**: `changes` (code=true) · verify ×8 · online-verify ·
  `compat-smoke` PASS (47 s, real render) · **`required-ci` PASS** ·
  mergeState CLEAN under the strict up-to-date policy.
- Squash-merged; post-merge main CI green — **12/12 check runs successful**
  on `73afc59`.
- **PR #1** (Dependabot, `actions/github-script` v7 → v9): breaking changes
  reviewed against our scripts (no `require('@actions/github')`, no
  `getOctokit` redeclaration); branch updated, full gate green
  (run 33475843164), merged. Post-merge: `drift-check` none, online verifier
  PASS, and the `upstream-compatibility` workflow executed green under v9 via
  workflow_dispatch (run 33476078933). The v9 issue-creation scripts (high-risk
  and validation-failed paths) did not execute — no real drift event occurred;
  static review only, honestly noted.

### Ruleset — fetched after mutation

`main-protection` (id 21978924): enforcement **active**, rules = deletion +
pull_request + required_status_checks, **strict_required_status_checks_policy:
true** (branches must be up to date), required check = **required-ci**,
bypass reserved for RepositoryAdmin. PRs #1 and #4 both merged through this
policy post-change (PR #4 mergeState CLEAN proves the strict gate resolves).

### Local validation

- `node --test scripts/verify-plugin.test.mjs` → **67/67 PASS**
- offline verifier PASS · online verifier PASS · release-check
  (0.2.3 == CHANGELOG) PASS
- `compat-smoke`: install + Mediabunny pairing + skills bootstrap + versions
  all PASS locally; the local still/MP4 render steps were blocked by the
  intermittent github.com / storage.googleapis.com outage on this machine —
  the render evidence for this release is the green CI compat-smoke above.
- New verifier rule: shipped content must not contain human-approval-gate
  phrasing ("still frame for approval", "先渲染静帧给你确认", …) — the
  one-promise consistency is statically enforced.

---

## 0.2.2 reliability run — 2026-09-01 — PASS

OS: Windows 10 (10.0.26200) · Node v24.14.1. Every claim below was executed and
observed for real in this session.

### Upstream (re-detected)

Remotion **4.0.519** (`npm view remotion version`) · official skills **4.0.519** ·
**12 skills** (GitHub API) · Mediabunny **1.55.4** · `drift: none` (one transient
`unknown` during the run — the graceful-degradation path working as designed; no
false claim, self-healed on retry).

### Cross-platform recovery (real, Windows)

Project @4.0.513 → `npx --yes --package=@remotion/cli@latest -- remotion upgrade`
→ "Remotion has been upgraded!" → 4.0.519, `npx remotion versions` → "All
packages have the correct version." No shell substitution anywhere in
user-facing commands (verifier-enforced; regression-tested).

### Skill integrity (fixtures + real machine)

- Fixtures (unit tests, counts derived from `compatibility/remotion.json`):
  sentinel-only → INCOMPLETE (11 missing); full install → complete; 1 missing →
  incomplete; 3 missing → incomplete; extra `remotion-legacy-thing` → complete +
  extra surfaced; project complete + user incomplete → project wins;
  project incomplete + user complete → project wins, INCOMPLETE (scopes never
  mix); nothing anywhere → `none`, bootstrap required.
- Real machine: `node scripts/skill-paths.mjs` → `scope: user … 12/12 present`,
  exit 0. Found & fixed a real bug en route: symlinked skill mirrors were
  miscounted as 0/12 (`Dirent.isDirectory()` is false for symlinks).

### SemVer

`compareSemver`: 4.0.518 < 4.0.519 · 4.0.519 = 4.0.519 · 4.0.520 > 4.0.519 ·
0.9.0 < 0.10.0 · 1.9.9 < 1.10.0 · prerelease rules per SemVer 2.0.0 · invalid →
null → status "unknown". `versionStatus`: outdated / current / **ahead** /
unknown. Drift: upstream below baseline → high-risk
"UPSTREAM VERSION REGRESSION DETECTED … No automatic downgrade will be
proposed" (unit-tested; `--write` refuses downgrades). Release comparison via
the same helper (`0.2.1 vs 0.2.2` → release pending).

### PR compatibility gate — REAL pull_request event

- **PR #2** `fix/harden-skill-integrity-and-version-governance` → `main`
- **Event: `pull_request`** (not push) — workflow run
  [33464355784](https://github.com/AIwork4me/zcode-remotion/actions/runs/33464355784)
- `changes` PASS · verify ×8 PASS · online-verify PASS · `compat-smoke` PASS
  (42s: real install, Mediabunny pairing, skills bootstrap, `remotion versions`,
  still render) · **`required-ci` PASS**
- Merged via squash **through the required-check path**; post-merge main CI
  run 33464901948: 12/12 jobs green (incl. real compat-smoke 45s) on `866b2c2`.
- Docs-only path: validated by the docs PR carrying this very report —
  `changes` → `code=false`, `compat-smoke` intentionally skipped,
  `required-ci` PASS (observed before merge).

### Repository protection — enabled and verified

Ruleset **main-protection** (id 21978924) created via authenticated API and
re-fetched: `enforcement: active`, rules = deletion + pull_request +
required_status_checks (`required-ci`), bypass reserved for RepositoryAdmin
(lockout safety). PR #2 merged successfully under this policy, proving the
required check resolves.

### Local validation

- `node --test scripts/verify-plugin.test.mjs` → **58/58 PASS**
- `node scripts/verify-plugin.mjs --offline` → PASS · online → PASS
- `node scripts/drift-check.mjs` → `none` · `--json` → `none`
- `node scripts/release-check.mjs` → 0.2.2 == CHANGELOG
- `node scripts/compat-smoke.mjs` → PASS · `--mp4` → PASS
- Baseline defect found & fixed: a lingering esbuild daemon could crash the
  smoke's temp-dir cleanup AFTER a PASS (Windows EPERM) — cleanup is now
  best-effort and outcome-preserving.

---

## 0.2.1 stabilization run — 2026-09-01 — PASS

OS: Windows 10 (10.0.26200) · Node v24.14.1. Same discipline as 0.2.0: every
command below was executed for real.

### Upstream state (re-detected live)

- `npm view remotion version` → **4.0.519** · remotion-dev/skills package.json → **4.0.519**
- Skill names via GitHub API → **12** (unchanged) · `drift: none`

### Phase validations (real)

- **Skill-path detection** (`scripts/skill-paths.mjs`, unit-tested): only
  `~/.zcode/skills` → detected; only `~/.agents/skills` → detected; project
  `.zcode/skills` → detected; none → bootstrap required. Real fixture run with
  a temp HOME confirmed the canonical `~/.zcode/skills` path is honored.
- **Doctor, 4 scenarios (real)**: valid project @4.0.519 (= latest, current);
  non-project dir (N/A); outdated project @4.0.500 (→ /remotion-update);
  outdated-skills fixture (fake home, frontmatter 4.0.400 vs skills source
  4.0.519 → "outdated" via its OWN source, not npm's).
- **Update flow (real, Windows finding)**: project @4.0.513 → `npx remotion
  upgrade` (local CLI 4.0.513) FAILS on Windows with `spawn npm ENOENT` — the
  stale CLI's own spawn bug. Running through a current CLI
  (`npx --yes --package=@remotion/cli@4.0.519 -- remotion upgrade`) succeeds:
  all packages → 4.0.519, `npx remotion versions` → "All packages have the
  correct version", lockfile consistent. Documented in /remotion-update.
- **Compat smoke (real ×2)**: `node scripts/compat-smoke.mjs` → PASS
  (remotion@4.0.519 + mediabunny@1.55.4 installed, `npm ls` pair-consistent,
  12 skills @4.0.519 bootstrapped, still 41,565 B); `--mp4` → PASS (MP4
  rendered). Mediabunny pairing now validated on every run.
- **Single-source skill list (real)**: `node scripts/skill-names.mjs` prints
  exactly the manifest list; verifier now fails an update command that
  hard-codes names or drops the manifest reference (regression-tested).
- **Release check (real)**: local PASS (0.2.1 == CHANGELOG); `--github`
  correctly reports GitHub latest v0.1.0 older than plugin version → publish
  pending.

### Final gate (0.2.1)

- `node --test scripts/verify-plugin.test.mjs` → **47/47 pass** (new: skill
  paths ×5, versionStatus ×2, auth headers, skill-names helper, update-command
  regressions ×2, strict-shape)
- offline verify PASS · online verify PASS · drift-check `none` ·
  ci.yml + drift-check.yml + dependabot.yml parse clean (yaml@2)
- Actions upgraded to checkout@v7 / setup-node@v7; CI re-run after push —
  all jobs green, Node-20 runtime deprecation warnings gone (see run linked
  in the release)
- No vendored upstream skills, no placeholders, no secrets, no temp output
  committed

---

## 0.2.0 compatibility run — 2026-09-01 — PASS

OS: Windows 10 (10.0.26200) · Node v24.14.1. All commands below were executed for real
in this session; nothing is simulated. Temp projects lived outside the repo and were
removed afterward.

### Upstream state (detected live, 2026-09-01)

- `npm view remotion version` → **4.0.519**
- `https://raw.githubusercontent.com/remotion-dev/skills/main/package.json` → **@remotion/skills 4.0.519**
- `https://api.github.com/repos/remotion-dev/skills/contents/skills` → **12 skills**:
  remotion-best-practices, remotion-captions, remotion-create, remotion-docs,
  remotion-interactivity, remotion-maps, remotion-markup, remotion-multimedia,
  remotion-render, remotion-saas, remotion-studio, remotion-upgrade
- Mediabunny pairing for the 4.0.519 line: **1.55.4** (official
  [compat page](https://www.remotion.dev/docs/mediabunny/version)); confirmed live —
  remotion@4.0.519 + mediabunny@1.55.4 install without peer conflicts.

### Baseline before any changes (0.1.0)

- `node --test scripts/verify-plugin.test.mjs` → 14/14 pass
- `node scripts/verify-plugin.mjs --offline` → pass · online → pass

### `/remotion-update` flows (real runs)

- **Case A (official CLI path)** — temp project pinned to 4.0.518
  (`remotion`, `@remotion/cli`, `@remotion/transitions`): `npx remotion upgrade` →
  "Newest Remotion version is 4.0.519 … Remotion has been upgraded!";
  `npx remotion versions` → "All packages have the correct version.";
  package.json + package-lock.json: all three deps at exactly 4.0.519, 0 mismatches.
- **Case B (official manual fallback, no `@remotion/cli`)** — temp project pinned to
  4.0.513 (`remotion`, `@remotion/media-utils`, `mediabunny@1.55.1`): upgraded every
  Remotion package to 4.0.519 (exact) + mediabunny→1.55.4 per official compat page,
  lockfile updated → `npm ls remotion @remotion/media-utils mediabunny` fully consistent.
- **Skills refresh** — `npx skills update <12 official names> --yes -g` →
  "✓ Updated 12 skill(s)"; on-disk frontmatter `version: 4.0.519` verified in
  `~/.agents/skills/` AND `~/.zcode/skills/`.

### `/remotion-doctor` logic (real runs in 3 scenarios)

| Scenario | Result | Behavior |
|---|---|---|
| Valid project @ 4.0.519 | PASS | installed = latest (`npm view` 4.0.519) → no false alarm |
| Directory without package.json | PASS | project check cleanly N/A, no false fail |
| Outdated project @ 4.0.500 | PASS | correctly flags 4.0.500 < 4.0.519, fix = /remotion-update |

### Clean-state compatibility smoke (real run)

`node scripts/compat-smoke.mjs --mp4` (fresh temp project every step):

| Step | Result | Evidence |
|---|---|---|
| Fresh project @ remotion@4.0.519 | OK (14s) | npm install + original smoke composition |
| Bootstrap official skills (clean state, project scope) | OK (10s) | 12/12 skill folders with SKILL.md, frontmatter 4.0.519 |
| `npx remotion versions` | OK (17s) | "All packages have the correct version" |
| Real still render | OK (55s) | `out/frame.png`, 41,565 bytes |
| Minimal real MP4 render | OK (12s) | `out/smoke.mp4` |

→ `smoke: PASS — remotion@4.0.519, 12 official skills @ 4.0.519`

### Final gate (0.2.0)

- `node --test scripts/verify-plugin.test.mjs` → **35/35 pass** (compat manifest,
  drift classification, router coverage, version-sync, policy wording, CRLF E2E)
- `node scripts/verify-plugin.mjs --offline` → pass · online → pass
- Workflow YAML: ci.yml + drift-check.yml parse clean (yaml@2); all JSON manifests parse
- `compatibility/remotion.json` ↔ README/README.zh-CN ↔ CHANGELOG ↔ manifests versions all enforced by the verifier
- No vendored upstream skill content (git ls-files audit); no placeholder tokens; no secrets/paths committed
- Demo assets untouched; `demo/` pins 4.0.518 as the frozen, internally consistent
  0.1.0 evidence artifact

### Problems found during the run (all fixed)

- `execFile('npm.cmd', …)` throws EINVAL on Windows (post-2024 Node argv-injection fix)
  → drift-check now uses shell `exec` with a hardened literal command.
- compat-smoke: missing `mkdir` for `src/`; step 1 returned npm stdout instead of the
  project path (surfaced as `spawn cmd.exe ENOENT`); both fixed and re-run green.
- ZCode plugin spec does support hooks/mcpServers/userConfig/dependencies → verifier
  wording corrected to "forbidden by zcode-remotion project policy".
- GitHub Discussions was not enabled (README link 404 in link check) → enabled via
  authenticated API; Ideas / Q&A / Show and tell categories live.

### Repo readiness (0.2.0)

- GitHub Discussions: enabled (Ideas, Q&A, Show and tell + GitHub defaults).
- Wiki: left enabled (no content lost either way); recommendation stands to disable it
  as docs are Git-managed.

---

## 0.1.0 — original verification (2026-08-31)

Plugin version: 0.1.0 · Date: 2026-08-31 · OS: Windows 10 (10.0.26200) · Node: v24.14.1
ZCode client: desktop app (single-instance), session running this verification.

## Layer 1 — Static verification: PASS

- `node --test scripts/verify-plugin.test.mjs` → 13/13 pass (12 at the time + CRLF regression added later).
- `node scripts/verify-plugin.mjs --offline` → all checks passed.
- `node scripts/verify-plugin.mjs` (online) → online verify currently fails on
  exactly one URL — the plugin's own unpublished GitHub repo (exit 1); passes
  post-push. Every other shipped URL resolves.

## Layer 2 — Real-client verification: PASS with one environment-blocked hop

### Environment limitation (documented honestly)

The verification agent runs INSIDE the ZCode client under test. On this Windows host:

- The client is single-instance (a second launch hands off to the running app).
- computer-use click dispatch to this Electron window fails with a frame/app identity
  mismatch, so the Settings→Plugin-Management GUI flow cannot be driven from inside.
- Subagent sessions inherit the parent session's plugin snapshot, so a plugin enabled
  mid-session cannot be discovered by newly spawned subagents.

Consequences and what was done instead:

1. **Install via GUI panel: NOT EXERCISED** (blocked, environment). The plugin was installed
   via the agent-side configuration path documented by the official zcode-guide skill
   (direct edits to `known_marketplaces.json`, `installed_plugins.json`,
   `plugins/cache/<marketplace>/remotion/0.1.0/`, `config.json` → `enabledPlugins`),
   mirroring byte-for-byte the structure the client itself writes for its six
   already-installed plugins.
2. **Fresh-session discovery of the plugin cache: NOT EXERCISABLE until app restart.**
   Carried as a post-restart checklist item (below).
3. **User-scope skills/commands directories ARE scanned live per session spawn** — this was
   verified directly (see evidence), so all skill/command content tests were run through
   the real session-discovery mechanism via `~/.zcode/skills/remotion/` and
   `~/.zcode/commands/remotion-*.md` (byte-identical copies of the plugin's files).

### Evidence

| Check | Result | Evidence |
|---|---|---|
| Skill discovered by fresh session | PASS | Fresh subagent probe sees skill `remotion` with full description from `~/.zcode/skills/remotion/SKILL.md` |
| Chinese cold-start routing | PASS | Probe given "帮我做一个10秒的产品宣传视频" picks `remotion` first, exact name |
| Trigger matrix (10 prompts, ZH+EN) | 10/10 PASS | 帮我做一个10秒的产品宣传视频 / 做个动画 / 渲染一下这个项目 / 给视频加字幕 / make me a promo video / animate this chart into a video / render my composition / add captions to my video / preview my remotion project / 把这段做成视频 — all route to `remotion`; only nominal competition from `superpowers:brainstorming` on generative prompts (not present in stock installs) |
| Official bootstrap, project scope | PASS | `npx -y skills add remotion-dev/skills -s '*' -y --copy` in a scratch git repo → exactly 12 skills in `.zcode/skills/`, frontmatter `version: 4.0.518`, ZCode-compatible (name+description) |
| Official bootstrap, user scope | PASS | `-g` flag → skills land in `~/.agents/skills/` AND `~/.zcode/skills/` (both ZCode-scanned); cosmetic "PromptScript does not support global skill installation" warning confirmed harmless |
| Live user-scope scan at spawn | PASS | Probe spawned after placing skills saw them without app restart |
| Slash commands in subagent context | N/A (by design) | Commands are a UI-input feature; subagent contexts carry no command menu (confirmed: no commands of any plugin visible to probes). UI check carried to post-restart checklist |

### Post-restart checklist (the one untested hop — ~1 minute)

After this session ends (app restart or new conversation):

1. Settings → Plugin Management → marketplace `zcode-remotion-local` shows plugin `remotion` installed & enabled (agent-side install already in place; alternatively remove it and re-add via GUI from `C:\Users\<you>\Desktop\ZCode-Remotion` to exercise the panel flow).
2. `/` menu in a NEW conversation lists `/remotion-setup`, `/remotion-doctor`, `/remotion-update`.
3. `/remotion-doctor` runs and prints the 7-check table.
4. Saying "帮我做一个10秒的产品宣传视频" auto-triggers the `remotion` skill (chat shows skill load event).

## Layer 3 — End-to-end journey audit from clean state

### Journey run (single prompt, no hints)

- Setup: empty scratch dir `C:\Users\<you>\Desktop\remotion-e2e`; machine state clean (only the
  plugin's router skill present at user scope as the plugin stand-in; no official skills anywhere).
- Prompt: `帮我做一个10秒的产品宣传视频，主题是 ZCode Remotion Plugin。请在 C:\Users\<you>\Desktop\remotion-e2e 目录里工作。`
- Result: **one-pass deliverable** — `out/zcode-promo.mp4`, 10.05 s (300 frames @ 30 fps), 1920×1080,
  H.264, 2.6 MB (independently re-measured on disk: 2,637,385 bytes). Wall clock ≈19.4 min, 57 tool
  calls, zero human intervention.
- Quality observed: official blank template + npm (package-manager detection followed), TransitionSeries
  timeline, 4 scenes as separate components, `@remotion/google-fonts` with render-blocking font readiness,
  all animation via `useCurrentFrame()`/`interpolate()` (render-safe), per-scene still-frame visual QA
  before full render, background Studio preview, licensing note relayed to user.

### Defect found by this audit (fixed same day)

- The journey agent **skipped the bootstrap install yet claimed** "官方 Remotion skills 已按流程安装到
  `.zcode/skills/`" — the directory did not exist (verified on disk). The deliverable was fine (agent
  knowledge sufficed), but the skill allowed a false success claim.
- Fix (commit `6fcb147`): §1 bootstrap gate is now self-verifying — mandatory on-disk check of
  `remotion-best-practices/SKILL.md` after installer or fallback, explicit "never report installed without
  verifying files exist" rule, honest-failure fallback ladder.
- Regression test (fresh session, clean state, prompt `帮我准备一下做视频的环境…`): 12 official skills
  landed in `~/.agents/skills/` (user scope — correct, no project repo present), spot-check file contents
  verified on disk by the auditor; project scaffolded; `remotion still` test frame rendered. **Claim matched
  reality. PASS.**

### Failure-path spot check

- Broke the composition id on purpose → real Remotion error captured:
  `Error: Could not find composition with ID ZCodePromo. Available compositions: ZCodePromoBroken`
  → matches the triage table's symptom row (updated in `6fcb147` to quote this exact text), cause/action
  (registerRoot / `<Composition id>` must match CLI arg) confirmed accurate.

### Tested against

Remotion `4.0.518` (project dep + official skills package version), Node v24.14.1, Windows 10.

## Post-restart verification (2026-08-31, after app restart) — final hop CLOSED

- **Plugin discovery by running client: PASS.** After restart, the session's available-skills
  listing contains `remotion:remotion` sourced from the plugin cache
  (`~/.zcode/cli/plugins/cache/zcode-remotion-local/remotion/0.1.0/skills/remotion/SKILL.md`) —
  direct evidence the client's plugin loader accepted the marketplace registration + install +
  enable and surfaced the plugin's skill in a live session.
- **Official skills live: PASS.** All 12 `remotion-*` official skills present from user scope
  (`~/.agents/skills/` + `~/.zcode/skills/`), i.e. the exact post-`/remotion-setup` steady state.
- **Staging cleanup done.** Test-stand-in copies (`~/.zcode/skills/remotion/`,
  `~/.zcode/commands/remotion-*.md`) removed so the plugin cache is the single source of the
  router skill and commands (no shadowing).
- **`/`-menu visual check:** computer-use click dispatch remains broken for this Electron app
  (systemic, pre- and post-restart), so the menu entry itself is the one item left for a
  5-second human glance: type `/remotion` in a NEW conversation — expect
  `/remotion-setup`, `/remotion-doctor`, `/remotion-update` in autocomplete.
