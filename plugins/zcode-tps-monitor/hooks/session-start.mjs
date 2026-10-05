#!/usr/bin/env node
// SessionStart hook:
// 1) 记录"用户最后所处的会话"到状态文件(供数据服务锁定当前会话)
// 2) 注入一行使用提示(严格 JSON 输出)

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RATE_SCRIPT = path.join(HERE, "..", "scripts", "token-rate.mjs");

const sid = process.env.ZCODE_SESSION_ID || process.env.CLAUDE_SESSION_ID || "";
if (sid) {
  try {
    const file = path.join(os.homedir(), ".zcode", "tps-monitor.last-session.json");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const now = Date.now();
    fs.writeFileSync(
      file,
      JSON.stringify({ sessionId: sid, ts: now, promptTs: now, source: "session-start" })
    );
  } catch {}
}

// 与 prompt-submit 的「本问统计」机制保持一致:先自测、再写正文,统计行与正文同条。
// 关键是防折叠:客户端把带工具调用的消息折叠进「模型轨迹」区,若模型写完正文后
// 补跑脚本、让统计行单独成条,用户就只能看到一行统计(正文被收起)。
const hint = [
  `[zcode-tps-monitor] 已就绪。每条回复收尾时(若该回复调用过工具):先运行 node "${RATE_SCRIPT}" --turn --current,再输出完整回复正文,并把输出的一行原样放入 Markdown 引用块附在这条回复的最末尾;脚本没有输出(如纯问答)则不显示任何统计行。`,
  "统计行必须与回复正文同处最后一条消息:绝不能在正文写完后再补调用工具,也不能让统计行单独成条(客户端会折叠带工具的消息,用户将只看到一行统计)。",
  "上下文里【内部背景·勿展示】的历史速率行仅供了解背景,绝不展示给用户。",
  "命令:/tps(快照)、/tps-doctor(自检)。大屏:node dashboard/server.mjs(http://127.0.0.1:7423);关闭注入:~/.zcode/tps-monitor.config.json → {\"tokenRateLine\":false}。",
].join("");

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: hint,
    },
  })
);
