# 📚 academic-search

> 任意主题的学术文献自动追踪与周报生成 · [ZCode](https://zcode.io) Skill

OpenAlex 主检索 + Semantic Scholar 摘要补全 + SQLite 本地去重 + LLM 中文概述，输出排版精美的 HTML/Markdown 周报。

**改改关键词就能用在你自己的研究方向上**——材料、化学、AI、医学、工程……任何领域都行。

---

## ✨ 功能特性

- 🔍 **自动化检索**：OpenAlex 为主，Semantic Scholar 补全摘要，日级增量窗口
- 🗃️ **本地去重归档**：SQLite 持久化，DOI + 标题双键去重，跨主题共现自动合并
- 🚦 **智能过滤**：标题/期刊排除词 + 期刊白名单（可自动生成），自动排除跑偏领域
- 📝 **摘要补全**：OpenAlex 倒排索引还原 + S2 明文摘要双链路，缺失率极低
- 🤖 **LLM 中文概述**：一键接入豆包/DeepSeek/Qwen/OpenAI，逐篇概述 + 主题级综述
- 📄 **双格式输出**：精美 HTML（移动端适配、筛选搜索、标记导出）+ Markdown
- 🎯 **零硬编码主题**：所有追踪方向写在 `topics.yaml`，换方向不改一行代码
- 🔧 **API Key 安全**：纯环境变量管理，`.env` 不进仓库，可安全公开分发

---

## 🚀 快速开始

### 1. 安装

将本仓库放到 ZCode 的 skills 目录：

```bash
# ZCode 用户目录（Windows）
git clone https://github.com/<your-username>/academic-search.git "$HOME/.zcode/skills/academic-search"

# macOS / Linux
git clone https://github.com/<your-username>/academic-search.git ~/.zcode/skills/academic-search
```

安装依赖：

```bash
pip install -r ~/.zcode/skills/academic-search/requirements.txt
```

依赖：`requests`、`openai`、`pyyaml`、`python-dotenv`

### 2. 配置追踪主题

```bash
cd ~/.zcode/skills/academic-search
cp topics.yaml.example topics.yaml
# 编辑 topics.yaml，填入你的研究方向
```

`topics.yaml` 示例：

```yaml
topics:
  - key: solid_state_battery
    display: 固态电池电解质
    query: "solid state electrolyte lithium OR solid-state battery electrolyte"
    allow_preprint: false
    whitelist: auto          # 自动生成 IF 期刊白名单
    theme_color: "#e67e22"
```

### 3. 配置 API Key

```bash
cp .env.example .env
# 编辑 .env 填入你的 key
```

| 变量 | 用途 | 是否必须 |
|------|------|----------|
| `S2_API_KEY` | Semantic Scholar 摘要补全 | ⭐ 推荐（[免费申请](https://www.semanticscholar.org/product/api#api-key)） |
| `OA_MAILTO` | OpenAlex polite pool（填邮箱即可） | ⭐ 推荐（免费） |
| `LLM_*` | LLM 中文概述 | 可选 |

> ⚠️ `.env` 已在 `.gitignore` 中排除，绝不会随仓库分发。

### 4. 初始化并首次检索

在 ZCode 中对 AI 说**「追踪固态电池方向的最新论文」**，skill 会自动引导完成配置。或手动执行：

```bash
python engine/literature_pipeline.py --init          # 建库
python engine/incremental_search.py --apply           # 增量检索
python engine/generate_report.py --date $(date +%Y-%m-%d) --auto-summary --md  # 生成报告
python engine/build_index.py                          # 刷新索引
```

报告输出到 `workspace/output/`：

```
workspace/output/
├── index.html                    # 索引页（所有期次聚合）
├── lit-weekly-2026-08-06.html    # HTML 周报（卡片式、可标记/搜索/筛选）
└── lit-weekly-2026-08-06.md      # Markdown 周报
```

### 5. 定期增量更新

```bash
python engine/incremental_search.py --apply
python engine/generate_report.py --date $(date +%Y-%m-%d) --auto-summary --md
python engine/build_index.py
```

---

## 🎯 主题定制

打开 `topics.yaml`，核心是 `topics` 列表。每个主题字段：

| 字段 | 说明 |
|------|------|
| `key` | 唯一标识（英文） |
| `display` | 中文显示名 |
| `query` | OpenAlex 搜索语法（见下表） |
| `allow_preprint` | 是否允许 arXiv 预印本（CS 类建议 true） |
| `whitelist` | `auto`（自动生成）/ 文件名.md / `null`（不限） |
| `theme_color` | HTML 主题色（Hex） |
| `if_threshold` | （whitelist=auto 时）IF 下限，默认 3.0 |

### OpenAlex Query 语法

| 语法 | 含义 | 示例 |
|------|------|------|
| `OR` | 并列任一 | `epoxy toughening OR epoxy toughness` |
| `AND` | 共现（默认） | `polymer AND "machine learning"` |
| `"..."` | 精确短语 | `"solid-state battery"` |
| `-` | 排除 | `battery -solar -fuel` |

> 💡 先在 [openalex.org/works](https://openalex.org/works) 测试 query 是否精准，再写入配置。

---

## 📁 目录结构

```
academic-search/
├── SKILL.md                 # ZCode skill 编排逻辑
├── topics.yaml.example      # 主题配置模板
├── .env.example             # API Key 模板
├── requirements.txt
├── engine/                  # 引擎代码（无需修改）
│   ├── config.py            # 配置加载（dotenv + topics.yaml）
│   ├── literature_pipeline.py   # 核心管线
│   ├── incremental_search.py    # 增量检索
│   ├── generate_report.py       # 报告生成
│   ├── build_index.py           # 索引页
│   ├── build_whitelist.py       # 白名单自动生成
│   ├── db_cleanup.py            # 数据库清理
│   └── backfill_*.py            # 历史/摘要/日期回填
├── references/              # 期刊白名单（auto 自动生成）
├── templates/               # HTML 报告模板（CSS+JS）
└── workspace/               # 用户数据（DB + 报告，.gitignore 排除）
```

---

## 📖 使用流程

| 场景 | 命令 |
|------|------|
| 首次配置 | 在 ZCode 中说「追踪 XXX 方向的最新论文」，skill 自动引导 |
| 定期增量 | `incremental_search.py --apply` → `generate_report.py` → `build_index.py` |
| 历史回溯 | `backfill_archive.py --apply` |
| 摘要补全 | `backfill_abstracts_oa.py --apply` |
| 清理去重 | `db_cleanup.py --apply` |
| 只生成部分主题 | `generate_report.py --topics key1,key2` |

---

## 🔒 安全说明

- **API Key 纯环境变量**：所有 key 通过 `.env` 或系统环境变量读取，代码中零硬编码
- **`.env` 不进仓库**：已在 `.gitignore` 中排除
- **用户数据隔离**：`topics.yaml` 和 `workspace/` 均在 `.gitignore` 中排除
- 本仓库可安全公开分发，不含任何真实密钥或用户数据

---

## 📜 许可

[MIT License](LICENSE)

数据来源：[OpenAlex](https://openalex.org/)、[Semantic Scholar](https://www.semanticscholar.org/)、[Crossref](https://www.crossref.org/)。请遵守各 API 使用条款。
