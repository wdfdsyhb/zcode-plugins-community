#!/usr/bin/env python3
"""Phase 2a: transcript paths, generalPurpose type name, plugin cache paths."""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent

REPLACEMENTS = [
    # subagent type name normalization
    ("substituting `generalPurpose` skips that read and drifts",
     "substituting `general-purpose` skips that read and drifts"),
    ("`generalPurpose` is the fallback. Never use the built-in `plan` subagent_type; it ignores this skill.",
     "`general-purpose` is the fallback."),
    # plugin-installed skill paths
    ("plugin-installed paths under `~/.cursor/plugins/`",
     "plugin-installed paths under `~/.zcode/cli/plugins/cache/`"),
    # transcript globs
    ("do not glob across `~/.cursor/projects/*/`, that crosses workspace boundaries and reads private chats from unrelated projects",
     "do not glob across other workspaces' session directories, that crosses workspace boundaries and reads private chats from unrelated projects"),
    ("Do not glob across `~/.cursor/projects/*/`; that crosses workspace boundaries and reads private chats from unrelated projects.",
     "Do not glob across other workspaces' session directories; that crosses workspace boundaries and reads private chats from unrelated projects."),
    ("do not glob across `~/.cursor/projects/*/`, that crosses workspace boundaries",
     "do not glob across other workspaces' session directories, that crosses workspace boundaries"),
    ("Don't glob across `~/.cursor/projects/*/`; that reads unrelated private chats.",
     "Don't glob across other workspaces' session directories; that reads unrelated private chats."),
    ("Don't glob across `~/.cursor/projects/*/`. That crosses workspace boundaries and reads private chats from unrelated projects.",
     "Don't glob across other workspaces' session directories. That crosses workspace boundaries and reads private chats from unrelated projects."),
    # transcript directory naming
    ("The system prompt names the workspace's `agent-transcripts/` directory. Use only that path.",
     "Locate the current workspace's session transcripts (ZCode stores session data under `~/.zcode/cli/`). Use only the current workspace's paths."),
    ("the active workspace's `agent-transcripts/` directory (the system prompt names the path; ",
     "the active workspace's session transcripts (stored under `~/.zcode/cli/`; "),
    ("the active workspace's `agent-transcripts/` directory (the system prompt names the path)",
     "the active workspace's session transcripts (stored under `~/.zcode/cli/`)"),
    ("the active workspace's `agent-transcripts/` directory (the system prompt names this path)",
     "the active workspace's session transcripts (stored under `~/.zcode/cli/`)"),
    ("the active workspace's `agent-transcripts/` directory (the system prompt names the path; use that path)",
     "the active workspace's session transcripts (stored under `~/.zcode/cli/`; use only that workspace)"),
    # worktree location example
    ("since a hand-typed `myrepo-worktrees/x` misses one that lives at `.cursor/worktrees/myrepo/x`",
     "since a hand-typed `myrepo-worktrees/x` misses one that agent tooling placed under its own state directory"),
]


def main() -> None:
    total = 0
    for md in sorted(ROOT.glob("**/*.md")):
        rel = md.relative_to(ROOT)
        if rel.parts[0] == "docs" and rel.name.startswith("DESIGN"):
            continue
        text = md.read_text(encoding="utf-8")
        for old, new in REPLACEMENTS:
            if old in text:
                count = text.count(old)
                text = text.replace(old, new)
                print(f"{rel}: {count}x  {old[:60]!r}...")
                total += count
        md.write_text(text, encoding="utf-8")
    print(f"\n{total} replacements")


if __name__ == "__main__":
    main()
