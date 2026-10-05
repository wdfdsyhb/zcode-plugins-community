#!/usr/bin/env node
// Stop hook:客户端在回复流结束/中断时触发(2026-10 起实测会触发,且时机不定——
// 曾观察到用户轮次进行中触发,而非仅在轮次结束时)。
// 职责:
// 1) 维护状态文件的 sessionId 跟随,但**绝不覆盖 promptTs**——那是「本问统计」
//    --current 守卫的依据(0.8.4 及之前每次触发都会把提问时刻改写成当前时刻,
//    导致守卫误判"本问无数据"、统计行消失)。
// 2) 可选直显(实验):配置 {"stopHookLine": true} 时经 systemMessage 显示本轮统计,
//    每个轮次最多显示一次。默认关闭——触发时机不定,避免过早/重复显示。
// 输出严格 JSON;任何异常静默退出,不影响对话。

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { queryTurn, formatTurnLine } from "../scripts/token-rate.mjs";

const STATE_FILE =
  process.env.TPS_MONITOR_STATE_FILE ||
  path.join(os.homedir(), ".zcode", "tps-monitor.last-session.json");

// stdin 是钩子入参 JSON(含 session_id);设超时兜底,客户端不给 stdin 也不挂起
function readStdin() {
  return new Promise((resolve) => {
    let raw = "";
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        resolve(raw);
      }
    };
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (raw += c));
    process.stdin.on("end", finish);
    setTimeout(finish, 1500);
  });
}

function readConfig() {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(os.homedir(), ".zcode", "tps-monitor.config.json"), "utf8")
    );
  } catch {
    return {};
  }
}

function readStateFile() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) || {};
  } catch {
    return {};
  }
}

// 写状态文件:sessionId/ts 跟随本次触发;promptTs 仅当同会话已有可信值时保留
// (来源须是 prompt-submit/session-start;缺失时以当前时刻兜底,下一条消息即自愈)
function writeState(fields) {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(fields));
  } catch {}
}

function noteSession(sid) {
  if (!sid) return;
  const prev = readStateFile();
  const same = prev.sessionId === sid;
  let promptTs = Date.now();
  if (same && Number.isFinite(prev.promptTs)) promptTs = prev.promptTs;
  else if (same && Number.isFinite(prev.ts) && prev.source === "prompt-submit") promptTs = prev.ts;
  writeState({
    ...prev,
    sessionId: sid,
    ts: Date.now(),
    promptTs,
    source: "stop",
  });
}

async function main() {
  let payload = {};
  try {
    payload = JSON.parse((await readStdin()) || "{}");
  } catch {}
  const sid =
    payload.session_id ||
    process.env.ZCODE_SESSION_ID ||
    process.env.CLAUDE_SESSION_ID ||
    "";
  noteSession(sid);

  const cfg = readConfig();
  if (cfg.tokenRateLine === false || cfg.stopHookLine !== true) return;

  // 直显(实验):触发时机不定,等待数据就绪后按 turnId 去重,每轮最多显示一次
  let r = null;
  for (let i = 0; i < 5; i++) {
    r = queryTurn(sid || null);
    if (r && r.turn && r.turn.rated > 0) break;
    if (i < 4) await new Promise((res) => setTimeout(res, 250));
  }
  if (!r || !r.turn) return; // 无本轮数据(如中断轮)则不打扰
  const prev = readStateFile();
  if (prev.lastShown && prev.lastShown.turnId === r.turnId) return; // 本轮已显示过
  writeState({ ...prev, lastShown: { turnId: r.turnId, at: Date.now() } });
  process.stdout.write(JSON.stringify({ systemMessage: formatTurnLine(r) }));
}

main()
  .catch(() => {})
  .finally(() => process.exit(0));
