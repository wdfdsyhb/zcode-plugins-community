#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
文献周报报告生成器 · 可移植版
============================
从 literature.db 直读 is_qualified=1 的论文，生成 HTML + Markdown 双格式报告。
支持 --auto-summary 自动调用 LLM（OpenAI 兼容接口）生成中文概述。

用法:
  python generate_report.py --date 2026-07-20
  python generate_report.py --date 2026-07-20 --since 2026-07-13 --md
  python generate_report.py --date 2026-07-20 --auto-summary --md
  python generate_report.py --date 2026-07-20 --topics epoxy_toughening,rag_kg
"""
import argparse
import html as html_module
import json
import os
import sqlite3
import sys
import time
import urllib.parse
from datetime import datetime
from pathlib import Path

# 让脚本无论从哪运行都能找到 engine 内的同级模块
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import config
from config import (
    WORKSPACE, DB_PATH, OUTPUT_DIR, TEMPLATE_DIR,
    LLM_BASE_URL, LLM_API_KEY, LLM_MODEL,
    LLM_PAPER_PROMPT, LLM_TOPIC_PROMPT,
)

# 主题展示配置：从 config.TOPICS 派生（运行时由 _sync_topics 刷新）
TOPICS = []
TOPIC_MAP = {}


def _sync_topics():
    """重新读取 topics.yaml 并派生主题展示配置。用户编辑后无需重启即可生效。"""
    global TOPICS, TOPIC_MAP
    config.load_topics()
    TOPICS = [(t['key'], t['display'], t['theme_color'], t['query']) for t in config.TOPICS]
    TOPIC_MAP = {t[0]: t for t in TOPICS}


_sync_topics()

# 摘要缓存路径（项目内）
SUMMARIES_CACHE = OUTPUT_DIR / "_paper_summaries.json"
TOPIC_OVERVIEWS_CACHE = OUTPUT_DIR / "_topic_overviews.json"

# 注入式概述（运行时加载）
SUMMARIES = {}
TOPIC_OVERVIEWS = {}


# ============ HTML 模板加载 ============

def load_template_assets():
    """从 templates/ 目录加载 CSS 和 JS，不再硬编码旧路径。"""
    css_path = TEMPLATE_DIR / "report_style.css"
    js_path = TEMPLATE_DIR / "report_script.js"

    css = ""
    js = ""
    if css_path.exists():
        css = css_path.read_text(encoding='utf-8')
    else:
        print(f"[WARN] CSS template not found: {css_path}, using inline fallback")
    if js_path.exists():
        js = js_path.read_text(encoding='utf-8')
    else:
        print(f"[WARN] JS template not found: {js_path}")
    return css, js


TEMPLATE_CSS, TEMPLATE_JS = None, None  # 懒加载


# ============ LLM 中文摘要 ============

def get_llm_client():
    """获取 OpenAI 兼容客户端。未配置返回 None。"""
    if not LLM_BASE_URL or not LLM_API_KEY or not LLM_MODEL:
        return None
    try:
        from openai import OpenAI
        client = OpenAI(base_url=LLM_BASE_URL, api_key=LLM_API_KEY)
        return client
    except ImportError:
        print("[WARN] openai 包未安装，LLM 摘要不可用。pip install openai>=1.0.0")
        return None
    except Exception as e:
        print(f"[WARN] LLM 客户端初始化失败: {e}")
        return None


def llm_chat(client, prompt, max_retries=2):
    """调用 LLM 对话，返回文本。失败返回 None。"""
    for attempt in range(max_retries + 1):
        try:
            resp = client.chat.completions.create(
                model=LLM_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=500,
            )
            return resp.choices[0].message.content.strip()
        except Exception as e:
            if attempt < max_retries:
                time.sleep(2 ** attempt)
                continue
            print(f"[LLM-ERR] {e}")
            return None
    return None


def load_cache(path):
    if path.exists():
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def save_cache(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def auto_generate_summaries(topic_papers, force=False):
    """为缺失中文概述的论文自动调用 LLM 生成。
    返回更新后的 SUMMARIES dict 和 TOPIC_OVERVIEWS dict。"""
    global SUMMARIES, TOPIC_OVERVIEWS

    # 加载已有缓存
    SUMMARIES = load_cache(SUMMARIES_CACHE) if not SUMMARIES else SUMMARIES
    TOPIC_OVERVIEWS = load_cache(TOPIC_OVERVIEWS_CACHE) if not TOPIC_OVERVIEWS else TOPIC_OVERVIEWS

    client = get_llm_client()
    if not client:
        print("[AUTO-SUMMARY] LLM 未配置，跳过自动摘要。仅生成英文报告。")
        print("  提示：在 .env 中配置 LLM_BASE_URL / LLM_API_KEY / LLM_MODEL 以启用中文摘要")
        return SUMMARIES, TOPIC_OVERVIEWS

    print(f"[AUTO-SUMMARY] 使用模型: {LLM_MODEL} @ {LLM_BASE_URL}")

    # 逐篇生成缺失的论文摘要
    total_papers = 0
    missing = 0
    for key, papers in topic_papers.items():
        for p in papers:
            total_papers += 1
            doi = p.get('doi') or ''
            if not doi:
                continue
            if doi in SUMMARIES and not force:
                continue
            abstract = p.get('abstract') or ''
            if not abstract or len(abstract) < 30:
                continue
            missing += 1
            title = p.get('title', '')
            journal = p.get('journal', '')
            prompt = LLM_PAPER_PROMPT.format(title=title, abstract=abstract, journal=journal)
            summary = llm_chat(client, prompt)
            if summary:
                SUMMARIES[doi] = summary
                if missing % 5 == 0:
                    print(f"  ...进度: {missing} 篇已生成", flush=True)
            else:
                print(f"  [WARN] 摘要生成失败: {title[:50]}...")
            time.sleep(0.5)  # 保守间隔

    if missing > 0:
        save_cache(SUMMARIES_CACHE, SUMMARIES)
        print(f"[AUTO-SUMMARY] 完成: 新生成 {missing} 篇概述，缓存已保存")

    # 主题级综述（仅当缓存中不存在时生成）
    need_overview = [k for k in topic_papers if k not in TOPIC_OVERVIEWS and topic_papers[k]]
    for key in need_overview:
        papers = topic_papers[key]
        display = TOPIC_MAP.get(key, (None, key))[1]
        # 构造论文列表文本
        lines = []
        for p in papers[:15]:  # 最多取 15 篇避免 prompt 过长
            doi = p.get('doi') or ''
            summ = SUMMARIES.get(doi, '(无概述)')
            lines.append(f"- {p.get('title', '')} | {p.get('journal', '')}\n  概述：{summ}")
        papers_text = '\n'.join(lines)
        prompt = LLM_TOPIC_PROMPT.format(display=display, papers_text=papers_text)
        overview = llm_chat(client, prompt)
        if overview:
            TOPIC_OVERVIEWS[key] = overview
            print(f"  [AUTO-SUMMARY] 生成 {display} 主题综述")
        time.sleep(0.5)

    if need_overview:
        save_cache(TOPIC_OVERVIEWS_CACHE, TOPIC_OVERVIEWS)

    return SUMMARIES, TOPIC_OVERVIEWS


# ============ HTML / MD 生成 ============

def escape_html(text):
    if not text:
        return ''
    return html_module.escape(str(text))


def generate_topic_summary(display, papers, time_range, topic_key):
    journals = {}
    for p in papers:
        j = p.get('journal') or 'Unknown'
        if j and j != 'Unknown':
            journals[j] = journals.get(j, 0) + 1
    top_journals = sorted(journals.items(), key=lambda x: x[1], reverse=True)[:5]
    journal_lines = '<br>'.join([f'- {j}（{c}篇）' for j, c in top_journals]) or '- 暂无期刊信息'

    if topic_key in TOPIC_OVERVIEWS:
        overview = TOPIC_OVERVIEWS[topic_key]
    else:
        overview = f"本周期共检索到 {len(papers)} 篇文献，涵盖多个研究方向。详见各文献概述。"

    return (f"本周期内（{time_range}）<strong>{display}</strong>领域共检索到 <strong>{len(papers)}</strong> 篇文献。<br><br>"
            f"<strong>本期综述：</strong><br>{overview}<br><br>"
            f"<strong>主要来源期刊：</strong><br>{journal_lines}")


def generate_paper_card(paper, idx, topic_key):
    pid = f"{topic_key}_{idx}"
    title = escape_html(paper.get('title', 'N/A'))
    authors = escape_html(paper.get('authors')) or 'N/A'
    journal = escape_html(paper.get('journal')) or 'N/A'
    pub_date = escape_html(paper.get('publication_date') or str(paper.get('year', ''))) or 'N/A'
    doi = paper.get('doi', '')
    abstract = paper.get('abstract', '')
    citations = paper.get('citations', 0) or 0

    doi_tag = ''
    if doi:
        doi_tag = f'<span class="meta-tag doi"><a href="https://doi.org/{doi}" target="_blank">📄 DOI</a></span>'
    cite_tag = f'<span class="meta-tag">引用 {citations}</span>' if citations else ''

    summary_text = SUMMARIES.get(doi, '') if doi else ''
    if summary_text:
        overview_section = f'<div class="highlights-section"><div class="highlights-title">📝 概述</div><div class="overview-text">{escape_html(summary_text)}</div></div>'
    else:
        overview_section = '<div class="highlights-section"><div class="highlights-title">📝 概述</div><div class="overview-text" style="color:#999">概述待补</div></div>'

    if abstract and len(abstract) > 30 and '...' not in abstract:
        abstract_section = f'<div class="abstract-section"><div class="abstract-title">Abstract 原文</div><div class="abstract-en">{escape_html(abstract)}</div></div>'
    else:
        abstract_section = f'<div class="abstract-missing"><div class="reason">⚠️ 摘要尚未完整收录</div><a href="https://scholar.google.com/scholar?q={urllib.parse.quote(title)}" target="_blank" class="fetch-btn">🔍 Google Scholar 搜索</a></div>'

    card = (f'<div class="paper-card" id="{pid}" data-topic="{topic_key}">\n'
            f'  <div class="select-box"><label class="select-label" for="cb-{pid}">标记下载</label>'
            f'<input type="checkbox" id="cb-{pid}" onchange="toggleSelect(\'{pid}\')"></div>\n'
            f'  <div class="paper-title">{title}</div>\n'
            f'  <div class="paper-meta"><span class="meta-tag journal">{journal}</span>'
            f'<span class="meta-tag date">{pub_date}</span>{doi_tag}{cite_tag}</div>\n'
            f'  <div class="paper-authors">👤 {authors}</div>\n'
            f'  {overview_section}\n  {abstract_section}\n</div>')
    return card


def load_papers_from_db(topic_keys, since=None, until=None):
    """从 DB 读取 is_qualified=1 的论文，按 topic 分组。"""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    result = {}
    for key in topic_keys:
        params = [f"%{key}%"]
        where = "WHERE topic LIKE ? AND is_qualified = 1"
        if since:
            where += " AND first_seen >= ?"
            params.append(since)
        if until:
            where += " AND first_seen <= ?"
            params.append(until)
        c.execute(f"SELECT * FROM papers {where} ORDER BY publication_date DESC, year DESC LIMIT 30", params)
        result[key] = [dict(r) for r in c.fetchall()]
    conn.close()
    return result


def build_html(topic_papers, report_date, time_range, prev_date=None, next_date=None):
    """组装完整 HTML 文档。"""
    global TEMPLATE_CSS, TEMPLATE_JS
    if TEMPLATE_CSS is None:
        TEMPLATE_CSS, TEMPLATE_JS = load_template_assets()

    tab_buttons = []
    topic_contents = []
    total = 0
    first_idx = None
    for idx, (key, display, color, _) in enumerate(TOPICS):
        papers = topic_papers.get(key, [])
        if not papers:
            continue
        if first_idx is None:
            first_idx = idx
        total += len(papers)
        active = 'active' if idx == first_idx else ''
        cnt = len(papers)
        tab_buttons.append(
            f'<div class="topic-tab {active}" data-topic="{key}" '
            f'style="border-color: {color}; color: {color};" '
            f'onclick="switchTopic(\'{key}\', this, \'{color}\')">'
            f'{display} <span style="opacity:0.6;font-weight:500">({cnt})</span></div>'
        )
        cards = '\n'.join([generate_paper_card(p, i, key) for i, p in enumerate(papers)])
        summary = generate_topic_summary(display, papers, time_range, key)
        active_content = 'active' if idx == first_idx else ''
        topic_contents.append(
            f'<div class="topic-content {active_content}" id="topic-{key}">\n'
            f'<div class="topic-summary" style="border-left-color: {color};">{summary}</div>\n'
            f'<div class="papers-grid" id="grid-{key}">\n{cards}\n</div></div>'
        )

    nav_links = '<div class="nav-links">'
    nav_links += '<a href="index.html">📂 返回索引</a>'
    if prev_date:
        nav_links += f'<a href="lit-weekly-{prev_date}.html">← 上一期 ({prev_date})</a>'
    if next_date:
        nav_links += f'<a href="lit-weekly-{next_date}.html">下一期 ({next_date}) -></a>'
    nav_links += '</div>'

    now_str = datetime.now().strftime('%Y-%m-%d %H:%M')
    topic_contents_joined = '\n'.join(topic_contents)

    # 内联 CSS/JS 兜底
    style_block = f'<style>\n{TEMPLATE_CSS}\n</style>' if TEMPLATE_CSS else ''
    script_block = f'<script>\n{TEMPLATE_JS}\n</script>' if TEMPLATE_JS else ''

    html = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>文献周报 - {time_range}</title>
{style_block}
<style>
.nav-links {{ margin-bottom: 20px; display: flex; gap: 16px; flex-wrap: wrap; }}
.nav-links a {{ padding: 8px 16px; background: white; border-radius: 10px; text-decoration: none; color: #2d5a87; font-size: 0.88em; font-weight: 600; box-shadow: var(--shadow); border: 1px solid var(--border); }}
.nav-links a:hover {{ background: #eff6ff; border-color: #2d5a87; }}
</style>
</head>
<body>
<div class="container">
{nav_links}
<div class="header">
  <h1>📚 文献周报</h1>
  <div class="subtitle">{time_range}</div>
  <div class="stats">
    <div class="stat-item"><div class="stat-num">{total}</div><div class="stat-label">总文献数</div></div>
    <div class="stat-item"><div class="stat-num" id="selected-total">0</div><div class="stat-label">已标记</div></div>
    <div class="stat-item"><div class="stat-num">{len(topic_contents)}</div><div class="stat-label">主题领域</div></div>
  </div>
</div>
<div class="topic-tabs">{''.join(tab_buttons)}</div>
<div class="filter-bar">
  <button class="filter-btn active" onclick="setFilter('all', this)">全部</button>
  <button class="filter-btn" onclick="setFilter('selected', this)">☑ 已标记</button>
  <button class="filter-btn" onclick="setFilter('unselected', this)">☐ 未标记</button>
  <input type="text" class="search-box" placeholder="🔍 搜索标题 / 作者 / 期刊..." oninput="searchPapers(this.value)">
</div>
{topic_contents_joined}
<div class="footer" style="text-align:center;color:var(--text-secondary);font-size:0.85em;margin-top:30px;padding:20px;background:white;border-radius:12px;">
  文献周报 · {report_date} · 生成时间 {now_str}<br>数据来源：OpenAlex、Semantic Scholar、Crossref · 由文献周报管线生成
</div>
</div>
<div class="bottom-bar">
  <div class="selected-count">已标记 <span class="num" id="selected-count">0</span> 篇</div>
  <div class="actions">
    <button class="btn btn-secondary" onclick="clearAll()">🗑️ 清空标记</button>
    <button class="btn btn-primary" onclick="exportSelected()">📋 导出DOI</button>
  </div>
</div>
{script_block}
</body>
</html>'''
    return html


def build_md(topic_papers, report_date, time_range):
    """生成 Markdown 版本。"""
    lines = [f"# 文献周报 · {time_range}\n",
             f"> 生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M')}  ",
             f"> 数据来源：OpenAlex、Semantic Scholar、Crossref\n",
             "---\n"]
    total = sum(len(v) for v in topic_papers.values())
    lines.append(f"本期共收录 **{total}** 篇文献，覆盖 {sum(1 for v in topic_papers.values() if v)} 个主题。\n")

    for key, display, color, _ in TOPICS:
        papers = topic_papers.get(key, [])
        if not papers:
            continue
        lines.append(f"\n## {display}\n")
        if key in TOPIC_OVERVIEWS:
            lines.append(f"**本期综述**：{TOPIC_OVERVIEWS[key]}\n")
        for i, p in enumerate(papers, 1):
            lines.append(f"### {i}. {p.get('title', 'N/A')}\n")
            lines.append(f"- **作者**：{p.get('authors') or 'N/A'}")
            lines.append(f"- **日期**：{p.get('publication_date') or p.get('year') or 'N/A'}")
            lines.append(f"- **期刊**：{p.get('journal') or 'N/A'}")
            doi = p.get('doi') or ''
            if doi:
                lines.append(f"- **DOI**：[{doi}](https://doi.org/{doi})")
            lines.append(f"- **引用**：{p.get('citations', 0) or 0}")
            summary_text = SUMMARIES.get(doi, '') if doi else ''
            if summary_text:
                lines.append(f"- **概述**：{summary_text}")
            abstract = p.get('abstract') or ''
            if abstract and len(abstract) > 30:
                lines.append(f"- **Abstract**：{abstract}")
            lines.append("")
    lines.append(f"\n---\n*文献周报 · {report_date} · 仅供学术交流使用*\n")
    return ''.join(lines)


def main():
    global SUMMARIES, TOPIC_OVERVIEWS
    ap = argparse.ArgumentParser(description='生成文献周报 HTML/MD（从 DB 直读）')
    ap.add_argument('--date', default=datetime.now().strftime('%Y-%m-%d'), help='报告日期 YYYY-MM-DD（默认今天）')
    ap.add_argument('--since', help='增量起始日 YYYY-MM-DD（按 first_seen 过滤）')
    ap.add_argument('--until', help='增量结束日 YYYY-MM-DD（按 first_seen 过滤）')
    ap.add_argument('--output', default=str(OUTPUT_DIR), help='输出目录')
    ap.add_argument('--topics', help='逗号分隔的主题子集（默认全部）')
    ap.add_argument('--md', action='store_true', help='同时输出 Markdown')
    ap.add_argument('--prev', help='上一期日期（导航链接）')
    ap.add_argument('--next', help='下一期日期（导航链接）')
    ap.add_argument('--summaries', help='概述 JSON 路径（手动注入）')
    ap.add_argument('--overview', help='主题综述 JSON 路径（手动注入）')
    ap.add_argument('--auto-summary', action='store_true', help='自动调用 LLM 生成中文概述')
    ap.add_argument('--force-summary', action='store_true', help='强制重新生成所有摘要（忽略缓存）')
    args = ap.parse_args()

    # 加载外部注入的摘要
    if args.summaries and os.path.exists(args.summaries):
        with open(args.summaries, 'r', encoding='utf-8') as f:
            SUMMARIES = json.load(f)
        print(f"[SUMMARY] 加载 {len(SUMMARIES)} 篇概述（文件注入）")
    if args.overview and os.path.exists(args.overview):
        with open(args.overview, 'r', encoding='utf-8') as f:
            TOPIC_OVERVIEWS = json.load(f)
        print(f"[OVERVIEW] 加载 {len(TOPIC_OVERVIEWS)} 个主题综述（文件注入）")

    topic_keys = [t[0] for t in TOPICS]
    if args.topics:
        topic_keys = [k.strip() for k in args.topics.split(',') if k.strip() in TOPIC_MAP]

    topic_papers = load_papers_from_db(topic_keys, args.since, args.until)
    counts = {k: len(v) for k, v in topic_papers.items()}
    total = sum(counts.values())
    print(f"[LOAD] 论文数: {counts} | 总计 {total}")

    if total == 0:
        print("[WARN] 无符合条件的论文，不生成报告。提示：")
        print("  1. 先运行 python literature_pipeline.py --init 初始化 DB")
        print("  2. 再运行 python incremental_search.py --apply 检索新文献")
        print("  3. 检查 since/until 参数或 is_qualified 标记")
        return

    if args.since and args.until:
        time_range = f"{args.since} ~ {args.until}"
    elif args.since:
        time_range = f"{args.since} ~ {args.date}"
    else:
        time_range = f"截至 {args.date}（全量）"

    # LLM 自动摘要
    if args.auto_summary:
        auto_generate_summaries(topic_papers, force=args.force_summary)

    # 生成 HTML
    html_doc = build_html(topic_papers, args.date, time_range, args.prev, args.next)
    os.makedirs(args.output, exist_ok=True)
    html_path = os.path.join(args.output, f"lit-weekly-{args.date}.html")
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html_doc)
    print(f"[HTML] {html_path}")

    if args.md:
        md_doc = build_md(topic_papers, args.date, time_range)
        md_path = os.path.join(args.output, f"lit-weekly-{args.date}.md")
        with open(md_path, 'w', encoding='utf-8') as f:
            f.write(md_doc)
        print(f"[MD] {md_path}")


if __name__ == '__main__':
    main()
