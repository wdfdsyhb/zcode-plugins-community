---
name: academic-search
description: 学术文献自动追踪与周报生成。当用户想持续追踪某个研究方向/主题的最新论文、生成中文文献周报、跟进学术领域进展时使用。覆盖检索→去重→过滤→摘要补全→LLM中文概述→HTML/Markdown报告全流程。触发场景如"追踪XXX方向的最新论文""帮我跟进XXX领域文献""这周XXX有什么新文章"。
---

# academic-search · 学术文献追踪 skill

自动追踪任意研究方向的最新论文，生成带中文概述的 HTML/Markdown 周报。
OpenAlex 主检索 + Semantic Scholar 摘要补全 + SQLite 本地去重 + LLM 中文概述。

## 何时使用

用户表达以下意图时触发：
- "追踪 / 跟进 / 关注 XXX 方向的最新论文 / 文献 / 进展"
- "这周 / 最近 XXX 有什么新文章 / 新论文"
- "帮我生成 XXX 领域的文献周报 / 综述"
- "我想持续了解 XXX 的研究动态"

## 工作区与状态

- skill 根目录：`~/.zcode/skills/academic-search/`（下文简称 `$SKILL`）
- 用户数据：`$SKILL/workspace/`
  - `doi_registry/literature.db` — SQLite 去重库（跨会话持久，判断是否首次运行的依据）
  - `output/` — 报告输出
- 主题配置：`$SKILL/topics.yaml`（用户编辑，定义追踪方向）
- 密钥配置：`$SKILL/.env`（API Key，绝不写入代码）

**判断首次运行**：`$SKILL/workspace/doi_registry/literature.db` 不存在 → 走首次配置流程。

## 流程 A：首次配置（数据库不存在）

### A1. 安装依赖
```bash
pip install -r "$SKILL/requirements.txt"
```
依赖：requests, openai, pyyaml, python-dotenv。

### A2. 引导用户配置 topics.yaml
复制模板并编辑：
```bash
cp "$SKILL/topics.yaml.example" "$SKILL/topics.yaml"
```
然后**交互式协助用户填写主题**：
1. 问用户想追踪什么方向（如"固态电池电解质"）
2. 据此建议 OpenAlex query（语法见下文速查），告诉用户可在 https://openalex.org/works 手动测试
3. 问是否允许预印本（材料/化学类建议 false，CS 类建议 true）
4. 问白名单策略：auto（推荐，自动生成 IF 期刊白名单）/ 手写文件名 / null（不限）
5. 问 IF 阈值（默认 3.0，仅 whitelist=auto 时生效）
6. 问主题色（Hex，给个默认即可）
7. 问有无需要排除的关键词（生物医学/农业等跑偏领域），加到 exclude_title_keywords

把结果写入 topics.yaml 的 topics 列表。可配置多个主题。

### A3. 引导用户配置 .env
复制模板：
```bash
cp "$SKILL/.env.example" "$SKILL/.env"
```
告诉用户填：
- `S2_API_KEY` — Semantic Scholar，免费申请 https://www.semanticscholar.org/product/api#api-key ，强烈推荐
- `OA_MAILTO` — OpenAlex，填自己邮箱即可获得 polite pool（免费）
- `LLM_*` — 可选，不配也能生成英文报告；配了才有中文概述

**强调**：API Key 只写进 .env，不要告诉别人，也不要写进 topics.yaml 或代码。

### A4. 初始化并首次检索
```bash
# 建库
python "$SKILL/engine/literature_pipeline.py" --init

# 增量检索（首次会拉最近 7 天）
python "$SKILL/engine/incremental_search.py" --apply

# 生成报告（--auto-summary 自动调 LLM 写中文概述，--md 同时输出 Markdown）
python "$SKILL/engine/generate_report.py" --date $(date +%Y-%m-%d) --auto-summary --md

# 刷新索引页
python "$SKILL/engine/build_index.py"
```
首检时若主题 whitelist=auto，会自动触发白名单生成（调 OpenAlex 统计期刊频次），耗时稍长，属正常。

