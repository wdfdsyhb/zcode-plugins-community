---
name: crawl-content
description: Use to crawl Chinese social media (B站/小红书/抖音/微博/快手/知乎) for content + comments via MediaCrawler, optionally chain to /wechat-article (writes 4000-char body) → export as local docx report at `$CRAWL_WORKDIR/{主题}-{YYYYMMDD}.docx`. Supports multi-platform parallel crawling — natural-language input is auto-split into jobs (e.g. 「全网扫 LABUBU」→ xhs+dy+wb+bili in parallel). Trigger on /crawl-content <平台> <关键词>, 爬B站, 爬小红书, 爬抖音, 抓社交媒体数据, 内容生态扫描, 关键词搜索抓评论, 爬数据写公众号, 爬数据出 docx, 多平台并行, 全网扫 Always available.
---

# Skill: crawl-content
# 社交媒体内容爬取与生态分析（支持多平台并行）

对 `$ARGUMENTS` 描述的目标（平台 + 关键词，或自然语言任务）执行 MediaCrawler 抓取，**自动识别单任务 vs 多任务**，多任务时智能并行（≤3 并发）+ 出**跨平台对比**，可选导出 4000 字本地 docx 研究报告到 `$CRAWL_WORKDIR/`。

## 适用场景

**单任务**：
- 行业研究：「抓 B 站价值投资 + 巴菲特，看头部内容结构」
- 消费者口碑：「抓小红书泡泡玛特 LABUBU，看用户真实情绪」
- 舆情监控：「抓微博宁德时代财报当天讨论」

**多任务并行（新）**：
- 全网扫单关键词：「全网扫一下 LABUBU 口碑」→ xhs+dy+wb+bili 并行
- 差异化多任务：「B 站价值投资 + 微博宁德时代 + 小红书理财」→ 3 平台 3 关键词并行
- 跨平台对比：「比一比 B 站、抖音、小红书谁在讨论 DeepSeek」→ 并行抓 + 出跨平台对比

**不适用**：私密数据、未公开内容、规模化采集（单平台 >50 条/次，并发也不放大单平台配额）、商业二次分发。

---

## 0. 环境前提（执行前必查）

### 0.1 路径约定（可移植化）

本 skill 默认以下路径，**均可通过环境变量覆盖**（换机器/换目录只改这两行即可）：

```bash
# MediaCrawler 仓库根目录（clone 后的路径）
export MC_HOME="${MC_HOME:-$HOME/MediaCrawler-main}"
# 抓取数据 & docx 报告输出目录
export CRAWL_WORKDIR="${CRAWL_WORKDIR:-$HOME/Documents/crawl-content}"
```

> 默认值 `$HOME/MediaCrawler-main` 和 `$HOME/Documents/crawl-content`。
> 如已 clone 到别处（如 `~/Desktop/Github/MediaCrawler-main`），在 shell 里 `export MC_HOME=...` 覆盖即可，**无需改 SKILL.md**。

### 0.2 依赖检查

| 依赖 | 检查命令 | 缺失时安装 |
|---|---|---|
| MediaCrawler 仓库 | `ls "$MC_HOME/main.py"` | `git clone https://github.com/NanmiCoder/MediaCrawler.git "$MC_HOME"` |
| uv | `~/.local/bin/uv --version` | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| Python 依赖 | `cd "$MC_HOME" && uv sync` | 同左 |
| Chromium 驱动 | 看 `~/Library/Caches/ms-playwright/chromium*` | `uv run playwright install chromium` |
| Node.js (仅 dy/zhihu) | `~/.nvm/versions/node/v20*/bin/node --version` | `curl ... nvm install.sh \| bash && nvm install 20` |

---

## 1. 每次执行的开场环境激活（必跑）

```bash
export PATH="$HOME/.local/bin:$PATH"               # 激活 uv
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" # 激活 Node（dy/zhihu 必需）
export MC_HOME="${MC_HOME:-$HOME/MediaCrawler-main}"
export CRAWL_WORKDIR="${CRAWL_WORKDIR:-$HOME/Documents/crawl-content}"
mkdir -p "$CRAWL_WORKDIR"
cd "$MC_HOME"
```

---

## 2. 解析用户输入 → jobs[] 列表

无论用户怎么说，最终都拆成一个 **jobs 数组**（单任务时 length=1）。每个 job 是：

```python
{
  "platform":  "bili",            # 平台代码
  "keywords":  "价值投资,巴菲特",   # 逗号分隔
  "intent":    "data+insight"     # data-only / data+insight / publish
}
```

### 2.1 平台名映射（代码 vs 数据目录有差异！）

⚠️ MediaCrawler 源码硬编码：**CLI 平台代码** 和 **`data/<X>/jsonl/` 子目录名** 在 `dy/wb/ks` 三个平台上不一致。下面是源码 ground truth（`store/<x>/_store_impl.py` 中 `AsyncFileWriter(platform="...")` 的写死值）：

| 用户说 | 代码 (CLI / browser_data) | 数据目录 (data/) | source_keyword | 风险 |
|---|---|---|---|---|
| B站 / bilibili / 哔哩哔哩 | `bili` | `bili` | ✅ | ⭐ 最稳 |
| 小红书 / xhs / 小红薯 | `xhs` | `xhs` | ✅ | ⭐⭐⭐ 首次有滑块 |
| 抖音 / dy / douyin | `dy` | **`douyin`** | ✅ | ⭐⭐ 需 Node |
| 微博 / wb / weibo | `wb` | **`weibo`** | ✅ | ⭐⭐ 120s 倒计时紧 |
| 快手 / ks / kuaishou | `ks` | **`kuaishou`** | ✅ | ⭐⭐ |
| 知乎 / zhihu | `zhihu` | `zhihu` | ✅ | ⭐⭐⭐ 需 Node + 紧 |
| 贴吧 / tieba | `tieba` | `tieba` | ✅ | ❌ 选择器失效，直接告知用户跳过 |

**两条铁律**：
- `data/<X>/jsonl/` 路径里的 `<X>` 必须**查 DATA_DIR 表**（见下方），不是直接用代码
- `browser_data/<X>_user_data_dir/` 里的 `<X>` 直接用平台代码（源码用 `config.USER_DATA_DIR % config.PLATFORM`）

### 2.2 多任务识别 cheatsheet（自然语言 → jobs[]）

| 用户原话 | 解析 |
|---|---|
| 「爬 B 站价值投资」 | `[{bili, 价值投资}]` ── 单任务 |
| 「扫一下小红书和抖音的 LABUBU 口碑」 | `[{xhs, LABUBU}, {dy, LABUBU}]` ── 多平台同关键词 |
| 「B 站价值投资 + 微博宁德时代 + 小红书理财」 | `[{bili, 价值投资}, {wb, 宁德时代}, {xhs, 理财}]` ── 多任务不同词 |
| 「全网扫 / 全平台扫 LABUBU」 | `[{xhs, LABUBU}, {dy, LABUBU}, {wb, LABUBU}, {bili, LABUBU}]` ── 默认 4 平台组合（不含 ks/tieba/zhihu） |
| 「比一比小红书和抖音谁在讨论 DeepSeek」 | `[{xhs, DeepSeek}, {dy, DeepSeek}]` ── 自带跨平台对比意图 |

**多任务分隔触发词**：`+` / `和` / `以及` / `同时` / `还有` / `逗号分隔的多个平台名`。

**特殊词**：
- 「全网」「全平台」「各平台」 → 默认 xhs+dy+wb+bili 4 个（最稳组合）
- 「主流平台」 → 同上
- 「短视频平台」 → bili+dy+ks
- 「图文平台」 → xhs+wb+zhihu

### 2.3 模糊点 → 直接问

- **关键词不明确**：问用户，不要瞎编。
- **平台不明确**（用户只说"爬一下 LABUBU"）：问要不要全网扫，还是指定平台。
- **意图不明确**：默认走"数据 + 洞察"，最后问是否导出 docx 研究报告。

