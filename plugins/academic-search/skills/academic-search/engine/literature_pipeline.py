#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
文献周报主管线 v5 · 可移植版
============================
OpenAlex 主检索 + Semantic Scholar 摘要补全 + SQLite 归档 + 白名单过滤 + 增量报告。

相比 v4 改动：
- 所有配置从 config.py 读取，零硬编码路径/邮箱/key
- 移除了 Kimi Desktop scholar_tool.py 私有依赖（OpenAlex 为主检索源）
- 年份过滤参数化（从 config.YEAR_START/YEAR_END 读取）
- 白名单映射从 TOPICS 配置读取（whitelist_file 字段）

用法：
  python literature_pipeline.py [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--init]
"""
import csv
import json
import sqlite3
import os
import re
import sys
import time
from datetime import datetime, timedelta
from urllib.parse import quote

import requests

# 从集中配置加载
from config import (
    WORKSPACE, DB_PATH, REFERENCES_DIR,
    OA_MAILTO, OPENALEX_API_KEY as OA_API_KEY, S2_API_KEY,
    TOPICS, EXCLUDE_TITLE_KEYWORDS, EXCLUDE_JOURNAL_KEYWORDS,
    YEAR_START, YEAR_END, NUM_RESULTS_PER_TOPIC as NUM_RESULTS, SORT_BY,
    REQUEST_TIMEOUT, REQUEST_MAX_RETRIES, S2_RATE_LIMIT_DELAY, OA_RATE_LIMIT_DELAY,
)


# ============ HTTP 请求（带指数退避重试）============

def _request_with_retry(method, url, max_retries=None, **kwargs):
    """带指数退避的请求，处理 429/503。返回 Response 或 None。"""
    if max_retries is None:
        max_retries = REQUEST_MAX_RETRIES
    for attempt in range(max_retries):
        try:
            resp = requests.request(
                method, url,
                timeout=kwargs.pop("timeout", REQUEST_TIMEOUT),
                **kwargs
            )
            if resp.status_code in (429, 503) and attempt < max_retries - 1:
                wait = 2 ** attempt + 1
                print(f"[WARN] {resp.status_code} @ {url[:70]} | retry {attempt+1}/{max_retries} in {wait}s")
                time.sleep(wait)
                continue
            return resp
        except requests.exceptions.RequestException as e:
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
                continue
            print(f"[ERR] request failed: {e}")
            return None
    return None


# ============ 白名单加载 ============

WHITELIST_MAP = {}  # 懒加载缓存


def load_whitelist(topic_key):
    """加载白名单期刊，返回归一化后的期刊名列表。
    从 config.TOPICS 读取 whitelist_file 字段。无白名单返回空列表（放行）。"""
    if topic_key in WHITELIST_MAP:
        return WHITELIST_MAP[topic_key]

    # 从 TOPICS 配置中找到 whitelist_file
    whitelist_file = None
    for t in TOPICS:
        if t['key'] == topic_key:
            whitelist_file = t.get('whitelist_file')
            break

    if not whitelist_file:
        WHITELIST_MAP[topic_key] = []
        return []

    # whitelist_file == "auto"：首次访问时自动生成白名单文件
    if whitelist_file == "auto":
        if_threshold = 3.0
        for t in TOPICS:
            if t['key'] == topic_key:
                if_threshold = t.get('if_threshold', 3.0)
                break
        try:
            from build_whitelist import generate_whitelist
            import config as _cfg
            _cfg.load_topics()
            generated = generate_whitelist(topic_key, if_threshold=if_threshold)
            if generated:
                # 生成成功，把实际文件名回写到 TOPICS 缓存，后续直接读文件
                whitelist_file = generated.name
                for t in TOPICS:
                    if t['key'] == topic_key:
                        t['whitelist_file'] = whitelist_file
                        break
                WHITELIST_MAP.pop(topic_key, None)  # 清缓存重读
            else:
                WHITELIST_MAP[topic_key] = []
                return []
        except Exception as e:
            print(f"[WARN] 自动生成白名单失败 ({topic_key}): {e}，该主题暂不限期刊")
            WHITELIST_MAP[topic_key] = []
            return []

    path = REFERENCES_DIR / whitelist_file
    if not path.exists():
        print(f"[WARN] whitelist file not found: {path}")
        WHITELIST_MAP[topic_key] = []
        return []

    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    journals = re.findall(r'\| ([^|]+) \| [^|]+ \|', content)
    cleaned = [
        j.strip() for j in journals
        if j.strip() and not j.strip().startswith('---') and j.strip() not in ('期刊名称', '简称', '参考IF')
    ]
    WHITELIST_MAP[topic_key] = [normalize_journal(j) for j in cleaned]
    return WHITELIST_MAP[topic_key]


def normalize_journal(name):
    """归一化期刊名用于模糊匹配"""
    if not name:
        return ""
    return re.sub(r'[.,;:\s]+', '', name.lower())


# ============ 论文过滤规则 ============

def is_preprint(paper):
    """判断是否为预印本"""
    doi = (paper.get('doi') or '').lower()
    url = (paper.get('url') or '').lower()
    journal = (paper.get('journal') or '').lower()
    if doi.startswith('arxiv:'):
        return True
    if 'arxiv' in journal or 'preprint' in journal:
        return True
    if 'arxiv.org/abs/' in url or 'engrxiv.org' in url or 'researchsquare.com' in url:
        return True
    return False


def is_off_topic(paper):
    """标题级排除：命中生物医学/临床/农业等无关关键词则判为跑偏。
    注意：检查标题+期刊，避免误杀（如 'plant' 可能出现在材料语境）。"""
    title = (paper.get('title') or '').lower()
    journal = (paper.get('journal') or '').lower()
    # 期刊级硬排除
    for bj in EXCLUDE_JOURNAL_KEYWORDS:
        if bj in journal:
            return True
    # 标题级排除
    for kw in EXCLUDE_TITLE_KEYWORDS:
        if kw in title:
            return True
    return False


def is_whitelist_journal(topic_key, journal_name):
    """判断期刊是否在白名单中。rag_kg 等无白名单主题直接放行。"""
    whitelist = load_whitelist(topic_key)
    if not whitelist:
        return True  # 无白名单配置 = 全部放行
    j_norm = normalize_journal(journal_name)
    if not j_norm:
        return False
    for w in whitelist:
        if w in j_norm or j_norm in w:
            return True
    return False


def hard_filter(papers, topic_key, allow_preprint):
    """硬过滤：年份、预印本、白名单"""
    kept = []
    dropped = []
    for paper in papers:
        # 1. 年份过滤（参数化）
        year = paper.get('year')
        if year is None or not (YEAR_START <= year <= YEAR_END):
            dropped.append(('year', paper))
            continue
        # 2. 预印本过滤
        if not allow_preprint and is_preprint(paper):
            dropped.append(('preprint', paper))
            continue
        # 3. 白名单过滤
        if not is_whitelist_journal(topic_key, paper.get('journal', '')):
            # 尝试用 DOI 反查 OpenAlex 补全期刊名
            doi = paper.get('doi', '')
            if doi and str(doi).startswith('10.'):
                oa_journal = openalex_get_journal(doi)
                if oa_journal and is_whitelist_journal(topic_key, oa_journal):
                    paper['journal'] = oa_journal
                    kept.append(paper)
                    continue
            dropped.append(('whitelist', paper))
            continue
        kept.append(paper)
    counts = {}
    for reason, _ in dropped:
        counts[reason] = counts.get(reason, 0) + 1
    print(f"[FILTER] {topic_key}: kept={len(kept)}, dropped={counts}")
    return kept, dropped


# ============ OpenAlex API ============

def _oa_headers():
    """构造 OpenAlex 请求头"""
    headers = {"User-Agent": f"literature_pipeline/2.0 (mailto:{OA_MAILTO})"}
    if OA_API_KEY:
        headers["Authorization"] = f"Bearer {OA_API_KEY}"
    return headers


def openalex_get_journal(doi):
    """通过 OpenAlex 获取准确期刊名"""
    try:
        url = f"https://api.openalex.org/works/doi:{doi}"
        resp = requests.get(url, headers=_oa_headers(), timeout=REQUEST_TIMEOUT)
        data = resp.json()
        journal = data.get('primary_location', {}).get('source', {}).get('display_name', '')
        return journal
    except Exception:
        return None


def restore_abstract(idx):
    """将 OpenAlex abstract_inverted_index 还原为完整摘要。
    idx: {word: [pos1, pos2, ...], ...}"""
    if not idx or not isinstance(idx, dict):
        return None
    try:
        all_pos = [p for v in idx.values() if v for p in v]
        if not all_pos:
            return None
        words = [""] * (max(all_pos) + 1)
        for word, positions in idx.items():
            for pos in positions:
                if 0 <= pos < len(words):
                    words[pos] = word
        text = re.sub(r'\s+', ' ', " ".join(words)).strip()
        return text or None
    except Exception:
        return None


def openalex_lookup(doi):
    """通过 OpenAlex 单篇 DOI 查询，返回摘要(还原)/期刊/被引。"""
    try:
        if not doi:
            return {}
        doi_clean = str(doi).replace("https://doi.org/", "").replace("http://doi.org/", "").strip()
        url = f"https://api.openalex.org/works/doi:{doi_clean}"
        resp = _request_with_retry("GET", url, headers=_oa_headers(), timeout=REQUEST_TIMEOUT)
        if not resp or resp.status_code != 200:
            return {}
        data = resp.json()
        journal = ((data.get("primary_location") or {}).get("source") or {}) or {}
        pub_date = data.get("publication_date")
        return {
            "title": data.get("display_name"),
            "publication_date": pub_date,
            "year": int(pub_date[:4]) if pub_date and len(pub_date) >= 4 else None,
            "abstract": restore_abstract(data.get("abstract_inverted_index")),
            "cited_by_count": data.get("cited_by_count"),
            "journal": journal.get("display_name"),
            "doi": doi_clean,
            "type": data.get("type"),
        }
    except Exception as e:
        print(f"[WARN] OpenAlex error for DOI '{doi}': {e}")
    return {}


def openalex_search(query, date_from, date_to, per_page=None):
    """OpenAlex 检索：日级时间窗口 + 关键词，返回归一化 paper 列表。"""
    if per_page is None:
        per_page = NUM_RESULTS
    params = {
        "search": query,
        "filter": f"from_publication_date:{date_from},to_publication_date:{date_to},type:article",
        "sort": "publication_date:desc",
        "per-page": per_page,
    }
    if OA_MAILTO:
        params["mailto"] = OA_MAILTO
    resp = _request_with_retry(
        "GET", "https://api.openalex.org/works",
        params=params, headers=_oa_headers(), timeout=25
    )
    if not resp or resp.status_code != 200:
        print(f"[WARN] OA search {resp.status_code if resp else 'ERR'}: {query}")
        if not OA_MAILTO and not OA_API_KEY:
            print("[HINT] 未配置 OA_MAILTO/OPENALEX_API_KEY，匿名访问限流严重，建议在 .env 中配置")
        return []
    results = resp.json().get("results", [])
    papers = []
    for w in results:
        doi_raw = w.get("doi") or ""
        doi = doi_raw.replace("https://doi.org/", "").replace("http://doi.org/", "").strip() or None
        source = (w.get("primary_location") or {}).get("source") or {}
        authorships = w.get("authorships") or []
        authors = ", ".join([((a.get("author") or {}).get("display_name") or "")
                             for a in authorships[:10]])
        pub_date = w.get("publication_date")
        year = int(pub_date[:4]) if pub_date and len(pub_date) >= 4 else None
        papers.append({
            "title": clean_text(w.get("display_name") or ""),
            "authors": clean_text(authors),
            "year": year,
            "publication_date": pub_date,
            "journal": clean_text(source.get("display_name") or ""),
            "abstract": clean_text(restore_abstract(w.get("abstract_inverted_index")) or ""),
            "url": w.get("id") or (f"https://doi.org/{doi}" if doi else ""),
            "doi": doi,
            "citations": w.get("cited_by_count") or 0,
            "source": "openalex",
        })
    print(f"[OA] '{query}' {date_from}~{date_to}: {len(papers)} hits")
    return papers


# ============ Semantic Scholar API ============

def s2_lookup_by_doi(doi):
    """S2 单篇 DOI 查询，返回明文 abstract。"""
    if not doi:
        return {}
    doi_clean = str(doi).replace("https://doi.org/", "").strip()
    headers = {"x-api-key": S2_API_KEY} if S2_API_KEY else {}
    url = f"https://api.semanticscholar.org/graph/v1/paper/DOI:{quote(doi_clean)}"
    fields = "title,abstract,year,externalIds,publicationDate,journal"
    resp = _request_with_retry("GET", url, headers=headers, params={"fields": fields}, timeout=REQUEST_TIMEOUT)
    if not resp or resp.status_code != 200:
        return {}
    d = resp.json()
    ext = d.get("externalIds") or {}
    return {
        "abstract": d.get("abstract"),
        "year": d.get("year"),
        "publication_date": d.get("publicationDate"),
        "journal": (d.get("journal") or {}).get("name") if d.get("journal") else None,
        "doi": ext.get("DOI"),
        "arxiv": ext.get("ArXiv"),
    }


def s2_lookup_by_title(title):
    """S2 标题搜索，返回首篇的明文 abstract。限频 1次/秒，调用方需确保间隔。"""
    if not title:
        return {}
    headers = {"x-api-key": S2_API_KEY} if S2_API_KEY else {}
    fields = "title,abstract,year,externalIds,publicationDate,journal"
    url = "https://api.semanticscholar.org/graph/v1/paper/search"
    resp = _request_with_retry("GET", url, headers=headers,
                               params={"query": title, "fields": fields, "limit": 1}, timeout=REQUEST_TIMEOUT)
    if not resp or resp.status_code != 200:
        return {}
    data = resp.json().get("data") or []
    if not data:
        return {}
    d = data[0]
    ext = d.get("externalIds") or {}
    return {
        "abstract": d.get("abstract"),
        "year": d.get("year"),
        "doi": ext.get("DOI"),
        "arxiv": ext.get("ArXiv"),
        "journal": (d.get("journal") or {}).get("name") if d.get("journal") else None,
    }


def s2_batch_by_dois(dois):
    """S2 批量按 DOI 查询，返回 {doi_lower: paper}。按 20 条分批避免超限。"""
    if not dois:
        return {}
    headers = {"Content-Type": "application/json"}
    if S2_API_KEY:
        headers["x-api-key"] = S2_API_KEY
    fields = "title,abstract,year,externalIds,publicationDate,journal"
    url = f"https://api.semanticscholar.org/graph/v1/paper/batch?fields={fields}"
    ids = [f"DOI:{str(d).replace('https://doi.org/', '').strip()}" for d in dois if d]
    result = {}
    for i in range(0, len(ids), 20):
        chunk = ids[i:i + 20]
        resp = _request_with_retry("POST", url, headers=headers, json={"ids": chunk}, timeout=30)
        if not resp or resp.status_code != 200:
            time.sleep(1)
            continue
        for p in resp.json():
            if not p:
                continue
            ext = p.get("externalIds") or {}
            d = ext.get("DOI")
            if d:
                result[d.lower()] = p
        time.sleep(S2_RATE_LIMIT_DELAY)
    return result


# ============ Crossref API ============

def crossref_lookup(title):
    """通过 Crossref 查找文献信息（用于 fallback 补全）"""
    try:
        url = f"https://api.crossref.org/works?query.title={quote(title)}&rows=3"
        resp = requests.get(url, timeout=REQUEST_TIMEOUT)
        data = resp.json()
        items = data.get('message', {}).get('items', [])
        if items:
            best = items[0]
            published = best.get('published-print') or best.get('published-online')
            year = None
            if published and isinstance(published, dict):
                dp = published.get('date-parts', [[None]])
                if dp and dp[0]:
                    year = dp[0][0]
            return {
                'doi': best.get('DOI'),
                'title': best.get('title', [None])[0],
                'year': year,
                'abstract': best.get('abstract'),
                'authors': ', '.join([
                    f"{a.get('family', '')}, {a.get('given', '')}".strip(', ')
                    for a in best.get('author', [])
                ]) if best.get('author') else None,
                'journal': best.get('container-title', [None])[0] if best.get('container-title') else None,
            }
    except Exception as e:
        print(f"[WARN] Crossref error for '{title[:50]}...': {e}")
    return {}


# ============ 工具函数 ============

def extract_doi(url):
    """从 URL 中提取 DOI"""
    if not url:
        return None
    m = re.search(r'doi\.org/([^\s"]+)', url)
    if m:
        return m.group(1)
    m = re.search(r'/doi/abs/([^\s"]+)', url)
    if m:
        return m.group(1)
    m = re.search(r'/doi/([^\s"]+)', url)
    if m:
        return m.group(1)
    m = re.search(r'10\.\d{4,}/[^\s"&?]+', url)
    if m:
        return m.group(0)
    return None


def clean_text(text):
    """清理乱码和多余空格"""
    if not text:
        return text
    text = str(text)
    text = text.replace('\ufffd', '')
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def normalize_title(t):
    """标题归一化用于去重：小写 + 去标点 + 折叠空格。"""
    if not t:
        return ""
    t = str(t).lower()
    t = re.sub(r'[^\w\s]', '', t)
    return re.sub(r'\s+', ' ', t).strip()


def normalize_doi(doi):
    """规范化 DOI：
    - 真 DOI (10.x/y) -> 保留小写
    - arXiv:xxx -> 保留
    - URL / 伪前缀 -> 尝试提取真 DOI，失败返回 None
    """
    if not doi:
        return None
    doi = str(doi).strip()
    if re.match(r'^10\.\d{4,9}/', doi):
        return doi.lower()
    if doi.lower().startswith('arxiv:'):
        return doi
    m = re.search(r'10\.\d{4,9}/[^\s"&?#]+', doi)
    if m:
        return m.group(0).lower()
    return None


# ============ 数据库操作 ============

def init_db(db_path=None):
    """初始化数据库（创建表）。首次运行时调用。"""
    if db_path is None:
        db_path = str(DB_PATH)
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS papers (
            doi TEXT PRIMARY KEY,
            title TEXT,
            authors TEXT,
            year INTEGER,
            journal TEXT,
            abstract TEXT,
            url TEXT,
            source TEXT,
            topic TEXT,
            first_seen TEXT,
            last_seen TEXT,
            has_pdf INTEGER DEFAULT 0,
            pdf_path TEXT,
            notes TEXT,
            is_qualified INTEGER DEFAULT 0,
            filter_reason TEXT DEFAULT 'pending',
            citations INTEGER DEFAULT 0,
            publication_date TEXT
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS search_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            search_date TEXT,
            topic TEXT,
            query TEXT,
            results_total INTEGER,
            new_count INTEGER
        )
    """)
    conn.commit()
    conn.close()
    print(f"[INIT] Database ready: {db_path}")


