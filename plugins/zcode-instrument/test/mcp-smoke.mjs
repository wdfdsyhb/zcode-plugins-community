#!/usr/bin/env node
// Smoke test for the instrument MCP server: handshake, tool visibility, the
// ui:// panel resource, host-bound session reads, and the panel payload shape.
//
//   node test/mcp-smoke.mjs                  # uses the real ZCode database
//   node test/mcp-smoke.mjs --session sess_x

import { spawn, execFile } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const SERVER = fileURLToPath(new URL('../mcp/server.mjs', import.meta.url));
const SCRIPT = fileURLToPath(new URL('../scripts/metrics.mjs', import.meta.url));
const PANEL_URI = 'ui://instrument/panel.html';
const explicitSession = process.argv.includes('--session')
  ? process.argv[process.argv.indexOf('--session') + 1]
  : null;

/** Run the CLI and return stdout (lies about nothing: err yields ''). */
function runCli(args, env = {}) {
  return new Promise((resolve) => {
    execFile(process.execPath, [SCRIPT, ...args], { env: { ...process.env, ...env } },
      (err, stdout) => resolve(err ? '' : stdout));
  });
}

const child = spawn(process.execPath, [SERVER], { stdio: ['pipe', 'pipe', 'pipe'] });
child.stderr.on('data', (chunk) => process.stderr.write(`[server] ${chunk}`));

const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
const waiting = new Map();
rl.on('line', (line) => {
  if (!line.trim()) return;
  const message = JSON.parse(line);
  const slot = waiting.get(message.id);
  if (!slot) return;
  waiting.delete(message.id);
  if (message.error) slot.reject(new Error(`${message.error.code}: ${message.error.message}`));
  else slot.resolve(message.result);
});