### 2.4 全文统一使用的 DATA_DIR 映射

所有路径拼接（§ 4.0 / § 5 / § 6 / § 7 / § 8）**必须**走这个 dict，不要直接拿平台代码当目录名：

```python
DATA_DIR = {
    'bili':  'bili',     'xhs':   'xhs',      'dy':    'douyin',
    'wb':    'weibo',    'ks':    'kuaishou', 'zhihu': 'zhihu',
    'tieba': 'tieba',
}
# 用法：path = f"data/{DATA_DIR[code]}/jsonl/..."
# 反例（错）：path = f"data/{code}/jsonl/..."  ← dy/wb/ks 会找不到文件！
```

bash 版（用于 § 4.0 / § 5 等 shell 脚本里）：

```bash
declare -A DATA_DIR=( [bili]=bili [xhs]=xhs [dy]=douyin [wb]=weibo [ks]=kuaishou [zhihu]=zhihu [tieba]=tieba )
# 用法：DIR=${DATA_DIR[$code]}; ls data/$DIR/jsonl/...
```

---

## 3. 配置策略：纯 CLI 参数化，**不动 `config/base_config.py`**

⚠️ **重要变更（vs 旧版本）**：旧版让你 Edit `config/base_config.py` 5 行 —— 那是**冗余且并发不安全**。`main.py` 的 CLI 已经原生支持所有运行时覆写，并发跑多个 job 时若同时改 config 会互相踩。

**所有参数通过 CLI 传**：

| 参数 | 默认值 | 备注 |
|---|---|---|
| `--platform` | job.platform | 必传 |
| `--keywords` | job.keywords | 必传，逗号分隔 |
| `--lt` | `qrcode` | 二维码登录 |
| `--type` | `search` | 关键词搜索 |
| `--get_comment` | `yes` | 评论是认知信号核心 |
| `--get_sub_comment` | `no` | 二级评论默认关 |
| `--crawler_max_notes_count` | `15` | **下限值**：平台单页固定返回数（xhs/bili ≈ 20、dy 视关键词冷热在 ~13-20），实际抓取数 ≥ 设定值，可能多 30-50% |
| `--max_comments_count_singlenotes` | `10` | 单条内容抓评论数 |
| `--save_data_option` | `jsonl` | 最易分析 |
| `--headless` | `no` | 弹浏览器，便于扫码 |

只有当用户明确要求"多抓些 / 少抓些 / 抓二级评论 / 静默模式"时再覆写默认值。

---

## 4. 执行模式（核心：单任务 / 多任务智能调度）

### 4.0 cookie 探测 → 任务分组

```bash
cd "$MC_HOME"
# browser_data/<X>_user_data_dir/ 的 X 直接用平台代码（不查 DATA_DIR）
echo "=== cookie 状态 ==="
for p in bili xhs dy wb ks zhihu; do
  if [ -d browser_data/${p}_user_data_dir ]; then echo "✅ $p (已登录)"; else echo "❌ $p (需扫码)"; fi
done
```

按结果把 jobs 分成两批：

- **batch_logged**：cookie 已存在 → 可直接并行
- **batch_fresh**：cookie 缺失 → 必须串行（避免多个二维码同时弹冲突）

### 4.1 并行启动（batch_logged，≤3 并发）

```bash
mkdir -p logs
TS=$(date +%Y%m%d_%H%M)

# 示例：3 个已登录平台并行
uv run main.py --platform bili --keywords "价值投资,巴菲特" --lt qrcode --type search \
  --get_comment yes --get_sub_comment no --crawler_max_notes_count 15 \
  --max_comments_count_singlenotes 10 --save_data_option jsonl --headless no \
  > logs/crawl_bili_${TS}.log 2>&1 &
PID_BILI=$!

uv run main.py --platform xhs --keywords "价值投资" --lt qrcode --type search \
  --get_comment yes --get_sub_comment no --crawler_max_notes_count 15 \
  --max_comments_count_singlenotes 10 --save_data_option jsonl --headless no \
  > logs/crawl_xhs_${TS}.log 2>&1 &
PID_XHS=$!

uv run main.py --platform wb --keywords "宁德时代" --lt qrcode --type search \
  --get_comment yes --get_sub_comment no --crawler_max_notes_count 15 \
  --max_comments_count_singlenotes 10 --save_data_option jsonl --headless no \
  > logs/crawl_wb_${TS}.log 2>&1 &
PID_WB=$!

echo "已起 PID: bili=$PID_BILI xhs=$PID_XHS wb=$PID_WB"
wait $PID_BILI $PID_XHS $PID_WB
echo "全部完成"
```

**关键规则**：
- 单次最大并发 **3** 个 Chromium 实例（M 系列 Mac 的稳健上限；>4 会卡顿）
- jobs 超过 3 时分波：第一波 3 个并行 → `wait` → 第二波 3 个 → ……
- `run_in_background: true`，timeout 提到 **900000ms（15 分钟）**
- 必须 `tee` 或 `>` 重定向到**独立日志**，否则多平台输出会交织难读
- 时间戳 `$TS` 必须**全局统一**（一次会话只取一次），便于后续聚合

### 4.2 串行扫码（batch_fresh，避免二维码冲突）

```bash
# 串行起，每个等用户扫完再起下一个
for spec in "bili:价值投资" "xhs:LABUBU"; do
  P=${spec%%:*}; K=${spec##*:}
  echo "🎯 准备启动 $P，关键词：$K"
  uv run main.py --platform $P --keywords "$K" --lt qrcode --type search \
    --get_comment yes --crawler_max_notes_count 15 \
    --max_comments_count_singlenotes 10 --save_data_option jsonl --headless no \
    > logs/crawl_${P}_${TS}.log 2>&1 &
  PID=$!
  sleep 30  # 给二维码弹出时间
  # → 这时候必须明确告诉用户：「📱 ${P} 二维码弹了，请用手机扫码登录」
  # → 监控 logs 出现 "Login finished" 或开始抓内容，再继续
  wait $PID  # 本任务跑完才起下一个；若想登录后转后台，用 nohup + 单独监控
done
```

### 4.3 进度监控（多任务版）

每 60-90s 看一次所有 log 文件：

```bash
cd "$MC_HOME"
echo "=== 进度（已运行 X 分钟）==="
for p in bili xhs wb; do  # ← 替换成本次跑的代码列表
  LOG=logs/crawl_${p}_${TS}.log
  [ -f "$LOG" ] || { echo "  $p  ❓ 无 log"; continue; }
  # 内容入库的源码日志特征（每平台一句）
  COUNT=$(grep -cE "update_(douyin_aweme|xhs_note|bilibili_video|weibo_note|kuaishou_video|zhihu_content|tieba_note)" "$LOG" 2>/dev/null || echo 0)
  STATUS="⏳ 抓取中 ($COUNT 内容)"
  if grep -q "Crawler finished" "$LOG"; then STATUS="✅ 完成 ($COUNT 条)"; fi
  if grep -qiE "error|exception|风控|TooManyRequests" "$LOG"; then STATUS="⚠️ 异常 ($COUNT 条)"; fi
  echo "  $p  $STATUS"
done
```

**关键**：完成态一定要带 `($COUNT 条)`，让"跑完很快"和"跑完很少"一眼可辨。dy 经常因为关键词冷门 1 分钟就 finish，附条数后用户/Agent 才能立刻判断是正常少召回还是抓取失败。

关键信号词：
- `keyword:xxx, page:1` → 搜索成功
- `update_xxx_aweme id:xxx` / `update_xhs_note` → 内容已落库
- `batch get comments` → 评论抓取中
- `Crawler finished` → 完成 ✅

### 4.4 单任务模式（退化）

只有 1 个 job 时，跳过所有"并行/批次/监控聚合"逻辑，直接：

```bash
uv run main.py --platform {P} --keywords "{K}" --lt qrcode --type search ... 2>&1 \
  | tee logs/crawl_{P}_${TS}.log
```

`run_in_background: true`，timeout 600000ms（10 分钟）。

