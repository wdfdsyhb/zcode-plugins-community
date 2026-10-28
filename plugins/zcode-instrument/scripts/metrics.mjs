#!/usr/bin/env node
// Reads ZCode session usage records from the local SQLite database and derives
// per-reply metrics: time to first token, output speed (tokens/s), token usage.
//
// Data source: ~/.zcode/cli/db/db.sqlite -> model_usage (one row per model
// request, written when that request finishes), session (workspace / title).
//
// Usable both as a CLI and as a library (the MCP server imports it).

import { existsSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// node:sqlite emits an ExperimentalWarning while loading; patch process.emit
// before the dynamic import below so CLI output stays clean.
const realEmit = process.emit;
process.emit = function (name, ...args) {
  if (name === 'warning' && args[0]?.name === 'ExperimentalWarning') return false;
  return realEmit.apply(this, [name, ...args]);
};
const { DatabaseSync } = await import('node:sqlite');

export const PLUGIN_VERSION = '0.6.1';

/**
 * The database records internal provider ids ("new-provider-2", "account:zai-start-plan").
 * ZCode keeps the display names in two files:
 *   - personal providers: <~/.zcode>/v2/provider_config.json  (config.providerConfigRules.providerRules)
 *   - built-in / account providers: <install>/resources/config/provider/zcode-builtin.json
 * A user-supplied override string ("id=name,id=name") wins over both.
 */
const providerRuleCache = new Map();

export function parseProviderNames(...sources) {
  const map = new Map();
  for (const source of sources) {
    if (!source) continue;
    for (const chunk of String(source).split(/[,;\n]/)) {
      const index = chunk.indexOf('=');
      if (index <= 0) continue;
      const id = chunk.slice(0, index).trim();
      const name = chunk.slice(index + 1).trim();
      if (id && name) map.set(id, name);
    }
  }
  return map;
}

export function defaultProviderConfigPaths() {
  const home = process.env.ZCODE_HOME || join(homedir(), '.zcode');
  const localAppData = process.env.LOCALAPPDATA || '';
  const candidates = [
    process.env.ZCODE_BUILTIN_PROVIDER_CONFIG,
    localAppData && join(localAppData, 'Programs', 'ZCode', 'resources', 'config', 'provider', 'zcode-builtin.json'),
    process.env.ProgramFiles && join(process.env.ProgramFiles, 'ZCode', 'resources', 'config', 'provider', 'zcode-builtin.json'),
    '/Applications/ZCode.app/Contents/Resources/config/provider/zcode-builtin.json',
    '/opt/ZCode/resources/config/provider/zcode-builtin.json',
    '/usr/lib/zcode/resources/config/provider/zcode-builtin.json',
  ].filter(Boolean);
  return {
    personal: join(home, 'v2', 'provider_config.json'),
    builtin: candidates.find((path) => existsSync(path)) || candidates[0],
  };
}

/** providerId -> providerName plus the user's provider order, from one config file. */
function readProviderConfig(filePath) {
  if (!filePath) return { names: new Map(), order: [], modelRules: [], providerModelRules: [], manualModelRules: [] };
  try {
    const stat = statSync(filePath);
    const cached = providerRuleCache.get(filePath);
    if (cached && cached.mtimeMs === stat.mtimeMs) return cached.value;

    const parsed = JSON.parse(readFileSync(filePath, 'utf8'));
    const config = parsed?.config || {};
    const names = new Map();
    for (const rule of config?.providerConfigRules?.providerRules || []) {
      const id = rule?.providerId;
      const name = rule?.providerName;
      if (typeof id === 'string' && typeof name === 'string' && name.trim()) {
        names.set(id, name.trim());
      }
    }
    const order = Array.isArray(config.providerOrder)
      ? config.providerOrder.filter((id) => typeof id === 'string')
      : [];
    // Model rules carry the context window; keep only what we need.
    const modelConfig = config?.modelConfigRules || {};
    const windowOf = (rule) => {
      const value = rule?.config?.properties?.contextWindow;
      return typeof value === 'number' && value > 0 ? value : null;
    };
    const modelRules = (modelConfig.modelRules || []).map((rule) => ({
      modelMatch: typeof rule?.modelMatch === 'string' ? rule.modelMatch : null,
      contextWindow: windowOf(rule),
    }));
    const providerModelRules = (modelConfig.providerModelRules || []).map((rule) => ({
      providerId: rule?.providerId,
      modelId: rule?.modelId,
      contextWindow: windowOf(rule),
    }));
    const manualModelRules = (modelConfig.manualProviderModelRules || []).map((rule) => ({
      providerId: rule?.providerId,
      modelId: rule?.modelId,
      contextWindow: windowOf(rule),
    }));
    const value = { names, order, modelRules, providerModelRules, manualModelRules };
    providerRuleCache.set(filePath, { mtimeMs: stat.mtimeMs, value });
    return value;
  } catch {
    return { names: new Map(), order: [], modelRules: [], providerModelRules: [], manualModelRules: [] };
  }
}

export function loadProviderNames(manual, paths = defaultProviderConfigPaths()) {
  const builtin = readProviderConfig(paths.builtin);
  const personal = readProviderConfig(paths.personal);
  const map = new Map([
    ...builtin.names,   // built-in / account providers
    ...personal.names,  // providers the user added
    ...parseProviderNames(process.env.INSTRUMENT_PROVIDER_NAMES, manual), // explicit override
  ]);
  return map;
}

/** The user's provider order (personal config), used to sort provider rows like the app does. */
export function loadProviderOrder(paths = defaultProviderConfigPaths()) {
  const personal = readProviderConfig(paths.personal);
  return personal.order.length ? personal.order : readProviderConfig(paths.builtin).order;
}

/** Display name for a provider id, falling back to the raw id. */
function providerLabel(map, providerId) {
  if (!providerId) return null;
  return (map && map.get(providerId)) || providerId;
}

export function defaultDbPath() {
  const home = process.env.ZCODE_HOME || join(homedir(), '.zcode');
  return join(home, 'cli', 'db', 'db.sqlite');
}

export function openDb(dbPath = defaultDbPath()) {
  if (!existsSync(dbPath)) {
    throw new Error(`找不到 ZCode 用量数据库：${dbPath}`);
  }
  // readOnly keeps the desktop app's WAL database safe to read while it runs.
  return new DatabaseSync(dbPath, { readOnly: true });
}

/** Pick the session to report on: explicit id -> env id -> cwd match -> newest. */
export function resolveSession(db, { sessionId, cwd } = {}) {
  const wanted = sessionId && sessionId !== 'latest' ? sessionId
    : process.env.CLAUDE_SESSION_ID || process.env.ZCODE_SESSION_ID || null;

  if (wanted) {
    const row = db.prepare(
      'select id, title, directory, time_updated from session where id = ?'
    ).get(wanted);
    if (row) return row;
  }

  const dir = normalizeDir(cwd || process.cwd());
  if (dir) {
    const rows = db.prepare(
      'select id, title, directory, time_updated from session order by time_updated desc limit 200'
    ).all();
    const hit = rows.find((r) => normalizeDir(r.directory) === dir);
    if (hit) return hit;
  }

  const newest = db.prepare(
    'select id, title, directory, time_updated from session order by time_updated desc limit 1'
  ).get();
  if (!newest) throw new Error('数据库里还没有任何会话记录。');
  return newest;
}

function normalizeDir(dir) {
  if (!dir) return null;
  return String(dir).replace(/[\\/]+$/, '').replace(/\//g, '\\').toLowerCase();
}

const REQUEST_COLUMNS = `
  id, logical_request_id, attempt_index, turn_id, query_source, provider_id, model_id,
  variant, agent, mode, status, started_at, first_token_at, completed_at, duration_ms,
  time_to_first_token_ms, finish_reason, tool_call_count, input_tokens, output_tokens,
  reasoning_tokens, cache_creation_input_tokens, cache_read_input_tokens,
  provider_total_tokens, computed_total_tokens, retry_count, error_type, error_code,
  error_message, assistant_message_id, parent_user_message_id
`;

function listRequests(db, sessionId, { turnId = null, querySource = 'main_turn', limit = null } = {}) {
  const clauses = ['session_id = ?'];
  const args = [sessionId];
  if (turnId) { clauses.push('turn_id = ?'); args.push(turnId); }
  if (querySource) { clauses.push('query_source = ?'); args.push(querySource); }
  let sql = `select ${REQUEST_COLUMNS} from model_usage where ${clauses.join(' and ')}
             order by started_at desc`;
  if (limit) { sql += ' limit ?'; args.push(limit); }
  const rows = db.prepare(sql).all(...args);
  return rows.reverse().map(withDerived);
}

function withDerived(row) {
  const ttftMs = row.time_to_first_token_ms
    ?? (row.first_token_at && row.started_at ? row.first_token_at - row.started_at : null);
  const streamMs = row.first_token_at && row.completed_at ? row.completed_at - row.first_token_at : null;
  // Same definition the desktop's own token debug panel uses:
  // output tokens ÷ seconds from the first output token to request completion.
  const tps = streamMs && streamMs > 0 && row.output_tokens > 0
    ? row.output_tokens / (streamMs / 1000)
    : null;
  return { ...row, ttftMs, streamMs, tps };
}

function aggregate(rows) {
  const acc = {
    requestCount: rows.length,
    toolCallCount: 0,
    retryCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    totalTokens: 0,
    sumDurationMs: 0,
    streamMs: 0,
    startedAt: null,
    completedAt: null,
  };
  for (const r of rows) {
    acc.toolCallCount += r.tool_call_count || 0;
    acc.retryCount += r.retry_count || 0;
    acc.inputTokens += r.input_tokens || 0;
    acc.outputTokens += r.output_tokens || 0;
    acc.reasoningTokens += r.reasoning_tokens || 0;
    acc.cacheReadTokens += r.cache_read_input_tokens || 0;
    acc.cacheWriteTokens += r.cache_creation_input_tokens || 0;
    acc.totalTokens += r.computed_total_tokens ?? ((r.input_tokens || 0) + (r.output_tokens || 0));
    acc.sumDurationMs += r.duration_ms || 0;
    acc.streamMs += r.streamMs || 0;
    if (r.started_at && (acc.startedAt === null || r.started_at < acc.startedAt)) acc.startedAt = r.started_at;
    if (r.completed_at && (acc.completedAt === null || r.completed_at > acc.completedAt)) acc.completedAt = r.completed_at;
  }
  // Time to first token is only meaningful for the first request of a scope:
  // that is the delay the user actually waited through. A retried first request
  // may have reported its own first token before failing, so completed requests
  // win over failed ones.
  const first = rows.find((r) => r.status === 'completed' && r.ttftMs != null)
    || rows.find((r) => r.ttftMs != null)
    || rows[0];
  acc.ttftMs = first ? first.ttftMs : null;
  // Average over every request that reported a first token — the tiles use this
  // so a many-request turn is not represented by its first request alone.
  const tracked = rows.filter((r) => r.ttftMs != null);
  acc.ttftCount = tracked.length;
  acc.avgTtftMs = tracked.length
    ? tracked.reduce((sum, r) => sum + r.ttftMs, 0) / tracked.length
    : null;
  acc.untrackedCount = rows.length - tracked.length;
  acc.tps = acc.streamMs > 0 ? acc.outputTokens / (acc.streamMs / 1000) : null;
  acc.wallMs = acc.startedAt && acc.completedAt ? acc.completedAt - acc.startedAt : null;
  acc.hitRate = acc.inputTokens > 0 ? acc.cacheReadTokens / acc.inputTokens : null;
  return acc;
}

/** Everything the reports need, in one object. */
export function collectMetrics(db, {
  sessionId, cwd, limit = 5, extras = true, modelScope = 'session', providerNames, contextWindows,
} = {}) {
  const session = resolveSession(db, { sessionId, cwd });
  const names = loadProviderNames(providerNames);
  const providerOrder = loadProviderOrder();

  const mainRequests = listRequests(db, session.id, { querySource: 'main_turn' });
  mainRequests.reverse(); // newest first
  for (const request of mainRequests) {
    request.providerName = providerLabel(names, request.provider_id);
  }

  const byTurn = new Map();
  for (const r of mainRequests) {
    const key = r.turn_id || '(untagged)';
    if (!byTurn.has(key)) byTurn.set(key, []);
    byTurn.get(key).push(r);
  }

  // Tool rows belong to the turn they ran in: they give both the totals and the
  // intervals needed to split a turn's wall clock into phases.
  const toolsByTurn = new Map();
  for (const row of db.prepare(
    `select turn_id, tool_name, status, started_at, completed_at, duration_ms
     from tool_usage where session_id = ? order by started_at`
  ).all(session.id)) {
    if (!toolsByTurn.has(row.turn_id)) toolsByTurn.set(row.turn_id, []);
    toolsByTurn.get(row.turn_id).push(row);
  }
  // turn_usage is written when a turn ends; it carries the host-side start, so
  // the preparation time before the first request is visible.
  const turnRows = new Map();
  for (const row of db.prepare(
    `select turn_id, started_at, first_model_start_at, status from turn_usage where session_id = ?`
  ).all(session.id)) {
    turnRows.set(row.turn_id, row);
  }
  const now = Date.now();

  const turns = [...byTurn.entries()].map(([turnId, rows]) => {
    const ordered = [...rows].sort((a, b) => a.started_at - b.started_at);
    const last = ordered[ordered.length - 1];
    // The reply the user reads is the turn's closing text answer; fall back to
    // the newest request when a turn ended on tool calls (aborted, still running).
    const closing = [...ordered].reverse().find((r) => r.finish_reason === 'stop') || last;
    const tools = toolsByTurn.get(turnId) || [];
    return {
      turnId,
      startedAt: ordered[0].started_at,
      completedAt: last.completed_at,
      requests: ordered,
      totals: aggregate(ordered),
      reply: closing,
      toolCount: tools.length,
      toolMs: tools.reduce((sum, tool) => sum + (tool.duration_ms || 0), 0),
      modelMs: ordered.reduce((sum, r) => sum + (r.duration_ms || 0), 0),
      phases: computePhases(ordered, tools, turnRows.get(turnId), now),
    };
  }).sort((a, b) => (b.completedAt || b.startedAt) - (a.completedAt || a.startedAt));

  const sessionRows = db.prepare(
    `select ${REQUEST_COLUMNS} from model_usage where session_id = ? order by started_at asc`
  ).all(session.id).map(withDerived);

  // Session-level composition over ACTIVE time: sum of each turn's wall clock,
  // so days of idle between turns do not turn "其他" into a meaningless number.
  const sessionPhases = turns.reduce((acc, turn) => {
    const p = turn.phases;
    if (!p) return acc;
    acc.prepMs += p.prepMs;
    acc.ttftMs += p.ttftMs;
    acc.genMs += p.genMs;
    acc.toolMs += p.toolMs;
    acc.gapMs += p.gapMs + p.prepMs; // prep belongs to the "other" slice
    acc.totalMs += p.totalMs;
    acc.requestCount += p.requestCount;
    acc.untrackedRequests += p.untrackedRequests;
    acc.toolCalls += turn.toolCount || 0;
    return acc;
  }, {
    prepMs: 0, ttftMs: 0, genMs: 0, toolMs: 0, gapMs: 0, totalMs: 0,
    requestCount: 0, untrackedRequests: 0, toolCalls: 0,
  });
  sessionPhases.modelRequests = sessionPhases.requestCount;

  const result = {
    session: {
      id: session.id,
      title: session.title,
      directory: session.directory,
      updatedAt: session.time_updated,
    },
    generatedAt: Date.now(),
    latest: turns[0] || null,
    turns: turns.slice(0, limit),
    sessionTotals: aggregate(sessionRows),
  };

  if (extras) {
    addPreviews(db, result.turns);
    const reply = result.latest?.reply;
    if (reply) {
      const context = resolveContextWindow(reply.provider_id, reply.model_id, contextWindows);
      result.context = {
        providerId: reply.provider_id,
        modelId: reply.model_id,
        inputTokens: reply.input_tokens,
        window: context.window,
        source: context.source,
        ratio: context.window ? reply.input_tokens / context.window : null,
      };
    }
    Object.assign(result, {
      modelScope,
      providerNames: Object.fromEntries(names),
      tools: toolRollup(db, session.id),
      models: modelRollup(db, session, modelScope, 12, names, providerOrder),
      failures: failureStats(db, session.id),
      timeSplit: sessionPhases,
      health: healthRollup(db, session.id),
    });
  }
  return result;
}

/** User prompt + reply text per turn, so a list of replies is readable. */
function addPreviews(db, turns) {
  const textOf = db.prepare(
    `select json_extract(data, '$.text') as text from part
     where message_id = ? and json_extract(data, '$.type') = 'text'
     order by rowid`
  );
  const join = (parts) => parts.map((p) => p.text || '').join(' ').replace(/\s+/g, ' ').trim();
  const shorten = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
  const textOfMessage = (messageId) => (messageId ? join(textOf.all(messageId)) : '');

  for (const turn of turns) {
    // The turn's closing request may be a tool call with no text of its own;
    // walk back until a request actually produced readable text.
    const newestFirst = [...turn.requests].sort((a, b) => b.started_at - a.started_at);
    const closingFirst = turn.reply
      ? [turn.reply, ...newestFirst.filter((r) => r !== turn.reply)]
      : newestFirst;

    let replyText = '';
    let questionId = turn.reply?.parent_user_message_id;
    for (const request of closingFirst) {
      if (!replyText) replyText = textOfMessage(request.assistant_message_id);
      if (!questionId) questionId = request.parent_user_message_id;
      if (replyText) break;
    }
    let question = textOfMessage(questionId);
    if (!question) {
      for (const request of newestFirst) {
        question = textOfMessage(request.parent_user_message_id);
        if (question) break;
      }
    }
    turn.replyPreview = shorten(replyText, 220);
    turn.userPreview = shorten(question, 160);
  }
}

/* ------------------------------------------------------- turn time breakdown */

function mergeIntervals(intervals) {
  const sorted = intervals
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start);
  const out = [];
  for (const item of sorted) {
    const last = out[out.length - 1];
    if (last && item.start <= last.end) last.end = Math.max(last.end, item.end);
    else out.push({ start: item.start, end: item.end });
  }
  return out;
}

const sumIntervals = (intervals) => intervals.reduce((sum, i) => sum + (i.end - i.start), 0);

function overlapLength(a, b) {
  let total = 0;
  for (const left of a) {
    for (const right of b) {
      const start = Math.max(left.start, right.start);
      const end = Math.min(left.end, right.end);
      if (end > start) total += end - start;
    }
  }
  return total;
}

/**
 * Where a turn's wall-clock time went. A turn is a chain of model requests and
 * tool runs; the user-visible "工作中 N 秒" is this whole chain. Splitting it
 * shows whether the wait is the provider (首字), the generation, the tools, or
 * idle gaps.
 *
 * Categories are attributed without double counting: model time wins over tool
 * time on overlap, and whatever no event covers is a gap (host processing,
 * permission waits, user input).
 */
export function computePhases(requests, tools, turnRow, now = Date.now()) {
  const modelIv = [];
  let ttftMs = 0;
  let untrackedRequests = 0;
  for (const request of requests) {
    const start = request.started_at;
    const end = request.completed_at ?? start + (request.duration_ms || 0);
    if (!start || end <= start) continue;
    modelIv.push({ start, end });
    if (request.first_token_at && request.first_token_at > start) {
      ttftMs += Math.min(request.first_token_at, end) - start;
    } else {
      // No first-token timestamp: the whole request is counted as generation,
      // so the reported "waiting for first token" is a lower bound.
      untrackedRequests += 1;
    }
  }
  const toolIv = [];
  for (const tool of tools) {
    const start = tool.started_at;
    const end = tool.completed_at ?? start + (tool.duration_ms || 0);
    if (!start || end <= start) continue;
    toolIv.push({ start, end });
  }
  if (!modelIv.length && !toolIv.length) return null;

  const mergedModel = mergeIntervals(modelIv);
  const mergedTool = mergeIntervals(toolIv);
  const modelMs = sumIntervals(mergedModel);
  const toolOnlyMs = sumIntervals(mergedTool) - overlapLength(mergedModel, mergedTool);

  const firstEvent = Math.min(...[...modelIv, ...toolIv].map((i) => i.start));
  const lastEvent = Math.max(...[...modelIv, ...toolIv].map((i) => i.end));
  const turnStart = turnRow?.started_at && turnRow.started_at <= firstEvent
    ? turnRow.started_at
    : firstEvent;
  const totalMs = lastEvent - turnStart;
  const prepMs = Math.max(0, firstEvent - turnStart);
  const busyMs = sumIntervals(mergeIntervals([...modelIv, ...toolIv]));
  const gapMs = Math.max(0, totalMs - prepMs - busyMs);

  const phases = {
    prepMs,
    ttftMs: Math.min(ttftMs, modelMs),
    genMs: Math.max(0, modelMs - Math.min(ttftMs, modelMs)),
    toolMs: Math.max(0, toolOnlyMs),
    gapMs,
    totalMs,
    requestCount: modelIv.length,
    untrackedRequests,
    // every category is a slice of the same wall clock, so they add up
    sumsToTotal: Math.abs((prepMs + modelMs + toolOnlyMs + gapMs) - totalMs) < 5,
  };

  // Is this turn still running? A turn ending on tool calls must be followed by
  // another request, so the silence after it means "waiting for the model".
  const running = tools.find((tool) => tool.status === 'running');
  const lastRequest = requests[requests.length - 1];
  if (running) {
    phases.live = {
      phase: 'tool',
      name: running.tool_name,
      elapsedMs: Math.max(0, now - running.started_at),
      since: running.started_at,
    };
  } else if (lastRequest && lastRequest.finish_reason === 'tool-calls'
    && ['completed', 'running'].includes(lastRequest.status)) {
    phases.live = {
      phase: 'model',
      name: null,
      elapsedMs: Math.max(0, now - lastEvent),
      since: lastEvent,
    };
  } else {
    phases.live = null;
  }
  return phases;
}

/** Per-turn request outcomes, for a health/retry trend. */
export function healthRollup(db, sessionId, limit = 20) {
  const rows = db.prepare(
    `select turn_id,
            max(started_at) last_at,
            count(*) requests,
            sum(case when status = 'completed' then 1 else 0 end) ok,
            sum(case when status = 'error' then 1 else 0 end) failed,
            sum(case when status = 'cancelled' then 1 else 0 end) cancelled,
            sum(retry_count) retries
     from model_usage
     where session_id = ? and query_source = 'main_turn'
     group by turn_id order by last_at desc limit ?`
  ).all(sessionId, limit);
  const toolErrors = new Map();
  for (const row of db.prepare(
    `select turn_id, count(*) n from tool_usage
     where session_id = ? and status = 'error' group by turn_id`
  ).all(sessionId)) {
    toolErrors.set(row.turn_id, row.n);
  }
  const turns = rows.map((row) => ({
    completedAt: row.last_at,
    requests: row.requests,
    ok: row.ok,
    failed: row.failed,
    cancelled: row.cancelled,
    retries: row.retries,
    toolErrors: toolErrors.get(row.turn_id) || 0,
  }));
  const totals = turns.reduce((acc, turn) => ({
    requests: acc.requests + turn.requests,
    ok: acc.ok + turn.ok,
    failed: acc.failed + turn.failed,
    cancelled: acc.cancelled + turn.cancelled,
    retries: acc.retries + turn.retries,
    toolErrors: acc.toolErrors + turn.toolErrors,
  }), { requests: 0, ok: 0, failed: 0, cancelled: 0, retries: 0, toolErrors: 0 });
  totals.successRate = totals.requests > 0 ? totals.ok / totals.requests : null;
  return { turns, totals };
}

/* ---------------------------------------------------------- context window */

/**
 * Effective context window for one (provider, model), mirroring the runtime:
 * built-in regex rules first (later matches win), then the user's provider
 * rules, then manual per-model rules. A user override always wins.
 */
export function resolveContextWindow(providerId, modelId, override) {
  if (!modelId) return { window: null, source: 'unknown' };
  const overrideMap = parseModelNumbers(process.env.INSTRUMENT_CONTEXT_WINDOWS, override);
  const explicit = overrideMap.get(modelId) || (providerId ? overrideMap.get(`${providerId}:${modelId}`) : null);
  if (explicit) return { window: explicit, source: 'user' };

  const paths = defaultProviderConfigPaths();
  const builtin = readProviderConfig(paths.builtin);
  const personal = readProviderConfig(paths.personal);

  let window = null;
  let source = 'unknown';
  for (const rule of builtin.modelRules) {
    if (!rule.contextWindow) continue;
    if (rule.modelMatch && safeMatch(rule.modelMatch, modelId)) {
      window = rule.contextWindow;
      source = 'builtin';
    }
  }
  for (const rule of personal.providerModelRules) {
    if (rule.providerId !== providerId || rule.modelId !== modelId) continue;
    if (rule.contextWindow) { window = rule.contextWindow; source = 'provider'; }
  }
  for (const rule of personal.manualModelRules) {
    if (rule.providerId !== providerId || rule.modelId !== modelId) continue;
    if (rule.contextWindow) { window = rule.contextWindow; source = 'manual'; }
  }
  return { window, source };
}

function safeMatch(pattern, value) {
  try {
    return new RegExp(`^(?:${pattern})$`).test(value);
  } catch {
    return false;
  }
}

/** "model=number,provider:model=number" -> Map */
export function parseModelNumbers(...sources) {
  const map = new Map();
  for (const source of sources) {
    if (!source) continue;
    for (const chunk of String(source).split(/[,;\n]/)) {
      const index = chunk.lastIndexOf('=');
      if (index <= 0) continue;
      const key = chunk.slice(0, index).trim();
      const value = Number(chunk.slice(index + 1).trim());
      if (key && Number.isFinite(value) && value > 0) map.set(key, value);
    }
  }
  return map;
}


export function toolRollup(db, sessionId, limit = 12) {
  return db.prepare(
    `select tool_name,
            count(*) n,
            sum(case when status = 'error' then 1 else 0 end) errors,
            sum(case when status = 'cancelled' then 1 else 0 end) cancelled,
            sum(coalesce(duration_ms, 0)) total_ms,
            max(coalesce(duration_ms, 0)) max_ms,
            sum(output_bytes) bytes
     from tool_usage where session_id = ?
     group by tool_name order by total_ms desc limit ?`
  ).all(sessionId, limit).map((row) => ({
    name: row.tool_name,
    count: row.n,
    errors: row.errors,
    cancelled: row.cancelled,
    totalMs: row.total_ms,
    maxMs: row.max_ms,
    bytes: row.bytes,
  }));
}

/**
 * Per-model averages. `scope: 'session'` covers this session only; `'workspace'`
 * adds every other session in the same directory (handy when comparing models).
 */
export function modelRollup(db, session, scope = 'session', limit = 10, names = new Map(), order = []) {
  const filter = scope === 'workspace'
    ? "m.query_source = 'main_turn' and s.directory = ?"
    : "m.query_source = 'main_turn' and m.session_id = ?";
  const arg = scope === 'workspace' ? session.directory : session.id;
  const rows = db.prepare(
    `select m.model_id, m.provider_id, m.variant,
            count(*) n,
            sum(m.input_tokens) input_tokens,
            sum(m.output_tokens) output_tokens,
            sum(m.reasoning_tokens) reasoning_tokens,
            sum(m.cache_read_input_tokens) cache_read_tokens,
            sum(m.computed_total_tokens) total_tokens,
            avg(m.time_to_first_token_ms) avg_ttft_ms,
            sum(case when m.status = 'completed' then 1 else 0 end) completed,
            sum(case when m.status <> 'completed' then 1 else 0 end) failed,
            sum(case when m.first_token_at is not null and m.completed_at is not null
                     then m.completed_at - m.first_token_at else 0 end) stream_ms,
            max(m.started_at) last_at
     from model_usage m join session s on s.id = m.session_id
     where ${filter}
     group by m.model_id, m.provider_id, m.variant
     order by n desc limit ?`
  ).all(arg, limit).map((row) => ({
    modelId: row.model_id,
    providerId: row.provider_id,
    providerName: providerLabel(names, row.provider_id),
    variant: row.variant,
    requests: row.n,
    completed: row.completed,
    failed: row.failed,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    reasoningTokens: row.reasoning_tokens,
    cacheReadTokens: row.cache_read_tokens,
    totalTokens: row.total_tokens,
    avgTtftMs: row.avg_ttft_ms === null ? null : Math.round(row.avg_ttft_ms),
    tps: row.stream_ms > 0 ? row.output_tokens / (row.stream_ms / 1000) : null,
    hitRate: row.input_tokens > 0 ? row.cache_read_tokens / row.input_tokens : null,
    lastAt: row.last_at,
  }));

  // Match the provider order the app itself shows, so the list reads the same way.
  if (order.length) {
    const rank = new Map(order.map((id, index) => [id, index]));
    rows.sort((a, b) => (rank.get(a.providerId) ?? order.length) - (rank.get(b.providerId) ?? order.length)
      || b.requests - a.requests);
  }
  return rows;
}

/** Failures, cancellations and retries — usually empty until something breaks. */
export function failureStats(db, sessionId) {
  const byKind = db.prepare(
    `select status, coalesce(error_code, error_type, 'unknown') kind, count(*) n
     from model_usage where session_id = ? and status <> 'completed'
     group by status, kind order by n desc`
  ).all(sessionId);
  const retries = db.prepare(
    `select count(*) n, coalesce(sum(retry_count), 0) retry_total,
            coalesce(max(retry_count), 0) retry_max
     from model_usage where session_id = ? and (attempt_index > 0 or retry_count > 0)`
  ).get(sessionId);
  const toolFailures = db.prepare(
    `select tool_name, count(*) n from tool_usage
     where session_id = ? and status = 'error' group by tool_name order by n desc`
  ).all(sessionId);
  const recent = db.prepare(
    `select started_at, model_id, status, coalesce(error_code, error_type, '') code,
            substr(coalesce(error_message, ''), 1, 160) message
     from model_usage where session_id = ? and status <> 'completed'
     order by started_at desc limit 8`
  ).all(sessionId);

  return {
    modelFailures: byKind.map((row) => ({ status: row.status, kind: row.kind, count: row.n })),
    retriedRequests: retries.n,
    retryTotal: retries.retry_total,
    retryMax: retries.retry_max,
    toolFailures: toolFailures.map((row) => ({ name: row.tool_name, count: row.n })),
    recent: recent.map((row) => ({
      startedAt: row.started_at,
      modelId: row.model_id,
      status: row.status,
      code: row.code,
      message: row.message,
    })),
  };
}

/* ------------------------------------------------------------------ formats */

const num = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('en-US'));
const one = (n, digits = 1) => (n === null || n === undefined || Number.isNaN(n) ? '—' : Number(n).toFixed(digits));
const pct = (n) => (n === null || n === undefined ? '—' : `${(n * 100).toFixed(1)}%`);

