#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""增量检索：从上次运行日期到今天，用 OpenAlex 检索所有主题新文献。
与 backfill_archive.py 互补：本脚本只跑最新增量窗口。
用法: python incremental_search.py [--apply] [--from YYYY-MM-DD]
"""
import os
import sys
import time
import sqlite3
from datetime import datetime

# 让脚本无论从哪运行都能找到 engine 内的同级模块
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 从集中配置加载
import config
from config import WORKSPACE, DB_PATH
import literature_pipeline as L


def _sync_topics():
    """重新读取 topics.yaml 并同步到 literature_pipeline 命名空间。
    用户编辑 topics.yaml 后无需重启即可生效。"""
    config.load_topics()
    L.TOPICS = config.TOPICS
    L.EXCLUDE_TITLE_KEYWORDS = config.EXCLUDE_TITLE_KEYWORDS
    L.EXCLUDE_JOURNAL_KEYWORDS = config.EXCLUDE_JOURNAL_KEYWORDS
    L.YEAR_START = config.YEAR_START
    L.YEAR_END = config.YEAR_END


def main():
    _sync_topics()
    apply = '--apply' in sys.argv
    # 检索窗口
    if '--from' in sys.argv:
        idx = sys.argv.index('--from')
        date_from = sys.argv[idx + 1]
    else:
        date_from = L.get_last_run_date()
    today = datetime.now().strftime('%Y-%m-%d')
    print(f"[STATE] date_from={date_from}  today={today}")
    print(f"[MODE] {'APPLY' if apply else 'DRY-RUN'}")

    # 确认数据库存在
    if not os.path.exists(str(DB_PATH)):
        print(f"[ERR] Database not found: {DB_PATH}")
        print("  首次运行请执行: python literature_pipeline.py --init")
        sys.exit(1)

    total_new = 0
    for topic in L.TOPICS:
        print(f"\n[TOPIC] {topic['display']} ({topic['key']})")
        papers = L.openalex_search(topic['query'], date_from, today, per_page=100)
        print(f"  [OA] {len(papers)} hits")
        if not papers:
            continue
        for p in papers:
            p['topic'] = topic['key']

        new_papers = L.deduplicate_only(papers, str(DB_PATH))
        print(f"  [DEDUP] {len(new_papers)} new")

        if apply and new_papers:
            inserted = L.insert_papers(new_papers, str(DB_PATH))
            L.log_search(str(DB_PATH), topic['key'], topic['query'], len(papers), len(new_papers))
            print(f"  [INSERT] {inserted} archived")
            total_new += inserted
        time.sleep(0.3)

    if apply:
        # 标记过滤
        print("\n[MARK] 标记过滤...")
        for topic in L.TOPICS:
            L.mark_filtered(str(DB_PATH), topic['key'], topic.get('allow_preprint', False))
        # 摘要补全
        print("\n[ENRICH] 补全摘要...")
        L.enrich_qualified(str(DB_PATH))

    # 统计
    c = sqlite3.connect(str(DB_PATH)).cursor()
    c.execute("SELECT COUNT(*) FROM papers")
    total = c.fetchone()[0]
    c.execute("SELECT is_qualified, COUNT(*) FROM papers GROUP BY is_qualified")
    print(f"\n[STAT] 总计{total}篇 | qualified分布: {c.fetchall()}")
    c.execute("SELECT substr(publication_date,1,7) as m, COUNT(*) FROM papers "
              "WHERE is_qualified=1 AND publication_date!='' GROUP BY m ORDER BY m DESC LIMIT 8")
    print(f"[STAT] qualified按月: {c.fetchall()}")
    print(f"\n[DONE] 本次新增 {total_new} 篇")
    if apply:
        print(f"下一步: python generate_report.py --date {today} --auto-summary --md")


if __name__ == '__main__':
    main()