---

## 5. 数据验收（按 jobs 列表逐个验）

> ⚠️ **必读警告**：MediaCrawler 的 jsonl 是 **append 累积**模式（源码 `tools/async_file_writer.py:59` 用 `open(path, 'a')`），文件名只按日期分（`search_contents_YYYY-MM-DD.jsonl`），不分关键词、不分批次。
>
> 当天对同一平台跑过多次或不同关键词，**全部追加到同一文件**。验收 / 深挖 / 跨平台对比前**必须**按 `source_keyword == "本次关键词"` 严格过滤，否则会把昨天/今早其他主题的数据混入分析，得到严重错误的洞察。
>
> 所有平台落盘均带 `source_keyword` 字段（dy/wb/ks/xhs/bili/zhihu/tieba 全有，源码已证实）。如果 head 出来的 schema 缺该字段（罕见、可能是旧版本），fallback 到日志 ID 集合过滤（见 § 6）。

```bash
cd "$MC_HOME"
TODAY=$(date +%Y-%m-%d)
declare -A DATA_DIR=( [bili]=bili [xhs]=xhs [dy]=douyin [wb]=weibo [ks]=kuaishou [zhihu]=zhihu [tieba]=tieba )

# 替换成本次实际跑的代码列表
for p in bili xhs wb; do
  DIR=${DATA_DIR[$p]}
  echo "=== $p (data/$DIR/jsonl/) ==="
  ls -la data/$DIR/jsonl/search_*_${TODAY}*.jsonl 2>/dev/null || { echo "  ⚠️ 无数据文件"; continue; }
  echo "文件总行数（含历史 append）："
  wc -l data/$DIR/jsonl/search_*_${TODAY}*.jsonl
  echo "本次抓取行数（按 source_keyword 过滤）："
  for f in data/$DIR/jsonl/search_*_${TODAY}*.jsonl; do
    N=$(python3 -c "import json,sys; print(sum(1 for l in open('$f') if json.loads(l).get('source_keyword')=='$KW'))" 2>/dev/null || echo "?")
    echo "  $f → $N 条"
  done
  echo ""
done
```

> 👀 **看这两组数字的差**：如果"文件总行数 200+ vs 本次 15 条"，说明今天/早些时候跑过其他关键词，append 累积了；后续分析必须严格走 source_keyword 过滤。

某平台**本次抓取**条数 < 5 → 关键词太冷门 / 风控触发 → 告知用户，不要默默吃下去。

---

## 6. 数据深挖（每平台单独跑一次）

每个平台都用下面这段 python heredoc 跑一次。**模板已包含**：① source_keyword 严格过滤、② 主题相关性二次校验、③ 源码事实字段名速查。

### 6.0 跑分析前的硬动作（每次必做）

```bash
cd "$MC_HOME"
# 实测字段名一遍，不要信任模板里的注释
head -1 data/{DATA_DIR[code]}/jsonl/search_contents_{date}.jsonl | \
  python3 -c "import json,sys; print(list(json.loads(sys.stdin.read()).keys()))"
```

如发现字段名和下面速查表不一致（罕见，可能 MediaCrawler 升级了），以**实测为准**并立刻提示用户更新 skill。

### 6.1 字段速查表（基于源码 `store/<平台>/__init__.py` 落盘事实）

```python
# 内容字段（search_contents_*.jsonl）：
# bili: video_play_count(播放), liked_count(赞), video_comment(评论数),
#       video_coin_count(投币), video_favorite_count(收藏), video_share_count(分享), video_danmaku(弹幕)
# xhs:  liked_count, comment_count, collected_count, share_count
# dy:   liked_count(赞,非digg_count!), comment_count, collected_count(非collect_count!), share_count
#       ⚠️ dy 内容无独立"播放量"字段，liked_count 是抖音搜索结果的最佳流量代理
# wb:   attitudes_count(赞), comments_count, reposts_count, share_count
# ks:   liked_count, viewd_count, comment_count
# zhihu: voteup_count(赞同), comment_count, thanks_count(感谢)

# 评论 like 字段：
# bili/xhs/dy/wb/zhihu 评论侧统一是 like_count（注意：dy 内容是 liked_count，评论是 like_count，一字之差）

# 创作者字段：
# bili: total_fans / xhs: follows / dy: follower_count / wb: follows / ks: follows
```

### 6.2 完整分析模板

```bash
cd "$MC_HOME" && python3 <<'EOF'
import json, re
from collections import Counter

# ====== 参数（按本次任务填）======
P    = "{平台代码}"               # 例 'dy'
DIR  = {"bili":"bili","xhs":"xhs","dy":"douyin","wb":"weibo","ks":"kuaishou","zhihu":"zhihu","tieba":"tieba"}[P]
KW   = "{本次关键词}"             # 例 '上海纽约大学'
DATE = "{抓取当天 YYYY-MM-DD}"
CORE_TERMS = {KW, "{核心同义词1}", "{核心同义词2}"}  # 例 {'上海纽约大学','上纽','NYU上海','NYUSH'}

base = f"data/{DIR}/jsonl"
all_videos   = [json.loads(l) for l in open(f"{base}/search_contents_{DATE}.jsonl")]
all_comments = [json.loads(l) for l in open(f"{base}/search_comments_{DATE}.jsonl")]
all_creators = [json.loads(l) for l in open(f"{base}/search_creators_{DATE}.jsonl")]

# ====== ① 必须先按 source_keyword 严格过滤（防 jsonl append 累积污染）======
if all_videos and 'source_keyword' in all_videos[0]:
    videos = [v for v in all_videos if v.get('source_keyword') == KW]
    print(f"📊 source_keyword 过滤: {len(all_videos)} → {len(videos)} 条")
else:
    # fallback：从日志抠本次抓取的 ID 集合（source_keyword 字段缺失时）
    print("⚠️ jsonl 无 source_keyword 字段，fallback 到日志 ID 过滤")
    import subprocess, glob
    log = sorted(glob.glob(f"logs/crawl_{P}_*.log"))[-1]
    id_pattern = {'dy':'aweme_id','xhs':'note_id','bili':'video_id','wb':'note_id','ks':'video_id'}.get(P,'id')
    ids = subprocess.check_output(f"grep -oE '{id_pattern}[:\":\\s]*[0-9a-zA-Z]+' {log} | grep -oE '[0-9a-zA-Z]+$' | sort -u", shell=True, text=True).split()
    id_set = set(ids)
    id_field = {'dy':'aweme_id','xhs':'note_id','bili':'video_id','wb':'note_id','ks':'video_id'}.get(P,'id')
    videos = [v for v in all_videos if str(v.get(id_field)) in id_set]
    print(f"📊 日志 ID 过滤: {len(all_videos)} → {len(videos)} 条")

# 同步过滤 comments：按 video_id ∈ 本次内容集合
id_field = {'dy':'aweme_id','xhs':'note_id','bili':'video_id','wb':'note_id','ks':'video_id','zhihu':'content_id'}.get(P,'id')
content_ids = {str(v.get(id_field)) for v in videos}
parent_field = {'dy':'aweme_id','xhs':'note_id','bili':'video_id','wb':'note_id','ks':'video_id','zhihu':'content_id'}.get(P,id_field)
comments = [c for c in all_comments if str(c.get(parent_field)) in content_ids]
print(f"📊 comments 过滤: {len(all_comments)} → {len(comments)} 条\n")

# ====== ② 主题相关性二次校验（防搜索召回宽松污染）======
def text_of(v):
    return (v.get('title','') or '') + ' ' + (v.get('desc','') or '') + ' ' + (v.get('content','') or '')
on_topic = [v for v in videos if any(t in text_of(v) for t in CORE_TERMS)]
rate = len(on_topic) / max(len(videos), 1) * 100
print(f"🎯 主题相关率: {len(on_topic)}/{len(videos)} = {rate:.0f}%")
if rate < 70:
    print(f"   ⚠️ 召回宽松，建议在最终结论里标注'部分样本含外围讨论'")
# 默认用 videos（宽松）；如用户要严格模式，改成 videos = on_topic

# ====== ③ 字段映射（按 P 取）======
def num(x):
    try: return int(x) if x else 0
    except: return 0
play_field = {'bili':'video_play_count','xhs':'liked_count','dy':'liked_count','wb':'attitudes_count','ks':'liked_count','zhihu':'voteup_count'}[P]
fan_field  = {'bili':'total_fans','xhs':'follows','dy':'follower_count','wb':'follows','ks':'follows','zhihu':'follower_count'}[P]

print(f"\n字段实测: {list(videos[0].keys())[:10]}..." if videos else "无内容")

# ====== ④ 流量分布 ======
plays = sorted([num(v.get(play_field, 0)) for v in videos], reverse=True)
total = sum(plays) or 1
print(f"\n=== 流量分布（按 {play_field}）===")
print(f"  Top3 占: {sum(plays[:3])/total*100:.1f}%")
print(f"  Top10 占: {sum(plays[:10])/total*100:.1f}%")
print(f"  中位数: {plays[len(plays)//2] if plays else 0:,}")
print(f"  最高: {plays[0] if plays else 0:,}")

# ====== ⑤ 创作者梯队 ======
print(f"\n=== 创作者梯队（按 {fan_field}）===")
for label, threshold in [('千万+', 10_000_000), ('百万', 1_000_000), ('十万', 100_000)]:
    cnt = sum(1 for c in all_creators if num(c.get(fan_field, 0)) >= threshold)
    print(f"  {label}: {cnt} 个")

# ====== ⑥ 高赞评论 Top 10（评论侧统一用 like_count）======
print(f"\n=== 高赞评论 Top 10 ===")
sorted_cm = sorted(comments, key=lambda c: num(c.get('like_count', 0)), reverse=True)
seen = set(); shown = 0
for c in sorted_cm:
    cnt = (c.get('content','') or '').replace('\n',' ').strip()
    if cnt[:30] in seen: continue
    seen.add(cnt[:30])
    if shown >= 10: break
    print(f"  赞{num(c.get('like_count',0)):>5} | {cnt[:160]}")
    shown += 1

# ====== ⑦ 评论认知信号（按主题调整 patterns）======
patterns = {
    '亏损自嘲': r'(亏|套|割|销户|天台|血亏|韭菜|被套)',
    '布道用语': r'(护城河|安全边际|长期持有|复利|好公司)',
    '名人引用': r'(段永平|阿段|李录|芒格|穷查理|巴菲特)',
    '找捷径':   r'(诀窍|捷径|秘诀|快速|分钟看懂)',
}
print(f"\n=== 评论认知信号 ===")
for label, pat in patterns.items():
    rx = re.compile(pat, re.I)
    hits = sum(1 for c in comments if rx.search(c.get('content','') or ''))
    print(f"  {label:12s}: {hits} 条 ({hits/max(len(comments),1)*100:.1f}%)")
EOF
```

