#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""扫描 output/ 目录下的 lit-weekly-*.html，生成自包含索引页 index.html。
静态生成（无需 JS 动态加载），浏览器 file:// 可直接打开。
用法: python build_index.py [--output 路径]
"""
import argparse
import os
import re
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import OUTPUT_DIR


def scan_editions(output_dir):
    """扫描目录下所有 lit-weekly-YYYY-MM-DD.html，提取日期+论文数+主题分布。"""
    editions = []
    pat = re.compile(r'^lit-weekly-(\d{4}-\d{2}-\d{2})(?:-v(\d+))?\.html$')
    if not os.path.isdir(output_dir):
        return editions
    for name in os.listdir(output_dir):
        m = pat.match(name)
        if not m:
            continue
        date = m.group(1)
        version = m.group(2)
        path = os.path.join(output_dir, name)
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        paper_count = content.count('class="paper-card"')
        tr_m = re.search(r'<title>文献周报 - (.*?)</title>', content)
        time_range = tr_m.group(1) if tr_m else date
        topic_m = re.findall(r'class="topic-tab[^"]*"[^>]*>(.*?)<span', content, re.S)
        topics = [re.sub(r'<[^>]+>', '', t).strip() for t in topic_m]
        editions.append({
            'date': date,
            'version': version,
            'filename': name,
            'paper_count': paper_count,
            'time_range': time_range,
            'topics': topics,
        })
    editions.sort(key=lambda e: (e['date'], e['version'] or ''), reverse=True)
    return editions


def build_index_html(editions):
    """生成自包含索引页。"""
    cards_html = []
    for e in editions:
        vbadge = f' <span class="vbadge">v{e["version"]}</span>' if e["version"] else ''
        topics_str = ' · '.join(e['topics']) if e['topics'] else '多主题'
        cards_html.append(f'''
<div class="edition-card">
  <a href="{e['filename']}" class="card-link">
    <div class="card-date">📅 {e['date']}{vbadge}</div>
    <div class="card-range">{e['time_range']}</div>
    <div class="card-stats">
      <span class="stat">📄 {e['paper_count']} 篇</span>
      <span class="stat">🏷️ {topics_str}</span>
    </div>
  </a>
</div>''')

    if not editions:
        body = '<div class="empty">暂无文献周报，运行 generate_report.py 生成第一期。</div>'
    else:
        body = f'<div class="grid">{"".join(cards_html)}</div>'

    now_str = datetime.now().strftime('%Y-%m-%d %H:%M')
    return f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>文献周报索引</title>
<style>
:root {{
  --bg: #f0f2f5; --card: #ffffff; --text: #1a1a2e; --muted: #5a5a6e;
  --accent: #2d5a87; --border: #d0d5dd; --shadow: 0 1px 3px rgba(0,0,0,0.08);
  --shadow-hover: 0 8px 24px rgba(0,0,0,0.12);
}}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; }}
.container {{ max-width: 960px; margin: 0 auto; padding: 24px 16px 60px; }}
.header {{ background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 50%, #4a7fb5 100%); color: white; padding: 36px 32px; border-radius: 16px; margin-bottom: 28px; box-shadow: var(--shadow-hover); }}
.header h1 {{ font-size: 1.8em; margin-bottom: 8px; }}
.header p {{ opacity: 0.85; font-size: 0.95em; }}
.header .meta {{ margin-top: 16px; font-size: 0.85em; opacity: 0.7; }}
.grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }}
.edition-card {{ background: var(--card); border-radius: 14px; box-shadow: var(--shadow); transition: all 0.25s; overflow: hidden; }}
.edition-card:hover {{ box-shadow: var(--shadow-hover); transform: translateY(-3px); }}
.card-link {{ display: block; padding: 20px; text-decoration: none; color: var(--text); }}
.card-date {{ font-size: 1.15em; font-weight: 700; color: var(--accent); margin-bottom: 6px; }}
.card-range {{ font-size: 0.88em; color: var(--muted); margin-bottom: 12px; }}
.card-stats {{ display: flex; flex-wrap: wrap; gap: 8px; }}
.stat {{ font-size: 0.82em; background: #f1f5f9; padding: 4px 10px; border-radius: 20px; color: var(--muted); }}
.vbadge {{ display: inline-block; background: #2d5a87; color: white; padding: 1px 8px; border-radius: 10px; font-size: 0.72em; font-weight: 600; }}
.empty {{ text-align: center; padding: 80px 40px; color: var(--muted); background: white; border-radius: 16px; }}
.footer {{ text-align: center; color: var(--muted); font-size: 0.85em; margin-top: 40px; }}
@media (max-width: 600px) {{ .grid {{ grid-template-columns: 1fr; }} .header {{ padding: 28px 20px; }} }}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>📚 文献周报索引</h1>
    <p>聚合你关注的学术方向，自动化追踪最新文献</p>
    <div class="meta">共 {len(editions)} 期 · 索引更新于 {now_str}</div>
  </div>
  {body}
  <div class="footer">文献周报 · 由文献周报管线自动生成</div>
</div>
</body>
</html>'''


def main():
    ap = argparse.ArgumentParser(description='生成文献周报索引页')
    ap.add_argument('--output', default=str(OUTPUT_DIR), help='周报输出目录')
    args = ap.parse_args()

    editions = scan_editions(args.output)
    print(f"[SCAN] 找到 {len(editions)} 期: {[e['date'] for e in editions]}")

    html = build_index_html(editions)
    index_path = os.path.join(args.output, 'index.html')
    os.makedirs(args.output, exist_ok=True)
    with open(index_path, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f"[INDEX] {index_path}")


if __name__ == '__main__':
    main()
