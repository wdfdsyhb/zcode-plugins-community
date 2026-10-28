// CommandCode account quota for the plugin's usage panel.
//
// Endpoints (alpha, as used by the `cmd` CLI's /usage):
//   GET https://api.commandcode.ai/alpha/billing/credits
//   GET https://api.commandcode.ai/alpha/billing/subscriptions
//   GET https://api.commandcode.ai/alpha/usage/summary
//
// Auth is the account's `user_...` API key. It is read from ZCode's own
// provider config (the provider pointed at api.commandcode.ai), never logged,
// and only sent to api.commandcode.ai.

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const API_BASE = 'https://api.commandcode.ai/alpha';
const CACHE_MS = 60_000;
const TIMEOUT_MS = 12_000;

// Monthly credit pool per plan (the API only reports what is left).
const PLAN_CAPS = {
  'individual-go': 10,
  'individual-goat': 70,
  'individual-pro': 80,
  'individual-max-10': 150,
  'individual-max-10x': 150,
  'individual-max-20': 300,
  'individual-max-20x': 300,
  'team-pro': 40,
};

let cache = { at: 0, key: null, value: null };

function providerConfigPath() {
  const home = process.env.ZCODE_HOME || join(homedir(), '.zcode');
  return join(home, 'v2', 'provider_config.json');
}

/** API key from the plugin config first, then ZCode's CommandCode provider. */
export function resolveQuotaKey() {
  const explicit = (process.env.INSTRUMENT_COMMANDCODE_KEY || '').trim();
  if (explicit) return { key: explicit, source: 'config' };

  try {
    const config = JSON.parse(readFileSync(providerConfigPath(), 'utf8'));
    const rules = config?.config?.providerConfigRules?.providerRules || [];
    const direct = rules.filter((rule) => String(rule?.config?.api?.baseUrl || '')
      .includes('api.commandcode.ai'));
    const preferred = direct.find((rule) => rule?.enabled !== false) || direct[0];
    const key = preferred?.config?.access?.apiKey;
    if (typeof key === 'string' && key.trim()) {
      return { key: key.trim(), source: `provider:${preferred.providerName || preferred.providerId}` };
    }
    const anyUserKey = rules
      .map((rule) => rule?.config?.access?.apiKey)
      .find((value) => typeof value === 'string' && value.startsWith('user_'));
    if (anyUserKey) return { key: anyUserKey.trim(), source: 'provider' };
  } catch {
    // fall through
  }
  return { key: null, source: 'none' };
}

