#!/usr/bin/env node
// zcode-tps-lite: 从 ZCode usage 数据库(model_usage)读 token 速率,输出一行遥测。
// 只保留核心:最近轮均 tok/s + Decode 会话均 + 会话累计 + 缓存命中率。
// 只读打开 WAL 数据库,不影响运行中的 ZCode。
// 用法: node tps.mjs [--json]  (ZCODE_SESSION_ID 可选)

import { DatabaseSync } from "node:sqlite";
import os from "node:os";
import path from "node:path";

const DB_PATH = process.env.ZCODE_USAGE_DB || path.join(os.homedir(), ".zcode", "cli", "db", "db.sqlite");
const MIN_MS = 500;        // 小于此耗时的请求速率失真,不计
const MAX_MS = 3_600_000;  // 大于此耗时的请求视为异常,不计
const DECODE_MIN_MS = 200; // Decode 窗口下限

const rate = (tokens, ms) => (tokens > 0 && ms > 0 ? Math.round((tokens / ms) * 10000) / 10 : null);
const fmtK = (n) => n == null ? "-" : n >= 1_000_000 ? (n / 1_000_000).toFixed(2) + "M" : n >= 10_000 ? Math.round(n / 1000) + "k" : n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n);

function query(sid) {
  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  try {
    db.exec("PRAGMA busy_timeout = 2000");
    const sessionFilter = sid ? " AND session_id = ?" : "";
    const args = sid ? [sid] : [];
    const durSql = "COALESCE(duration_ms, completed_at - started_at)";
    const decSql = "COALESCE(time_to_first_token_ms, first_token_at - started_at)";

    // 最近一条有效主对话请求
    const latest = db
      .prepare(
        `SELECT model_id, output_tokens, input_tokens, cache_read_input_tokens, time_to_first_token_ms,
                ${durSql} dur_ms, ${durSql} - ${decSql} dec_ms
         FROM model_usage
         WHERE status = 'completed' AND query_source = 'main_turn'${sessionFilter}
           AND ${durSql} >= ? AND ${durSql} < ? AND output_tokens > 0
         ORDER BY completed_at DESC LIMIT 1`
      )
      .get(...args, MIN_MS, MAX_MS);

    // 会话累计(主对话)
    const sum = db
      .prepare(
        `SELECT COUNT(*) n, SUM(output_tokens) o, SUM(input_tokens) i,
                SUM(cache_read_input_tokens) c
         FROM model_usage
         WHERE status = 'completed' AND query_source = 'main_turn'${sessionFilter}`
      )
      .get(...args);

    // 会话均(有效请求加权)
    const aggr = db
      .prepare(
        `SELECT COUNT(*) n, SUM(output_tokens) tok, SUM(${durSql}) dur
         FROM model_usage
         WHERE status = 'completed' AND query_source = 'main_turn'${sessionFilter}
           AND ${durSql} >= ? AND ${durSql} < ? AND output_tokens > 0`
      )
      .get(...args, MIN_MS, MAX_MS);

    // Decode 会话均(纯生成,剔除首字等待)
    const decode = db
      .prepare(
        `SELECT COUNT(*) n, SUM(output_tokens) tok, SUM(${durSql} - ${decSql}) dec
         FROM model_usage
         WHERE status = 'completed' AND query_source = 'main_turn'${sessionFilter}
           AND ${durSql} >= ? AND ${durSql} < ? AND output_tokens > 0
           AND (${durSql} - ${decSql}) >= ${DECODE_MIN_MS}`
      )
      .get(...args, MIN_MS, MAX_MS);

    // 最近一轮(turn_id 聚合,整轮状态未知)
    const latestTurn = db
      .prepare(
        `SELECT turn_id FROM model_usage
         WHERE status = 'completed' AND query_source = 'main_turn'${sessionFilter}
         ORDER BY completed_at DESC LIMIT 1`
      )
      .get(...args);
    let turn = null;
    if (latestTurn?.turn_id) {
      const g = db
        .prepare(
          `SELECT COUNT(*) n, SUM(input_tokens) i, SUM(output_tokens) o,
                  SUM(cache_read_input_tokens) cr,
                  SUM(CASE WHEN ${durSql} >= ? AND ${durSql} < ? AND output_tokens > 0 THEN output_tokens ELSE 0 END) vtok,
                  SUM(CASE WHEN ${durSql} >= ? AND ${durSql} < ? AND output_tokens > 0 THEN ${durSql} ELSE 0 END) vdur
           FROM model_usage
           WHERE status = 'completed' AND query_source = 'main_turn'${sessionFilter} AND turn_id = ?`
        )
        .get(MIN_MS, MAX_MS, MIN_MS, MAX_MS, ...args, latestTurn.turn_id);
      if (g?.n) {
        turn = {
          input: g.i ?? 0, output: g.o ?? 0, cacheRead: g.cr ?? 0,
          requests: g.n, avgTps: g.vdur ? rate(g.vtok, g.vdur) : null,
          cacheHit: g.i ? Math.round(((g.cr ?? 0) / g.i) * 1000) / 10 : null,
        };
      }
    }

    const totalInput = sum.i ?? 0;
    const cacheHit = totalInput ? Math.round(((sum.c ?? 0) / totalInput) * 1000) / 10 : null;
    const sessionTps = aggr?.n && aggr.dur ? rate(aggr.tok, aggr.dur) : null;
    const decodeTps = decode?.n && decode.dec ? rate(decode.tok, decode.dec) : null;

    return {
      ok: true,
      latest: latest
        ? { model: latest.model_id, outputTokens: latest.output_tokens, inputTokens: latest.input_tokens, ttftMs: latest.time_to_first_token_ms }
        : null,
      turn,
      session: {
        requests: sum.n ?? 0,
        totalInput, totalOutput: sum.o ?? 0, totalCacheRead: sum.c ?? 0,
        total: (sum.i ?? 0) + (sum.o ?? 0),
        avgTps: sessionTps, decodeTps, cacheHit,
      },
    };
  } finally {
    db.close();
  }
}

