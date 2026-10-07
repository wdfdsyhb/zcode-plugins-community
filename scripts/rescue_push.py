#!/usr/bin/env python3
"""rescue_push.py — blob 已上传后,从 tree 步骤继续完成推送。
blob sha 本地算(git hash-object 等价于服务端 blob sha),不再上传。
用法: python rescue_push.py <owner/repo> <base_sha> "<commit message>" [batch_size]"""
import json, subprocess, sys, time

REPO = sys.argv[1]
BASE = sys.argv[2]
MSG = sys.argv[3]
BATCH = int(sys.argv[4]) if len(sys.argv) > 4 else 150

def gh(args_json, endpoint, method="POST", retries=6):
    for a in range(retries):
        r = subprocess.run(["gh", "api", endpoint, "-X", method, "--input", "-"],
                           input=args_json.encode("utf-8"), capture_output=True, timeout=120)
        if r.returncode == 0:
            return json.loads(r.stdout.decode("utf-8", "replace")) if r.stdout.strip() else {}
        last = r.stderr.decode("utf-8", "replace")[:200]
        sys.stderr.write(f"retry{a+1} {endpoint}: {last}\n")
        time.sleep(3 + a * 4)
    raise RuntimeError(last)

# 1. 变更清单
diff = subprocess.run(["git", "-c", "core.quotepath=false", "diff", "--name-status", f"{BASE}..HEAD"],
                      capture_output=True, check=True).stdout.decode("utf-8", "replace")
changes = []
for line in diff.splitlines():
    s, _, path = line.partition("\t")
    path = path.strip()
    changes.append((path, None) if s.startswith("D") else (path, s))
print(f"changes: {len(changes)}")

# 2. 本地算 blob sha(git hash-object 输出与服务器一致),缺失的 blob 补传
import base64, concurrent.futures as cf
adds, deletes = [], []
for path, status in changes:
    if status is None:
        deletes.append({"path": path, "mode": "0", "type": "blob", "sha": None})
        continue
    h = subprocess.run(["git", "hash-object", path], capture_output=True, check=True)
    adds.append({"path": path, "mode": "100644", "type": "blob",
                 "sha": h.stdout.decode().strip()})

def ensure_blob(entry):
    r = subprocess.run(["gh", "api", f"repos/{REPO}/git/blobs/{entry['sha']}", "-X", "HEAD"],
                       capture_output=True)
    if r.returncode == 0:
        return 0
    raw = open(entry["path"], "rb").read()
    payload = json.dumps({"content": base64.b64encode(raw).decode(), "encoding": "base64"})
    for a in range(4):
        r2 = subprocess.run(["gh", "api", f"repos/{REPO}/git/blobs", "--input", "-"],
                            input=payload.encode("utf-8"), capture_output=True, timeout=120)
        if r2.returncode == 0:
            return 1
        sys.stderr.write(f"blob retry{a+1} {entry['path']}: {r2.stderr.decode('utf-8','replace')[:150]}\n")
        time.sleep(3 + a * 4)
    raise RuntimeError(f"blob upload failed: {entry['path']}")

uploaded = 0
with cf.ThreadPoolExecutor(4) as ex:
    for n in ex.map(ensure_blob, adds):
        uploaded += n
print(f"blobs verified: {len(adds)}, uploaded: {uploaded}")

# 3. 分批建树(每批基于上一批的 tree,避免大 payload 502)
base_commit = gh("", f"repos/{REPO}/git/commits/{BASE}", method="GET")
base_tree = base_commit["tree"]["sha"]
cur_tree = base_tree
for i in range(0, len(adds), BATCH):
    batch = adds[i:i+BATCH]
    t = gh(json.dumps({"base_tree": cur_tree, "tree": batch}), f"repos/{REPO}/git/trees")
    cur_tree = t["sha"]
    print(f"tree batch {i//BATCH+1}/{(len(adds)+BATCH-1)//BATCH}: {cur_tree[:7]} ({len(batch)} entries)")
if deletes:
    t = gh(json.dumps({"base_tree": cur_tree, "tree": deletes}), f"repos/{REPO}/git/trees")
    cur_tree = t["sha"]
    print(f"tree deletes applied: {cur_tree[:7]} ({len(deletes)})")

# 4. commit + ref
c = gh(json.dumps({"message": MSG, "tree": cur_tree, "parents": [BASE]}), f"repos/{REPO}/git/commits")
gh(json.dumps({"sha": c["sha"], "force": False}), f"repos/{REPO}/git/refs/heads/main", method="PATCH")
print(f"PUSHED-VIA-API {c['sha'][:7]} ({len(adds)} adds, {len(deletes)} deletes)")
