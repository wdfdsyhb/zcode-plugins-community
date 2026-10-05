---
description: Diagnose the Remotion + ZCode environment (Node, package manager, skills, versions, Chrome)
---

Run each check, collect results, then print ONE pass/fail table with fixes. Do
not attempt fixes before reporting. Machine-readable version sources, kept
STRICTLY separate (a Remotion release and a skills release are different
artifacts — never infer one from the other):

- Remotion latest stable: `npm view remotion version`
- Official skills latest: the `version` field in the official
  remotion-dev/skills package metadata
  (https://raw.githubusercontent.com/remotion-dev/skills/main/package.json)
- In-project truth: `npx remotion versions` when available
- Recorded tested baseline: `compatibility/remotion.json` in this plugin

1. **Node**: `node -v` — pass if ≥18. Fix: install from https://nodejs.org.
2. **npx**: `npx -v` — pass if prints a version.
3. **Package manager**: detect lockfile (bun.lock/bun.lockb → bun,
   pnpm-lock.yaml → pnpm, yarn.lock → yarn, package-lock.json → npm). Report
   which one to use here.
4. **Official skills installed — and complete?** Check `.zcode/skills/`
   (project scope), then `~/.zcode/skills/` and `~/.agents/skills/` (user
   scope — first hit wins, scopes are never mixed). A lone
   `remotion-best-practices/` is NOT enough: compare the folder's
   `remotion-*` SKILL.md set against the canonical list
   (`compatibility/remotion.json` → `skills.names`; `node
   scripts/skill-paths.mjs` prints the report). Report `N/M present` +
   missing names + extra folders. Incomplete fix: /remotion-setup (repairs
   the detected scope). Nothing installed fix: /remotion-setup.
5. **Official skills latest?** Installed = the `version:` frontmatter of
   `remotion-best-practices/SKILL.md` (first scope found in check 4). Latest =
   the skills package metadata above. Compare with real SemVer rules:
   installed < latest → outdated (fix: /remotion-update); equal → current;
   installed > latest → "ahead" (informational — newer than upstream index,
   not a failure); source unreachable → "unknown" — do NOT guess from
   `npm view remotion version` and do NOT mark skills outdated without their
   own source.
6. **Remotion project check** (only if package.json has a `remotion`
   dependency): installed version via `npm ls remotion --depth=0` (or matching
   pm) or `npx remotion versions`; consistency = every `remotion`/`@remotion/*`
   entry resolves to ONE exact version (`npm ls remotion` warnings count as
   fail); latest = `npm view remotion version`. Compare with SemVer rules:
   installed < latest → outdated (fix: /remotion-update); equal → current;
   installed > latest → "ahead" (e.g. dist-tag lag — informational, not a
   failure). Additionally, if the installed version is newer than the plugin's
   LAST VERIFIED BASELINE (`compatibility/remotion.json` →
   `remotion.tested`), add a warning: "Installed Remotion is newer than this
   plugin's verified baseline — check compatibility evidence before relying on
   the baseline." "Latest upstream" and "last verified baseline" are separate
   concepts — never conflate them, and never call a newer version
   incompatible without evidence. Report Remotion installed vs latest
   SEPARATELY from the skills check above. Outdated/inconsistent fix:
   /remotion-update. If NOT in a Remotion project, mark N/A with a note.
7. **Chrome Headless Shell**: in a Remotion project run `npx remotion browser
   ensure` (if no project, skip with a note). Fail fix: check network/proxy, see
   https://www.remotion.dev/docs/chrome-headless-shell.
8. **License awareness**: print a one-line note that Remotion is free for
   individuals and companies ≤3 employees, otherwise a company license is
   required (https://www.remotion.pro). Informational — always pass.

End the report with:
- summary count: X/8 checks passed
- a compact version block: Remotion installed / latest · official skills
  installed / latest / count
- the single highest-priority action, with the exact fix command
  (/remotion-update, /remotion-setup, or an install command)
- pointer to the official `remotion-docs` skill for Remotion-API-specific questions