export function fmtDuration(ms) {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m${s}s`;
}

const fmtSpeed = (tps) => (tps === null || tps === undefined ? '—' : `${one(tps)} tok/s`);

export function fmtTime(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** Time of day only — for compact per-reply lines. */
export function clock(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** MCP tool names are long; keep the readable tail. */
function shortTool(name) {
  const text = String(name || '');
  const parts = text.split('__');
  return parts[parts.length - 1] || text;
}

function usageLine(a) {
  const parts = [`输入 ${num(a.inputTokens)}`];
  if (a.cacheReadTokens) parts[0] += `（缓存命中 ${num(a.cacheReadTokens)} · ${pct(a.hitRate)}）`;
  parts.push(`输出 ${num(a.outputTokens)}`);
  if (a.reasoningTokens) parts.push(`推理 ${num(a.reasoningTokens)}`);
  parts.push(`合计 ${num(a.totalTokens)}`);
  return parts.join(' · ');
}

export function formatText(data) {
  const lines = [];
  const s = data.session;
  lines.push(`⚡ 仪表盘 · ${truncate(s.title, 40) || '(未命名会话)'}`);
  lines.push(`   会话 ${s.id} · 目录 ${s.directory || '—'} · 统计时间 ${fmtTime(data.generatedAt)}`);
  lines.push('');

  if (!data.latest) {
    lines.push('还没有可用的回复记录（数据库里没有 main_turn 请求）。');
    return lines.join('\n');
  }

  const reply = data.latest.reply;
  const t = data.latest.totals;
  lines.push(`最新回复  ${reply.model_id} · ${reply.providerName || reply.provider_id}${reply.variant ? ` · ${reply.variant}` : ''}`);
  if (reply.status !== 'completed') {
    lines.push(`   状态：${statusLabel(reply)}`);
  }
  lines.push(`   首字 ${fmtDuration(reply.ttftMs)} · 生成 ${fmtSpeed(reply.tps)} · 请求耗时 ${fmtDuration(reply.duration_ms)}`);
  if (reply.ttftMs === null) {
    lines.push('   （这条请求没有首字时间记录，速度无法计算——常见于整段一次性返回的请求）');
  }
  lines.push(`   ${usageLine({
    inputTokens: reply.input_tokens,
    cacheReadTokens: reply.cache_read_input_tokens,
    hitRate: reply.input_tokens > 0 ? reply.cache_read_input_tokens / reply.input_tokens : null,
    outputTokens: reply.output_tokens,
    reasoningTokens: reply.reasoning_tokens,
    totalTokens: reply.computed_total_tokens,
  })}`);
  lines.push('');

  lines.push(`本轮汇总  ${t.requestCount} 次请求 · 工具调用 ${t.toolCallCount} 次 · 结束于 ${fmtTime(data.latest.completedAt)}`);
  lines.push(`   首个请求首字 ${fmtDuration(t.ttftMs)} · 平均生成 ${fmtSpeed(t.tps)} · 实际耗时 ${fmtDuration(t.wallMs)}（含工具执行与等待）`);
  lines.push(`   ${usageLine(t)}`);
  lines.push('');

  const phases = data.latest.phases;
  if (phases && phases.totalMs > 0) {
    const share = (ms) => `${pct(ms / phases.totalMs)}`;
    lines.push(`本轮时间  等待首字 ${fmtDuration(phases.ttftMs)}（${share(phases.ttftMs)}，${phases.requestCount} 次请求累计）`
      + ` · 生成 ${fmtDuration(phases.genMs)}`
      + ` · 工具 ${fmtDuration(phases.toolMs)}`
      + ` · 间隙 ${fmtDuration(phases.gapMs)}`
      + ` · 合计 ${fmtDuration(phases.totalMs)}`);
    if (phases.untrackedRequests) {
      lines.push(`   注：${phases.untrackedRequests} 次请求没有首字时间记录，它们的时间计入了"生成"，`
        + '所以"等待首字"是下限');
    }
    if (phases.live) {
      const live = phases.live;
      lines.push(`   进行中：${live.phase === 'tool' ? `正在执行工具 ${shortTool(live.name)}` : '正在等待模型响应'}`
        + `（${fmtDuration(live.elapsedMs)}）`);
    }
    lines.push('');
  }

  if (data.context) {
    const ctx = data.context;
    const source = { user: '手动设置', manual: '手动模型规则', provider: 'provider 配置', builtin: '内置规则', unknown: '未知' }[ctx.source] || ctx.source;
    lines.push(ctx.window
      ? `上下文  ${num(ctx.inputTokens)} / ${num(ctx.window)}（${pct(ctx.ratio)}，窗口来自${source}）`
      : `上下文  ${num(ctx.inputTokens)}（窗口未知，可用 --context-windows "${ctx.modelId}=800000" 指定）`);
    lines.push('');
  }

  const st = data.sessionTotals;
  lines.push(`会话累计  ${st.requestCount} 次请求（含子代理/压缩/标题，来自 model_usage 全部记录）`);
  lines.push(`   ${usageLine(st)}`);

  if (data.timeSplit) {
    const sp = data.timeSplit;
    const share = (ms) => pct(ms / sp.totalMs);
    lines.push('');
    lines.push(`本次会话时间构成  活跃 ${fmtDuration(sp.totalMs)}（各轮之和，不含轮次之间的空闲）`);
    lines.push(`   等待首字 ${fmtDuration(sp.ttftMs)}（${share(sp.ttftMs)}）`
      + ` · 生成 ${fmtDuration(sp.genMs)}（${share(sp.genMs)}）`
      + ` · 工具 ${fmtDuration(sp.toolMs)}（${share(sp.toolMs)}）`
      + ` · 其他 ${fmtDuration(sp.gapMs)}（${share(sp.gapMs)}）`);
  }
  if (data.tools?.length) {
    lines.push(`工具耗时  ${data.tools.slice(0, 3).map((tool) => `${shortTool(tool.name)} ${fmtDuration(tool.totalMs)}/${tool.count}`).join(' · ')}`);
  }
  if (data.failures) {
    const f = data.failures;
    const failed = f.modelFailures.reduce((sum, item) => sum + item.count, 0);
    const toolErrors = f.toolFailures.reduce((sum, item) => sum + item.count, 0);
    const health = data.health?.totals;
    if (failed || toolErrors || f.retriedRequests) {
      lines.push(`失败重试  模型失败 ${failed} 次`
        + `${f.modelFailures.length ? `（${f.modelFailures.map((x) => `${x.kind}×${x.count}`).join('、')}）` : ''}`
        + ` · 工具报错 ${toolErrors} 次`
        + `${f.toolFailures.length ? `（${f.toolFailures.map((x) => `${shortTool(x.name)}×${x.count}`).join('、')}）` : ''}`
        + ` · 重试 ${f.retryTotal} 次（${f.retriedRequests} 个请求）`);
    } else {
      lines.push(`失败重试  无（成功率 ${health ? pct(health.successRate) : '—'}，工具报错 ${toolErrors} 次）`);
    }
  }
  if (data.turns?.some((turn) => turn.replyPreview)) {
    lines.push('');
    lines.push('最近回复摘要');
    for (const turn of data.turns.slice(0, 3)) {
      if (!turn.replyPreview) continue;
      lines.push(`   ${clock(turn.completedAt)} 首字 ${fmtDuration(turn.totals.ttftMs)} · ${fmtSpeed(turn.totals.tps)} · 输出 ${num(turn.totals.outputTokens)}`);
      if (turn.userPreview) lines.push(`      问：${turn.userPreview}`);
      lines.push(`      答：${turn.replyPreview}`);
    }
  }
  return lines.join('\n');
}

export function formatMarkdown(data, { detail = false } = {}) {
  const s = data.session;
  const out = [];
  out.push(`## 仪表盘 · ${truncate(s.title, 60) || '(未命名会话)'}`);
  out.push('');
  out.push(`会话 \`${s.id}\` · 目录 \`${s.directory || '—'}\` · 统计时间 ${fmtTime(data.generatedAt)}`);
  out.push('');

  if (!data.latest) {
    out.push('还没有可用的回复记录（数据库里没有 main_turn 请求）。');
    return out.join('\n');
  }

  const r = data.latest.reply;
  out.push('### 最新回复');
  out.push('');
  out.push(`**${r.model_id}** · ${r.providerName || r.provider_id}${r.variant ? ` · ${r.variant}` : ''} · ${statusLabel(r)}`);
  out.push('');
  out.push('| 首字延迟 | 生成速度 | 输出 | 推理 | 输入 | 缓存命中 | 合计 | 请求耗时 |');
  out.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
  out.push(`| ${fmtDuration(r.ttftMs)} | ${fmtSpeed(r.tps)} | ${num(r.output_tokens)} | ${num(r.reasoning_tokens)} | ${num(r.input_tokens)} | ${num(r.cache_read_input_tokens)} (${pct(r.input_tokens > 0 ? r.cache_read_input_tokens / r.input_tokens : null)}) | ${num(r.computed_total_tokens)} | ${fmtDuration(r.duration_ms)} |`);
  if (r.ttftMs === null) {
    out.push('');
    out.push('> 这条请求没有首字时间记录，首字与速度无法计算（常见于整段一次性返回的请求）。');
  }
  out.push('');

  out.push(`### 最近 ${data.turns.length} 轮`);
  out.push('');
  out.push('| 轮次结束时间 | 模型 | 首字 | 平均速度 | 输出 | 输入（命中率） | 合计 | 请求数 | 模型耗时 | 工具耗时 | 实际耗时 |');
  out.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const turn of data.turns) {
    const a = turn.totals;
    out.push(`| ${fmtTime(turn.completedAt)} | ${shortModel(turn.reply.model_id)} | ${fmtDuration(a.ttftMs)} | ${fmtSpeed(a.tps)} | ${num(a.outputTokens)} | ${num(a.inputTokens)} (${pct(a.hitRate)}) | ${num(a.totalTokens)} | ${a.requestCount} | ${fmtDuration(turn.modelMs)} | ${fmtDuration(turn.toolMs)} | ${fmtDuration(a.wallMs)} |`);
  }
  out.push('');

  if (data.turns?.some((turn) => turn.replyPreview)) {
    out.push('### 最近回复摘要');
    out.push('');
    for (const turn of data.turns.slice(0, 5)) {
      if (!turn.replyPreview) continue;
      out.push(`- **${clock(turn.completedAt)}** · 首字 ${fmtDuration(turn.totals.ttftMs)} · ${fmtSpeed(turn.totals.tps)} · 输出 ${num(turn.totals.outputTokens)}`);
      if (turn.userPreview) out.push(`  - 问：${turn.userPreview}`);
      out.push(`  - 答：${turn.replyPreview}`);
    }
    out.push('');
  }

  if (detail) {
    out.push('### 请求明细（最新一轮）');
    out.push('');
    out.push('| 开始时间 | 状态 | 首字 | 速度 | 输出 | 输入 | 缓存命中 | 工具调用 | 尝试 |');
    out.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const req of data.latest.requests) {
      out.push(`| ${fmtTime(req.started_at)} | ${statusLabel(req)} | ${fmtDuration(req.ttftMs)} | ${fmtSpeed(req.tps)} | ${num(req.output_tokens)} | ${num(req.input_tokens)} | ${num(req.cache_read_input_tokens)} | ${req.tool_call_count} | ${req.attempt_index + 1} |`);
    }
    out.push('');
  }

  const st = data.sessionTotals;
  out.push('### 会话累计');
  out.push('');
  out.push(`- 请求 ${st.requestCount} 次（含子代理 / 压缩 / 标题生成，来自 model_usage 全部记录）`);
  out.push(`- 输入 ${num(st.inputTokens)} · 输出 ${num(st.outputTokens)} · 推理 ${num(st.reasoningTokens)} · 缓存命中 ${num(st.cacheReadTokens)}（${pct(st.hitRate)}）`);
  out.push(`- 合计 ${num(st.totalTokens)} tok · 首条记录 ${fmtTime(st.startedAt)}`);

  if (data.timeSplit) {
    const sp = data.timeSplit;
    const share = (ms) => pct(ms / sp.totalMs);
    out.push('');
    out.push('### 本次会话时间构成');
    out.push('');
    out.push(`- 等待首字 ${fmtDuration(sp.ttftMs)}（${share(sp.ttftMs)}）`);
    out.push(`- 生成 ${fmtDuration(sp.genMs)}（${share(sp.genMs)}）`);
    out.push(`- 工具 ${fmtDuration(sp.toolMs)}（${share(sp.toolMs)}）`);
    out.push(`- 其他（等待/停顿）${fmtDuration(sp.gapMs)}（${share(sp.gapMs)}）`);
    out.push(`- 活跃时长 ${fmtDuration(sp.totalMs)}（各轮之和，不含轮次之间的空闲）`);
  }

  const phases = data.latest.phases;
  if (phases && phases.totalMs > 0) {
    out.push('');
    out.push('### 本轮时间构成（最新一轮）');
    out.push('');
    out.push(`- 等待首字 ${fmtDuration(phases.ttftMs)}（${pct(phases.ttftMs / phases.totalMs)}，${phases.requestCount} 次请求累计）`);
    out.push(`- 生成 ${fmtDuration(phases.genMs)}`);
    out.push(`- 工具 ${fmtDuration(phases.toolMs)}`);
    out.push(`- 间隙 ${fmtDuration(phases.gapMs)}`);
    out.push(`- 合计 ${fmtDuration(phases.totalMs)}（${data.latest.requests.length} 次请求）`);
    if (phases.untrackedRequests) {
      out.push(`- 注：${phases.untrackedRequests} 次请求没有首字时间记录，它们的时间计入了"生成"，所以"等待首字"是下限`);
    }
    if (phases.live) {
      out.push(`- 进行中：${phases.live.phase === 'tool' ? `正在执行工具 ${shortTool(phases.live.name)}` : '正在等待模型响应'}`
        + `（${fmtDuration(phases.live.elapsedMs)}）`);
    }
    out.push('');
    out.push('| 开始时间 | 首字 | 生成 | 请求耗时 | 工具调用 | 状态 |');
    out.push('| --- | --- | --- | --- | --- | --- |');
    for (const request of data.latest.requests.slice(-12)) {
      const gen = request.ttftMs !== null && request.duration_ms !== null
        ? request.duration_ms - request.ttftMs : null;
      out.push(`| ${fmtTime(request.started_at)} | ${fmtDuration(request.ttftMs)} | ${fmtDuration(gen)} | ${fmtDuration(request.duration_ms)} | ${request.tool_call_count} | ${statusLabel(request)} |`);
    }
  }

  if (data.context) {
    const ctx = data.context;
    const source = { user: '手动设置', manual: '手动模型规则', provider: 'provider 配置', builtin: '内置规则', unknown: '未知' }[ctx.source] || ctx.source;
    out.push('');
    out.push('### 上下文占用');
    out.push('');
    out.push(ctx.window
      ? `- 输入 ${num(ctx.inputTokens)} / 窗口 ${num(ctx.window)}（${pct(ctx.ratio)}，窗口来自${source}）`
      : `- 输入 ${num(ctx.inputTokens)}，窗口未知（可用 \`--context-windows "${ctx.modelId}=800000"\` 指定）`);
  }

  if (data.health) {
    const totals = data.health.totals;
    out.push('');
    out.push('### 健康度');
    out.push('');
    out.push(`- 成功率 ${pct(totals.successRate)}（${totals.ok}/${totals.requests}）· 失败 ${totals.failed} · 取消 ${totals.cancelled}`
      + ` · 重试 ${totals.retries} · 工具报错 ${totals.toolErrors}`);
    const turns = data.health.turns.slice(0, 10);
    if (turns.length) {
      out.push('');
      out.push('| 轮次结束时间 | 请求 | 成功 | 失败 | 取消 | 重试 | 工具报错 |');
      out.push('| --- | --- | --- | --- | --- | --- | --- |');
      for (const turn of turns) {
        out.push(`| ${fmtTime(turn.completedAt)} | ${turn.requests} | ${turn.ok} | ${turn.failed} | ${turn.cancelled} | ${turn.retries} | ${turn.toolErrors} |`);
      }
    }
  }

  if (detail && data.tools?.length) {
    out.push('');
    out.push('### 工具耗时');
    out.push('');
    out.push('| 工具 | 调用 | 总耗时 | 最慢一次 | 失败 | 输出字节 |');
    out.push('| --- | --- | --- | --- | --- | --- |');
    for (const tool of data.tools) {
      out.push(`| ${tool.name} | ${tool.count} | ${fmtDuration(tool.totalMs)} | ${fmtDuration(tool.maxMs)} | ${tool.errors + tool.cancelled} | ${num(tool.bytes)} |`);
    }
  }

  if (detail && data.models?.length) {
    out.push('');
    out.push(`### 模型对比（${data.modelScope === 'workspace' ? '本工作区' : '本会话'}）`);
    out.push('');
    out.push('| 模型 | Provider | 请求 | 平均首字 | 平均速度 | 输出 | 输入 | 命中率 | 失败 |');
    out.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const model of data.models) {
      out.push(`| ${model.modelId}${model.variant ? ` · ${model.variant}` : ''} | ${model.providerName || model.providerId} | ${model.requests} | ${fmtDuration(model.avgTtftMs)} | ${fmtSpeed(model.tps)} | ${num(model.outputTokens)} | ${num(model.inputTokens)} | ${pct(model.hitRate)} | ${model.failed} |`);
    }
  }

  if (data.failures) {
    const f = data.failures;
    out.push('');
    out.push('### 失败与重试');
    out.push('');
    if (!f.modelFailures.length && !f.toolFailures.length && !f.retriedRequests) {
      out.push('- 本会话没有失败、取消或重试记录');
    } else {
      for (const item of f.modelFailures) {
        out.push(`- 模型 ${item.status}：${item.kind} × ${item.count}`);
      }
      for (const item of f.toolFailures) {
        out.push(`- 工具报错：${item.name} × ${item.count}`);
      }
      out.push(`- 重试 ${f.retryTotal} 次（涉及 ${f.retriedRequests} 个请求，单请求最多 ${f.retryMax} 次）`);
      for (const event of f.recent.slice(0, 5)) {
        out.push(`  - ${fmtTime(event.startedAt)} ${shortModel(event.modelId)} ${event.status} ${event.code}${event.message ? ` — ${event.message}` : ''}`);
      }
    }
  }
  return out.join('\n');
}