// 速率行:首字 TTFT + 本轮(最近轮) + 轮均(会话加权)。降级链:本轮 → 轮均,保证 ⏱ 恒有值。
function formatLine(r) {
  if (!r.latest) return "暂无已完成的模型请求";
  const thisTurn = r.turn?.avgTps ?? r.session.avgTps ?? null;
  const turnAvg = r.session.avgTps ?? null;
  const parts = [];
  // 首字 TTFT 放最前:决定用户等第一句话多久
  if (r.latest.ttftMs != null) {
    parts.push(`⏱ tokline · 首字 ${(r.latest.ttftMs / 1000).toFixed(1)}s`);
  } else {
    parts.push(`⏱ tokline · 本轮 ${thisTurn ?? "-"} tok/s`);
  }
  if (thisTurn != null) {
    parts.push(`本轮 ${thisTurn} tok/s`);
  }
  // 轮均与本轮相同时不重复显示
  if (turnAvg != null && Math.abs(turnAvg - (thisTurn ?? -1)) > 0.1) {
    parts.push(`轮均 ${turnAvg} tok/s`);
  }
  return parts.join(" · ");
}

// --- CLI ---
if (process.argv[1] && process.argv[1].endsWith("tps.mjs")) {
  const sid = process.env.ZCODE_SESSION_ID || process.env.CLAUDE_SESSION_ID || null;
  try {
    const r = query(sid);
    if (process.argv.includes("--json")) {
      console.log(JSON.stringify(r, null, 2));
    } else {
      console.log(formatLine(r));
    }
  } catch (e) {
    console.error(`tps 查询失败: ${e?.message ?? e}`);
    process.exitCode = 1;
  }
}

export { query, formatLine };
