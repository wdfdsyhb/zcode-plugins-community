#!/usr/bin/env node
// MCP server for ZCode reply metrics: a model-facing `metrics` tool, plus an
// App-only `panel_snapshot` tool and the `ui://` resource that renders the
// sidebar panel (MCP Apps / `text/html;profile=mcp-app`).
//
// Speaks newline-delimited JSON-RPC 2.0 over stdin/stdout. No dependencies —
// the metrics reader uses Node's built-in sqlite (Node >= 22.5).
//
// stdout carries protocol frames only; diagnostics go to stderr.

import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  PLUGIN_VERSION,
  runReport,
  formatText,
  formatMarkdown,
  fmtTime,
  fmtDuration,
  cleanTitle,
} from '../scripts/metrics.mjs';
import { fetchQuota, formatQuotaText } from '../scripts/quota.mjs';

const SERVER_NAME = 'instrument';
const FALLBACK_PROTOCOL = '2024-11-05';
const PANEL_URI = 'ui://instrument/panel.html';
const PANEL_MIME = 'text/html;profile=mcp-app';
// The host passes the ZCode session a panel belongs to in this namespace.
const REQUEST_CONTEXT_KEY = 'com.zcode/request-context';

const METRICS_TOOL = {
  name: 'metrics',
  title: '回复指标',
  description:
    '读取本机 ZCode 会话的模型用量记录，报告首字延迟(time to first token)、'
    + '生成速度(tokens/s)与 token 用量。默认返回当前会话最新一条回复的指标；'
    + '可以按轮次列表查看，或看整个会话的累计消耗。当用户询问"刚才那条回复多快"、'
    + '"首字多久"、"速度多少"、"用了多少 token"时使用。'
    + '请始终传入 cwd（当前工作目录），否则可能匹配到同一目录下别的会话。',
  inputSchema: {
    type: 'object',
    properties: {
      view: {
        type: 'string',
        enum: ['reply', 'turns', 'session', 'all'],
        description:
          'reply=最新回复(默认)；turns=最近若干轮的表格；session=会话累计；all=全部',
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 50,
        description: 'turns/all 视图包含的轮数，默认 5',
      },
      session: {
        type: 'string',
        description: '会话 id；省略时按工作目录匹配最近活跃的会话',
      },
      cwd: {
        type: 'string',
        description: '用于匹配会话的工作目录；省略时用当前工作目录',
      },
      detail: {
        type: 'boolean',
        description: 'turns/all 视图追加"最新一轮的逐请求明细"',
      },
    },
    additionalProperties: false,
  },
};

const PANEL_TOOL = {
  name: 'panel_snapshot',
  title: '侧栏面板快照',
  description: '面板专用：返回当前会话的回复指标快照。模型不可见。',
  inputSchema: {
    type: 'object',
    properties: {
      workdir: {
        type: 'string',
        description: '可选：会话未绑定时用于匹配会话的工作目录',
      },
      modelScope: {
        type: 'string',
        enum: ['session', 'workspace'],
        description: '模型对比的范围：session=只算本会话（默认）；workspace=含本工作区其他会话',
      },
    },
    additionalProperties: false,
  },
  // App-only: the agent neither sees nor can call this tool.
  _meta: { ui: { visibility: ['app'] } },
};

const QUOTA_TOOL = {
  name: 'quota',
  title: '订阅额度',
  description:
    '查询本机 CommandCode 订阅（GOAT 等）的额度：5 小时、每周、每月的已用/上限与重置时间，'
    + '以及本期请求数和 token 用量。当用户问"还剩多少额度""这个 5 小时窗口用了多少"时使用。'
    + '只读，不消耗额度。',
  inputSchema: {
    type: 'object',
    properties: {
      force: { type: 'boolean', description: '绕过 60 秒缓存，强制重新查询' },
    },
    additionalProperties: false,
  },
};

/* ---------------------------------------------------------------- transport */

function send(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

const sendResult = (id, result) => send({ jsonrpc: '2.0', id, result });
const sendError = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });

/* ------------------------------------------------------------------ reports */

