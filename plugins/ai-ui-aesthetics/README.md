# ai-ui-aesthetics

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![ZCode Plugin](https://img.shields.io/badge/ZCode-Plugin-blue.svg)](.zcode-plugin/plugin.json)
[![MCP](https://img.shields.io/badge/MCP-FastMCP-green.svg)](mcp-server)
[![Python](https://img.shields.io/badge/Python-%3E%3D3.10-3776AB.svg?logo=python&logoColor=white)](mcp-server/requirements.txt)

> **前端美学增强插件** —— 让 AI 生成漂亮、有层级、统一的前端 UI。

一个给 AI 编程代理使用的**双形态插件**：**Skill（知识，教 AI 怎么想）+ MCP（工具，让 AI 能做事）**。零框架依赖，可跨 Agent Harness 使用（ZCode、DeepSeek Harness 等）。

它的目标不是"给 AI 一堆规则"，而是让 AI 先建立审美判断，再落成可复用的设计 Token 和代码。**导入即用**——首次使用自动完成环境自举，无需手动配置 MCP 路径或虚拟环境。

---

## 目录

- [它解决什么问题](#它解决什么问题)
- [提供什么功能](#提供什么功能)
- [能做什么](#能做什么)
- [为什么选它（优点）](#为什么选它优点)
- [快速开始](#快速开始)
- [安装](#安装)
- [使用](#使用)
- [MCP 工具参考](#mcp-工具参考)
- [项目结构](#项目结构)
- [跨 Harness 接入](#跨-harness-接入)
- [常见问题](#常见问题)
- [贡献](#贡献)
- [许可证](#许可证)

---

## 它解决什么问题

AI 生成的前端常常"单调"——配色随手、间距无尺度、排版无层次、缺少质感。**界面丑往往不是某个颜色错了，而是整页只有一种声音**：同样的字重、尺寸、颜色、间距，没有重点。

本插件的核心命题是 **美 = 统一性 × 对比**：只有统一会单调，只有对比会混乱。它把这套审美判断**固化为 AI 可执行的知识 + Token + 检查清单**，让 AI 在写码前先定方向、写码时引用统一规范、交付前自动自检，而不是每次凭手感生成。

## 提供什么功能

插件由 **Skill（知识，教 AI 怎么想）** 与 **MCP（工具，让 AI 能做事）** 两形态组成，Skill 内部又分四根支柱。

### 四根支柱（Skill）

| 支柱 | 位置 | 具体内容 |
| --- | --- | --- |
| **风格原型** | [`references/style-archetypes.md`](skills/ai-ui-aesthetics/references/style-archetypes.md) | **7 种风格气质**：极简克制（Apple 式）、玻璃拟态与光效、编辑排版风（杂志式）、大胆撞色、深色高级感、柔和拟态、精简数据仪表盘。写码前先选定 1 种，避免混搭与单调 |
| **审美知识** | [`knowledge/`](skills/ai-ui-aesthetics/knowledge/) | 讲清「**为什么美**」：设计原则（对齐 / 对比 / 留白 / 层次与分组等六大原则）、色彩情绪与配色克制、排版层级、布局与留白尺度 |
| **设计 Token** | [`tokens/`](skills/ai-ui-aesthetics/tokens/) | 可直接落地的**一套完整令牌**：颜色（主色 / 强调 / 中性灰阶 / 语义色）、字体族、字号与行高、4px 间距尺度（`--space-1…9`）、圆角、阴影分层、缓动曲线。提供 `.md`（规范说明）与 `.css`（CSS 变量，可自托管引用）两份 |
| **代码规则** | [`rules/`](skills/ai-ui-aesthetics/rules/) + [`patterns/`](skills/ai-ui-aesthetics/patterns/) | **怎么写**：组件约定（按钮 / 卡片 / 输入 / 导航 / 表格 / 弹窗）、响应式（移动优先 + 断点）、质感与动效（阴影分层、悬停三件套、正确缓动）、交付前检查清单；另有缓动曲线可视对照 `easing-swatches.md` |

### 四步工作流

单入口 [`SKILL.md`](skills/ai-ui-aesthetics/SKILL.md) 内置强制流程：

```
读取上下文 → 选风格定主色层级 → 用 Token 写码 → 美学自检（不达标不许交付）
```

### 使用铁律（违反即不合格）

不写裸值（颜色 / 圆角 / 阴影 / 间距 / 动效一律走 Token）、先选风格再写码、统一里做对比（有唯一焦点）、间距守 4px 尺度、动效用正确缓动（禁 `linear`）、可访问性优先（对比度 ≥ 4.5:1、焦点环、`prefers-reduced-motion`）、尊重用户已有设计系统。

### 交付前自检清单

[`rules/代码检查清单.md`](skills/ai-ui-aesthetics/rules/代码检查清单.md) 覆盖 **A–F 六大维度**：统一性、层级与对比、间距与留白、布局与响应式、质感与动效、可访问性与语义——每项都是可勾选的硬性标准。

### MCP 设计调研工具（可选）

`mcp-server/`（Python + FastMCP）为 AI 提供**真实设计依据**，而非凭空生成：

| 工具 | 入参 | 返回 |
| --- | --- | --- |
| `research_reference_site` | 参考站 URL | 标题、主色板（高频色 + 占比）、字体族、圆角 / 间距线索、亮暗主题 |
| `scan_colors` | 图片 URL 或本地路径 | 主导色板（hex + 占比） |
| `suggest_color_palette` | 风格关键词 | 配色方案（主 / 强调 / 中性 / 语义）+ WCAG 对比度检查 |

## 能做什么

装上后，AI 在以下场景会自动按"选风格 → 定层级 → 用 Token → 自检"的方式工作：

- **从零生成页面 / 组件** —— 落地页、仪表盘、后台管理、表单、弹窗、卡片、导航等，直接产出带设计 Token 的代码，而非随手数值。
- **改造既有 UI** —— 把"单调"的界面升级为有层级、有焦点、有质感的版本（见 [`examples/before-after.md`](skills/ai-ui-aesthetics/examples/before-after.md) 端到端示例）。
- **统一设计语言** —— 为一组页面建立一致的色彩 / 间距 / 圆角 / 阴影 / 动效规范，消除各处不一致。
- **按参考做设计** —— 用 MCP 抓取真实参考站或设计稿取色，据此定配色与气质，再生成代码。
- **修质感与动效** —— 补阴影分层、悬停反馈、正确缓动与微交互，解决"能用但很糙"的问题。
- **过可访问性** —— 自动检查对比度、焦点态、`prefers-reduced-motion` 与语义化标签。
- **建立设计 Token 体系** —— 产出的 Token 可直接作为项目设计系统的起点（`design-tokens.css`）。

## 为什么选它（优点）

- **先判断、再动手** —— 强制 AI 写码前选定风格原型，从源头避免"配色随手、风格混搭"。
- **Token 化，不写裸值** —— 所有颜色 / 间距 / 圆角 / 阴影 / 动效都走统一 Token，产出天然一致、易维护。
- **有尺度，不是玄学** —— 统一 4px 间距尺度、明确字号层级、预设缓动曲线，规则具体可执行。
- **克制而有重点** —— 强调"统一里做对比"，每页有明确焦点，避免均匀用力导致的单调。
- **默认可访问** —— 对比度、焦点环、动效降级、语义化写进铁律与检查清单，而非事后补救。
- **尊重你的系统** —— 若你已有品牌色 / 设计系统，优先沿用，本插件作兜底与规范示范。
- **零依赖、框架无关** —— Skill 不绑定 React / Vue / Tailwind，产出通用 Token 与原则；MCP 的依赖由独立进程自带。
- **导入即用** —— `${ZCODE_PLUGIN_ROOT}` 模板变量 + 自举启动器自动创建环境，克隆 / 导入后无需手动配置 MCP 路径或虚拟环境。
- **可跨 Harness** —— 同时提供 ZCode 插件清单、DeepSeek Harness 与通用 Harness 接入说明。

## 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/Jaye2610/ai-ui-aesthetics.git
cd ai-ui-aesthetics

# 2. 冒烟测试（首次运行会自动创建 .venv 并安装依赖）
python mcp-server/launch_mcp.py --smoke
# 预期输出：['research_reference_site_tool', 'scan_colors_tool', 'suggest_color_palette_tool']
```

然后在 ZCode 中把本目录添加为插件并启用（见 [安装](#安装)）。

> 环境要求：**Python 3.10+**。仅使用 Skill 不需要 Python；只有使用 MCP 工具时才需要。

## 安装

本仓库同时是一个 **ZCode 插件** 和 **插件市场源**：

- [`.zcode-plugin/plugin.json`](.zcode-plugin/plugin.json) —— 插件清单（`skills` + `mcpServers`）
- [`marketplace.json`](marketplace.json) —— 市场清单（把自己登记为市场中的一个插件）

ZCode 的 **Settings → Plugin Management**（插件管理）分为 **Installed**（已安装）和 **Discover**（发现）两个标签。

### 方式一：添加市场源安装（推荐）

在 **Discover** 标签点 **`+`**，填入仓库地址 `Jaye2610/ai-ui-aesthetics`（或仓库 Git URL）。ZCode 会读取根目录的 `marketplace.json`，在市场卡片中点 **Get** 安装。

### 方式二：从本地目录安装

克隆仓库后（见 [快速开始](#快速开始)），在 **Discover** 标签点 **`+` → 选择本地目录**，选中仓库根目录（含 `.zcode-plugin/plugin.json`）。

### 方式三：手动注册 MCP（通用 Harness）

任何支持 MCP 的客户端都可添加 stdio server，使用系统 `python` + 自举启动器（自动处理环境，跨平台）：

```json
{
  "command": "python",
  "args": ["<仓库绝对路径>/mcp-server/launch_mcp.py"]
}
```

安装后请到 **Installed** 标签确认插件处于**启用**状态。首次使用 MCP 工具时，启动器会自动创建 `.venv` 并安装依赖；此后直接复用。

## 使用

### Skill：让 AI 学会"怎么想"

单入口 [`skills/ai-ui-aesthetics/SKILL.md`](skills/ai-ui-aesthetics/SKILL.md)，内置完整工作流与"使用铁律"：

```
选风格  →  定主色与层级  →  用 Token 写码  →  美学自检
```

与 AI 协作时先加载该 Skill，它会决定接下来写码的审美取向。

### 规划 / 排版 / 响应式 / 动效

| 需求 | 参考文件 |
| --- | --- |
| 选择整体风格气质 | [`references/style-archetypes.md`](skills/ai-ui-aesthetics/references/style-archetypes.md) |
| 色彩与排版规则 | [`knowledge/`](skills/ai-ui-aesthetics/knowledge/) |
| 落地设计 Token（CSS / 文档） | [`tokens/design-tokens.css`](skills/ai-ui-aesthetics/tokens/design-tokens.css) · [`tokens/design-tokens.md`](skills/ai-ui-aesthetics/tokens/design-tokens.md) |
| 组件 / 响应式 / 动效约定 | [`rules/`](skills/ai-ui-aesthetics/rules/) |
| 交付前自检 | [`rules/代码检查清单.md`](skills/ai-ui-aesthetics/rules/代码检查清单.md) |
| 前后对比示例 | [`examples/before-after.md`](skills/ai-ui-aesthetics/examples/before-after.md) |

## MCP 工具参考

三个工具的定义见上文 [MCP 设计调研工具](#mcp-设计调研工具可选)。要点：

- `research_reference_site` / `scan_colors` 用于**先拿到真实依据**（真实站点的色板与排版线索、设计稿的主色），避免凭空配色。
- `suggest_color_palette` 的 `style` 支持：`minimal/极简`、`glass/玻璃`、`editorial/编辑`、`bold/撞色`、`dark/深色`、`soft/柔`、`data/数据`，返回配色方案并附 **WCAG 对比度检查**。
- 推荐的组合顺序：`research_reference_site`（或 `scan_colors`）→ `suggest_color_palette` → 按 Skill 工作流生成代码。

### 手动运行

```bash
# 自举启动（首次自动建 .venv 并装依赖）
python mcp-server/launch_mcp.py

# 冒烟测试：列出全部工具
python mcp-server/launch_mcp.py --smoke
```

更多细节（依赖、边界与伦理）见 [`mcp-server/README.md`](mcp-server/README.md)。

## 项目结构

```
ai-ui-aesthetics/
├── .zcode-plugin/
│   └── plugin.json              # ZCode 插件清单（skills + mcpServers）
├── marketplace.json             # ZCode 市场清单（登记本插件）
├── skills/ai-ui-aesthetics/     # Skill 本体（SKILL.md + 四支柱）
│   ├── SKILL.md                 # 单入口与工作流
│   ├── references/              # 风格原型
│   ├── knowledge/               # 设计原则 / 色彩 / 排版 / 留白
│   ├── tokens/                  # 设计 Token（CSS + 文档）
│   ├── rules/                   # 组件 / 响应式 / 动效 / 检查清单
│   ├── patterns/                # 可复用模式
│   └── examples/                # 前后对比示例
├── mcp-server/                  # 设计调研 MCP（Python + FastMCP）
│   ├── mcp_server.py            # 工具实现
│   ├── launch_mcp.py            # 自举启动器：自动建 .venv + 装依赖
│   └── requirements.txt
├── integration/                 # 跨 harness 接入说明
└── package.json                 # 包元数据（可选）
```

## 跨 Harness 接入

- **DeepSeek Harness**：字段映射与最小提示词片段见 [`integration/deepseek-harness/INSTALL.md`](integration/deepseek-harness/INSTALL.md)。
- **通用 Harness**：作为 Skill / 系统提示 / MCP 接入见 [`integration/generic/INSTALL.md`](integration/generic/INSTALL.md)。

## 常见问题

<details>
<summary><strong>装了插件但 MCP 连不上，或市场源提示找不到 manifest？</strong></summary>

- **市场源报"找不到 manifest"**：ZCode 添加市场源时读取的是仓库根目录的 `marketplace.json`（市场清单），而不是 `.zcode-plugin/plugin.json`（插件清单）。本仓库已包含 [`marketplace.json`](marketplace.json)。
- **MCP 连不上**：确认机器上 `python` 3.10+ 在 `PATH` 中，并手动运行一次 `python mcp-server/launch_mcp.py --smoke` 查看错误。
</details>

<details>
<summary><strong>克隆下来没有 .venv，MCP 起不来？</strong></summary>

`.venv` 被 `.gitignore` 排除、不随仓库分发。运行一次 `python mcp-server/launch_mcp.py`（或 `--smoke`）即会自动创建并安装依赖，无需手动执行 `venv` / `pip`。
</details>

<details>
<summary><strong>Skill 没有触发？</strong></summary>

确认插件在 **Installed** 标签为启用状态，且 Skill 出现在 **Settings → Skills**。Skill 的身份是文件路径，若别处存在同名 Skill，生效的是优先级更高的那个。
</details>

<details>
<summary><strong>想修改默认配色 / 字体？</strong></summary>

所有落地数值集中在 [`skills/ai-ui-aesthetics/tokens/`](skills/ai-ui-aesthetics/tokens/)（`.css` 与 `.md` 两份），修改后 AI 会按新 Token 写码。
</details>

## 贡献

欢迎提交 Issue 与 Pull Request，共同完善风格原型、审美知识或新增设计 Token。

1. Fork 本仓库并创建特性分支：`git checkout -b feature/your-idea`
2. 提交改动：`git commit -m "feat: ..."`（建议使用 [Conventional Commits](https://www.conventionalcommits.org/)）
3. 推送并开启 Pull Request。

> **设计边界**：MCP 仅做**设计调研**（抓取限速、超时、遵守 robots），提炼设计原则与 Token，**不复制目标站点的像素资产**；不持久化用户数据、不追踪。请确保你有权访问所抓取的站点。

## 许可证

本项目基于 [MIT License](LICENSE) 发布，Copyright © 2026 jaye。
