# ZCode Handbook - English

English handbook plugin for the ZCode AI coding assistant. This plugin contains 7 skills and 2 commands.

## Skills

| Skill | When it triggers |
|-------|------------------|
| `zcode-agent-en` | ZCode Agent, execution modes, AGENTS.md, workspace context |
| `zcode-skill-guide` | Creating skills, SKILL.md, frontmatter, discovery, best practices |
| `zcode-goal-task-en` | Goal Mode, task management, file tree, edit history |
| `zcode-remote-en` | Remote Control, Bot Channel, mobile access |
| `zcode-subagents-en` | Subagents (general-purpose, Explore, custom) |
| `zcode-mcp-plugin-en` | MCP servers, plugin management, slash commands |
| `zcode-best-practices-en` | Best practices, diagnostics (diagnosing-*), troubleshooting |

## Commands

```
/handbook       # Overview - all features summary
/troubleshoot   # Diagnostics guide - symptom → solution
```

## Usage

Skills **trigger automatically** when you ask about the relevant topic. To invoke manually:

```
$zcode-skill-guide how do I create a skill?
```

## Source

Content adapted from the official documentation at `zcode.z.ai/en/docs`.