function sessionOnlyView(data) {
  const st = data.sessionTotals;
  const pct = (n) => (n === null || n === undefined ? '—' : `${(n * 100).toFixed(1)}%`);
  return [
    `## 会话累计 · ${cleanTitle(data.session.title) || '(未命名会话)'}`,
    '',
    `会话 \`${data.session.id}\` · 目录 \`${data.session.directory || '—'}\``,
    '',
    `- 请求 ${st.requestCount} 次（含子代理 / 压缩 / 标题生成）`,
    `- 输入 ${st.inputTokens.toLocaleString('en-US')} · 输出 ${st.outputTokens.toLocaleString('en-US')}`
      + ` · 推理 ${st.reasoningTokens.toLocaleString('en-US')}`,
    `- 缓存命中 ${st.cacheReadTokens.toLocaleString('en-US')}（${pct(st.hitRate)}）`
      + ` · 合计 ${st.totalTokens.toLocaleString('en-US')} tok`,
    `- 首条记录 ${fmtTime(st.startedAt)} · 总请求耗时 ${fmtDuration(st.sumDurationMs)}`,
  ].join('\n');
}

function renderToolResult(args = {}) {
  const view = ['reply', 'turns', 'session', 'all'].includes(args.view) ? args.view : 'reply';
  const limit = Number.isInteger(args.limit) && args.limit > 0 ? Math.min(args.limit, 50) : 5;
  const data = runReport({
    sessionId: args.session,
    cwd: args.cwd,
    limit: view === 'turns' || view === 'all' ? limit : 1,
  });
  switch (view) {
    case 'turns':
      return formatMarkdown(data, { detail: Boolean(args.detail) });
    case 'session':
      return sessionOnlyView(data);
    case 'all':
      return `${formatText(data)}\n\n---\n\n${formatMarkdown(data, { detail: true })}`;
    default:
      return formatText(data);
  }
}

/**
 * The reply to headline in the panel. The newest request may still be
 * generating (no first-token time recorded yet); in that case show the newest
 * request that does have metrics and flag it, instead of a row of dashes.
 */
function pickReply(data) {
  const turns = data.turns || [];
  if (!turns.length) return { request: null, fallback: false };
  const closing = turns[0].reply;
  if (closing && closing.ttftMs != null) return { request: closing, fallback: false };
  for (const turn of turns) {
    const ordered = [...turn.requests].sort((a, b) => b.started_at - a.started_at);
    const hit = ordered.find((r) => r.ttftMs != null);
    if (hit) return { request: hit, fallback: true };
  }
  return { request: closing || null, fallback: false };
}

/** MCP tool names are long; show the readable tail and keep the full name for tooltips. */
function shortToolName(name) {
  const text = String(name || '');
  if (!text.startsWith('mcp__')) return text;
  const parts = text.slice(5).split('__');
  const server = (parts[0] || '').replace(/^plugin_/, '').split('-')[0];
  return `${server}:${parts[1] || text}`;
}