### A5. 交付报告
- HTML：`$SKILL/workspace/output/lit-weekly-YYYY-MM-DD.html`（浏览器打开，卡片式可标记/搜索）
- 索引：`$SKILL/workspace/output/index.html`
- Markdown：`$SKILL/workspace/output/lit-weekly-YYYY-MM-DD.md`
把当期 md 的关键内容（主题综述 + 几篇亮点论文）摘要回复给用户，并附 HTML 路径。

## 流程 B：增量更新（数据库已存在）

用户再次说"看看这周新论文""更新一下文献"时：
```bash
# 拉取自上次运行以来的新文献
python "$SKILL/engine/incremental_search.py" --apply

# 生成周报
python "$SKILL/engine/generate_report.py" --date $(date +%Y-%m-%d) --auto-summary --md

# 刷新索引
python "$SKILL/engine/build_index.py"
```
然后把新文献摘要回复给用户。

## 流程 C：调优（用户反馈召回质量）

- **"召回太多 / 不相关"**：
  1. 查看被过滤的论文：`sqlite3 "$SKILL/workspace/doi_registry/literature.db" "SELECT title,journal,filter_reason FROM papers WHERE is_qualified=0 LIMIT 20;"`
  2. 引导用户在 topics.yaml 的 exclude_title_keywords 加排除词，或收紧 query（用 AND）
  3. 重跑标记：`python "$SKILL/engine/db_cleanup.py" --apply`
- **"好论文被过滤了"**：检查 filter_reason，若是 not_whitelist，让用户把该期刊加进 references/ 对应白名单 md，或把 whitelist 改 null
- **"想加 / 删主题"**：编辑 topics.yaml，重跑 incremental_search
- **"摘要缺失"**：`python "$SKILL/engine/backfill_abstracts_oa.py" --apply`
- **"想回溯历史"**：`python "$SKILL/engine/backfill_archive.py" --apply`

## OpenAlex Query 语法速查

| 语法 | 含义 | 示例 |
|------|------|------|
| `OR` | 并列任一 | `epoxy toughening OR epoxy toughness` |
| `AND` | 共现（默认） | `polymer AND "machine learning"` |
| `"..."` | 精确短语 | `"solid-state battery"` |
| `-` | 排除某词 | `battery -solar -fuel` |

技巧：先在 https://openalex.org/works 测试 query，看返回是否精准，再写入 topics.yaml。

## 常见坑

- **检索 0 结果**：多半是 OpenAlex 限流 → 让用户在 .env 填 OA_MAILTO 邮箱；或时间窗口太短
- **S2 报 429**：没填 S2_API_KEY，限频 1次/5秒；填了 key 提升到 1次/秒
- **跨年全被过滤 old_year**：topics.yaml 的 year_window 需手动更新（如 2027 年改为 [2026, 2027]）
- **LLM 概述不生成**：检查 .env 的 LLM_BASE_URL/LLM_API_KEY/LLM_MODEL 是否都填了；论文 abstract 太短（<30字）不会调 LLM
- **白名单匹配不到**：期刊名归一化差异，查 DB 实际存的 journal 名，在白名单 md 加完整名称

## 文件结构

```
$SKILL/
├── SKILL.md                 # 本文件（编排逻辑）
├── topics.yaml.example      # 主题配置模板（用户复制为 topics.yaml）
├── topics.yaml              # 用户主题配置（.gitignore 排除）
├── .env.example             # API Key 模板
├── .env                     # 用户 API Key（.gitignore 排除）
├── requirements.txt
├── engine/                  # 引擎代码（用户无需改）
│   ├── config.py            # 配置加载（dotenv + topics.yaml）
│   ├── literature_pipeline.py   # 核心管线（检索/去重/过滤/补全）
│   ├── incremental_search.py    # 增量检索入口
│   ├── generate_report.py       # 报告生成（HTML+MD+LLM摘要）
│   ├── build_index.py           # 索引页生成
│   ├── build_whitelist.py       # 白名单自动生成
│   ├── db_cleanup.py            # 数据库清理
│   ├── backfill_archive.py      # 历史回溯
│   ├── backfill_abstracts_oa.py # 摘要回填
│   └── backfill_dates_fast.py   # 日期回填
├── references/              # 期刊白名单（auto 自动生成 / 手写）
├── templates/               # HTML 报告模板（CSS+JS）
└── workspace/               # 用户数据（DB + 报告，.gitignore 排除）
    ├── doi_registry/literature.db
    └── output/
```
