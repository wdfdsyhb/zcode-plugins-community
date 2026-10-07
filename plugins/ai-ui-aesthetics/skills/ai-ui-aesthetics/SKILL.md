---
name: ai-ui-aesthetics
description: 前端美学增强包。让 AI 生成漂亮的 UI——统一的设计 Token、清晰的排版层级、克制的留白、丝滑的动效与质感。在编写任何前端/网页组件代码时触发，自动执行「选风格→定主色层级→用 Token 写码→美学自检」四步流程。零依赖、框架无关，可跨 Agent Harness（含 DeepSeek Harness）使用。
---

# AI UI 美学（ai-ui-aesthetics）

> 核心命题：**美 = 统一性 × 对比**。界面丑多是「单调」——所有元素均匀用力。本包教你用一套统一规范 + 克制对比，写出漂亮、高级、有层次的前端。

## 何时使用
当任务涉及**生成或修改前端 UI**时自动激活：页面、组件、表单、仪表盘、样式、响应式布局等。

## 快速入口（四支柱）
| 支柱 | 文件 | 作用 |
| --- | --- | --- |
| 风格原型 | `references/style-archetypes.md` | 写码前先选 1 种气质，反单调 |
| 审美知识 | `knowledge/`（设计原则·色彩·排版·布局留白） | 理解「为什么美」 |
| 设计 Token | `tokens/design-tokens.md`（+ `.css`） | 直接落地的一致规范 |
| 代码规则 | `rules/`（组件·响应式·质感与动效·检查清单）+ `patterns/easing-swatches.md` | 怎么写 + 质感细节 |

> 参考文件以相对路径位于本 SKILL 目录内，按需读取，勿一次性全部载入。

---

## 工作流（必做四步）

### 第 1 步：读取上下文
识别：页面类型（落地页/表单/仪表盘/后台…）、用户是否已有设计系统/品牌色、目标框架（React/Vue/原生）、深色还是浅色。
- 若用户已有设计系统：**优先用用户的 token**，本包作兜底与规范示范。

### 第 2 步：设计决策（先选风格，产出简短说明——不自嗨，不啰嗦）
1. 读 `references/style-archetypes.md`，**选定 1 种风格原型**并说明理由（写码前必须定方向，避免单调/混搭）。
2. 定主色倾向（结合 `knowledge/色彩.md` 情绪联想）与排版层级（`knowledge/排版.md`）。
3. 定间距尺度：一律 4px 基底（`--space-1…9`）。

### 第 3 步：生成代码
按序落地：
1. 引入/对照 `tokens/design-tokens.md`：所有颜色、圆角、阴影、间距、字体、动效**引用 token，不写裸值**。
2. 组件按 `rules/组件约定.md` 统一（按钮/卡片/输入/导航/表格/弹窗…）。
3. 布局与多端按 `rules/响应式.md`（移动优先 + 断点）。
4. 质感与动效按 `rules/质感与动效.md` + `patterns/easing-swatches.md`（阴影分层、悬停三件套、正确缓动，拒绝 `linear`/`all 1s`）。
5. 可参考 `examples/before-after.md` 的落地形态。

### 第 4 步：美学自检（必须，不达标准不许交付）
逐条核对 `rules/代码检查清单.md`（统一性/层级/间距/响应式/质感/可访问性/风格一致性），未通过的项修复后再交付。

---

## 使用铁律（违反即不合格）
1. **不写裸值**：颜色/圆角/阴影/间距/动效一律 token。
2. **先选风格**：写码前从 style-archetypes.md 定 1 种气质。
3. **统一里做对比**：有焦点（1 个主按钮/主标题/主数字），别一切平均。
4. **间距守 4px 尺度**：禁止 13px/19px 散值。
5. **动效用正确缓动**：`--ease-out`/`--ease-in-out`/`--ease-spring` + 合理时长，禁 `linear`。
6. **可访问性优先**：对比度 ≥4.5:1、焦点环、`prefers-reduced-motion`、语义化标签。
7. **尊重用户系统**：有品牌/设计系统时优先用户的。

## 参考实现
- 完整可跑的设计 Token：`tokens/design-tokens.css`
- 端到端改造示例：`examples/before-after.md`
- 安装/接入到具体 harness：`integration/`

## 可选：MCP 设计调研工具（插件内）
若当前环境已连接本插件的 MCP server（`ai-ui-aesthetics-design-research`），写前端前**优先调研真实参考**：
1. `research_reference_site(url)`：抓参考站，提取主色板/字体/圆角间距/亮暗，据此定配色与气质。
2. `scan_colors(source)`：扫设计稿/截图/素材图取主色盘。
3. `suggest_color_palette(style)`：按风格原型直接产出配色方案 + 对比度检查。
建议流程：先 `research_reference_site` 或 `scan_colors` 拿真实依据，再 `suggest_color_palette` 选风格方案，最后走第 3 步生成代码。Pillow/httpx 等由 MCP 进程自带，Skill 本身保持零依赖。