let nextId = 1;
function rpc(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    setTimeout(() => {
      if (waiting.delete(id)) reject(new Error(`timeout: ${method}`));
    }, 15000).unref();
  });
}
const notify = (method, params) => child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`);

let failures = 0;
function check(label, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

const callPanel = (args, meta) => rpc('tools/call', {
  name: 'panel_snapshot',
  arguments: args,
  ...(meta ? { _meta: meta } : {}),
});

try {
  const init = await rpc('initialize', {
    protocolVersion: '2025-11-21',
    capabilities: {},
    clientInfo: { name: 'mcp-smoke', version: '1' },
  });
  notify('notifications/initialized');
  check('initialize returns server info', init?.serverInfo?.name === 'instrument', init?.serverInfo?.title);
  check('initialize echoes protocol version', init?.protocolVersion === '2025-11-21');
  check('declare tools + resources',
    Boolean(init?.capabilities?.tools) && Boolean(init?.capabilities?.resources));
  check('declare MCP Apps UI extension',
    Boolean(init?.capabilities?.extensions?.['io.modelcontextprotocol/ui']?.mimeTypes?.includes('text/html;profile=mcp-app')));

  const tools = await rpc('tools/list', {});
  const names = (tools.tools || []).map((tool) => tool.name);
  check('expose metrics + panel_snapshot',
    names.includes('metrics') && names.includes('panel_snapshot'), names.join(', '));
  check('expose the quota tool', names.includes('quota'));
  const panelTool = (tools.tools || []).find((tool) => tool.name === 'panel_snapshot');
  check('panel tool is App-only', JSON.stringify(panelTool?._meta?.ui?.visibility) === '["app"]');
  check('panel tool accepts a model scope',
    JSON.stringify(panelTool?.inputSchema?.properties?.modelScope?.enum) === '["session","workspace"]');
  check('metrics tool stays model-visible',
    !(tools.tools || []).find((tool) => tool.name === 'metrics')?._meta?.ui?.visibility);

  const list = await rpc('resources/list', {});
  const resource = (list.resources || []).find((entry) => entry.uri === PANEL_URI);
  check('list the panel resource', Boolean(resource));
  check('panel resource uses the MCP Apps mime type', resource?.mimeType === 'text/html;profile=mcp-app');
  check('panel resource declares no network access',
    JSON.stringify(resource?._meta?.ui?.csp) === '{"connectDomains":[],"resourceDomains":[]}');

  const read = await rpc('resources/read', { uri: PANEL_URI });
  const html = read?.contents?.[0]?.text || '';
  check('read returns panel html', html.startsWith('<!doctype html'), `${html.length} bytes`);
  check('panel performs the App handshake', html.includes("request('ui/initialize'"));
  check('panel calls the App-only tool', html.includes("name: 'panel_snapshot'"));
  check('panel renders all four tabs',
    ['overview', 'replies', 'models', 'tools'].every((tab) => html.includes(`data-tab="${tab}"`)));

  let unknownResourceFailed = false;
  try {
    await rpc('resources/read', { uri: 'ui://nope/x.html' });
  } catch {
    unknownResourceFailed = true;
  }
  check('unknown resource is rejected', unknownResourceFailed);

  const cwd = process.cwd();
  const reply = await rpc('tools/call', { name: 'metrics', arguments: { view: 'reply', cwd } });
  const replyText = reply?.content?.[0]?.text || '';
  check('metrics tool answers with a report', replyText.includes('仪表盘'), replyText.split('\n')[0]);
  check('text report includes the time split', replyText.includes('时间构成'));
  check('text report includes tool time', replyText.includes('工具耗时'));

  const boundSession = explicitSession
    || (replyText.match(/sess_[A-Za-z0-9-]+/) || [])[0];
  const bound = await callPanel({ modelScope: 'session' }, {
    'com.zcode/request-context': { session_id: boundSession },
  });
  const payload = bound?.structuredContent;
  check('panel snapshot binds to the host session id', payload?.session?.id === boundSession,
    `${payload?.session?.id} vs ${boundSession}`);
  check('payload carries the reply metrics',
    payload?.reply === null || 'ttftMs' in (payload?.reply || {}));
  check('payload carries trend data', Array.isArray(payload?.trend));
  check('payload carries the reply list', Array.isArray(payload?.replies));
  check('payload carries the session time split',
    payload?.timeSplit === null || typeof payload?.timeSplit?.totalMs === 'number');
  if (payload?.timeSplit) {
    const sp = payload.timeSplit;
    const sum = sp.ttftMs + sp.genMs + sp.toolMs + sp.gapMs;
    check('session slices add up to active time', Math.abs(sum - sp.totalMs) < 5,
      `${Math.round(sum / 1000)}s vs ${Math.round(sp.totalMs / 1000)}s`);
  }
  check('payload carries tool stats', Array.isArray(payload?.tools));
  check('payload carries model stats', Array.isArray(payload?.models));
  check('payload carries failure stats', payload?.failures === null || Array.isArray(payload?.failures?.recent));
  check('payload carries turn phases',
    payload?.phases === null || (typeof payload?.phases?.totalMs === 'number' && payload.phases.totalMs > 0));
  check('turn phase slices add up to the turn duration',
    !payload?.phases || payload.phases.sumsToTotal !== false);
  check('payload carries context usage',
    payload?.context === null || payload?.context === undefined
      || payload.context.window === null || typeof payload.context.ratio === 'number');
  check('payload carries health', Boolean(payload?.health?.totals),
    payload?.health ? `${Math.round((payload.health.totals.successRate || 0) * 100)}%` : '');

  const first = (payload?.replies || [])[0];
  if (first) {
    check('replies carry previews or an in-flight turn',
      typeof first.userPreview === 'string' && typeof first.replyPreview === 'string',
      `Q「${(first.userPreview || '').slice(0, 24)}」 A「${(first.replyPreview || '').slice(0, 24)}」`);
    check('newest replies carry expandable request rows',
      Array.isArray(first.requests), `${(first.requests || []).length} rows`);
  }

  const workspace = await callPanel({ modelScope: 'workspace' }, {
    'com.zcode/request-context': { session_id: boundSession },
  });
  const workspacePayload = workspace?.structuredContent;
  check('workspace scope is applied', workspacePayload?.modelScope === 'workspace');
  check('workspace scope can surface more models',
    (workspacePayload?.models || []).length >= (payload?.models || []).length,
    `workspace ${(workspacePayload?.models || []).length} vs session ${(payload?.models || []).length}`);

  if (payload?.reply) {
    console.log(`      sample: ${payload.reply.modelId} · ${payload.reply.providerName}`
      + ` · ${payload.reply.ttftMs}ms ttft · ${payload.reply.tps} tok/s · ${payload.reply.outputTokens} out`);
    const providerId = payload.reply.providerId;
    const providerName = payload.reply.providerName;
    check('provider display name resolved from ZCode config',
      Boolean(providerName) && providerName !== providerId, `${providerId} → ${providerName}`);
  }

  // An explicit mapping must still win over the on-disk names.
  const providerId = payload?.reply?.providerId;
  if (providerId) {
    const overridden = await runCli(
      ['--cwd', cwd, '--provider-names', `${providerId}=Overridden Name`],
      { INSTRUMENT_PROVIDER_NAMES: '' },
    );
    check('manual provider override wins', overridden.includes('Overridden Name'),
      `${providerId} → Overridden Name`);

    const viaEnv = await runCli(['--cwd', cwd], { INSTRUMENT_PROVIDER_NAMES: `${providerId}=Env Name` });
    check('provider mapping works through the env var', viaEnv.includes('Env Name'));
  }

  const modelsWithProvider = (payload?.models || []).filter((m) => m.providerName && m.providerName !== m.providerId);
  check('model rollup carries provider names', modelsWithProvider.length > 0,
    modelsWithProvider.map((m) => m.providerName).join(', '));

  if (payload?.tools?.length) {
    console.log(`      tools: ${payload.tools.slice(0, 3).map((x) => `${x.short}:${Math.round(x.totalMs / 1000)}s`).join(' ')}`);
  }
  if (payload?.models?.length) {
    console.log(`      models: ${(workspacePayload?.models || []).map((x) => `${x.modelId.split('/').pop()}=${x.tps}tps`).join(' ')}`);
  }
} catch (err) {
  check('smoke test completed', false, err.message);
} finally {
  child.kill();
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
