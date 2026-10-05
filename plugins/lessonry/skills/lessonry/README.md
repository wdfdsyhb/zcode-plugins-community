# lessonry 📚

**把任意主题做成一页"由浅入深、可播放、可自测"的单文件交互式学习网页。**

lessonry 是一个 [ZCode skill](https://code.z.ai)：安装后，你只需要说 *"做一个讲 XX 的交互式学习网页"*，
agent 就会按照一套经过 7 页真实课程打磨过的生产线——**教学法 → 页面引擎 → 动画模式库 → 验收管线**——
产出可直接双击打开的中文交互教程。

> 项目起源：本 skill 的方法论沉淀自一个 7 页 AI 基础课程系列
> （Transformer·ViT / Agent Loop / K8s / CLIP·多模态 / 随机梯度下降 / GPU·CUDA / KV Cache·量化）
> 的真实生产、三轮视觉验收与 140+ 处内容修复过程。

## 产出长什么样？

每页是一个零依赖的单文件 HTML：

- 📖 **章节化**：一分钟速览 → 直觉类比 → 核心机制(★) → 实战 → 全景+综合测验
- ▶️ **步骤播放器**：每章一个动画讲解器（播放/单步/重置，空格/→/R 快捷键），字幕与画面逐步对齐
- 🧪 **交互件**：滑块实验室（亲手把训练玩坏）、可点击架构图、终端模拟、显存计算器…
- 📝 **每章自测**：即时反馈的选择题 + 完整解析
- 🧮 **公式不空投**：先数字例子、再公式、逐符号白话点名、quiz 变式练习
- ✅ **可验收**：内置回归探针与无头截图管线，修复未验证不算完成

打开 [`assets/template.html`](assets/template.html) 可以直接看到骨架长什么样（内含一个可播放的最小演示章节）；
[`pages-examples/6-gpu-cuda.html`](pages-examples/6-gpu-cuda.html) 是一份完整的真实成品。

## 快速开始（不用装 skill）

```bash
git clone https://github.com/<owner>/lessonry.git
cd lessonry/assets
python -m http.server 8613
# 浏览器打开 http://localhost:8613/template.html
```

## 安装为 skill（推荐）

复制到 ZCode 的 skill 发现目录：

```bash
# 全局（对所有项目生效）
mkdir -p ~/.agents/skills
cp -r lessonry ~/.agents/skills/lessonry
```

之后在任意会话里说：

- 「做一个讲 Git 基础的交互式学习网页」
- 「我想学 KV Cache，做一个交互讲解页」
- 「给我的 lessonry 页面加一章讲 FlashAttention」

## 工作流

```
澄清需求 → 设计大纲(读 pedagogy) → 构建(复制 template + engine-guide)
        → 验证(checklist: 语法→逐步骤回归→截图逐章检查→内容审查)
        → 交付(学习顺序 + 快捷键) → 反馈迭代(坑清单持续沉淀)
```

## 文件地图

| 文件 | 内容 |
|---|---|
| [SKILL.md](SKILL.md) | skill 入口：任务路由 + 五步工作流 + 规则 |
| [assets/template.html](assets/template.html) | 可复制骨架：全套 CSS + 步骤播放器引擎 + 最小演示章节 |
| [references/pedagogy.md](references/pedagogy.md) | 教学法：大纲设计、章节五件套、公式四步链、数字一致性 |
| [references/engine-guide.md](references/engine-guide.md) | 引擎 API：initSection / 动画原语 / initQuiz / #autoplay |
| [references/patterns.md](references/patterns.md) | 10 种交互形态模式库（含选型速查表） |
| [references/checklist.md](references/checklist.md) | 交付前验证管线 + 16 条血泪坑清单 |
| [pages-examples/](pages-examples/) | 完整真实范例 |

## License

[MIT](LICENSE)
