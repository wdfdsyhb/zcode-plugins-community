---
name: lessonry
description: Create single-file interactive learning webpages in the "step-player" house style — Chinese beginner-friendly tutorials with SVG step-by-step animations, per-chapter quizzes, lab sliders, and a built-in visual acceptance pipeline. Use whenever the user wants an interactive tutorial/lesson/学习网页 about any topic (Transformer, agents, K8s, CLIP, gradient descent, CUDA, KV cache — or anything else entirely), says 做一个/写一个 交互式学习网页、交互讲解、可视化教程、学习笔记网页, asks to add a chapter to an existing lessonry-style page, or wants to 调研并讲解一个新概念 in the illustrated step-player format. Not for slide decks, PDFs, or plain markdown notes.
license: MIT
---

# lessonry — 交互式学习网页生产线

把任意主题做成一页"由浅入深、可播放、可自测"的单文件 HTML 交互教程。
方法论沉淀自一个 7 页 AI 课程系列（Transformer / Agent / K8s / CLIP / SGD / GPU-CUDA / KV Cache）的真实生产与验收过程。

**产出物**：一个单文件 `主题.html`——零构建、双击可开、章节化、每章带步骤播放器（▶ 播放 / ⏭ 单步 / ↺ 重置）、SVG 动画、图例、一句话总结与自测小测。

## Task Router

| 用户意图 | 路线 | 必读文件 |
|---|---|---|
| 从零做一个新主题的学习网页 | 完整五步工作流（下文） | pedagogy.md + patterns.md + engine-guide.md + checklist.md |
| 给现有 lessonry 页面加一章 | 工作流第 3-4 步（只做新章+回归） | engine-guide.md + checklist.md |
| 只讨论设计/大纲，还没动笔 | 工作流第 1-2 步后停下与用户确认 | pedagogy.md |
| 想看"成品长什么样" | 打开 pages-examples/ 真实范例 | — |
| 报告某页有 bug / 内容错误 | 按 checklist.md 的坑清单定位 → 修复 → 回归 | checklist.md |

**Always load ALL files listed for your route before writing code.** 漏读的代价是返工；
多读一个文件只花几百 token。构建前至少完整通读一遍真实范例
`pages-examples/6-gpu-cuda.html`——它是全部规范的活样例。

## 完整工作流（从零做一页）

### 第 1 步 · 澄清需求
- 确认三件事：**主题与边界**、**读者水平**（默认中文零基础小白）、**篇幅**（默认 8±2 章，30-40 分钟）。
- 未指定时先做轻量调研（主题属于哪个领域、公认的学习主线是什么），把结论写进第 0 章。

### 第 2 步 · 设计大纲
- 读 `references/pedagogy.md`，产出：章节列表（每章一句话目标 + 标 ★ 的核心章）+ 类比映射表。
- 每章从 `references/patterns.md` 选定主交互形态（并排对比/流水线/滑块实验室/终端模拟…）。
- **把大纲给用户确认后再动笔**（大纲错了全错）。

### 第 3 步 · 构建
- 复制 `assets/template.html` 作为起点（引擎勿改；只换标题、调色板、章节）。
- 读 `references/engine-guide.md`；逐章填充：五件套结构（note → 播放器/交互件 → legend → recap → quiz）。
- 铁律：单文件无构建步骤；公式走"例子→公式→逐符号点名→变式"四步；SVG 文本不换行，长文案放 HTML note。
- 每写完一章立即在浏览器里单步过一遍——不要攒到最后。

### 第 4 步 · 验证（不跳过）
- 读 `references/checklist.md`，顺序执行：V1 语法 → V2 逐步骤回归（收集 errs + 隐藏元素审计）→ V3 无头截图逐章视觉检查 → V4 内容审查（逐题验算、数字口径、黑话白话）。
- 发现问题 → 修复 → **只重截受影响章节**复检 → 直到全绿。

### 第 5 步 · 交付
- 报告：文件路径、章节地图、建议学习顺序（本页与相关页的先后）、快捷键（空格/→/R）。
- 提醒用户：动画速度可在导航栏调节；`#autoplay` 可快速过完整页。

## Rules

- **验证未过不交付。** 步骤播放器会吞掉步骤里的异常（字幕照常推进），必须用 checklist V2 的
  探针显式收集错误；只看画面发现不了坏步骤。
- **数字必须可复算。** 图、字幕、quiz 答案共用同一数据源；倍数/折扣全页一种口径。
- **公式不空投。** 每个公式走完 pedagogy 的四步链；黑话首次出现给括号白话。
- **示例优于说教。** 不确定怎么写时，先去 pages-examples 里找同类结构照着改。
- **一页一主题。** 内容溢出时拆成系列页 + 顶部系列导航，不要做成超长单页。

## 反馈迭代

用户报 bug 或"某章看不懂"时：先按 checklist.md 坑清单定位类别（语法/视觉/内容/口径），
修复后跑 V2+V3 对应项复检，并把新坑追加进坑清单——这份清单是生产线最值钱的部分。
