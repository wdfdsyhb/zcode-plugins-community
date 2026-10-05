---
description: Upgrade Remotion via the official CLI path and refresh official skills (official-first)
---

Bring the current project's Remotion packages AND the installed official Remotion
skills up to the latest stable. The official Remotion CLI / official
`remotion-upgrade` skill is the source of truth — never invent a parallel upgrade
algorithm. Two independent parts: run both, report both, continue past failures.

## Part A — Upgrade Remotion packages (official-first)

Record the previous version first: read `package.json` (or `npm ls remotion
--depth=0` / the matching package-manager equivalent).

**Case A1 — `@remotion/cli` is installed in the project** (official CLI path):

```bash
npx remotion upgrade
```

This is the official upgrader — it aligns all Remotion packages AND updates
project-local Remotion skills. Do not hand-edit package.json for the upgrade.

Windows note (real-world finding): a STALE local CLI can fail with
`spawn npm ENOENT` (older CLIs couldn't spawn npm on Windows). If that
happens, run the upgrade through a CURRENT CLI instead of hand-upgrading —
this form is cross-platform (no shell substitution, works in Bash,
PowerShell and cmd):

```bash
npx --yes --package=@remotion/cli@latest -- remotion upgrade
```

or drop to Case A2. `npx remotion versions` afterwards confirms either way.

**Case A2 — `@remotion/cli` is NOT installed** (manual path, exactly as the
official `remotion-upgrade` skill prescribes):

1. Get the target version: `npm view remotion version` (never scrape a docs page).
2. Find EVERY installed `remotion` and `@remotion/*` dependency across the
   project's package.json (all dependency sections; respect workspaces/catalogs)
   and upgrade them ALL to that one exact version with the detected package
   manager (bun/pnpm/yarn/npm — detect by lockfile). Preserve dependency
   sections and existing version-pin style (`--save-exact` if versions are exact).
3. Mediabunny: if `mediabunny` or any `@mediabunny/*` package is installed, read
   the official compatibility page
   https://www.remotion.dev/docs/mediabunny/version and upgrade all of them to
   the version documented for the target Remotion version.
4. Run the detected package manager's install so the lockfile is updated.

## Part B — Refresh official Remotion skills

Update the installed skills by name, from the ONE canonical list: the
`skills.names` array in `compatibility/remotion.json` (shipped in this plugin's
repository/cache; `node scripts/skill-names.mjs` prints it). Never use a
memorized list — a skill recorded in the manifest must never be silently
omitted from the update:

```bash
npx skills update <every name from compatibility/remotion.json skills.names> --yes
```

Scope flags: inside a project with project-scope skills add `-p`; for user-scope
skills add `-g`. If the skill list upstream has changed (an update report says a
name is unknown), say so — do not guess replacements. After updating, verify on
disk that `remotion-*` folders still contain SKILL.md and report the resulting
skill count and the version in `remotion-best-practices/SKILL.md` frontmatter.

## Verify (mandatory, both parts)

1. If `@remotion/cli` is available: `npx remotion versions` — all Remotion
   packages must show ONE version.
2. Inspect package.json + lockfile: every `remotion` / `@remotion/*` entry at
   the same exact version; Mediabunny packages at the documented compatible
   version. Run `npm ls remotion` (or matching pm) to confirm resolution.
3. Skills: folder count + SKILL.md presence verified on disk (Part B).

## Report to the user

- previous Remotion version → new Remotion version
- which path was used: official CLI (`npx remotion upgrade`) or manual
- skills refresh: success/failure, resulting skill count, skills version
- package consistency: pass/fail (all Remotion packages on one version)
- Mediabunny compatibility result, if Mediabunny packages are installed
- breaking changes the user must review: summarize relevant entries from
  https://github.com/remotion-dev/remotion/releases and
  https://www.remotion.dev/docs/upgrading for the crossed version range
