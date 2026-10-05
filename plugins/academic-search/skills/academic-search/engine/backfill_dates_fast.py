#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""高效批量回填 publication_date。
对有DOI的论文用 OpenAlex DOI 单篇查询（0.3s/篇），无DOI的用 S2 标题查。
断点续传：每50篇commit+save progress。
用法: python backfill_dates_fast.py [--apply] [--limit N]
"""
import sqlite3
import os
import sys
import json
import time
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import WORKSPACE, DB_PATH
import literature_pipeline as L

PROGRESS_PATH = os.path.join(os.path.dirname(str(DB_PATH)), "backfill_fast_progress.json")


def load_progress():
    if os.path.exists(PROGRESS_PATH):
        with open(PROGRESS_PATH, 'r', encoding='utf-8') as f:
            return set(json.load(f).get('done', []))
    return set()


def save_progress(done):
    with open(PROGRESS_PATH, 'w', encoding='utf-8') as f:
        json.dump({'done': list(done), 'ts': datetime.now().isoformat()}, f)


def main():
    apply = '--apply' in sys.argv
    limit = None
    if '--limit' in sys.argv:
        limit = int(sys.argv[sys.argv.index('--limit') + 1])

    conn = sqlite3.connect(str(DB_PATH))
    c = conn.cursor()
    c.execute("SELECT rowid, doi, title FROM papers WHERE publication_date IS NULL OR publication_date='' ORDER BY rowid")
    rows = c.fetchall()
    print(f"[SCAN] {len(rows)} rows need publication_date")

    done = load_progress()
    todo = [r for r in rows if str(r[0]) not in done]
    if limit:
        todo = todo[:limit]
    print(f"[TODO] {len(todo)} to process ({len(rows)-len(todo)} done)")

    fixed = 0
    failed = 0
    for i, (rowid, doi, title) in enumerate(todo, 1):
        try:
            pub_date = None
            real_doi = L.normalize_doi(doi) if doi else None
            if real_doi and real_doi.startswith('10.'):
                oa = L.openalex_lookup(real_doi)
                time.sleep(0.3)
                if oa.get('publication_date'):
                    pub_date = oa['publication_date']
                if oa.get('abstract') and len(oa['abstract']) > 30:
                    c.execute("UPDATE papers SET abstract=? WHERE rowid=? AND (abstract IS NULL OR length(abstract)<50)",
                              (oa['abstract'], rowid))
                if real_doi != doi:
                    c.execute("UPDATE papers SET doi=? WHERE rowid=?", (real_doi, rowid))

            if not pub_date and title and not real_doi:
                s2 = L.s2_lookup_by_title(title)
                time.sleep(0.6)
                if s2:
                    if s2.get('publication_date'):
                        pub_date = s2['publication_date']
                    elif s2.get('year'):
                        pub_date = f"{s2['year']}-01-01"
                    if s2.get('doi') and not real_doi:
                        c.execute("SELECT 1 FROM papers WHERE doi=? AND rowid!=?", (s2['doi'], rowid))
                        if not c.fetchone():
                            c.execute("UPDATE papers SET doi=? WHERE rowid=?", (s2['doi'], rowid))
                    if s2.get('abstract') and len(s2['abstract']) > 30:
                        c.execute("UPDATE papers SET abstract=? WHERE rowid=? AND (abstract IS NULL OR length(abstract)<50)",
                                  (s2['abstract'], rowid))

            if pub_date:
                c.execute("UPDATE papers SET publication_date=? WHERE rowid=?", (pub_date, rowid))
                fixed += 1
            else:
                failed += 1

            done.add(str(rowid))
            if apply:
                if i % 20 == 0:
                    conn.commit()
                    save_progress(done)
                    print(f"  ...{i}/{len(todo)} fixed={fixed} failed={failed}", flush=True)
        except Exception as e:
            print(f"[ERR] rowid={rowid}: {e}")
            failed += 1
            done.add(str(rowid))

    if apply:
        conn.commit()
        save_progress(done)
    conn.close()

    print(f"\n[DONE] processed={len(todo)} fixed={fixed} failed={failed}")
    if not apply:
        print("[DRY-RUN] 加 --apply 实际写入。")

    c2 = sqlite3.connect(str(DB_PATH)).cursor()
    c2.execute("SELECT COUNT(*) FROM papers WHERE publication_date IS NOT NULL AND publication_date!=''")
    print(f"[STAT] 有日期: {c2.fetchone()[0]}")
    c2.execute("SELECT COUNT(*) FROM papers WHERE publication_date IS NULL OR publication_date=''")
    print(f"[STAT] 无日期: {c2.fetchone()[0]}")


if __name__ == '__main__':
    main()