function statusLabel(r) {
  const base = { completed: '完成', running: '进行中', error: '出错', cancelled: '已取消' }[r.status] || r.status;
  if (r.status === 'completed') return base;
  const code = r.error_code || r.error_type;
  return code ? `${base}（${code}）` : base;
}

const shortModel = (m) => (m || '—').split('/').pop();
// Titles may carry markdown links; ZCode truncates long ones, so the closing
// paren can be missing from the stored string.
export const cleanTitle = (s) => (s || '').replace(/\[([^\]]*)\]\([^)]*\)?/g, '$1').replace(/\s+/g, ' ').trim();
const truncate = (s, n) => {
  const t = cleanTitle(s);
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

/* ---------------------------------------------------------------------- CLI */

const HELP = `用法: node metrics.mjs [选项]

查看 ZCode 会话的回复指标：首字延迟、生成速度(tokens/s)、token 用量。

选项:
  --cwd <目录>       用工作目录匹配会话（默认当前目录）
  --session <id>     指定会话 id；latest 或省略表示自动解析
  --limit <n>        报告最近 n 轮（默认 5）
  --format <fmt>     text | markdown | json（默认 text）
  --detail           追加工具耗时、模型对比、请求明细
  --model-scope <s>  session（默认）| workspace：模型对比是否含本工作区其他会话
  --provider-names <p>  provider 显示名映射，如 "new-provider-2=GOAT(LiteL.M)"
  --db <path>        用量数据库路径（默认 ~/.zcode/cli/db/db.sqlite）
  --help             显示本帮助
`;

function parseArgs(argv) {
  const out = { limit: 5, format: 'text', detail: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case '--cwd': out.cwd = next(); break;
      case '--session': out.sessionId = next(); break;
      case '--limit': out.limit = Number(next()) || 5; break;
      case '--format': out.format = (next() || 'text').toLowerCase(); break;
      case '--detail': out.detail = true; break;
      case '--model-scope': out.modelScope = (next() || 'session').toLowerCase(); break;
      case '--provider-names': out.providerNames = next(); break;
      case '--context-windows': out.contextWindows = next(); break;
      case '--db': out.db = next(); break;
      case '--help': case '-h': out.help = true; break;
      default: break;
    }
  }
  return out;
}