def insert_papers(papers, db_path=None):
    """将所有文献（含过滤掉的）写入数据库，is_qualified=0 待标记。"""
    if db_path is None:
        db_path = str(DB_PATH)
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    now = datetime.now().strftime('%Y-%m-%dT%H:%M:%S%z')
    inserted = 0
    for paper in papers:
        try:
            cursor.execute("""
                INSERT INTO papers (doi, title, authors, year, journal, abstract, url, source, topic,
                                    first_seen, last_seen, has_pdf, pdf_path, notes, is_qualified, filter_reason,
                                    citations, publication_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                paper.get('doi'), paper['title'], paper.get('authors'), paper.get('year'),
                paper.get('journal'), paper.get('abstract'), paper.get('url', ''),
                paper.get('source', 'openalex'), paper['topic'], now, now,
                0, None, None, 0, 'pending',
                paper.get('citations', 0) or 0, paper.get('publication_date')
            ))
            inserted += 1
        except Exception as e:
            print(f"[WARN] Insert failed for '{paper['title'][:40]}': {e}")
    conn.commit()
    conn.close()
    return inserted


def get_last_run_date(db_path=None):
    """从 search_history 取上次运行日期；空库回退 today-7。"""
    if db_path is None:
        db_path = str(DB_PATH)
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute("SELECT MAX(search_date) FROM search_history")
    row = c.fetchone()
    conn.close()
    if row and row[0] and len(row[0]) >= 10:
        return row[0][:10]
    return (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')


def log_search(db_path, topic, query, results_total, new_count):
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    now = datetime.now().strftime('%Y-%m-%dT%H:%M:%S%z')
    c.execute(
        "INSERT INTO search_history (search_date, topic, query, results_total, new_count) VALUES (?,?,?,?,?)",
        (now, topic, query, results_total, new_count)
    )
    conn.commit()
    conn.close()


def deduplicate_only(papers, db_path=None):
    """加固去重：规范化 DOI + 规范化标题双键匹配。
    命中则视为重复：若是同库内多主题共现，追加 topic 到已有行，不重复插行。"""
    if db_path is None:
        db_path = str(DB_PATH)
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT rowid, doi, title, topic FROM papers")
    existing = [(r[0], r[1], r[2], r[3] or '') for r in cursor.fetchall()]

    new_papers = []
    for paper in papers:
        title = paper['title']
        doi_raw = paper.get('doi') or ''
        doi = normalize_doi(doi_raw)
        nt = normalize_title(title)
        paper['doi'] = doi

        hit_rowid = None
        for e_rowid, e_doi, e_title, e_topic in existing:
            if doi and e_doi and e_doi == doi:
                hit_rowid = e_rowid
                break
            if nt and normalize_title(e_title) == nt:
                hit_rowid = e_rowid
                break

        if hit_rowid is None:
            new_papers.append(paper)
            existing.append((None, doi, title, paper.get('topic', '')))
        else:
            paper_topic = paper.get('topic', '')
            if paper_topic:
                for i, (e_rowid, e_doi, e_title, e_topic) in enumerate(existing):
                    if e_rowid == hit_rowid:
                        topics = [t.strip() for t in e_topic.split(',') if t.strip()]
                        if paper_topic not in topics:
                            topics.append(paper_topic)
                            new_topic = ','.join(topics)
                            cursor.execute(
                                "UPDATE papers SET topic=?, last_seen=? WHERE rowid=?",
                                (new_topic, datetime.now().strftime('%Y-%m-%dT%H:%M:%S%z'), hit_rowid)
                            )
                            existing[i] = (e_rowid, e_doi, e_title, new_topic)
                        break
    conn.commit()
    conn.close()
    return new_papers


def deduplicate_and_enrich(papers, db_path=None):
    """去重 + 补全摘要（Crossref/OpenAlex），返回待入库的新文献列表。"""
    if db_path is None:
        db_path = str(DB_PATH)
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    new_papers = []

    for paper in papers:
        title = paper['title']
        doi = paper['doi'] or ''

        # 去重：按 DOI 或标题
        cursor.execute("SELECT COUNT(*) FROM papers WHERE doi = ? OR title = ?", (doi, title))
        if cursor.fetchone()[0] > 0:
            continue

        # 补全：如果 abstract 为空或片段，尝试 Crossref
        abstract = paper['abstract'] or ''
        if not abstract or '...' in abstract or len(abstract) < 50:
            print(f"[ENRICH] Crossref: {title[:50]}...")
            cr = crossref_lookup(title)
            time.sleep(OA_RATE_LIMIT_DELAY)
            if cr.get('abstract') and len(cr['abstract']) > len(abstract):
                abstract = cr['abstract']
            if cr.get('doi') and not doi:
                doi = cr['doi']
                paper['doi'] = doi
            if cr.get('year') and not paper['year']:
                paper['year'] = cr['year']
            if cr.get('authors') and not paper['authors']:
                paper['authors'] = cr['authors']
            if cr.get('journal') and not paper['journal']:
                paper['journal'] = cr['journal']

        # 补全：如果仍有 DOI 但 abstract 缺失，尝试 OpenAlex
        if doi and (not abstract or len(abstract) < 100):
            print(f"[ENRICH] OpenAlex: {doi}")
            oa = openalex_lookup(doi)
            time.sleep(OA_RATE_LIMIT_DELAY)
            if oa.get('abstract') and oa['abstract'] != 'N/A' and len(oa['abstract']) > len(abstract):
                abstract = oa['abstract']

        paper['abstract'] = abstract
        new_papers.append(paper)

    conn.close()
    return new_papers


def mark_filtered(db_path=None, topic_key=None, allow_preprint=False):
    """对 pending 论文标记过滤状态。用 rowid 定位，绕开 NULL doi。
    年份过滤参数化（YEAR_START~YEAR_END）。"""
    if db_path is None:
        db_path = str(DB_PATH)
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

        # 1. 年份过滤（参数化）
        if year is None or not (YEAR_START <= (year or 0) <= YEAR_END):
            mark(rowid, 0, 'old_year')
            dropped['year'] += 1
            continue

        # 2. 预印本过滤
        if not allow_preprint and is_preprint(paper):
            mark(rowid, 0, 'preprint')
            dropped['preprint'] += 1
            continue

        # 2.5 离题过滤
        if is_off_topic(paper):
            mark(rowid, 0, 'off_topic')
            dropped['off_topic'] += 1
            continue

        # 3. 白名单过滤
        if not is_whitelist_journal(topic_key, journal):
            if doi and str(doi).startswith('10.'):
                oa_j = openalex_get_journal(doi)
                if oa_j and is_whitelist_journal(topic_key, oa_j):
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
    print(f"[MARK] {topic_key}: qualified={qualified}, dropped={dropped}")
    return qualified, dropped


def enrich_qualified(db_path=None):
    """对 qualified=1 且摘要缺失的论文补全：先 OA（单篇DOI），再 S2（明文abstract）。"""
    if db_path is None:
        db_path = str(DB_PATH)
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("""SELECT doi, title, abstract, authors, year, journal FROM papers
                      WHERE is_qualified = 1 AND (abstract IS NULL OR length(abstract) < 50)""")
    rows = cursor.fetchall()
    fixed = 0
    for doi, title, abstract, authors, year, journal in rows:
        abstract = abstract or ''

        # 第一优先级：OpenAlex 单篇
        if doi and (not abstract or len(abstract) < 100):
            oa = openalex_lookup(doi)
            if oa.get('abstract') and len(oa['abstract']) > len(abstract):
                abstract = oa['abstract']
            if oa.get('journal') and not journal:
                journal = oa['journal']
            time.sleep(OA_RATE_LIMIT_DELAY)

        # 第二优先级：Semantic Scholar
        if not abstract or len(abstract) < 100:
            s2 = s2_lookup_by_doi(doi) if doi else {}
            time.sleep(S2_RATE_LIMIT_DELAY)
            if not s2.get('abstract'):
                s2 = s2_lookup_by_title(title)
                time.sleep(S2_RATE_LIMIT_DELAY)
            if s2.get('abstract') and len(s2['abstract']) > len(abstract):
                abstract = s2['abstract']
            if s2.get('doi') and not doi:
                doi = s2['doi']

        if abstract and len(abstract) > 30:
            cursor.execute("UPDATE papers SET abstract=?, journal=?, doi=? WHERE doi=? OR title=?",
                           (abstract, journal, doi, doi, title))
            fixed += 1
    conn.commit()
    conn.close()
    print(f"[ENRICH] Fixed {fixed} qualified papers with missing abstracts")


def read_csv_papers(path, topic_key):
    """读取 Scholar CSV 结果，返回结构化列表（保留以支持手动导入 CSV）"""
    papers = []
    try:
        with open(path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                doi = extract_doi(row.get('url', ''))
                papers.append({
                    'title': clean_text(row.get('title', '')),
                    'authors': clean_text(row.get('authors', '')),
                    'year': int(row.get('year', 0)) if row.get('year') else None,
                    'journal': clean_text(row.get('publication_info', '')),
                    'abstract': clean_text(row.get('abstract', '')),
                    'url': row.get('url', ''),
                    'doi': clean_text(doi) if doi else None,
                    'topic': topic_key,
                    'source': 'csv_import',
                    'citations': int(row.get('citations', 0)) if row.get('citations') else 0,
                })
    except Exception as e:
        print(f"[ERR] Failed to read CSV {path}: {e}")
    return papers


# ============ 主流程 ============

def main():
    """主流程：OA检索 → 入库 → 标记过滤 → 摘要补全。"""
    import argparse
    ap = argparse.ArgumentParser(description='文献周报主管线')
    ap.add_argument('--init', action='store_true', help='初始化数据库（首次运行）')
    ap.add_argument('--from', dest='date_from', help='检索起始日期 YYYY-MM-DD')
    ap.add_argument('--to', dest='date_to', help='检索结束日期 YYYY-MM-DD')
    args = ap.parse_args()

    print("=" * 60)
    print("文献周报自动化管线 v5 (OpenAlex + S2, 可移植版)")
    print("=" * 60)

    # 首次初始化
    if args.init or not DB_PATH.exists():
        init_db()
        if args.init:
            return

    if not DB_PATH.exists():
        print(f"[ERR] Database not found: {DB_PATH}")
        print("  首次运行请执行: python literature_pipeline.py --init")
        sys.exit(1)

    # 日期窗口
    date_from = args.date_from or get_last_run_date()
    date_to = args.date_to or datetime.now().strftime('%Y-%m-%d')
    print(f"[STATE] date_from={date_from}  date_to={date_to}")

    all_new = []
    for topic in TOPICS:
        print(f"\n[TOPIC] {topic['display']} ({topic['key']})")
        papers = openalex_search(topic['query'], date_from, date_to, per_page=NUM_RESULTS)
        if not papers:
            print(f"[INFO] {topic['key']}: no results from OpenAlex")
        for p in papers:
            p['topic'] = topic['key']
        new_papers = deduplicate_only(papers, str(DB_PATH))
        all_new.extend(new_papers)
        print(f"[INFO] {topic['key']}: {len(new_papers)} new after dedup")
        log_search(str(DB_PATH), topic['key'], topic['query'], len(papers), len(new_papers))

    if all_new:
        inserted = insert_papers(all_new)
        print(f"\n[INFO] Inserted {inserted}/{len(all_new)} new papers (all archived)")
    else:
        print("\n[INFO] No new papers")

    # 标记过滤
    for topic in TOPICS:
        mark_filtered(str(DB_PATH), topic['key'], topic.get('allow_preprint', False))

    # 摘要补全
    enrich_qualified()

    print("\n" + "=" * 60)
    print(f"Done. 下一步: python generate_report.py --date {date_to} --auto-summary")


if __name__ == '__main__':
    main()
