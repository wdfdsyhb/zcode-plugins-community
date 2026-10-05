---
description: Install the official Remotion Agent Skills into ZCode and verify discovery
argument-hint: "[--project]"
---

Install the official Remotion Agent Skills via the official installer, then
verify the REQUESTED scope's full integrity. Idempotent — safe to re-run.

1. Pre-flight: run `node -v`. If Node is missing or <18, stop and tell the user
   to install Node ≥18 from https://nodejs.org first.
2. Scope decision — default is global (user scope):
   - Default → global: skills available in every project.
   - `$ARGUMENTS` contains `--project` → project scope (pin skills to the
     current repo only).
3. Inspect the REQUESTED scope (`node scripts/skill-paths.mjs --global`, or
   `--project .` for project scope). Expected skills come from
   `compatibility/remotion.json` → `skills.names`. Outcomes:
   - **complete** → nothing to do; report and stop (but still show the N/M
     report — do not treat any single skill, including
     `remotion-best-practices`, as proof by itself).
   - **incomplete** → repair THIS scope with step 4, then re-verify. Never
     report success from another scope, and never fill a project install from
     user scope or vice versa.
   - **absent** (no expected skill in that scope) → bootstrap this scope with
     step 4.
4. Install/repair via the official installer:

   ```bash
   npx -y skills add remotion-dev/skills -s '*' -y --copy -g # global (default)
   npx -y skills add remotion-dev/skills -s '*' -y --copy    # project (opt-in)
   ```

   `--copy` is mandatory on Windows. The warning
   "PromptScript does not support global skill installation" is expected and harmless.

   If the installer fails, keep the requested scope and follow the fallback
   ladder (never silently switch scope):
   - network/GitHub still reachable → fetch the official skill folders from
     https://github.com/remotion-dev/skills into the requested scope directory
     (global → `~/.zcode/skills/`, project → `.zcode/skills/`);
   - truly offline → use an already-installed/cached copy of the same scope if
     one exists; otherwise report honestly that official skills cannot be
     installed now.
5. Verify the SAME requested scope with the SAME command as step 3
   (`--global` for the default, `--project .` for project scope). Every
   recorded skill must have its SKILL.md. Report as
   `Official Remotion skills: N/M present` with the status line, list any
   missing skills, and note extra `remotion-*` folders (upstream topology may
   have changed). Only a COMPLETE report counts as success.
6. Report to the user: installed skills table, scope used, licensing note
   (skills are Copyright Remotion under the Remotion License, fetched from the
   official source — this plugin does not redistribute them), and that the
   official source — this plugin does not redistribute them), and the current
   ZCode skill-discovery step: open **Settings → Skills**, click **Refresh**,
   and confirm every skill is listed and enabled (official ZCode Skill docs).
   The plugin's own `/remotion-*` commands register automatically on install;
   only start a new conversation if Refresh does not surface the skills. If any
   check fails, run the /remotion-doctor flow and report findings instead of
   guessing.