⚠️ **多任务时一定要循环跑这段**，每平台一次（每次改 `P / KW`）。**保留每平台的输出快照**，§ 7 跨平台对比要用。

### 6.3 情绪快照自动保存（所有报告类型通用基础设施）

每跑完一个平台的分析后，自动写一份 JSON 快照到 `$CRAWL_WORKDIR/.snapshots/`。**D · 散户情绪温度计**依赖此快照做历史对比；其他报告类型也可从中取跨期数据。

```bash
cd "$MC_HOME" && python3 <<'EOF'
import json, os, re
from pathlib import Path
from collections import Counter

# 复用 § 6.2 的计算结果：这部分跟在 § 6.2 heredoc 后面跑
# 所以 P / KW / DATE / videos / comments / patterns 等变量已在内存中
# 如果没有前文计算上下文，则重新从文件加载（兜底）
if 'KW' not in dir():
    # 兜底：重新加载
    P = "{平台代码}"
    DIR = {"bili":"bili","xhs":"xhs","dy":"douyin","wb":"weibo","ks":"kuaishou","zhihu":"zhihu","tieba":"tieba"}[P]
    KW = "{本次关键词}"
    DATE = "{抓取当天 YYYY-MM-DD}"
    base = f"data/{DIR}/jsonl"
    all_videos = [json.loads(l) for l in open(f"{base}/search_contents_{DATE}.jsonl")]
    all_comments = [json.loads(l) for l in open(f"{base}/search_comments_{DATE}.jsonl")]
    videos = [v for v in all_videos if v.get('source_keyword') == KW]
    id_map = {'dy':'aweme_id','xhs':'note_id','bili':'video_id','wb':'note_id','ks':'video_id','zhihu':'content_id'}
    id_f = id_map.get(P, 'id')
    content_ids = {str(v.get(id_f)) for v in videos}
    comments = [c for c in all_comments if str(c.get(id_f)) in content_ids]

def num(x):
    try: return int(x) if x else 0
    except: return 0

# 认知信号 pattern（与 § 6.2 保持一致）
patterns = {
    '亏损自嘲': r'(亏|套|割|销户|天台|血亏|韭菜|被套)',
    '布道用语': r'(护城河|安全边际|长期持有|复利|好公司)',
    '名人引用': r'(段永平|阿段|李录|芒格|穷查理|巴菲特)',
    '找捷径':   r'(诀窍|捷径|秘诀|快速|分钟看懂)',
}
played = sorted([num(v.get({'bili':'video_play_count','xhs':'liked_count','dy':'liked_count','wb':'attitudes_count','ks':'liked_count','zhihu':'voteup_count'}.get(P,'liked_count'),0)) for v in videos], reverse=True)

snapshot = {
    'keyword': KW,
    'platform': P,
    'date': DATE,
    'n_videos': len(videos),
    'n_comments': len(comments),
    'pattern_hits': {},
    'top10_hf_words': [],
    'cmt_median_like': played[len(played)//2] if played else 0,
    'on_topic_rate': None,
    'source': 'MediaCrawler crawl-content skill §6.3',
}

# pattern 命中率（百分比）
for label, pat in patterns.items():
    rx = re.compile(pat)
    hits = sum(1 for c in comments if rx.search(c.get('content','') or ''))
    snapshot['pattern_hits'][label] = round(hits / max(len(comments), 1) * 100, 1)

# 评论高频 2-4 字词
cmt_text = " ".join(c.get('content','') or '' for c in comments)
words = re.findall(r'[\u4e00-\u9fa5]{2,4}', cmt_text)
top10 = Counter(words).most_common(10)
snapshot['top10_hf_words'] = [{'word': w, 'count': n} for w, n in top10]

# 保存
snap_dir = Path.home() / "Documents" / "crawl-content" / ".snapshots"
snap_dir.mkdir(parents=True, exist_ok=True)
fname = f"{KW}-{P}-{DATE.replace('-','')}.json"
out = snap_dir / fname
out.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2))
print(f"💾 快照已存：{out}")
print(f"    pattern: {snapshot['pattern_hits']}")
print(f"    top words: {[t['word'] for t in snapshot['top10_hf_words'][:5]]}")
EOF
```

## 7. 跨平台对比（多任务专属，单任务跳过）

并行任务全部跑完后追加一次聚合分析，**这是并行模式的核心增值**：

