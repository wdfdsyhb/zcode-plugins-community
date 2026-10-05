#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""批量补摘要：先用OpenAlex批量DOI查（50个/次，不限频），OA没有的再走S2（1次/秒）。
用法: python backfill_abstracts_oa.py [--apply]
"""
import sqlite3
import os
import sys
import time
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import WORKSPACE, DB_PATH, OA_MAILTO, OA_API_KEY, S2_API_KEY
import literature_pipeline as L
import requests


def batch_oa_abstracts(dois):
    """OpenAlex批量DOI查询摘要，返回 {doi_lower: abstract}。一次最多50个。"""
    if not dois:
        return {}
    doi_filter = "|".join(dois)
    params = {
        "filter": f"doi:{doi_filter}",
        "per-page": len(dois),
        "select": "doi,abstract_inverted_index",
    }
    if OA_MAILTO:
        params["mailto"] = OA_MAILTO
    headers = {"User-Agent": f"literature_pipeline/2.0 (mailto:{OA_MAILTO})"}
    if OA_API_KEY:
        headers["Authorization"] = f"Bearer {OA_API_KEY}"
    resp = L._request_with_retry("GET", "https://api.openalex.org/works",
                                 params=params, headers=headers, timeout=30)
    if not resp or resp.status_code != 200:
        print(f"  [WARN] OA batch {resp.status_code if resp else 'ERR'}")
        return {}
    results = resp.json().get("results", [])
    out = {}
    for w in results:
        doi_raw = w.get("doi") or ""
        doi = doi_raw.replace("https://doi.org/", "").replace("http://doi.org/", "").strip().lower()
        abstract = L.restore_abstract(w.get("abstract_inverted_index"))
        if doi and abstract and len(abstract) > 30:
            out[doi] = abstract
    return out


def main():
    apply = '--apply' in sys.argv
    conn = sqlite3.connect(str(DB_PATH))
    c = conn.cursor()
    c.execute("""SELECT rowid, doi, title FROM papers
                 WHERE is_qualified=1 AND (abstract IS NULL OR length(abstract)<50)
                 AND doi IS NOT NULL AND doi LIKE '10.%' ORDER BY rowid""")
    rows = c.fetchall()
    print(f"[SCAN] {len(rows)} papers need abstracts (have DOI)")

    if not apply:
        print("[DRY-RUN] 加 --apply 实际写入。")
        return

    BATCH = 50
    oa_fixed = 0
    s2_fixed = 0
    failed = 0
    s2_candidates = []

    for batch_start in range(0, len(rows), BATCH):
        batch = rows[batch_start:batch_start+BATCH]
        dois = [r[1].lower() for r in batch]
        rowid_map = {r[1].lower(): r[0] for r in batch}

        result = batch_oa_abstracts(dois)
        time.sleep(0.3)

        for doi_lower, abstract in result.items():
            rowid = rowid_map.get(doi_lower)
            if rowid:
                c.execute("UPDATE papers SET abstract=? WHERE rowid=?", (abstract, rowid))
                oa_fixed += 1

        hit_dois = set(result.keys())
        for r in batch:
            if r[1].lower() not in hit_dois:
                s2_candidates.append(r)

        if (batch_start // BATCH) % 4 == 0:
            conn.commit()
            print(f"  OA: {batch_start+len(batch)}/{len(rows)} fixed={oa_fixed} remaining_for_s2={len(s2_candidates)}", flush=True)

    conn.commit()
    print(f"\n[OA] fixed={oa_fixed}, S2候选={len(s2_candidates)}")

    print(f"[S2] 补 {len(s2_candidates)} 篇OA未命中的...")
    s2_delay = L.S2_RATE_LIMIT_DELAY if hasattr(L, 'S2_RATE_LIMIT_DELAY') else 1.1
    for i, (rowid, doi, title) in enumerate(s2_candidates, 1):
        abstract = None
        real_doi = L.normalize_doi(doi)
        if real_doi and real_doi.startswith('10.'):
            s2 = L.s2_lookup_by_doi(real_doi)
            time.sleep(s2_delay)
            if s2 and s2.get('abstract') and len(s2['abstract']) > 30:
                abstract = s2['abstract']
        if not abstract and title:
            s2t = L.s2_lookup_by_title(title)
            time.sleep(s2_delay)
            if s2t and s2t.get('abstract') and len(s2t['abstract']) > 30:
                abstract = s2t['abstract']
        if abstract:
            c.execute("UPDATE papers SET abstract=? WHERE rowid=?", (abstract, rowid))
            s2_fixed += 1
        else:
            failed += 1
        if i % 20 == 0:
            conn.commit()
            print(f"  S2: {i}/{len(s2_candidates)} fixed={s2_fixed} failed={failed}", flush=True)

    conn.commit()
    conn.close()

    c2 = sqlite3.connect(str(DB_PATH)).cursor()
    c2.execute("SELECT COUNT(*) FROM papers WHERE is_qualified=1 AND (abstract IS NULL OR length(abstract)<50)")
    print(f"\n[DONE] OA fixed={oa_fixed} S2 fixed={s2_fixed} failed={failed} | 仍缺摘要: {c2.fetchone()[0]}")


if __name__ == '__main__':
    main()
