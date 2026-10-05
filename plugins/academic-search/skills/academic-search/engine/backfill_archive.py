#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""回溯灌库：用 OpenAlex 对所有主题按季度分窗检索历史文献。
- 复用 literature_pipeline 的函数
- 年份下限从 config.YEAR_START 读取（不再硬编码 2024）
- 断点续传：记录已完成窗口
用法: python backfill_archive.py [--apply] [--from 2024]
"""
import json
import os
import sys
import time
from datetime import datetime
from calendar import monthrange

# 让脚本无论从哪运行都能找到 engine 内的同级模块
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import config
from config import WORKSPACE, DB_PATH
import literature_pipeline as L
import sqlite3


def _sync_topics():
    """重新读取 topics.yaml 并同步到 literature_pipeline 命名空间。"""
    config.load_topics()
    L.TOPICS = config.TOPICS
    L.EXCLUDE_TITLE_KEYWORDS = config.EXCLUDE_TITLE_KEYWORDS
    L.EXCLUDE_JOURNAL_KEYWORDS = config.EXCLUDE_JOURNAL_KEYWORDS
    L.YEAR_START = config.YEAR_START
    L.YEAR_END = config.YEAR_END

PROGRESS_PATH = os.path.join(os.path.dirname(str(DB_PATH)), "backfill_archive_progress.json")


def quarter_windows(start_year, end_date):
    """生成 start_year-Q1 ~ end_date 所在季度的季度窗口列表。"""
    windows = []
    end_y, end_m = int(end_date[:4]), int(end_date[5:7])
    end_q = (end_m - 1) // 3 + 1
    for y in range(start_year, end_y + 1):
        last_q = 4 if y < end_y else end_q
        for q in range(1, last_q + 1):
            m_start = (q - 1) * 3 + 1
            m_end = m_start + 2
            if q == 4:
                d_to = f"{y}-12-31"
            else:
                d_to = f"{y}-{m_end:02d}-{monthrange(y, m_end)[1]:02d}"
            d_from = f"{y}-{m_start:02d}-01"
            windows.append((d_from, d_to, f"{y}Q{q}"))
    return windows


def mark_filtered_range(db_path, topic_key, allow_preprint, year_min):
    """本地版 mark_filtered：year >= year_min 即通过年份过滤。"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("""SELECT rowid, doi, title, year, journal, url FROM papers
                      WHERE is_qualified = 0 AND filter_reason = 'pending' AND topic LIKE ?""",
                   (f"%{topic_key}%",))
    rows = cursor.fetchall()
    qualified = 0
    dropped = {'year': 0, 'preprint': 0, 'whitelist': 0, 'off_topic': 0}

    def mark(rowid, qflag, reason, journal=None):
        if journal:
            cursor.execute("UPDATE papers SET is_qualified=?, filter_reason=?, journal=? WHERE rowid=?",
                           (qflag, reason, journal, rowid))
        else:
            cursor.execute("UPDATE papers SET is_qualified=?, filter_reason=? WHERE rowid=?",
                           (qflag, reason, rowid))

    for rowid, doi, title, year, journal, url in rows:
        paper = {'doi': doi or '', 'year': year, 'journal': journal or '', 'url': url or '', 'title': title or ''}
        if year is None or year < year_min:
            mark(rowid, 0, 'old_year')
            dropped['year'] += 1
            continue
        if not allow_preprint and L.is_preprint(paper):
            mark(rowid, 0, 'preprint')
            dropped['preprint'] += 1
            continue
        if L.is_off_topic(paper):
            mark(rowid, 0, 'off_topic')
            dropped['off_topic'] += 1
            continue
        if not L.is_whitelist_journal(topic_key, journal):
            if doi and str(doi).startswith('10.'):
                oa_j = L.openalex_get_journal(doi)
                if oa_j and L.is_whitelist_journal(topic_key, oa_j):
                    mark(rowid, 1, 'qualified', oa_j)
                    qualified += 1
                    continue
            mark(rowid, 0, 'not_whitelist')
            dropped['whitelist'] += 1
            continue
        mark(rowid, 1, 'qualified')
        qualified += 1

    conn.commit()
    conn.close()
    print(f"  [MARK] {topic_key}: qualified={qualified}, dropped={dropped}")
    return qualified, dropped


def load_progress():
    if os.path.exists(PROGRESS_PATH):
        with open(PROGRESS_PATH, 'r', encoding='utf-8') as f:
            return set(json.load(f).get('done_windows', []))
    return set()


def save_progress(done):
    with open(PROGRESS_PATH, 'w', encoding='utf-8') as f:
        json.dump({'done_windows': list(done), 'ts': datetime.now().isoformat()}, f)


def main():
    _sync_topics()
    apply = '--apply' in sys.argv
    start_year = config.YEAR_START
    if '--from' in sys.argv:
        start_year = int(sys.argv[sys.argv.index('--from') + 1])
    today = datetime.now().strftime('%Y-%m-%d')
    windows = quarter_windows(start_year, today)
    print(f"[PLAN] {len(windows)} 季度窗口 × {len(L.TOPICS)} 主题 = {len(windows)*len(L.TOPICS)} 次检索")
    print(f"       范围: {windows[0][2]} ~ {windows[-1][2]}")

    done = load_progress()
    todo = [(w, t) for w in windows for t in L.TOPICS if f"{w[2]}_{t['key']}" not in done]
    print(f"[TODO] {len(todo)} 待检索 ({len(done)} 已完成)")

    if not apply:
        print("[DRY-RUN] 预览模式，加 --apply 实际灌库。")
        return

    total_new = 0
    for i, ((d_from, d_to, label), topic) in enumerate(todo, 1):
        key = topic['key']
        window_key = f"{label}_{key}"
        print(f"\n[{i}/{len(todo)}] {label} {topic['display']} ({key}) {d_from}~{d_to}")

        papers = L.openalex_search(topic['query'], d_from, d_to, per_page=200)
        print(f"  [OA] {len(papers)} hits")
        if not papers:
            done.add(window_key)
            save_progress(done)
            continue

        for p in papers:
            p['topic'] = key

        new_papers = L.deduplicate_only(papers, str(DB_PATH))
        print(f"  [DEDUP] {len(new_papers)} new after dedup")

        if new_papers:
            inserted = L.insert_papers(new_papers, str(DB_PATH))
            print(f"  [INSERT] {inserted} archived")
            total_new += inserted

        done.add(window_key)
        if i % 3 == 0:
            save_progress(done)
        time.sleep(0.3)

    save_progress(done)

    print("\n[MARK] 标记过滤...")
    for topic in L.TOPICS:
        mark_filtered_range(str(DB_PATH), topic['key'], topic.get('allow_preprint', False), year_min=start_year)

    print("\n[ENRICH] 补全摘要...")
    L.enrich_qualified(str(DB_PATH))

    c = sqlite3.connect(str(DB_PATH)).cursor()
    c.execute("SELECT COUNT(*) FROM papers")
    total = c.fetchone()[0]
    c.execute("SELECT year, COUNT(*) FROM papers GROUP BY year ORDER BY year")
    by_year = c.fetchall()
    c.execute("SELECT filter_reason, COUNT(*) FROM papers GROUP BY filter_reason")
    by_reason = c.fetchall()
    print(f"\n{'='*60}")
    print(f"[DONE] 本次新增 {total_new} 篇 | 库总计 {total} 篇")
    print(f"  按年: {by_year}")
    print(f"  按状态: {by_reason}")


if __name__ == '__main__':
    main()
