#!/usr/bin/env python3
"""discover.py — 扫 GitHub 上散装的 ZCode 插件/技能候选,输出候选清单(candidates.md)。
数据源:topic:zcode-plugin / topic:zcode-plugins / gh code search plugin.json+zcode。
输出:stdout 或写 docs/candidates.md。零第三方依赖(用 gh CLI)。"""
import json, subprocess, sys

QUERIES = [
    ["gh", "search", "repos", "topic:zcode-plugin", "--limit", "50",
     "--json", "fullName,description,stargazersCount,url"],
    ["gh", "search", "repos", "topic:zcode-plugins", "--limit", "50",
     "--json", "fullName,description,stargazersCount,url"],
]

def gh(args):
    r = subprocess.run(args, capture_output=True, timeout=60)
    if r.returncode != 0:
        return []
    try:
        return json.loads(r.stdout.decode("utf-8", "replace"))
    except json.JSONDecodeError:
        return []

def main():
    seen, rows = {}, []
    for q in QUERIES:
        for it in gh(q):
            name = it.get("fullName", "")
            if name and name not in seen:
                seen[name] = True
                rows.append(it)
    rows.sort(key=lambda x: -x.get("stargazersCount", 0))
    lines = ["# 候选插件发现报告", "",
             f"生成时间: 自动(topic 扫描,共 {len(rows)} 个候选)", "",
             "| 仓库 | star | 说明 |", "|---|---|---|"]
    for it in rows:
        desc = (it.get("description") or "").replace("|", "/").replace("\n", " ")[:120]
        lines.append(f"| {it['fullName']} | {it.get('stargazersCount', 0)} | {desc} |")
    out = "\n".join(lines) + "\n"
    if len(sys.argv) > 1:
        open(sys.argv[1], "w", encoding="utf-8").write(out)
        print(f"written: {sys.argv[1]} ({len(rows)} candidates)")
    else:
        print(out)

if __name__ == "__main__":
    main()
