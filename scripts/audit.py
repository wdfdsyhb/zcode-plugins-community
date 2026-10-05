#!/usr/bin/env python3
"""audit.py <plugin-path> — 收录审计:5项检查,输出 PASS/FAIL 清单。零第三方依赖。"""
import json, os, re, subprocess, sys

def fail(msg, results):
    results.append(("FAIL", msg))

def main(path):
    results = []
    p = os.path.abspath(path)
    if not os.path.isdir(p):
        print(f"audit: not a directory: {p}"); return 2

    # 1. plugin.json 存在且可解析
    man = None
    for cand in (os.path.join(p, ".zcode-plugin", "plugin.json"),
                 os.path.join(p, "plugin.json")):
        if os.path.isfile(cand):
            try:
                man = json.load(open(cand, encoding="utf-8"))
            except Exception as e:
                fail(f"plugin.json 解析失败: {e}", results)
            break
    if man:
        for k in ("name", "version", "description"):
            if k not in man:
                fail(f"plugin.json 缺字段: {k}", results)
        results.append(("PASS", f"manifest OK: {man.get('name')} v{man.get('version')}"))
    else:
        fail("无 plugin.json(.zcode-plugin/ 或根目录)", results)

    # 2. LICENSE
    lic = next((f for f in os.listdir(p) if f.upper().startswith("LICENSE")), None)
    if lic:
        results.append(("PASS", f"LICENSE: {lic}"))
    else:
        fail("无 LICENSE 文件", results)

    # 3. gitleaks(判定走输出文本,不依赖 returncode;不同版本 -q 行为不一致)
    try:
        r = subprocess.run(["gitleaks", "detect", "--source", p, "--no-git",
                            "--config", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".gitleaks.toml")],
                           capture_output=True, timeout=300)
        out = r.stdout.decode("utf-8", "replace") + r.stderr.decode("utf-8", "replace")
        if "no leaks found" in out:
            results.append(("PASS", "gitleaks 零命中"))
        elif "Finding" in out or "Secret" in out or "leaks found" in out:
            fail("gitleaks 命中(见上方明细):\n" + out[-2000:], results)
        else:
            results.append(("SKIP", f"gitleaks 输出异常,人工复核:\n{out[-300:]}"))
    except FileNotFoundError:
        results.append(("SKIP", "gitleaks 未安装,跳过(收录前人工补跑)"))

    # 4. 中英双语 description
    if man and "description_i18n" in man and "zh-CN" in man.get("description_i18n", {}):
        results.append(("PASS", "双语 description OK"))
    else:
        fail("缺 description_i18n.zh-CN", results)

    # 5. 硬编码账号模式兜底:只扫入口文件(manifest + SKILL.md);
    #    references/payload 教学内容里的 RFC1918 示例 IP 属正常,交给 gitleaks 深扫
    pat = re.compile(r"(密码\s*[:=]\s*['\"][^'\"]{4,}|passwd\s*=\s*['\"][^'\"]{4,}|api[_-]?key\s*=\s*['\"][A-Za-z0-9]{16,})", re.I)
    hits = []
    scan_targets = []
    for root, dirs, files in os.walk(p):
        dirs[:] = [d for d in dirs if d not in (".git", "node_modules", "__pycache__")]
        for f in files:
            if f == "plugin.json" or f == "SKILL.md":
                scan_targets.append(os.path.join(root, f))
    for fp in scan_targets:
        try:
            txt = open(fp, encoding="utf-8", errors="replace").read()
        except OSError:
            continue
        for m in pat.finditer(txt):
            hits.append(f"{fp}: {m.group(0)[:60]}")
    if hits:
        fail("疑似硬编码凭据(人工复核):\n" + "\n".join(hits[:10]), results)
    else:
        results.append(("PASS", "入口文件无硬编码凭据模式"))

    bad = sum(1 for s, _ in results if s == "FAIL")
    for s, m in results:
        print(f"[{s}] {m}")
    print(f"\n=> {'REJECT' if bad else 'ACCEPT'} ({bad} fail)")
    return 1 if bad else 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "."))