/** Compact, presentation-ready payload for the sidebar panel. */
function panelPayload(data, trendLimit = 12) {
  const round = (n) => (n === null || n === undefined || Number.isNaN(n) ? null : Math.round(n * 10) / 10);
  const pick = (a) => (a ? {
    requestCount: a.requestCount,
    toolCallCount: a.toolCallCount,
    inputTokens: a.inputTokens,
    outputTokens: a.outputTokens,
    reasoningTokens: a.reasoningTokens,
    cacheReadTokens: a.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens,
    totalTokens: a.totalTokens,
    hitRate: a.hitRate === null || a.hitRate === undefined ? null : Math.round(a.hitRate * 1000) / 1000,
    ttftMs: a.ttftMs ?? null,
    avgTtftMs: a.avgTtftMs === null || a.avgTtftMs === undefined ? null : Math.round(a.avgTtftMs),
    ttftCount: a.ttftCount ?? 0,
    untrackedCount: a.untrackedCount ?? 0,
    tps: round(a.tps),
    wallMs: a.wallMs ?? null,
    completedAt: a.completedAt ?? null,
  } : null);

  const chosen = pickReply(data);
  const reply = chosen.request;
  const turns = (data.turns || []).slice(0, trendLimit).map((turn) => ({
    completedAt: turn.completedAt,
    modelId: turn.reply?.model_id || null,
    tps: round(turn.totals.tps),
    ttftMs: turn.totals.ttftMs,
    inputTokens: turn.totals.inputTokens,
    outputTokens: turn.totals.outputTokens,
    totalTokens: turn.totals.totalTokens,
    hitRate: turn.totals.hitRate === null || turn.totals.hitRate === undefined
      ? null : Math.round(turn.totals.hitRate * 1000) / 1000,
    wallMs: turn.totals.wallMs,
    modelMs: turn.modelMs ?? null,
    toolMs: turn.toolMs ?? null,
    toolCount: turn.toolCount ?? 0,
    requestCount: turn.totals.requestCount,
  }));

  // One entry per reply the user actually read: the question, the answer, and
  // what it cost. Newest first. The newest few carry their per-request rows so
  // the panel can expand a turn without a second round trip.
  const replies = (data.turns || []).slice(0, 20).map((turn, index) => ({
    completedAt: turn.completedAt,
    modelId: turn.reply?.model_id || null,
    status: turn.reply?.status || null,
    userPreview: turn.userPreview || '',
    replyPreview: turn.replyPreview || '',
    ttftMs: turn.totals.ttftMs ?? null,
    tps: round(turn.totals.tps),
    durationMs: turn.totals.wallMs ?? null,
    inputTokens: turn.totals.inputTokens,
    outputTokens: turn.totals.outputTokens,
    cacheReadTokens: turn.totals.cacheReadTokens,
    totalTokens: turn.totals.totalTokens,
    hitRate: turn.totals.hitRate === null || turn.totals.hitRate === undefined
      ? null : Math.round(turn.totals.hitRate * 1000) / 1000,
    requestCount: turn.totals.requestCount,
    toolCount: turn.toolCount ?? 0,
    toolMs: turn.toolMs ?? null,
    wallMs: turn.totals.wallMs,
    phases: turn.phases ? {
      ttftMs: turn.phases.ttftMs,
      genMs: turn.phases.genMs,
      toolMs: turn.phases.toolMs,
      gapMs: turn.phases.gapMs,
      totalMs: turn.phases.totalMs,
      requestCount: turn.phases.requestCount,
      untrackedRequests: turn.phases.untrackedRequests,
      live: turn.phases.live,
    } : null,
    requests: index < 5
      ? turn.requests.slice(-40).map((req) => ({
        startedAt: req.started_at,
        status: req.status,
        ttftMs: req.ttftMs,
        genMs: req.ttftMs !== null && req.duration_ms !== null ? req.duration_ms - req.ttftMs : null,
        tps: round(req.tps),
        outputTokens: req.output_tokens,
        inputTokens: req.input_tokens,
        cacheReadTokens: req.cache_read_input_tokens,
        toolCalls: req.tool_call_count,
        attempt: (req.attempt_index || 0) + 1,
        finishReason: req.finish_reason,
      }))
      : null,
  }));

  return {
    session: {
      id: data.session.id,
      title: cleanTitle(data.session.title),
      directory: data.session.directory,
    },
    generatedAt: data.generatedAt,
    replyFallback: chosen.fallback,
    reply: reply ? {
      modelId: reply.model_id,
      providerId: reply.provider_id,
      providerName: reply.providerName || reply.provider_id,
      variant: reply.variant,
      status: reply.status,
      finishReason: reply.finish_reason,
      ttftMs: reply.ttftMs,
      tps: round(reply.tps),
      durationMs: reply.duration_ms,
      inputTokens: reply.input_tokens,
      outputTokens: reply.output_tokens,
      reasoningTokens: reply.reasoning_tokens,
      cacheReadTokens: reply.cache_read_input_tokens,
      cacheWriteTokens: reply.cache_creation_input_tokens,
      totalTokens: reply.computed_total_tokens,
      hitRate: reply.input_tokens > 0
        ? Math.round((reply.cache_read_input_tokens / reply.input_tokens) * 1000) / 1000
        : null,
      toolCallCount: reply.tool_call_count,
      completedAt: reply.completed_at,
    } : null,
    turn: data.latest ? pick(data.latest.totals) : null,
    phases: data.latest?.phases ? {
      prepMs: data.latest.phases.prepMs,
      ttftMs: data.latest.phases.ttftMs,
      genMs: data.latest.phases.genMs,
      toolMs: data.latest.phases.toolMs,
      gapMs: data.latest.phases.gapMs,
      totalMs: data.latest.phases.totalMs,
      requestCount: data.latest.phases.requestCount,
      untrackedRequests: data.latest.phases.untrackedRequests,
      sumsToTotal: data.latest.phases.sumsToTotal,
      live: data.latest.phases.live,
    } : null,
    context: data.context ? {
      inputTokens: data.context.inputTokens,
      window: data.context.window,
      ratio: data.context.ratio,
      source: data.context.source,
      modelId: data.context.modelId,
    } : null,
    health: data.health ? {
      totals: data.health.totals,
      turns: data.health.turns.slice(0, 20).map((turn) => ({
        completedAt: turn.completedAt,
        requests: turn.requests,
        ok: turn.ok,
        failed: turn.failed,
        cancelled: turn.cancelled,
        retries: turn.retries,
        toolErrors: turn.toolErrors,
      })),
    } : null,
    sessionTotals: pick(data.sessionTotals),
    trend: turns,
    replies,
    timeSplit: data.timeSplit ? {
      ttftMs: data.timeSplit.ttftMs,
      genMs: data.timeSplit.genMs,
      toolMs: data.timeSplit.toolMs,
      gapMs: data.timeSplit.gapMs,
      totalMs: data.timeSplit.totalMs,
      requestCount: data.timeSplit.requestCount,
      toolCalls: data.timeSplit.toolCalls,
    } : null,
    modelScope: data.modelScope || 'session',
    models: (data.models || []).map((model) => ({
      modelId: model.modelId,
      providerId: model.providerId,
      providerName: model.providerName || model.providerId,
      variant: model.variant,
      requests: model.requests,
      failed: model.failed,
      avgTtftMs: model.avgTtftMs,
      tps: round(model.tps),
      inputTokens: model.inputTokens,
      outputTokens: model.outputTokens,
      totalTokens: model.totalTokens,
      hitRate: model.hitRate === null || model.hitRate === undefined
        ? null : Math.round(model.hitRate * 1000) / 1000,
    })),
    tools: (data.tools || []).map((tool) => ({
      name: tool.name,
      short: shortToolName(tool.name),
      count: tool.count,
      errors: tool.errors + tool.cancelled,
      totalMs: tool.totalMs,
      maxMs: tool.maxMs,
      bytes: tool.bytes,
    })),
    failures: data.failures ? {
      modelFailures: data.failures.modelFailures,
      toolFailures: data.failures.toolFailures,
      retriedRequests: data.failures.retriedRequests,
      retryTotal: data.failures.retryTotal,
      retryMax: data.failures.retryMax,
      recent: data.failures.recent.map((event) => ({
        startedAt: event.startedAt,
        modelId: event.modelId,
        status: event.status,
        code: event.code,
        message: event.message,
      })),
    } : null,
  };
}

