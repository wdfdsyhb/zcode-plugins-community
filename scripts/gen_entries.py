#!/usr/bin/env python3
"""gen_entries.py — 扫描 plugins/ 下所有 manifest,生成 marketplace.json 缺失的条目。
category/display_zh 取自 scripts/batch2-meta.json(无记录的用 manifest 内字段+默认值)。
用法: python gen_entries.py  (在仓库根执行;输出到 stdout,--write 直接写回 marketplace.json)"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
meta = json.load(open(os.path.join(ROOT, "scripts", "batch2-meta.json"), encoding="utf-8"))
mkt_path = os.path.join(ROOT, "marketplace.json")
mkt = json.load(open(mkt_path, encoding="utf-8"))
have = {p["name"] for p in mkt["plugins"]}
new_entries = []

for plug in sorted(os.listdir(os.path.join(ROOT, "plugins"))):
    mp = os.path.join(ROOT, "plugins", plug, ".zcode-plugin", "plugin.json")
    if not os.path.isfile(mp):
        continue
    man = json.load(open(mp, encoding="utf-8"))
    if man["name"] in have:
        continue
    m = meta.get(plug, {})
    desc = man.get("description", "")
    zh = m.get("display_zh") or man.get("description_i18n", {}).get("zh-CN", desc)
    entry = {
        "name": man["name"],
        "source": f"./plugins/{plug}",
        "displayName": zh if any("\u4e00" <= c <= "\u9fff" for c in zh) else man["name"],
        "displayName_i18n": {"en": man["name"], "zh-CN": zh},
        "description": desc[:400],
        "description_i18n": {"en": desc[:400], "zh-CN": zh[:400]},
        "version": man.get("version", "0.1.0"),
        "author": man.get("author", {"name": plug}),
        "category": m.get("category", "dev-tools"),
        "keywords": man.get("keywords", [])[:5],
    }
    new_entries.append(entry)

if "--write" in sys.argv:
    mkt["plugins"].extend(new_entries)
    json.dump(mkt, open(mkt_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"marketplace.json: +{len(new_entries)} → {len(mkt['plugins'])} plugins")
else:
    print(json.dumps(new_entries, ensure_ascii=False, indent=2)[:2000])
