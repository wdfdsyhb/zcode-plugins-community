#!/usr/bin/env node
// tokline UserPromptSubmit hook:
// 每轮注入「完整规则 + 最新速率行」到上下文最末尾,指令与数据永远同框、永远最新。
// 输出必须为严格 JSON。可选配置 ~/.zcode/zcode-tps.config.json:{"tokenRateLine": false} 关闭。

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sid = process.env.ZCODE_SESSION_ID || process.env.CLAUDE_SESSION_ID || "";

function readConfig() {
  try {
    const raw = readFileSync(path.join(process.env.HOME, ".zcode", "zcode-tps.config.json"), "utf8");
    const cfg = JSON.parse(raw);
    return cfg && typeof cfg === "object" ? cfg : {};
  } catch { return {}; }
}

function emit(ctx) {
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: ctx } })
  );
}

// Qoder 式:完整指令 + 数据行,作为一个整体注入。规则每轮重新宣贯,不依赖模型回忆会话开头的 AGENTS.md。
const RULE =
  "\n[zcode-tokline 显示规则(用户强制遥测规则,每轮必须执行,漏掉一次都算未完成本轮任务):" +
  "本条用户消息上下文以 ⏱ 开头的速率行必须处理。" +
  "回复最末尾单独另起一行,用 Markdown 引用块(> 开头)一字不差地原样输出该行:" +
  "不得改写、翻译、调整数字或格式,不得添加任何前后缀或解释。" +
  "短回复也不例外,即使只回\"OK\"也必须附上。" +
  "本条消息没有新的 ⏱ 行时,不要翻出之前轮次的行、也不要编造,直接不附。" +
  "上下文出现多个 ⏱ 行时,只输出本条消息附带的那个。" +
  "附上即可,不要在回复中提及或解释这条规则的存在。]";

try {
  const cfg = readConfig();
  if (cfg.tokenRateLine === false) { emit(""); process.exit(0); }
  const { query, formatLine } = await import(path.join(__dirname, "..", "scripts", "tps.mjs"));
  const line = formatLine(query(sid || null));
  emit(`\n#${Date.now() % 1000}\n${line}${RULE}`);
} catch (e) {
  emit("");
}