```bash
cd "$MC_HOME" && python3 <<'EOF'
import json, re
from pathlib import Path

# ====== 参数 ======
DATE = "{今日 YYYY-MM-DD}"
# jobs[(平台代码, 本次关键词)]，按本次跑的任务填
jobs = [("bili","价值投资"), ("xhs","价值投资"), ("wb","宁德时代")]

DATA_DIR = {"bili":"bili","xhs":"xhs","dy":"douyin","wb":"weibo","ks":"kuaishou","zhihu":"zhihu","tieba":"tieba"}

# 字段映射（源码事实，已修正 dy）
fields = {
    'bili': {'play': 'video_play_count', 'fan': 'total_fans',     'id': 'video_id'},
    'xhs':  {'play': 'liked_count',      'fan': 'follows',        'id': 'note_id'},
    'dy':   {'play': 'liked_count',      'fan': 'follower_count', 'id': 'aweme_id'},  # ← 不是 digg_count
    'wb':   {'play': 'attitudes_count',  'fan': 'follows',        'id': 'note_id'},
    'ks':   {'play': 'liked_count',      'fan': 'follows',        'id': 'video_id'},
    'zhihu':{'play': 'voteup_count',     'fan': 'follower_count', 'id': 'content_id'},
}

def num(x):
    try: return int(x) if x else 0
    except: return 0

def load_filtered(p, kw, kind):
    """按 source_keyword 严格过滤后加载"""
    f = Path(f"data/{DATA_DIR[p]}/jsonl/search_{kind}_{DATE}.jsonl")
    if not f.exists(): return []
    rows = [json.loads(l) for l in open(f)]
    if rows and 'source_keyword' in rows[0]:
        return [r for r in rows if r.get('source_keyword') == kw]
    return rows  # 字段缺失时全量返回，调用方需自行处理

# ====== 矩阵：平台 × 维度 ======
print(f"\n{'平台':<6}{'内容':>6}{'评论':>6}{'创作者':>8}{'Top3占比':>10}{'百万KOL':>10}{'评论/内容':>12}")
print("-" * 60)
summary = {}
for p, kw in jobs:
    videos   = load_filtered(p, kw, 'contents')
    creators = load_filtered(p, kw, 'creators')
    # comments 按内容 id 过滤
    all_cmts = [json.loads(l) for l in open(f"data/{DATA_DIR[p]}/jsonl/search_comments_{DATE}.jsonl")] \
                if Path(f"data/{DATA_DIR[p]}/jsonl/search_comments_{DATE}.jsonl").exists() else []
    id_f = fields[p]['id']
    content_ids = {str(v.get(id_f)) for v in videos}
    comments = [c for c in all_cmts if str(c.get(id_f)) in content_ids]
    if not videos: continue
    pf = fields[p]['play']; ff = fields[p]['fan']
    plays = sorted([num(v.get(pf, 0)) for v in videos], reverse=True)
    total = sum(plays) or 1
    top3 = sum(plays[:3]) / total * 100
    million_kol = sum(1 for c in creators if num(c.get(ff, 0)) >= 1_000_000)
    cmt_per_content = len(comments) / max(len(videos), 1)
    summary[p] = {
        'videos': len(videos), 'comments': len(comments), 'creators': len(creators),
        'top3': top3, 'million': million_kol, 'cmt_ratio': cmt_per_content,
    }
    print(f"{p:<6}{len(videos):>6}{len(comments):>6}{len(creators):>8}{top3:>9.1f}%{million_kol:>10}{cmt_per_content:>12.1f}")

# ====== 情绪/认知信号矩阵 ======
patterns = {
    '亏损自嘲': r'(亏|套|割|销户|天台|血亏|韭菜|被套)',
    '布道用语': r'(护城河|安全边际|长期持有|复利)',
    '找捷径':   r'(诀窍|捷径|秘诀|快速|分钟看懂)',
    '名人引用': r'(段永平|阿段|李录|芒格|巴菲特)',
}
print(f"\n{'信号':<14}", end="")
for p, _ in jobs: print(f"{p:>8}", end="")
print()
print("-" * (14 + 8 * len(jobs)))
for label, pat in patterns.items():
    rx = re.compile(pat, re.I)
    print(f"{label:<14}", end="")
    for p, kw in jobs:
        all_cmts = [json.loads(l) for l in open(f"data/{DATA_DIR[p]}/jsonl/search_comments_{DATE}.jsonl")] \
                    if Path(f"data/{DATA_DIR[p]}/jsonl/search_comments_{DATE}.jsonl").exists() else []
        videos = load_filtered(p, kw, 'contents')
        id_f = fields[p]['id']; ids = {str(v.get(id_f)) for v in videos}
        cmts = [c for c in all_cmts if str(c.get(id_f)) in ids]
        if not cmts: print(f"{'—':>8}", end=""); continue
        hits = sum(1 for c in cmts if rx.search(c.get('content', '') or ''))
        print(f"{hits/len(cmts)*100:>7.1f}%", end="")
    print()

# ====== 各平台独有高频词（粗筛）======
print(f"\n=== 各平台独有信号（top 词，需肉眼判断）===")
from collections import Counter
word_sets = {}
for p, kw in jobs:
    all_cmts = [json.loads(l) for l in open(f"data/{DATA_DIR[p]}/jsonl/search_comments_{DATE}.jsonl")] \
                if Path(f"data/{DATA_DIR[p]}/jsonl/search_comments_{DATE}.jsonl").exists() else []
    videos = load_filtered(p, kw, 'contents')
    id_f = fields[p]['id']; ids = {str(v.get(id_f)) for v in videos}
    cmts = [c for c in all_cmts if str(c.get(id_f)) in ids]
    if not cmts: continue
    text = " ".join(c.get('content','') or '' for c in cmts)
    words = re.findall(r'[\u4e00-\u9fa5]{2,4}', text)
    word_sets[p] = Counter(words)
for p in word_sets:
    others = Counter()
    for q, c in word_sets.items():
        if q != p: others.update(c)
    unique = [(w, n) for w, n in word_sets[p].most_common(50) if others[w] < n / 3]
    print(f"  {p}: {', '.join(w for w, _ in unique[:8])}")
EOF
```

**对比维度**：
1. 内容量级 / 评论量 / 创作者数
2. **Top3 占比**：哪个平台最赢家通吃
3. **百万 KOL 浓度**：哪个平台头部创作者最密
4. **评论/内容比**：哪个平台用户最爱讨论
5. **认知信号矩阵**：同样的 patterns 在不同平台浓度差异
6. **独有信号**：哪个平台冒出别处罕见的词（粗筛，需肉眼判断）

输出给用户：**一张矩阵表 + 3 条跨平台冲击性结论**。

---

## 7.5 报告类型菜单：8 种 docx 输出规格

跑完数据后，用户要在 "下一步" 选择一种或多种报告类型（可多选，如 `A+B`）。每种类型的规格见下方。通用执行流程在 § 7.5.9。

### 7.5.1 类型 A · 4000 字深度研究报告（默认）

| 字段 | 值 |
|---|---|
| 触发条件 | 任意，无门槛 |
| 长度 | 4-6 页 / ~4000 字 |
| 数据来源 | § 6 单平台输出（单任务）或 § 7 跨平台矩阵 + 各平台洞见（多任务） |
| 结构 | 开篇结论 → 数据全景 → 头部内容拆解 → 评论认知信号 → 行业/公司启示 → 结语与风险提示 |
| 风格 | 叙事型，可读性优先，每段 3-5 行，高信息密度 |
| 文件命名 | 单任务：`{平台}-{关键词}-深度研究-{YYYYMMDD}.docx`；多任务：`多平台-{关键词}-深度研究-{YYYYMMDD}.docx` |

### 7.5.2 类型 B · 2 页公司舆情简报

| 字段 | 值 |
|---|---|
| 触发条件 | 单关键词，单/多平台均可 |
| 长度 | 2-3 页 / ≤800 字 |
| 数据来源 | § 6 输出（流量分布 + 认知信号 + Top5 评论 + 创作者梯队） |
| 结构 | ① 一句话结论（粗体 18pt）→ ② 4 个关键数据点（数字密集，列表）→ ③ 情绪雷达图（4 个 pattern 命中率横向比较）→ ④ 高赞评论 Top5 → ⑤ 3 条隐藏信号 → ⑥ 风险提示 |
| 风格 | 彭博 brief 风，每段 ≤3 行，结论先行。标题用「关键发现」「隐藏信号」「风险提示」等短标签 |
| 文件命名 | `{平台}-{关键词}-舆情简报-{YYYYMMDD}.docx` |

### 7.5.3 类型 C · 行业认知扫描报告

