# Any other agent (generic install)

For harnesses without a plugin/marketplace mechanism — or ones not listed above —
install ClarityKit as plain skill directories plus the CLI. This always works, because
ClarityKit's skills are standard Agent Skills (`SKILL.md` + frontmatter) that reference
shared files two levels up.

## Install

```bash
git clone https://github.com/maxi3777/claritykit.git ~/agent-kits/claritykit

# 1. skills → the universal shared directory (read by Codex, Cursor, Pi, ...):
mkdir -p ~/.agents/skills
ln -s ~/agent-kits/claritykit/skills/* ~/.agents/skills/
#    or into your agent's own skills dir (~/.claude/skills/, .opencode/skill/, ...)

# 2. CLI on PATH:
ln -s ~/agent-kits/claritykit/bin/clarity ~/.local/bin/clarity
#    (or: npm install -g github:maxi3777/claritykit)
```

Link the skill **directories** (not the SKILL.md files), and keep symlinks pointing into
the clone — the skills read `references/` and `tools/` from the repo root, and symlinks
mean one `git pull` updates everything.

Project-local alternative: link into `<project>/.agents/skills/` and commit the links so
everyone on the repo gets the skills automatically.

## Update

```bash
cd ~/agent-kits/claritykit && git pull
clarity version    # verify the expected release
```

With the symlink CLI, that single `git pull` updates skills and CLI together. If
`tools/node_modules` was removed, the CLI wrapper reinstalls the pinned dependencies
automatically on the next run.

## Verify

`clarity doctor` passes, and your agent lists the nine claritykit skills.
