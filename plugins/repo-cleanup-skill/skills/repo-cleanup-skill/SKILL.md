# Skill: repo-cleanup

# Repository Cleanup

Audit a git repository for accumulated cruft — obsolete docs, stale branches,
orphaned worktrees, dead config — then remove it safely through a worktree
workflow that keeps `main` untouched and produces a reviewable PR.

Use this skill whenever the user wants to "clean up" a repo, folder, or
codebase: tidying docs, removing junk/stale files, pruning branches,
decluttering the working tree, or asking "what can I delete from this repo?"
Even a vague "ทำความสะอาด repo หน่อย" or "scan for files we don't need
anymore" should trigger it. This is a common, repeatable workflow that
benefits from a structured, safe-by-default approach.

## Core principle: report before you remove

**This skill is read-only until the user approves.** Never delete, move, or
commit anything in the first pass. Scan, classify, and present a report with
risk levels and a recommended action per item. Only after the user picks what
to act on do you move to execution.

The reason: "junk" is a judgment call. A half-finished translation folder
might be someone's in-progress work; a 2-year-old doc might still be the only
record of a critical design decision. Surfacing the candidates with context
lets the human decide; deleting silently does not.

## Phase 1 — Scan and report

Run these checks in parallel where possible. Search the whole repo but exclude
`.git/`, `node_modules/`, virtualenv dirs (`.venv*`, `venv/`, `ENV/`), build
output (`dist/`, `build/`), and anything already gitignored that isn't worth
reporting on.

### What to look for

| Category | How to find | Risk to note |
| --- | --- | --- |
| Backup / temp files | `*.bak`, `*.orig`, `*.tmp`, `*.old`, `*.swp`, `*~` | Low — almost always safe |
| OS cruft | `.DS_Store`, `Thumbs.db`, `desktop.ini` | Low |
| Empty directories | `find . -type d -empty` | Low |
| Stray local artifacts at root | local DBs (`*.db`), export JSONs, scratch files sitting in the repo root | Check if gitignored |
| Obsolete docs | Old plans, superseded specs, ghost trackers ("Phase 2 in progress" from a year ago), half-finished translations | Medium — check links |
| Stale config / previews | One-off HTML mockups, old test fixtures, dead `.env.example` variants | Medium — check links |
| Large files | `find ... -exec ls -la` → sort by size | Check what they are |
| Stale git worktrees | `git worktree prune --dry-run` | Low — metadata cleanup |
| Merged local branches | `git branch --merged` + squash-merged check (see Phase 3) | Low once verified |

For each candidate, note: what it is, how old (if the `find`/`git log` output
shows it), whether it's git-tracked, and the recommended action (delete,
archive, keep, ask).

### Critical: check inbound links before recommending deletion

For any **tracked file or directory** you're considering for deletion, run:

```bash
git grep -n -E "<filename>" -- . ":(exclude)<the-file-itself>"
```

A file can look obsolete and still be the target of a live link in a README,
an active planning doc, or a reference list. If inbound links exist, report
them — don't silently break them. Options when links exist:

- Fix the referencing file in the same commit that deletes the target (best).
- Note that deletion requires touching the referencing file and ask the user.
- Keep the file if the references are active and load-bearing.

### Present the report

Structure the output as:

1. **What's already clean** (one line) — sets a reassuring baseline.
2. **Candidates grouped by risk** (low / medium / needs-decision), each with
   the recommended action and any inbound-link findings.
3. **Items kept on purpose** (historical records, active docs) — with reasons.
4. A short **recommended action plan** ordered low-risk → high-risk.

End by asking the user what to act on. Don't assume "all of it."

## Phase 2 — Execute via worktree → PR

Once the user has chosen what to remove, do the work in an isolated git
worktree so `main` stays untouched during development.

### Worktree workflow

```bash
# 1. Create an isolated worktree + branch off the base branch (usually main)
git worktree add _worktrees/<slug> -b <type>/<slug> main

# 2. Work inside the worktree, commit in small focused chunks
cd _worktrees/<slug>
git commit -m "<type>: <subject>"

# 3. Push and open a PR
git push -u origin <type>/<slug>
gh pr create --base main

# 4. After merge (or abandonment), remove the worktree
cd <repo-root>
git worktree remove _worktrees/<slug>
git branch -d <type>/<slug>   # -d is a safe delete; -D only if unmerged/abandoned
```

Use the `chore/` prefix for pure cleanup branches (e.g.
`chore/cleanup-docs-2026-07`). Commit conventions: `chore`, `fix`, `feat`,
`docs`, `refactor`, `perf`.

### Execution rules

- **Split unrelated changes into separate commits.** This lets the reviewer
  drop individual commits in the PR UI without rejecting the whole PR. One
  commit per logical cleanup area (e.g. "remove preview HTML" separate from
  "remove stale translations").
- **Delete a file and fix its inbound links in the same commit.** Don't split
  link fixes across commits — the repo should be consistent at every commit.
- **Never touch source code or runtime logic in a cleanup PR.** If a cleanup
  requires editing code (e.g. removing a dead import the deleted file left
  behind), do it — but call it out in the PR description so it's not buried.