| 字段 | 值 |
|---|---|
| 触发条件 | **需 ≥2 个关键词组合**（如"价值投资 + 巴菲特 + 段永平"），单/多平台。不足时提示用户加词或换 B/A |
| 长度 | 4-6 页 / ~3000 字 |
| 数据来源 | 多组 § 6 输出（每关键词一次） |
| 结构 | ① 行业讨论热度概览（各关键词内容量级对比）→ ② 头部内容类型分布（教程/评测/观点/数据/news）→ ③ 创作者梯队（谁在发声，KOL 占比）→ ④ 用户认知分层（科普类 vs 专业类话语占比）→ ⑤ 大众认知偏差点（3~5 条"市场以为 X，实际 Y"）→ ⑥ 行研启示 |
| 风格 | 行研 brief 风，多表格。每节有摘要句 |
| 文件命名 | `{多平台/平台}-{主要关键词}-行业扫描-{YYYYMMDD}.docx` |

### 7.5.4 类型 D · 散户情绪温度计

| 字段 | 值 |
|---|---|
| 触发条件 | 单关键词，单/多平台均可。**强烈建议追踪 ≥2 期**，无历史快照时只出本期数据并标注"需后续跟踪" |
| 长度 | 3-4 页 / ~2000 字 |
| 数据来源 | § 6.3 快照全部历史（`$CRAWL_WORKDIR/.snapshots/{关键词}-*-*.json`） |
| 结构 | ① 本期情绪雷达（4 pattern 命中率竖条图）→ ② 历史对比表（本期 vs 上期/上月/历史最高最低）→ ③ 关键变化信号（标注 ≥30% 的突变方向）→ ④ 本期新增高频词 vs 历史高频词 → ⑤ 反向信号告警（负数极端值：如亏损自嘲 > 60%、布道率 < 5% 均值得关注）→ ⑥ 反向操作建议（免责：仅供研究参考，非投资建议） |
| 风格 | 金融 dashboard 风，数字优先。≥5% 变化用 ⬆️⬇️ 箭头标注 |
| 文件命名 | `{平台}-{关键词}-情绪温度计-{YYYYMMDD}.docx` |

### 7.5.5 类型 E · 创作素材包（选题卡 + 金句库）

| 字段 | 值 |
|---|---|
| 触发条件 | 任意，建议多平台抓取以获取更丰富素材 |
| 长度 | 10-20 页（卡片/列表形式，可变） |
| 数据来源 | § 6/§ 7（集中所有平台素材） |
| 结构 | 前半 → **选题灵感卡片**（8-12 张），每张卡独立：| 选题标题 | 数据佐证（如"评论 32 次提及"）| 角度建议（视频/图文/长文）| 参考爆款标题 | 风险提示 |

后半 → **金句素材库**（30-50 条），按 pattern 分组（亏损自嘲 / 布道 / 段子 / 名人引用 / 独有词），每条含原文、赞数、来源平台、用法建议 |
| 风格 | 素材库风，每张卡可独立剪用。docx 内用分割线或分页隔开，方便读者直接取用 |
| 文件命名 | `{平台}-{关键词}-创作素材-{YYYYMMDD}.docx`；多任务：`多平台-{关键词}-创作素材-{YYYYMMDD}.docx` |

### 7.5.6 类型 F · 传播学话语分析

| 字段 | 值 |
|---|---|
| 触发条件 | **多平台 ≥3 个 + 评论总量 ≥300**。不满足时**拒绝出**F，提示用户补抓后再试 |
| 长度 | 6-10 页 / ~5000 字 |
| 数据来源 | § 6（各平台分析结果） + § 7（跨平台对比） + 独有词分析 |
| 结构 | ① 摘要（100-150 字）→ ② 方法论说明（抓取平台、关键词、样本量、日期）→ ③ 平台话语场对比（各平台主流话语风格：理性/情绪/玩梗/种草）→ ④ 共现词网络分析（用列表代替伪网络图：每个词的 top5 搭配词）→ ⑤ 议题转移路径（跨平台共识议题 vs 独有议题）→ ⑥ 理论框架引用（拟态环境/过滤气泡/群体极化，写 1-2 段即可，不要堆术语）→ ⑦ 结论与局限 |
| 风格 | 偏学术论文但不堆术语。少口语、多分析。每个观点都需引用数据支撑 |
| 文件命名 | `多平台-{关键词}-话语分析-{YYYYMMDD}.docx` |
| 数据门槛检查 | 📐 如果 `总评论数 < 300`：直接告知用户"本次数据不足以支撑 F 类型，建议换选 B/A/E"。如果 `总平台数 < 3`：告知用户多任务模式下才有跨平台话语对比价值，建议先补抓其他平台 |

### 7.5.7 类型 G · 结构化数据底稿

| 字段 | 值 |
|---|---|
| 触发条件 | 任意 |
| 长度 | 纯表格，10+ 页 |
| 数据来源 | 原始 jsonl（§ 5） |
| 结构 | ① 字段对照表（原始 json 字段名 → 中文标签）→ ② 内容总表（每条一行：Title / Desc / Play(like) / Comment / Like / Author / URL / source_keyword / pattern_hit）→ ③ 评论总表（每条：Content / Like / Author / 命中 pattern）→ ④ 创作者总表 → ⑤ 主题相关性标记 → ⑥ 认知信号 pattern 命中明细（逐条标记）→ ⑦ 跨平台对比矩阵（多任务时） |
| 风格 | **零叙事、零结论、纯表格**。给 AI/分析师二次加工用。docx 用 docx skill 排版即可，不需封面 |
| 文件命名 | `{平台}-{关键词}-数据底稿-{YYYYMMDD}.docx`；多任务：`多平台-{关键词}-数据底稿-{YYYYMMDD}.docx` |

### 7.5.8 类型 H · 跨平台对比战报（多任务专属）

| 字段 | 值 |
|---|---|
| 触发条件 | **多任务，jobs ≥ 2**。单任务时此类型不在菜单中出现 |
| 长度 | 4-6 页 / ~2500 字 |
| 数据来源 | § 7 跨平台对比脚本输出 |
| 结构 | ① 一句话核心结论 → ② 对比矩阵（平台 × 维度表格，直接复制 § 7 输出）→ ③ 情绪信号矩阵 → ④ 各平台独有信号汇总 → ⑤ 3 条最具冲击力的跨平台发现 → ⑥ 战略启示：为什么这对决策者重要 |
| 风格 | 作战图风，强结论。每个平台给 1-2 句画像（"B 站：最理性的用户群体"） |
| 文件命名 | `多平台-{核心关键词}-对比战报-{YYYYMMDD}.docx` |

### 7.5.9 通用执行流程（所有类型共享）

用户选好类型后（单选或多选），执行以下流程。**无论选哪种/几种，步骤一致**：

```bash
cd "$MC_HOME"
TS=$(date +%Y%m%d_%H%M)
DATE=$(date +%Y%m%d)

# 用户选择了哪些类型（例：用户在§8菜单回 A+B）
SELECTED=("A" "B")

for TYPE in "${SELECTED[@]}"; do
  case $TYPE in
    A) TPL="深度研究"; CHARS=4000;  BLUEPRINT="7.5.1" ;;
    B) TPL="舆情简报"; CHARS=800;   BLUEPRINT="7.5.2" ;;
    C) TPL="行业扫描"; CHARS=3000;  BLUEPRINT="7.5.3" ;;
    D) TPL="情绪温度计"; CHARS=2000; BLUEPRINT="7.5.4" ;;
    E) TPL="创作素材"; CHARS=0;     BLUEPRINT="7.5.5" ;;  # CHARS=0 = 不限字数
    F) TPL="话语分析"; CHARS=5000;  BLUEPRINT="7.5.6" ;;
    G) TPL="数据底稿"; CHARS=0;     BLUEPRINT="7.5.7" ;;
    H) TPL="对比战报"; CHARS=2500;  BLUEPRINT="7.5.8" ;;
  esac

  echo "📄 正在生成：$TPL"

  # 1. 调用 /wechat-article 生成 markdown（按 BLUEPRINT 的规格约束）
  #    输入素材：§ 6/§ 7 的输出 + BLUEPRINT 的结构+长度+风格
  #    输出：/tmp/crawl-${TS}-${TPL}.md
  #    ⚠️ 关键：wechat-article 要收到 BLUEPRINT 的结构清单作为硬约束

  # 2. docx skill (Report 场景) 转 docx
  OUT="$CRAWL_WORKDIR/{平台}-{关键词}-${TPL}-${DATE}.docx"
  #    调用方式：传入 markdown 路径 + 场景 Report + 输出路径 $OUT

  echo "✅ $TPL → $OUT"
done

# 多选时，最终给用户列出所有产出的路径，不要遗漏
```

