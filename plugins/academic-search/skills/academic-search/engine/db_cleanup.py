#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""DB 清理：修复 NULL-doi / 伪DOI 行 + 回填 publication_date + 去重 + 重新标记。
默认 dry-run，--apply 才写入。
用法: python db_cleanup.py [--apply] [--no-recover]
"""
import sqlite3
import os
import sys
import shutil
import re
import time
from datetime import datetime

# 让脚本无论从哪运行都能找到 engine 内的同级模块
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import config
from config import WORKSPACE, DB_PATH
import literature_pipeline as L


def _sync_topics():
    """重新读取 topics.yaml 并同步到 literature_pipeline 命名空间。"""
    config.load_topics()
    L.TOPICS = config.TOPICS
    L.EXCLUDE_TITLE_KEYWORDS = config.EXCLUDE_TITLE_KEYWORDS
    L.EXCLUDE_JOURNAL_KEYWORDS = config.EXCLUDE_JOURNAL_KEYWORDS


def normalize_title(t):
    """标题归一化：小写 + 去标点 + 折叠空格，用于去重匹配。"""
    if not t:
        return ""
    t = t.lower()
    t = re.sub(r'[^\w\s]', '', t)
    return re.sub(r'\s+', ' ', t).strip()


def normalize_doi(doi):
    """规范化 DOI，返回 (normalized_doi_or_None, needs_recover_bool)。"""
    if not doi:
        return None, True
    doi = str(doi).strip()
    if re.match(r'^10\.\d{4,9}/', doi):
        return doi.lower(), False
    if doi.lower().startswith('arxiv:'):
        return doi, False
    if doi.startswith('http'):
        m = re.search(r'10\.\d{4,9}/[^\s"&?#]+', doi)
        if m:
            return m.group(0).lower(), False
        return None, True
    if ':' in doi:
        m = re.search(r'10\.\d{4,9}/[^\s"&?#]+', doi)
        if m:
            return m.group(0).lower(), False
        return None, True
    return None, True


def recover_by_title(title):
    """用 S2 标题查询尝试恢复 DOI + publication_date + abstract。"""
    s2 = L.s2_lookup_by_title(title)
    time.sleep(0.5)
    if not s2:
        return {}
    out = {}
    if s2.get('doi'):
        out['doi'] = s2['doi']
    if s2.get('publication_date') or s2.get('year'):
        out['publication_date'] = s2.get('publication_date')
    if s2.get('abstract'):
        out['abstract'] = s2['abstract']
    if s2.get('journal'):
        out['journal'] = s2['journal']
    return out


def main():
    _sync_topics()
    apply = '--apply' in sys.argv
    no_recover = '--no-recover' in sys.argv
    conn = sqlite3.connect(str(DB_PATH))
    c = conn.cursor()

    if apply:
        bak = str(DB_PATH) + f".bak.{datetime.now().strftime('%Y%m%d%H%M%S')}"
        shutil.copy2(str(DB_PATH), bak)
        print(f"[BACKUP] {bak}")

    c.execute("SELECT rowid, doi, title, year, journal, url FROM papers")
    all_rows = c.fetchall()
    print(f"[SCAN] {len(all_rows)} total rows")

    doi_updates = []
    recover_targets = []
    for rowid, doi, title, year, journal, url in all_rows:
        new_doi, needs_recover = normalize_doi(doi)
        old_val = doi or None
        changed = (new_doi != old_val) or (needs_recover and old_val is not None)
        if changed:
            if new_doi:
                doi_updates.append((rowid, new_doi))
            else:
                doi_updates.append((rowid, None))
                recover_targets.append((rowid, title))

    print(f"[NORM] {len(doi_updates)} DOI 规范化更新; {len(recover_targets)} 需 S2 恢复")

    if apply and doi_updates:
        for rowid, new_doi in doi_updates:
            c.execute("UPDATE papers SET doi=? WHERE rowid=?", (new_doi, rowid))
        conn.commit()

    c.execute("SELECT rowid, title, first_seen FROM papers ORDER BY first_seen ASC")
    dedup_rows = c.fetchall()
    seen_titles = {}
    dup_rowids = []
    for rowid, title, first_seen in dedup_rows:
        nt = normalize_title(title)
        if not nt:
            continue
        if nt in seen_titles:
            dup_rowids.append(rowid)
        else:
            seen_titles[nt] = rowid
    print(f"[DEDUP] {len(dup_rowids)} duplicate rows to remove (by normalized title)")

    recover_rowids = {r[0] for r in recover_targets}
    dup_rowids = [r for r in dup_rowids if r not in recover_rowids]

    recovered = 0
    unrecoverable = 0
    recover_updates = []
    if no_recover:
        print(f"[RECOVER] skipped (--no-recover); {len(recover_targets)} rows remain NULL-doi")
    else:
        for rowid, title in recover_targets:
            if rowid in dup_rowids:
                continue
            rec = recover_by_title(title)
            if rec.get('doi'):
                c.execute("SELECT 1 FROM papers WHERE doi=? AND rowid!=?", (rec['doi'], rowid))
                if c.fetchone():
                    dup_rowids.append(rowid)
                    continue
                recover_updates.append((rowid, rec.get('doi'), rec.get('publication_date'),
                                        rec.get('abstract'), rec.get('journal')))
                recovered += 1
            else:
                unrecoverable += 1
            if (recovered + unrecoverable) % 10 == 0:
                print(f"  ...recover progress: {recovered+unrecoverable}/{len(recover_targets)}")
        print(f"[RECOVER] doi_found={recovered}, unrecoverable={unrecoverable}, dup_to_delete={len(dup_rowids)}")

    if not apply:
        print("\n[DRY-RUN] 以上为预览。加 --apply 实际执行。")
        conn.close()
        return

    for rowid, doi, pub_date, abstract, journal in recover_updates:
        c.execute("UPDATE papers SET doi=? WHERE rowid=?", (doi, rowid))
        if pub_date:
            c.execute("UPDATE papers SET publication_date=? WHERE rowid=?", (pub_date, rowid))
            c.execute("UPDATE papers SET year=? WHERE year IS NULL AND rowid=?",
                      (int(str(pub_date)[:4]) if len(str(pub_date)) >= 4 else None, rowid))
        if abstract:
            c.execute("UPDATE papers SET abstract=? WHERE (abstract IS NULL OR length(abstract)<50) AND rowid=?",
                      (abstract, rowid))
        if journal:
            c.execute("UPDATE papers SET journal=? WHERE (journal IS NULL OR journal='') AND rowid=?",
                      (journal, rowid))
    for rowid in dup_rowids:
        c.execute("DELETE FROM papers WHERE rowid=?", (rowid,))
    conn.commit()
    conn.close()

    for topic in L.TOPICS:
        L.mark_filtered(str(DB_PATH), topic['key'], topic.get('allow_preprint', False))

    c = sqlite3.connect(str(DB_PATH)).cursor()
    c.execute("SELECT COUNT(*) FROM papers")
    print(f"[AFTER] total={c.fetchone()[0]}")
    c.execute("SELECT filter_reason, COUNT(*) FROM papers GROUP BY filter_reason")
    print("  filter_reason:", c.fetchall())
    c.execute("SELECT COUNT(*) FROM papers WHERE doi IS NULL OR doi=''")
    print("  null_doi:", c.fetchone()[0])
    c.execute("SELECT COUNT(*) FROM papers WHERE publication_date IS NULL OR publication_date=''")
    print("  null_pubdate:", c.fetchone()[0])


if __name__ == '__main__':
    main()
