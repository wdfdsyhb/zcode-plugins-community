# 通用 Agent Harness 接入说明（generic）

> 目标：把 `ai-ui-aesthetics` 加载到任意支持 Skill 约定的 Agent Harness。
> 本插件是 **Skill（知识）+ MCP（工具）混合**：
> - Skill 部分 `skills/ai-ui-aesthetics/`：单入口 `SKILL.md`，纯文本零依赖，兼容性极佳。
> - MCP 部分 `mcp-server/`：设计调研工具（抓参考站/扫图/配色），需要 Python 运行时。

## 方法 A：作为「Skill」装载（推荐）
大多数 harness（如 Claude Agent Skills、各类本地 Agent 框架）识别目录中名为 `SKILL.md` 的文件，其 frontmatter 的 `name` 和 `description` 用于触发。

1. 把 `ai-ui-aesthetics/` 目录整体放入 harness 的 skills 目录（路径因 harness 而异，通常是 `~/.config/<harness>/skills/` 或项目内 `.agents/skills/`）。
2. 确认 `SKILL.md` 的 frontmatter 被读取：
   ```yaml
   name: ai-ui-aesthetics
   description: 前端美学增强包。生成统一、漂亮、有层级的前端 UI……
   ```
3. 重启/刷新 harness，触发词命中（description 里的「前端、UI、组件、样式」等）即自动加载。

> 若 harness 只加载 `SKILL.md` 本篇而不自动带引用文档：无需改动，`SKILL.md` 内含完整四步工作流，其余文档按需由模型读取（相对路径同目录）。

## 方法 B：作为「系统提示词片段」注入（降级/兼容）
不是所有环境都支持 Skill 装载。此时把内容当作提示词拼接进系统提示即可：
- 最小可用：把 `SKILL.md`「工作流」与「使用铁律」两节文本粘贴进 system prompt。
- 进阶：再把 `skills/ai-ui-aesthetics/references/style-archetypes.md` 的风格表、`skills/ai-ui-aesthetics/tokens/design-tokens.md` 的 token 表一并粘贴。

## 方法 C：只引用可落地的 CSS
若只想要现成的美观基础样式：
- 引入 `skills/ai-ui-aesthetics/tokens/design-tokens.css`（CSS 变量），即获得统一色彩/字体/间距/圆角/阴影/动效令牌。

## 方法 D：接入 MCP（可选，设计调研）
若想用 MCP 工具（抓参考站/扫图取色/配色建议），在支持 MCP 的客户端注册 stdio server：
```json
{
  "command": "<mcp-server 绝对路径>/.venv/Scripts/python.exe",  // Linux/macOS: .venv/bin/python
  "args": ["<mcp-server 绝对路径>/mcp_server.py"]
}
```
详见 `mcp-server/README.md`。Skill 与 MCP 都可独立启用，也可组合使用。

## 校验是否接入成功
在 harness 里生成一段前端代码，检查：
- 代码中是否出现 `--color-primary`、`--space-*`、`--radius-*` 等 token 引用（而非裸值）。
- 是否先说明了选用的风格原型。
- 是否无 `linear`、无裸色值。

若以上均未出现，说明未触发，请检查 frontmatter 与目录路径。