类型 C 的数据门槛检查（≥2 关键词 / 多平台≥3 + 评论≥300）在菜单阶段完成，**不要等到生成一半才报错**。

---

## 8. 任务收尾（必跑）

### 8.1 单任务时（向后兼容旧模板）

```markdown
## ✅ 抓取完成

**任务**：{平台} × "{关键词}"
**数据**：{N} 条内容 + {M} 条评论 + {K} 个创作者
**文件**：`data/{平台}/jsonl/search_*_{日期}.jsonl`

### 🔍 三个最值得说的发现
1. **{冲击性结论 1}** —— {一句话支撑数据}
2. **{冲击性结论 2}** —— {一句话支撑数据}
3. **{冲击性结论 3}** —— {一句话支撑数据}

### 下一步：选择报告类型（可多选，如 `A+B+G`）

- **A. 深度研究报告**（默认 · 叙事型 · 4-6 页）→ `{平台}-{关键词}-深度研究-{YYYYMMDD}.docx`
- **B. 舆情简报**（速读 · 2 页 · 1 分钟看完）→ `{平台}-{关键词}-舆情简报-{YYYYMMDD}.docx`
- **C. 行业认知扫描**（需 ≥2 关键词，已有则用，否则提示补抓）
- **D. 散户情绪温度计**（反向指标 · 需历史快照才完整）→ `{平台}-{关键词}-情绪温度计-{YYYYMMDD}.docx`
- **E. 创作素材包**（选题卡 + 金句库 · 自媒体用）→ `{平台}-{关键词}-创作素材-{YYYYMMDD}.docx`
- **F. 传播学话语分析**（学术风 · **本次单任务不可用**，需多平台 ≥3 + 评论 ≥300）
- **G. 结构化数据底稿**（纯表格 · 二次加工友好）→ `{平台}-{关键词}-数据底稿-{YYYYMMDD}.docx`

选哪个/几个？或者直接说"不要"跳过出稿。
```

### 8.2 多任务时（新模板）

```markdown
## ✅ 批量抓取完成（耗时 X 分 Y 秒）

| 平台 | 关键词 | 内容 | 评论 | 创作者 | 状态 |
|---|---|---:|---:|---:|---|
| bili | 价值投资 | 15 | 142 | 15 | ✅ |
| xhs | 价值投资 | 15 | 98 | 15 | ✅ |
| wb | 宁德时代 | 12 | 67 | 12 | ⚠️ 部分风控 |

### 🌐 跨平台 3 个最值得说的发现
1. **{对比性结论 1}** —— 例：B 站 Top3 占 67% vs xhs 占 41%，头部垄断显著
2. **{对比性结论 2}** —— 例：百万 KOL 浓度 wb > bili > xhs
3. **{对比性结论 3}** —— 例：「亏损自嘲」在 bili 占 18% 而 xhs 仅 3%，平台情绪基色完全不同

### 📊 跨平台矩阵
{贴 § 7 跑出来的表格}

### 🔍 各平台单独洞察
- **bili**：{从 § 6 输出里挑 1-2 条}
- **xhs**：{同上}
- **wb**：{同上}

### 📁 数据文件
- `data/bili/jsonl/search_*_{日期}.jsonl`
- `data/xhs/jsonl/search_*_{日期}.jsonl`
- `data/wb/jsonl/search_*_{日期}.jsonl`

### 下一步：选择报告类型（可多选，如 `A+B+F+H`）

- **A. 深度研究报告**（默认 · 每平台一份）→ `{平台}-{关键词}-深度研究-{YYYYMMDD}.docx`
- **B. 舆情简报**（速读 · 每平台一份）→ `{平台}-{关键词}-舆情简报-{YYYYMMDD}.docx`
- **C. 行业认知扫描**（自动用本次所有关键词组合）→ `{多平台/平台}-{主要关键词}-行业扫描-{YYYYMMDD}.docx`
- **D. 散户情绪温度计**（反向指标 · 每平台一份）
- **E. 创作素材包**（合并所有平台素材，**只出一份**）→ `多平台-{关键词}-创作素材-{YYYYMMDD}.docx`
- **F. 传播学话语分析**（⭐⭐⭐⭐⭐ 多任务首选）→ `多平台-{关键词}-话语分析-{YYYYMMDD}.docx`
- **G. 结构化数据底稿**（含跨平台矩阵）→ `多平台-{关键词}-数据底稿-{YYYYMMDD}.docx`
- **H. 跨平台对比战报**（⭐⭐⭐⭐⭐ 多任务专属）→ `多平台-{关键问}-对比战报-{YYYYMMDD}.docx`

选哪个/几个？或者直接说"不要"跳过出稿。
```

### 8.3 进程清理（必跑 · 防内存泄漏）

⚠️ **背景**：MediaCrawler 跑完会留下 Chromium 子进程，加上 ZCode 本身的 Bash worker / MCP 调用残留，单次多平台抓取后系统内存可能涨 5-15GB。**必须每次跑完清理**，否则连跑 2-3 次就会撑爆内存。

跑完数据 + 出稿后，**无条件执行这段**（不需要用户确认）：

```bash
echo "=== 进程清理 ==="

# 1. 杀 MediaCrawler 残留的 Chromium / Python 子进程（属于本会话刚跑的）
pkill -9 -f "main\.py.*--platform" 2>/dev/null
pkill -9 -f "uv run main\.py" 2>/dev/null
# ⚠️ 注意：只杀 main.py 相关，不要杀所有 chromium（用户可能开着浏览器）

# 2. 杀 playwright-mcp 僵尸（ZCode 调 MCP 工具时累积的 npx 进程）
PW_COUNT=$(pgrep -f "playwright-mcp|npm exec @playwright/mcp" 2>/dev/null | wc -l | tr -d ' ')
if [ "$PW_COUNT" -gt 0 ]; then
  pkill -9 -f "playwright-mcp" 2>/dev/null
  pkill -9 -f "npm exec @playwright/mcp" 2>/dev/null
  echo "✅ 清理 $PW_COUNT 个 playwright-mcp 僵尸"
else
  echo "✓ playwright-mcp 无残留"
fi

# 3. 杀 zcode-cli 孤儿（PPID=1 的 = 上次会话遗留的 worker，不影响当前活跃会话）
ORPHAN_COUNT=0
for pid in $(ps -eo pid,ppid,comm | awk '$2==1 && $3=="zcode-cli" {print $1}'); do
  kill -9 $pid 2>/dev/null && ORPHAN_COUNT=$((ORPHAN_COUNT+1))
done
if [ "$ORPHAN_COUNT" -gt 0 ]; then
  echo "✅ 清理 $ORPHAN_COUNT 个 zcode-cli 孤儿进程"
else
  echo "✓ zcode-cli 无孤儿"
fi

# 4. 汇报内存变化
sleep 1
TOTAL=$(ps aux | grep -i "ZCode" | grep -v grep | awk '{sum+=$6} END {printf "%.2f", sum/1024/1024}')
echo ""
echo "📊 ZCode 当前总内存: ${TOTAL} GB"
echo "（清理前参考值：47GB 是严重泄漏 / 正常活跃会话约 2-4GB）"
```

