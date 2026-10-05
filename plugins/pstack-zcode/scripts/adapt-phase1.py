#!/usr/bin/env python3
"""Phase 1: deterministic Cursor->ZCode string replacements across pstack-zcode markdown.

Ordered longest-first. Every replacement is logged. Review with git diff after.
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

# (old, new) — applied verbatim; order matters (longest first within a theme)
REPLACEMENTS = [
    # benny install paths: Cursor automations dir -> ZCode non-scanned automations dir
    (".cursor/automations/benny/skills/", ".zcode/automations/benny/skills/"),
    (".cursor/automations/benny/", ".zcode/automations/benny/"),
    ("<target-repository>/.cursor/automations/benny/", "<target-repository>/.zcode/automations/benny/"),
    (".cursor/automations/", ".zcode/automations/"),
    # benny user-owned config location
    (".cursor/benny/", ".zcode/benny/"),
    # plugin enablement in target repo: Cursor settings -> ZCode workspace config
    (".cursor/settings.json", ".zcode/config.json"),
    # project-local skills dir
    (".cursor/skills/", ".zcode/skills/"),
    ("~/.cursor/skills/", "~/.zcode/skills/"),
    # pstack role config file
    ("~/.cursor/rules/pstack-models.mdc", "~/.zcode/pstack-roles.md"),
    # tool names
    ("Task subagent", "Agent subagent"),
    ("Task tool", "Agent tool"),
    ("Task call", "Agent call"),
    ("Task calls", "Agent calls"),
    ("`Task`", "`Agent`"),
    ("AskQuestion", "AskUserQuestion"),
    # skill authoring built-in
    ("Cursor's built-in `create-skill` skill", "the `skill-creator` skill (from the `skill-creator` plugin)"),
    ("Cursor's built-in `create-skill`", "the `skill-creator` skill (from the `skill-creator` plugin)"),
    ("**create-skill** skill (Cursor's built-in for authoring SKILL.md files)",
     "**skill-creator** skill (from the `skill-creator` plugin, for authoring SKILL.md files)"),
    ("`/create-skill`", "`/skill-creator`"),
    # cloud agents -> background subagents
    ("One Cursor cloud agent per PR", "One background subagent per PR"),
    ("Cursor cloud agent", "background subagent"),
    # Slack actions
    ("configured Cursor Slack actions", "configured Slack MCP tools"),
    ("Prefer configured Cursor Slack actions", "Prefer configured Slack MCP tools"),
]


def main() -> int:
    total = 0
    files_touched = 0
    for md in sorted(ROOT.glob("**/*.md")):
        rel = md.relative_to(ROOT)
        if rel.parts[0] in ("docs",) and rel.name.startswith("DESIGN"):
            continue
        text = md.read_text(encoding="utf-8")
        orig = text
        for old, new in REPLACEMENTS:
            if old in text:
                count = text.count(old)
                text = text.replace(old, new)
                print(f"{rel}: {count}x  {old!r} -> {new!r}")
                total += count
        if text != orig:
            md.write_text(text, encoding="utf-8")
            files_touched += 1
    print(f"\n{total} replacements across {files_touched} files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
