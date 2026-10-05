#!/usr/bin/env python3
"""gh-api-push.py — git push 不可用时的兜底:通过 gh api 手动推送本地 HEAD 到远端分支。
用法: python gh-api-push.py <owner/repo> <remote_base_sha> "<commit message>"
把本地 HEAD 与 remote_base_sha 的差异以单个远端 commit 的形式推上 main。"""
import base64, json, subprocess, sys, concurrent.futures as cf

REPO = sys.argv[1]
BASE = sys.argv[2]
MSG = sys.argv[3]

def gh(*args, stdin=None, timeout=60, retries=3):
    last = None
    for attempt in range(retries):
        r = subprocess.run(["gh", "api", *args, *(["--input", "-"] if stdin else [])],
                           input=stdin.encode("utf-8") if stdin else None,
                           capture_output=True, timeout=timeout)
        if r.returncode == 0:
            return json.loads(r.stdout.decode("utf-8", "replace")) if r.stdout.strip() else {}
        last = r.stderr.decode("utf-8", "replace")[:300]
        if "404" in last or "abuse" in last.lower() or "502" in last or "503" in last:
            import time; time.sleep(2 + attempt * 3)
            continue
        break
    sys.stderr.write(f"FAIL on {' '.join(args[:2])} (input {len(stdin) if stdin else 0}B)\n")
    raise RuntimeError(last)

# 1. 变更文件清单(name-status 相对远端基线)
diff = subprocess.run(["git", "diff", "--name-status", f"{BASE}..HEAD"],
                      capture_output=True, check=True).stdout.decode("utf-8", "replace")
changes = []
for line in diff.splitlines():
    s, _, path = line.partition("\t")
    path = path.strip()
    if s.startswith("D"):
        changes.append((path, None))
    else:
        changes.append((path, s))

# 2. 上传 blobs(并发)
def upload(item):
    path, status = item
    if status is None:
        return {"path": path, "mode": "100644", "type": "blob", "sha": None}
    raw = subprocess.run(["git", "show", f"HEAD:{path}"], capture_output=True, check=True).stdout
    b = gh(f"repos/{REPO}/git/blobs", stdin=json.dumps(
        {"content": base64.b64encode(raw).decode(), "encoding": "base64"}))
    return {"path": path, "mode": "100644", "type": "blob", "sha": b["sha"]}

with cf.ThreadPoolExecutor(2) as ex:
    tree_entries = list(ex.map(upload, changes))

# 3. 基树 + 新树(删除项用 mode 0)
base_commit = gh(f"repos/{REPO}/git/commits/{BASE}")
deletes = [{"path": t["path"], "mode": "0", "type": "blob"} for t in tree_entries if t["sha"] is None]
adds = [t for t in tree_entries if t["sha"] is not None]
new_tree = gh(f"repos/{REPO}/git/trees", stdin=json.dumps(
    {"base_tree": base_commit["tree"]["sha"], "tree": adds + deletes}))

# 4. commit + ref
c = gh(f"repos/{REPO}/git/commits", stdin=json.dumps(
    {"message": MSG, "tree": new_tree["sha"], "parents": [BASE]}))
gh(f"repos/{REPO}/git/refs/heads/main", "-X", "PATCH", stdin=json.dumps({"sha": c["sha"], "force": False}))
print(f"PUSHED-VIA-API {c['sha'][:7]} ({len(adds)} adds, {len(deletes)} deletes)")
