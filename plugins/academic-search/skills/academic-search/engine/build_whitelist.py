#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
academic-search · 期刊白名单自动生成器
========================================
调用 OpenAlex 检索某主题近 N 年论文，统计期刊出现频次（按被引加权），
生成 references/journals-<topic>-if<threshold>.md 白名单文件。

生成的 md 格式与 load_whitelist() 解析逻辑完全兼容：
  | 期刊名称 | 简称 | 参考IF |
  |---------|------|--------|
  | Nature | Nature | - |

用法:
  python build_whitelist.py --topic solid_state_battery
  python build_whitelist.py --topic solid_state_battery --if 5.0 --years 3 --top 40

说明：
  - 本脚本不判断真实 IF（需 JCR 数据），而是按"该主题下的出现频次+被引"
    排序取 Top N 期刊作为候选白名单。IF 阈值仅用于文件名标记。
  - 生成后用户可手动增删行；白名单是 Markdown 表格，编辑即可。
"""
import argparse
import os
import sys
from collections import Counter, defaultdict
from datetime import datetime

# 让脚本无论从哪运行都能找到 engine 内的同级模块
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import literature_pipeline as L
from config import TOPICS, REFERENCES_DIR, YEAR_START, YEAR_END, load_topics


def generate_whitelist(topic_key, if_threshold=3.0, years_back=3, top_n=40):
    """为指定主题生成期刊白名单 md 文件。

    参数:
        topic_key     : topics.yaml 中的主题 key
        if_threshold  : IF 阈值（仅用于文件名标记，如 if3plus）
        years_back    : 回溯年数（从当前年到 N 年前）
        top_n         : 取频次最高的前 N 个期刊

    返回生成的文件路径（Path），失败返回 None。
    """
    # 找到主题配置
    load_topics()
    topic = None
    for t in TOPICS:
        if t["key"] == topic_key:
            topic = t
            break
    if not topic:
        print(f"[ERR] 主题 '{topic_key}' 未在 topics.yaml 中找到")
        print(f"      已配置主题: {[t['key'] for t in TOPICS]}")
        return None

    query = topic["query"]
    display = topic.get("display", topic_key)

    # 时间窗口：近 years_back 年
    now = datetime.now()
    date_to = now.strftime("%Y-%m-%d")
    date_from = f"{now.year - years_back}-01-01"

    print(f"[GEN] 为主题 '{display}' ({topic_key}) 生成白名单")
    print(f"      query: {query}")
    print(f"      窗口: {date_from} ~ {date_to}（近 {years_back} 年）")

    # 分段检索（OpenAlex 单次上限 200，按年分段提高召回）
    all_papers = []
    for y in range(now.year - years_back, now.year + 1):
        papers = L.openalex_search(query, f"{y}-01-01", f"{y}-12-31", per_page=200)
        all_papers.extend(papers)
        L.time.sleep(0.3)  # 限流
    print(f"      检索到 {len(all_papers)} 篇论文")

    if not all_papers:
        print("[WARN] 未检索到论文，无法生成白名单。请检查 query 或扩大时间窗口。")
        return None

    # 统计期刊频次 + 累计被引（用被引加权，突出重要期刊）
    journal_count = Counter()
    journal_citations = defaultdict(int)
    for p in all_papers:
        j = (p.get("journal") or "").strip()
        if not j:
            continue
        journal_count[j] += 1
        journal_citations[j] += p.get("citations", 0)

    # 按频次为主、被引为辅排序
    ranked = sorted(
        journal_count.keys(),
        key=lambda j: (journal_count[j], journal_citations[j]),
        reverse=True
    )[:top_n]

    print(f"      统计到 {len(journal_count)} 个期刊，取 Top {len(ranked)}")

    # 生成 md
    if_tag = f"if{int(if_threshold)}plus" if if_threshold == int(if_threshold) else f"if{if_threshold}"
    filename = f"journals-{topic_key}-{if_tag}.md"
    filepath = REFERENCES_DIR / filename
    REFERENCES_DIR.mkdir(parents=True, exist_ok=True)

    lines = [
        f"# {display} - 期刊白名单（自动生成）",
        "",
        f"> 主题: {topic_key}",
        f"> 生成方式: OpenAlex 近 {years_back} 年论文期刊频次 Top {len(ranked)}",
        f"> 生成时间: {now.strftime('%Y-%m-%d %H:%M')}",
        f"> IF 标记: ≥{if_threshold}（仅文件名标记，实际按频次/被引排序，请人工核对 IF）",
        f"> 编辑本文件可增删期刊行，格式保持三列表格即可被引擎识别。",
        "",
        "| 期刊名称 | 出现频次 | 累计被引 |",
        "|---------|---------|---------|",
    ]
    for j in ranked:
        # 转义管道符，避免破坏表格
        j_safe = j.replace("|", "\\|")
        lines.append(f"| {j_safe} | {journal_count[j]} | {journal_citations[j]} |")

    filepath.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"[OK] 白名单已生成: {filepath}")
    print(f"     共 {len(ranked)} 个期刊")
    print(f"     可手动编辑增删，或重跑本脚本覆盖刷新。")
    return filepath


def main():
    ap = argparse.ArgumentParser(description="自动生成某主题的期刊白名单 md")
    ap.add_argument("--topic", required=True, help="topics.yaml 中的主题 key")
    ap.add_argument("--if", type=float, default=3.0, dest="if_threshold", help="IF 阈值（仅文件名标记，默认 3.0）")
    ap.add_argument("--years", type=int, default=3, help="回溯年数（默认 3）")
    ap.add_argument("--top", type=int, default=40, help="取频次最高的前 N 期刊（默认 40）")
    args = ap.parse_args()

    generate_whitelist(
        topic_key=args.topic,
        if_threshold=args.if_threshold,
        years_back=args.years,
        top_n=args.top,
    )


if __name__ == "__main__":
    main()
