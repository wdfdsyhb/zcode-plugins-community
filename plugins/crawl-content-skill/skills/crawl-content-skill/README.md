# crawl-content-skill

一个 [ZCode](https://zcode.dev) / Claude Code / Codex 的 **Skill**，用自然语言一句话爬取中文社交媒体（B站 / 小红书 / 抖音 / 微博 / 快手 / 知乎）的内容 + 评论，自动做数据分析，并可选导出 8 种 docx 研究报告。

底层基于 [MediaCrawler](https://github.com/NanmiCoder/MediaCrawler) 开源项目。

---

## ✨ 能做什么

- **单平台抓取**：「爬 B 站价值投资 + 巴菲特」
- **多平台并行**：「全网扫一下 LABUBU 口碑」→ xhs + dy + wb + bili 同时抓（≤3 并发）
- **跨平台对比**：「比一比小红书和抖音谁在讨论 DeepSeek」→ 自动出对比矩阵
- **8 种 docx 报告**：深度研究 / 舆情简报 / 行业扫描 / 情绪温度计 / 创作素材 / 话语分析 / 数据底稿 / 跨平台对比战报

## 📋 前置依赖

| 依赖 | 安装方式 |
|---|---|
| Python 3.9+ | 系统自带或 `pyenv install 3.11` |
| [uv](https://github.com/astral-sh/uv) | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| [MediaCrawler](https://github.com/NanmiCoder/MediaCrawler) | 由本 skill 的 install.sh 自动 clone |
| Chromium | `uv run playwright install chromium`（首次抓取前） |
| Node.js 20+ | 仅抓抖音 / 知乎时需要 |
| [ZCode](https://zcode.dev) 或 Claude Code | 作为 skill 宿主 |

## 🚀 一键安装

```bash
git clone https://github.com/JJ188-coder/crawl-content-skill.git
cd crawl-content-skill
bash install.sh
```

`install.sh` 会做三件事：

1. 把 `crawl-content` skill 装到 `~/.agents/skills/crawl-content/`（跨工具标准位置，ZCode / Claude Code / Codex 都能发现）
2. clone MediaCrawler 到 `~/MediaCrawler-main`（如已存在则跳过）
3. 在 MediaCrawler 里跑 `uv sync` 装好 Python 依赖

装完重启 ZCode / Claude Code，skill 即生效。

## 🔧 自定义路径

默认路径通过环境变量覆盖，**无需改 SKILL.md**：

```bash
# MediaCrawler 仓库位置（默认 ~/MediaCrawler-main）
export MC_HOME="$HOME/Desktop/Github/MediaCrawler-main"

# 抓取数据 & docx 报告输出目录（默认 ~/Documents/crawl-content）
export CRAWL_WORKDIR="$HOME/Documents/my-crawl-reports"
```

把这两行加到 `~/.zshrc` 或 `~/.bashrc` 即可永久生效。

## 📖 使用示例

在 ZCode / Claude Code 里直接说：

```
/crawl-content bili 价值投资,巴菲特
```

或自然语言：

```
爬一下小红书 LABUBU 的口碑，出个舆情简报
```

```
全网扫一下 DeepSeek，对比各平台讨论度
```

```
比一比 B 站、抖音、小红书谁在讨论宁德时代财报
```

抓完会问你选哪种 docx 报告（A-H 可多选），选完自动生成到 `$CRAWL_WORKDIR/`。

## ⚠️ 合规与红线

- **仅抓公开数据**，不抓私密对话、未公开内容
- **单次单平台 ≤ 50 条**，多平台并行**不放大单平台配额**
- 数据**仅用于研究分析**，不商用、不公开二次分发原始 jsonl
- 引用评论时：标赞数，但用户 ID 必须匿名化
- 同主题第二次深抓需间隔 24h

完整红线见 [SKILL.md § 10](./SKILL.md#10-红线与合规)。

## 📂 仓库结构

```
crawl-content-skill/
├── SKILL.md          # skill 主体（ZCode 自动加载）
├── install.sh        # 一键安装脚本
├── README.md         # 本文件
└── LICENSE           # MIT
```

## 🙏 致谢

- [MediaCrawler](https://github.com/NanmiCoder/MediaCrawler) — 核心爬取引擎，由 NanmiCoder 维护
- 本 skill 只是在其之上封装了自然语言解析、多平台并行调度、数据分析模板和 docx 报告生成

## 📄 License

MIT — 见 [LICENSE](./LICENSE)
