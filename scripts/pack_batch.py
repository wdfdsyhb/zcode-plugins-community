#!/usr/bin/env python3
"""pack_batch.py — 批量判型打包候选插件到 plugins/。
判型规则(按优先级):
  A. 上游有 .zcode-plugin/plugin.json → 整仓拷(含点文件),manifest 沿用上游
  B. 上游有 skills/<name>/SKILL.md → 拷 skills/ 全部,manifest 新建
  C. 上游根有单个 SKILL.md → 拷进 skills/<repo-name>/,manifest 新建
  无 LICENSE → SKIP(记入报告)
manifest 新建时:从 SKILL.md frontmatter 提取 name/description;category/zh 补充走 META 表。
用法: python pack_batch.py <upstream_dir> <plugins_dir> <meta.json>
meta.json: {repo_name: {category, author_github, display_zh, zh_extra}}"""
import json, os, re, shutil, subprocess, sys

def sh(*a, **k):
    return subprocess.run(a, capture_output=True, **k)

def frontmatter(path):
    try:
        txt = open(path, encoding="utf-8", errors="replace").read(8000)
    except OSError:
        return {}
    m = re.match(r"^---\s*\n(.*?)\n---", txt, re.S)
    if not m:
        return {}
    fm = {}
    for line in m.group(1).splitlines():
        if ":" in line and not line.startswith((" ", "\t")):
            k, _, v = line.partition(":")
            fm[k.strip()] = v.strip().strip("\"'")
    return fm

def copytree(src, dst):
    shutil.copytree(src, dst, dirs_exist_ok=True,
                    ignore=shutil.ignore_patterns(".git", "node_modules", "__pycache__", "*.tgz"))

def main(updir, plugdir, metapath):
    meta = json.load(open(metapath, encoding="utf-8"))
    report = []
    for repo in sorted(os.listdir(updir)):
        src = os.path.join(updir, repo)
        if not os.path.isdir(src) or repo.startswith("."):
            continue
        if os.path.isdir(os.path.join(plugdir, repo)):
            report.append((repo, "EXISTS", "已收录,跳过"))
            continue
        lic = next((f for f in os.listdir(src) if f.upper().startswith("LICENSE")), None)
        if not lic:
            report.append((repo, "SKIP", "无 LICENSE"))
            continue
        m = meta.get(repo, {})
        gh_user = m.get("author_github", repo)
        fm = {}
        # A. 原生插件整仓
        if os.path.isfile(os.path.join(src, ".zcode-plugin", "plugin.json")):
            dst = os.path.join(plugdir, repo)
            copytree(src, dst)
            man = json.load(open(os.path.join(dst, ".zcode-plugin", "plugin.json"), encoding="utf-8"))
            kind = "A-原生整仓"
        # B. skills/ 目录型
        elif os.path.isdir(os.path.join(src, "skills")):
            dst = os.path.join(plugdir, repo)
            copytree(os.path.join(src, "skills"), os.path.join(dst, "skills"))
            sk = next((d for d in sorted(os.listdir(os.path.join(dst, "skills")))
                       if os.path.isfile(os.path.join(dst, "skills", d, "SKILL.md"))), repo)
            fm = frontmatter(os.path.join(dst, "skills", sk, "SKILL.md"))
            kind = "B-skills目录"
            man = None
        # C. 单 SKILL.md
        elif os.path.isfile(os.path.join(src, "SKILL.md")):
            dst = os.path.join(plugdir, repo)
            copytree(src, dst)
            for junk in ("LICENSE", "LICENSE.md"):
                p = os.path.join(dst, junk)
                if os.path.isfile(p):
                    shutil.move(p, os.path.join(dst, "LICENSE"))
            sk = repo
            os.makedirs(os.path.join(dst, "skills"), exist_ok=True)
            inner = os.path.join(dst, "skills", sk)
            os.makedirs(inner, exist_ok=True)
            for f in os.listdir(dst):
                if f not in ("skills", ".zcode-plugin", ".claude-plugin") and not f.startswith("."):
                    shutil.move(os.path.join(dst, f), os.path.join(inner, f))
            fm = frontmatter(os.path.join(inner, "SKILL.md"))
            kind = "C-单技能"
            man = None
        else:
            report.append((repo, "SKIP", "无 plugin.json/skills/SKILL.md,人工判"))
            continue
        # manifest 补齐/新建
        mp = os.path.join(dst, ".zcode-plugin", "plugin.json")
        if man is None:
            name = fm.get("name", repo)
            man = {"name": name, "version": "0.1.0",
                   "description": fm.get("description", repo)[:400],
                   "author": {"name": gh_user, "url": f"https://github.com/{gh_user}"},
                   "license": "MIT", "keywords": m.get("keywords", [])}
        else:
            man.setdefault("author", {})
            man["author"] = {"name": gh_user, "url": f"https://github.com/{gh_user}"}
            man.setdefault("license", "MIT")
        desc = man.get("description", "")
        man["description_i18n"] = {"en": desc,
                                   "zh-CN": m.get("display_zh") or (desc if re.search(r"[\u4e00-\u9fff]", desc) else desc)}
        os.makedirs(os.path.dirname(mp), exist_ok=True)
        json.dump(man, open(mp, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        os.makedirs(os.path.join(dst, ".claude-plugin"), exist_ok=True)
        shutil.copy(mp, os.path.join(dst, ".claude-plugin", "plugin.json"))
        report.append((repo, "PACKED", f"{kind} name={man['name']} v{man.get('version')}(zh={'有' if m.get('display_zh') else '沿上游'})"))
    for repo, st, note in report:
        print(f"[{st}] {repo} — {note}")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3])