/** ZCode session bound by the host to this panel instance, if provided. */
function sessionFromMeta(meta) {
  const ctx = meta?.[REQUEST_CONTEXT_KEY];
  const sessionId = ctx?.session_id;
  return typeof sessionId === 'string' && sessionId ? sessionId : undefined;
}

/* --------------------------------------------------------------- resources */

function panelHtml() {
  return readFileSync(fileURLToPath(new URL('../ui/panel.html', import.meta.url)), 'utf8');
}

function handleResourceList(id) {
  sendResult(id, {
    resources: [{
      uri: PANEL_URI,
      name: 'response-metrics-panel',
      title: '回复指标',
      description: '会话回复的首字延迟、生成速度与 token 用量面板。',
      mimeType: PANEL_MIME,
      // No network access: the panel is fully self-contained.
      _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] } } },
    }],
  });
}

function handleResourceRead(id, params) {
  if (params?.uri !== PANEL_URI) {
    return sendError(id, -32602, `未知资源：${params?.uri}`);
  }
  try {
    sendResult(id, {
      contents: [{
        uri: PANEL_URI,
        mimeType: PANEL_MIME,
        text: panelHtml(),
        _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] } } },
      }],
    });
  } catch (err) {
    sendError(id, -32603, `读取面板资源失败：${err.message}`);
  }
}

