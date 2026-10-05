#!/usr/bin/env node
// UserPromptSubmit hook: 每次用户发消息时
// 1) 记录"用户最后所处的会话"与提问时间戳到状态文件(--current 守卫依赖该时间戳)
// 2) 注入上一轮速率作为模型上下文,并下达"本问统计"指令:
//    模型在回答收尾时运行 token-rate.mjs --turn --current,把输出的"本问"速率行
//    原样引用在回复末尾。--current 保证绝不把上一轮数据冒充本问(纯问答轮无输出)。
// 输出必须为严格 JSON。
// 可选配置 ~/.zcode/tps-monitor.config.json:
//   {"tokenRateLine": false} 关闭全部速率注入。

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query, formatLine } from "../scripts/token-rate.mjs";

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
      // promptTs:本次提问时刻,--current 守卫的唯一依据;Stop 钩子触发时会保留它而非覆盖
      JSON.stringify({ sessionId: sid, ts: now, promptTs: now, source: "prompt-submit" })
    );
  } catch {}
}

// 本问统计指令:模型在写最终回复之前自测当前提问的速率,统计行与回复正文同处最后一条消息。
// 防折叠约束(2026-09 实测):客户端把带工具调用的消息折叠进「模型轨迹」区,只有轮次
// 最后一条纯文字消息默认展开——若模型先写完正文再补跑脚本、让统计行单独成条,
// 用户就只能看到一行统计(正文全被收起)。故指令严格规定顺序并给出降级规则。
const TURN_STATS_INSTRUCTION = [
  "",
  "【本轮统计指令】若你在本次回答中已经调用过工具,请严格按以下顺序收尾:",
  `1. 在开始写最终回复正文之前,运行一次:node "${RATE_SCRIPT}" --turn --current`,
  "2. 然后输出完整的最终回复正文(用户需要的全部内容),并把脚本输出的那一行原样放入 Markdown 引用块(新行行首加「> 」)附在这条回复的最末尾;不要改写数字、不要追加任何其他内容。",
  "关键约束:统计行必须与完整回复正文在同一条消息里。绝不能让统计行(或只含统计行的短消息)单独成为你最后一条消息,也绝不能在写完全部回复正文之后再调用任何工具——客户端会折叠之前带工具调用的消息,用户将只能看到一行统计。",
  "降级规则:若你已经写完回复正文才发现没运行统计脚本,就直接省略统计行结束回答,不要事后补调用工具。",
  "注意:①上面【内部背景·勿展示】行是上一条提问的历史数据,仅供你了解背景,绝不展示给用户;②若脚本没有输出任何统计行,或本次回答你没有调用过任何工具,则不要显示任何统计行、也不要为此额外调用工具。",
].join("\n");

function readConfig() {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(os.homedir(), ".zcode", "tps-monitor.config.json"), "utf8")
    );
  } catch {
    return {};
  }
}

function emit(ctx) {
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: ctx } })
  );
}

try {
  const cfg = readConfig();
  if (cfg.tokenRateLine === false) {
    emit("");
  } else {
    // 上一轮行仅作模型上下文(加【内部背景·勿展示】前缀,明确禁止展示);本问统计由模型收尾时按指令自测
    emit("【内部背景·勿展示】上一条回复:" + formatLine(query(sid || null)) + TURN_STATS_INSTRUCTION);
  }
} catch {
  emit("");
}
