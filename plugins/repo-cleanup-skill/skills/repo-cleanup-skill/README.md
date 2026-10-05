# repo-cleanup

A skill (in the `SKILL.md` format used by many AI coding agents) that audits a
git repository for accumulated cruft — obsolete docs, stale branches, orphaned
worktrees, dead config — then removes it safely through a worktree workflow
that keeps the base branch untouched and produces a reviewable PR.

## Why this skill exists

"Clean up the repo" sounds trivial but goes wrong in predictable ways:

- **Silent deletes.** A 2-year-old doc looks like junk but might be the only
  record of a load-bearing design decision.
- **Broken links.** Deleting a tracked file without checking inbound references
  silently breaks READMEs and active planning docs.
- **The squash-merge trap.** `git branch --merged` does *not* list branches
  whose PRs were squash-merged on GitHub — so a naive branch cleanup quietly
  leaves dozens of stale branches (or, worse, deletes unmerged ones).
- **Working on `main`.** Cleanup changes are low-stakes individually but
  numerous; doing them directly on the base branch makes review impossible.

This skill enforces a **report-before-remove** flow that catches each of these.

## What it does

| Phase | What happens |
| --- | --- |
| **1. Scan & report** | Read-only sweep for backup/temp files, OS cruft, empty dirs, stray local artifacts, ghost docs, stale translations, large files, stale worktrees, and merged branches. Every tracked deletion candidate is checked for inbound links via `git grep`. Output is grouped by risk (low / medium / needs-decision). |
| **2. Execute** | Work happens in an isolated `git worktree` off the base branch. Changes are split into small focused commits (one per logical area), pushed, and opened as a PR. The base branch stays untouched. |
| **3. Post-merge cleanup** | After merge: prune stale worktree metadata, delete merged local branches, and verify remote branches against PR state via `gh` (catches the squash-merge trap). |
| **4. Document** | Optionally records the worktree → PR → cleanup workflow in the repo's `CONTRIBUTING.md` or coordination doc so the practice sticks. |

## Install

This is a single-file skill. Copy `SKILL.md` into any directory on your
agent's skill path. The exact path depends on the agent you use — common
conventions are `~/.agents/skills/<name>/SKILL.md` (user-level) or
`.agents/skills/<name>/SKILL.md` (project-level). Check your agent's docs for
where it discovers skills.

```bash
# example: user-level install
mkdir -p ~/.agents/skills/repo-cleanup
curl -fsSL https://raw.githubusercontent.com/peetwan/repo-cleanup-skill/master/SKILL.md \
  -o ~/.agents/skills/repo-cleanup/SKILL.md
```

Once installed, the skill triggers on phrases like *"clean up this repo"*,
*"scan for junk files"*, *"what can I delete from this codebase?"*, and similar
requests in any language.

## Requirements

- `git` (with `worktree` support — standard since git 2.5)
- [GitHub CLI](https://cli.github.com/) (`gh`) authenticated, for PR state
  verification in Phase 3. The skill still works without `gh`, but the
  squash-merge branch check falls back to `git --merged` only.

## License

MIT — see [LICENSE](LICENSE).