export function runReport({ sessionId, cwd, limit, dbPath, modelScope = 'session', providerNames, contextWindows } = {}) {
  const db = openDb(dbPath);
  try {
    return collectMetrics(db, { sessionId, cwd, limit, modelScope, providerNames, contextWindows });
  } finally {
    db.close();
  }
}

const isMain = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    process.exit(0);
  }
  try {
    const data = runReport({
      sessionId: args.sessionId,
      cwd: args.cwd,
      limit: args.limit,
      dbPath: args.db,
      modelScope: args.modelScope,
      providerNames: args.providerNames,
      contextWindows: args.contextWindows,
    });
    if (args.format === 'json') {
      console.log(JSON.stringify(args.detail ? data : { ...data, turns: data.turns.map(summarizeTurn) }, null, 2));
    } else if (args.format === 'markdown' || args.format === 'md') {
      console.log(formatMarkdown(data, { detail: args.detail }));
    } else {
      console.log(formatText(data));
    }
  } catch (err) {
    console.error(`读取回复指标失败：${err.message}`);
    process.exit(1);
  }
}

/** JSON output keeps turns light unless --detail is passed. */
function summarizeTurn(turn) {
  const { requests, ...rest } = turn;
  return { ...rest, requestIds: requests.map((r) => r.id) };
}