**安全说明**（让用户放心）：
- 第 1 步只杀匹配 `main.py` 的 Python/Chromium，**不会杀用户自己开着的浏览器**
- 第 2 步杀 playwright-mcp（MCP 工具的子进程），**不影响当前正在使用的浏览器自动化**
- 第 3 步只杀 PPID=1 的 zcode-cli 孤儿（上次会话遗留的），**当前活跃会话的 worker 保留不动**

**用户可选的长期方案**（不在 skill 内强制）：
- 已有 `~/bin/zcode-mem-clean.sh` 一键清理脚本 + launchd 每小时自动跑
- 但 skill 内置的这段是"每次抓完立刻清"，比定时更及时

---

## 9. 常见坑（直接告诉用户而不是默默处理）

| 现象 | 原因 | 处理 |
|---|---|---|
| 二维码弹了但日志无进展 | 用户没扫 / 没确认登录 | 主动提醒倒计时 |
| 滑块验证（xhs/zhihu 高发） | 平台风控 | 告诉用户**手动拖**，脚本会等 |
| 贴吧报错 / 死循环 | MediaCrawler 选择器失效 | 不要重试，告知用户已知问题 |
| cookie 过期 | 距上次登录 > 7-30 天 | 重扫码即可，无需重新搭环境 |
| 抓到 0 条 | 关键词太冷门 / 触发风控 | 暂停建议明天再试 / 换词 |
| 互动率前后不一致 | 多种口径混用 | 全文统一一个口径，加脚注说明 |
| **并行时某平台 hang 死** | 该平台单独风控 / 网络抖动 | `kill $PID_X` 单独干掉，其他继续，跨平台对比时标注该平台缺失 |
| **多个二维码同时弹** | 没走 § 4.0 cookie 探测、误把 batch_fresh 并行起了 | 立刻 kill 全部，重跑 § 4.0 → § 4.2 |
| **跨平台时间戳错位** | 没用统一 `$TS` | 一次会话只取一次时间戳，所有 job 共用 |
| **多任务后 § 7 报字段不存在** | 字段映射没改对应平台 | 查 § 6.1 字段速查表，每平台改一次 |
| **抖音验收报"0 条数据"** | 用 `data/dy/` 拼路径，实际目录是 `data/douyin/` | 必须走 § 2.4 的 DATA_DIR 映射表 |
| **jsonl 文件行数远超本次抓取** | append 累积，多次抓取/不同关键词留在同一文件 | 必须按 `source_keyword == 本次KW` 严格过滤（§ 5 警告框 / § 6 模板） |
| **dy 字段全 0、Top3 占比 0%** | 用 `digg_count / collect_count` 旧字段名 | 改 `liked_count / collected_count`（源码事实，§ 6.1） |
| **`--crawler_max_notes_count 15` 实抓 20** | 是平台单页下限不是上限 | § 3 已注明；规划合规配额按上限估算 |
| **选 D 但没有历史快照** | 首次跟踪某关键词，`.snapshots/` 为空 | 出本期数据，标注"需后续跟踪才有趋势对比" |
| **选 F 但评论数 < 300** | 学术分析样本量不够 | 拒绝出 F，告知用户"本次数据不足以支撑，建议换 B/A/E" |
| **选 C 但只有 1 个关键词** | 行业扫描需要 ≥2 关键词组合 | 提示用户加关键词，或换选 B/A |
| **连跑 2-3 次后系统弹"内存不足"** | MediaCrawler Chromium + ZCode worker / playwright-mcp 子进程累积泄漏 | 每次跑完必跑 § 8.3 进程清理；已有定时任务每小时自动清 |

---

## 10. 红线与合规

- **仅抓公开数据**，不抓私密对话
- **单次单平台 ≤ 50 条**，并发**不放大单平台配额**：跑 3 个平台并行抓 15 条 ≠ 单平台抓 45 条
- **数据仅用于研究分析**，不商用、不公开二次分发原始 jsonl
- **引用评论时**：标赞数，但用户 ID 必须匿名化
- 同主题第二次深抓需间隔 24h；多任务并发跑过的平台同样适用
- 「全网扫」是默认 4 平台同时各抓 15 条，仍在合规范围内；用户如果说"全网各抓 50 条"，提醒"单平台 50 是上限，但同日不建议全平台都打满"
- **`--crawler_max_notes_count` 是下限不是上限**：实际抓取数可能多 30-50%。规划合规配额时按上限估算（传 30 实抓可能 40），仍守"单平台单次 ≤ 50"红线

---

## 11. 修订说明

- 此 skill 依赖 MediaCrawler 仓库本地存在于 `$MC_HOME`（默认 `~/MediaCrawler-main`，可经环境变量覆盖，见 § 0.1）。
- 如换机器使用，先按章节 0 完整搭环境。
- 完整背景手册：上游 MediaCrawler 仓库的 README（`https://github.com/NanmiCoder/MediaCrawler`）。

### 版本历史

- **2026-07-03（第五轮）** ── 新增 § 8.3 进程清理：每次抓完 + 出稿后无条件执行，杀掉 MediaCrawler Chromium 残留 + playwright-mcp 僵尸 + zcode-cli 孤儿。单次多平台抓取后内存从 47GB 降到 2GB。§ 9 坑表追加"连跑后内存不足"一行。
- **2026-07-02（第四轮）** ── 输出能力大扩展：从"单一 4000 字研究报告"扩成 8 种 docx 类型菜单（A 深度研究 / B 舆情简报 / C 行业扫描 / D 情绪温度计 / E 创作素材 / F 话语分析 / G 数据底稿 / H 跨平台对比战报），用户可多选。新增 § 6.3 情绪快照自动持久化（`$CRAWL_WORKDIR/.snapshots/`）作为 D 类报告的历史数据基础，也供其他类型取用。§ 8 "下一步" 菜单同步升级为 A-H 列表。
- **2026-06-28（第三轮）** ── 输出环节本地化：成稿默认导出 `$CRAWL_WORKDIR/{主题}-{YYYYMMDD}.docx`（直接放工作目录根、不建 reports/ 子目录、文件名去掉「公众号-」前缀）。流程：/wechat-article 出 ~4000 字 markdown 正文（沿用其模板，内容 100% 不变）→ docx skill（Report 场景）转 docx。/wechat-article 接力保留但用户可见文案统一去"公众号"。
- **2026-06-28（第二轮）** ── 基于「复盘-crawl-content流程-上海纽约大学-20260628.md」的 7 个坑全部修复：
  1. § 2.1 / § 2.4 新增 DATA_DIR 平台代码 → 数据目录映射（修复 dy→douyin、wb→weibo、ks→kuaishou 路径错位）
  2. § 5 头部加 jsonl append 累积警告 + 验收脚本附"本次 source_keyword 过滤后行数"
  3. § 6 重写：分析模板内置 source_keyword 严格过滤（含日志 ID fallback）+ 主题相关性二次校验（CORE_TERMS）
  4. § 6.1 字段速查表修正 dy：`digg_count → liked_count`、`collect_count → collected_count`；标注 dy 无独立播放量字段、内容侧 `liked_count` vs 评论侧 `like_count` 的命名差
  5. § 6.0 加"跑分析前先 head 一条实测字段"硬规则
  6. § 7 跨平台脚本同步：`fields['dy']['play'] = 'liked_count'`、全部走 DATA_DIR、全部按 source_keyword 过滤
  7. § 3 `--crawler_max_notes_count` 备注改为"下限值"；§ 10 红线追加配额按上限估算
  8. § 4.3 监控完成态附条数（让"跑得快"vs"跑得少"一眼可辨）
  9. § 9 坑表追加 4 行新坑（dy 路径错位、append 污染、dy 字段全 0、max_notes 不严格）
- **2026-06-28（第一轮）** ── 升级：支持多平台并行（自然语言指令解析、≤3 并发、cookie 智能调度、跨平台对比矩阵）。废弃 Edit `config/base_config.py` 改用 CLI 参数化（并发安全）。单任务老用法 100% 向后兼容。
- **2026-06-27** ── 初版，单平台单任务流程。