/* ------------------------------------------------------------------ dispatch */

async function handleRequest(message) {
  const { id, method, params } = message;

  switch (method) {
    case 'initialize':
      return sendResult(id, {
        protocolVersion: typeof params?.protocolVersion === 'string'
          ? params.protocolVersion
          : FALLBACK_PROTOCOL,
        capabilities: {
          tools: {},
          resources: {},
          extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: [PANEL_MIME] } },
        },
        serverInfo: { name: SERVER_NAME, title: '仪表盘', version: PLUGIN_VERSION },
        instructions:
          '用 metrics 工具回答关于模型回复速度与 token 用量的问题；'
          + '它会读取本机 ZCode 的用量数据库，不需要用户手动操作。'
          + 'panel_snapshot 只服务于会话侧栏面板。',
      });

    case 'ping':
      return sendResult(id, {});

    case 'tools/list':
      return sendResult(id, { tools: [METRICS_TOOL, PANEL_TOOL, QUOTA_TOOL] });

    case 'resources/list':
      return handleResourceList(id);

    case 'resources/templates/list':
      return sendResult(id, { resourceTemplates: [] });

    case 'resources/read':
      return handleResourceRead(id, params);

    case 'tools/call': {
      const name = params?.name;
      if (name !== METRICS_TOOL.name && name !== PANEL_TOOL.name && name !== QUOTA_TOOL.name) {
        return sendError(id, -32602, `未知工具：${name}`);
      }
      try {
        if (name === QUOTA_TOOL.name) {
          const quota = await fetchQuota({ force: Boolean(params?.arguments?.force) });
          return sendResult(id, {
            content: [{ type: 'text', text: formatQuotaText(quota) }],
            structuredContent: quota,
            ...(quota.ok ? {} : { isError: false }),
          });
        }
        if (name === PANEL_TOOL.name) {
          const bound = sessionFromMeta(params?._meta);
          const workdir = params?.arguments?.workdir || process.cwd();
          const modelScope = params?.arguments?.modelScope === 'workspace' ? 'workspace' : 'session';
          const data = runReport({ sessionId: bound, cwd: workdir, limit: 20, modelScope });
          return sendResult(id, {
            content: [{
              type: 'text',
              text: `${bound ? '会话已绑定' : '按目录匹配'}：${data.session.id}`
                + ` · 最新回复 ${fmtDuration(data.latest?.reply.ttftMs)} 首字`
                + ` · ${data.latest?.reply.tps ? data.latest.reply.tps.toFixed(1) : '—'} tok/s`,
            }],
            structuredContent: panelPayload(data),
          });
        }
        const text = renderToolResult(params?.arguments);
        return sendResult(id, { content: [{ type: 'text', text }] });
      } catch (err) {
        return sendResult(id, {
          content: [{ type: 'text', text: `读取回复指标失败：${err.message}` }],
          isError: true,
        });
      }
    }

    default:
      return sendError(id, -32601, `不支持的方法：${method}`);
  }
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let message;
  try {
    message = JSON.parse(trimmed);
  } catch {
    process.stderr.write(`${SERVER_NAME}: 忽略无法解析的行\n`);
    return;
  }
  // Notifications carry no id and expect no reply.
  if (message.id === undefined || message.id === null) return;
  handleRequest(message).catch((err) => {
    sendError(message.id, -32603, err?.message || '内部错误');
  });
});

rl.on('close', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