async function getJson(path, key) {
  const res = await fetch(`${API_BASE}/${path}`, {
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
      'x-command-code-version': '0.40.0',
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${path} -> HTTP ${res.status}${text ? `: ${text.slice(0, 120)}` : ''}`);
  }
  return JSON.parse(text);
}

function windowOf(raw, cap) {
  if (!raw) return null;
  const used = Number(raw.used) || 0;
  const limit = Number(raw.cap) || cap || null;
  return {
    used,
    cap: limit,
    ratio: limit ? used / limit : null,
    resetAt: Number(raw.resetAt) || null,
    exceeded: Boolean(raw.exceeded),
  };
}

/**
 * Fetch the account quota. Cached for a minute because the panel polls; pass
 * `force` for an explicit refresh.
 */
export async function fetchQuota({ force = false } = {}) {
  const { key, source } = resolveQuotaKey();
  if (!key) {
    return { ok: false, error: 'no-key', keySource: source, fetchedAt: Date.now() };
  }
  if (!force && cache.value && Date.now() - cache.at < CACHE_MS) {
    return { ...cache.value, cached: true };
  }

  try {
    const [credits, subscription, summary] = await Promise.all([
      getJson('billing/credits', key),
      getJson('billing/subscriptions', key).catch(() => null),
      getJson('usage/summary', key).catch(() => null),
    ]);

    const sub = subscription?.data || null;
    const planId = sub?.planId || null;
    const monthlyCap = planId ? PLAN_CAPS[planId] ?? null : null;
    const remaining = Number(credits?.credits?.monthlyCredits) || 0;
    const usedFromApi = Number(summary?.totalCost);
    const used = Number.isFinite(usedFromApi) && usedFromApi >= 0
      ? usedFromApi
      : (monthlyCap !== null ? Math.max(0, monthlyCap - remaining) : null);
    const cap = monthlyCap;

    const value = {
      ok: true,
      fetchedAt: Date.now(),
      keySource: source,
      plan: {
        id: planId,
        status: sub?.status || null,
        cap: monthlyCap,
        periodStart: sub?.currentPeriodStart || null,
        periodEnd: sub?.currentPeriodEnd || null,
        cancelAtPeriodEnd: Boolean(sub?.cancelAtPeriodEnd),
      },
      monthly: {
        used,
        cap,
        remaining,
        purchased: Number(credits?.credits?.purchasedCredits) || 0,
        free: Number(credits?.credits?.freeCredits) || 0,
        ratio: cap ? used / cap : null,
        resetAt: sub?.currentPeriodEnd ? Date.parse(sub.currentPeriodEnd) : null,
      },
      fiveHour: windowOf(credits?.windowLimits?.fiveHour, 14),
      weekly: windowOf(credits?.windowLimits?.weekly, 35),
      limited: Boolean(credits?.windowLimits?.limited),
      exceeded: credits?.windowLimits?.exceeded ?? null,
      periodUsage: summary ? {
        requests: Number(summary.totalCount) || 0,
        tokensIn: Number(summary.totalTokensIn) || 0,
        tokensOut: Number(summary.totalTokensOut) || 0,
        totalTokens: Number(summary.totalTokens) || 0,
      } : null,
    };
    cache = { at: Date.now(), key, value };
    return value;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      keySource: source,
      fetchedAt: Date.now(),
    };
  }
}

/** One-line text form, for the model-facing tool. */
export function formatQuotaText(quota) {
  if (!quota.ok) {
    if (quota.error === 'no-key') {
      return '没有找到 CommandCode API key：可在插件配置 commandCodeKey 里填写，或在 ZCode 里配置 api.commandcode.ai 的 provider。';
    }
    return `查询 CommandCode 额度失败：${quota.error}`;
  }
  const money = (n) => (n === null || n === undefined ? '—' : `$${Number(n).toFixed(2)}`);
  const pct = (r) => (r === null || r === undefined ? '—' : `${(r * 100).toFixed(1)}%`);
  const reset = (ms) => {
    if (!ms) return '—';
    const diff = ms - Date.now();
    if (diff <= 0) return '即将重置';
    const minutes = Math.round(diff / 60000);
    if (minutes < 60) return `${minutes} 分钟后重置`;
    const hours = Math.floor(minutes / 60);
    if (hours < 48) return `${hours} 小时 ${minutes % 60} 分后重置`;
    return `${Math.floor(hours / 24)} 天后重置`;
  };
  const lines = [
    `CommandCode ${String(quota.plan.id || '订阅').replace(/^individual-/, '').toUpperCase()}`
      + ` · 状态 ${quota.plan.status === 'active' ? '活跃' : quota.plan.status || '—'}`,
    `5 小时：${money(quota.fiveHour?.used)} / ${money(quota.fiveHour?.cap)}（${pct(quota.fiveHour?.ratio)}）· ${reset(quota.fiveHour?.resetAt)}`,
    `本周：${money(quota.weekly?.used)} / ${money(quota.weekly?.cap)}（${pct(quota.weekly?.ratio)}）· ${reset(quota.weekly?.resetAt)}`,
    `本月：${money(quota.monthly.used)} / ${money(quota.monthly.cap)}（${pct(quota.monthly.ratio)}）`
      + ` · 剩余 ${money(quota.monthly.remaining)} · ${reset(quota.monthly.resetAt)}`,
  ];
  if (quota.periodUsage) {
    lines.push(`本期请求 ${quota.periodUsage.requests} 次 · 输入 ${quota.periodUsage.tokensIn} tok · 输出 ${quota.periodUsage.tokensOut} tok`);
  }
  return lines.join('\n');
}
