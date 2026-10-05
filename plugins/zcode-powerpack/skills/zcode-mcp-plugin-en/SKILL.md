---
name: zcode-mcp-plugin-en
description: English guide for ZCode MCP Servers, Plugins, and Commands (slash commands). Creating/importing MCP servers, plugin marketplace, installing plugins, creating /commands. Use whenever MCP, model context protocol, server, stdio, SSE, HTTP, plugin, marketplace, command, slash command, /compact, /goal, command creation, or import is mentioned.
---

# MCP, Plugins and Commands

## MCP Servers

**MCP (Model Context Protocol)** connects external capabilities like file systems, browser automation, memory, and databases to Agents.

### Creating a Server

**Settings → MCP Servers → New MCP Server**

1. **Scope:** User (all workspaces) or Workspace (current project)
2. **Name** (e.g. `memory`)
3. **Type:** stdio (default), SSE, or HTTP
4. **Command + arguments:** e.g. `npx` + `-y @modelcontextprotocol/server-memory`
5. **Environment variables:** Add keys/paths if needed
6. **Add** and confirm it's enabled

**JSON config:** Paste directly in Full configuration mode. ZCode accepts both `{"server-name": {...}}` and `{"mcpServers": {...}}` styles.

### Importing from an External Agent

Import MCP servers configured in Claude Code, Codex CLI, OpenCode, or `.agents/mcp.json` **in one click**.

| External Agent | Config File |
|----------------|-------------|
| Claude Code | `~/.claude/settings.json` |
| Codex CLI | `~/.codex/config.toml` |
| OpenCode | `~/.config/opencode/opencode.json` |
| Generic | `~/.agents/mcp.json` |

### Recommended Zhipu Servers

- **zai-mcp-server:** Visual understanding (images, screenshots, UI context)
- **web-search-prime:** Web search (up-to-date external info)
- **web-reader:** Webpage reading (content, structure, details)

---

## Plugins

Plugins extend what ZCode can do. A single plugin can bundle skills, commands, subagents, and MCP servers **together**.

### Installation

Discover from **Settings → Plugins → Marketplace**. Click **Get** on a plugin to install — newly installed plugins are enabled by default.

### Custom Marketplace

Add your own source with the **`+`** button next to the search box:
- GitHub repo (`owner/repo` or URL)
- Git URL
- Local path

### Built-in Plugins

ZCode ships with official plugins. Highlights:
- **android-emulator:** Agent drives the Android emulator directly
- **ios-simulator:** Agent drives the iOS simulator directly

### Management

- Enable/disable (right-side switch)
- Filter (name, description, status)
- Details (bundled skill/command/MCP counts)
- Uninstall (official plugins can only be disabled)

**Configuration:** Some plugins need parameters (default device, path). Installed → plugin → Advanced info → Configuration. Sensitive fields (API keys) can't be entered in the UI yet — prepare at the system level.

---

## Commands (Slash Commands)

Commands invoke built-in Agent capabilities and save prompts you use often.

### Usage

Type **`/`** in the input box → command panel opens (Commands and Skills groups). Select a command, add arguments if expected.

### Built-in Commands

| Command | Purpose |
|---------|---------|
| `/compact` | Clean up/compress context in a long task |
| `/goal` | Keep the agent working toward a long-term objective |

To invoke a skill, use **`$`**.

### Creating a Command

**Settings → Commands** → new command. Custom commands are stored as `.md` files under `~/.zcode/commands/` (workspace-level in the project directory). Invoke with `/command-name`.

### Importing from an External Agent

Bring commands from Claude Code or other external agents via **Import commands from external Agent** on the Commands page.

### Command or Skill?

- **To save a simple prompt:** Use a Command
- **When scripts, templates, or example files are needed:** Use a Skill