- **Check repo-specific safety rules.** Some repos have a `CONTRIBUTING.md`,
  coordination doc, or similar that forbids working on `main`, lists parked
  services, or flags production-affecting paths. Read it before starting.
- The worktree folder (commonly `_worktrees/`) should itself be gitignored —
  it's local scratch space, not repo content.

### PR description template

```markdown
## Summary

<one-paragraph repo housekeeping summary; note if no source/trading logic touched>

## Changes (N focused commits)

| Commit | What | Risk |
| --- | --- | --- |
| `<sha>` | <description> | None / Low / Medium |

## Kept on purpose

- **<file>** — <reason it stays>

## Verification

- [x] Checked inbound links for every deleted file before removal (`git grep`)
- [x] Fixed all broken references in the same commit that deleted the target
- [x] No source code / services / trading logic modified
```

## Phase 3 — Post-merge cleanup

After the PR merges, tidy the local clone.

### Worktree pruning

```bash
git worktree prune -v          # clear stale metadata for deleted worktrees
git worktree list              # confirm only intended worktrees remain
```

If `git worktree prune` fails to delete `.git/worktrees/<name>/` (happens on
Windows with file locks), remove those dirs manually:

```bash
rm -rf .git/worktrees/<stale-name>
git worktree prune -v   # should now report nothing
```

### Branch cleanup — including squash-merged branches

**The "report before you remove" principle applies here too.** Branch
deletion — especially `git push origin --delete` — is irreversible from the
user's point of view. Do not jump straight to deletion just because the skill
reached Phase 3. Always build the full candidate table first, show it to the
user, and delete only the subset they confirm.

This matters because GitHub's **squash merge** collapses a branch's commits
into one commit on `main`, so `git branch --merged main` will **not** list
branches whose PRs were squash-merged, even though the work is fully in
`main`. Verification requires looking each branch up via `gh`.

#### Step 1 — gather local candidates (read-only)

```bash
# Truly merged (regular merge) — safe to delete with -d once confirmed
git branch --merged main | grep -v '^\*' | grep -v main

# NOT listed as merged — but may still be squash-merged. Verify each one:
for b in $(git branch --no-merged main | grep -v '^\*'); do
  state=$(gh pr view "$b" --json state --jq '.state' 2>/dev/null)
  echo "$b → PR state: $state"
done
```

#### Step 2 — gather remote candidates (read-only)

```bash
git fetch --prune   # refresh remote-tracking refs first
# List remote branches and their PR state (this is read-only — do NOT delete yet)
for b in $(git branch -r --no-merged origin/main | grep -v HEAD); do
  name=${b#origin/}
  state=$(gh pr view "$name" --json state --jq '.state' 2>/dev/null || echo "no PR")
  echo "$name → $state"
done
```

#### Step 3 — present the table, then wait

Combine local + remote candidates into one table grouped by state:

| Branch | Local/Remote | PR state | Recommended action |
| --- | --- | --- | --- |
| `feat/old-thing` | local + remote | MERGED | delete both |
| `chore/scratch-42` | remote only | CLOSED (unmerged) | ask — may be abandoned or may be intentional |
| `claude/random-codename` | remote only | no PR | ask — could be unreviewed work |

Only after the user confirms which rows to act on, proceed to deletion. If a
group is large (e.g. 50+ autogenerated agent branches), list them and ask
about the group as a whole rather than one by one — but still ask.

#### Step 4 — delete only confirmed branches

```bash
# Local: regular-merged → -d; squash-merged (PR verified MERGED) → -D
git branch -d <confirmed-regular-merged>
git branch -D <confirmed-squash-merged>

# Remote: only after explicit confirmation — this is the irreversible one
git push origin --delete <confirmed-remote-branch>

# Tidy local remote-tracking refs afterwards
git fetch --prune
```

Use `git branch -d` for regular merges and `git branch -D` for squash-merged
ones (git refuses `-d` because it can't see the merge — that's expected once
you've verified via PR state). Treat `CLOSED` (unmerged) and `no PR` branches
as **needs-decision**, not auto-delete: a closed PR may have been closed
because the work was abandoned, or because it was merged manually and the PR
just wasn't linked — only the user can tell.

## Phase 4 — Document the workflow (optional, high-value)

If the repo has a `CONTRIBUTING.md` or similar coordination doc, offer to add
the worktree → PR → cleanup workflow there as a short section so future
contributors and agents follow the same pattern. Keep it concise — the commands
above plus a one-line rationale. This is what makes the cleanup practice stick
rather than being a one-off.

## When to stop

- Don't refactor code in the name of cleanup. If a file looks dead but is
  imported by live code, that's a refactor, not a cleanup — flag it and stop.
- Don't delete `docs/plan/*` or similar historical records without checking
  the repo's documentation policy. Many teams keep these as audit trails.
- Don't touch parked/archived service folders unless the owner explicitly asks.
- If a deletion would have scope creep (e.g. the only inbound link is in an
  active planning doc that would itself need rework), call it out and let the
  user decide whether to expand scope or defer that item.
