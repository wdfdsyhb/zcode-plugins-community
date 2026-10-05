#!/usr/bin/env node
// Static verifier for the ZCode remotion plugin. CI gate + local dev tool.
// Pure functions are exported for unit tests; CLI mode runs the full check.

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateManifest, checkRouterCoverage } from './compatibility.mjs';

const PLUGIN_NAME_RE = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const COMMAND_NAME_RE = /^[a-z0-9][a-z0-9_:-]{0,63}$/;
const PLACEHOLDER_RE = /\b(TBD|TODO|FIXME|XXX)\b/;
// Product-promise consistency: the render gate is AUTONOMOUS agent visual QA
// ("one prompt from idea to MP4"). These stale human-approval-gate phrasings
// contradict that promise and must not reappear in shipped content.
const FORBIDDEN_GATE_PHRASES = [
  'still frame for approval',
  'still frame you approve',
  'still frame for you to approve',
  'wait for your approval',
  'wait for user approval',
  'only after the user approves',
  'user approves the still',
  'only after your approval',
  'approve the look',
  '先渲染静帧给你确认',
  '先确认画面',
];
const SEMVER_RE = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

export function parseFrontmatter(text) {
  // Normalize CRLF (Windows autocrlf checkouts) — in JS regex, `.` does not
  // match \r and `$` does not assert before it, so unnormalized CRLF lines
  // with values silently fail the key match below.
  const normalized = text.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---')) throw new Error('frontmatter: missing opening ---');
  const end = normalized.indexOf('\n---', 3);
  if (end === -1) throw new Error('frontmatter: missing closing ---');
  const raw = normalized.slice(4, end).trim();
  const data = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (m) data[m[1]] = m[2].replace(/^['"]|['"]$/g, '').trim();
  }
  return { data, raw, body: normalized.slice(end + 4) };
}

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = join(dir, e.name);
  return e.isDirectory() ? walk(p) : [p];
});

export const extractUrls = (text) =>
  [...text.matchAll(/https?:\/\/[^\s)\]>'"]+/g)]
    .map((m) => m[0].replace(/[.,;:!?)\]}'"`]+$/, ''));

export async function verifyPlugin(root, { offline = false } = {}) {
  const errors = [];
  const warnings = [];

  // 1. plugin.json
  const manifestPath = join(root, '.zcode-plugin', 'plugin.json');
  if (!existsSync(manifestPath)) return { errors: ['.zcode-plugin/plugin.json is missing'], warnings };
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (!PLUGIN_NAME_RE.test(manifest.name ?? '')) errors.push(`invalid plugin name: ${manifest.name}`);
  if (!SEMVER_RE.test(manifest.version ?? '')) errors.push('plugin.json: version must be semver');
  // The current ZCode plugin spec supports these fields, but this repository is
  // deliberately zero-config: the restriction is project policy, not the spec.
  for (const key of ['hooks', 'mcpServers', 'userConfig', 'dependencies']) {
    if (manifest[key]) errors.push(`plugin.json: ${key} is forbidden by zcode-remotion project policy (zero-config plugin)`);
  }

  // 2. declared component dirs exist (manifests may use string or array form)
  const asList = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
  const declaredDirs = [...asList(manifest.skills), ...asList(manifest.commands)]
    .filter((p) => typeof p === 'string' && !p.endsWith('.md'));
  for (const d of declaredDirs) {
    if (!existsSync(join(root, d))) errors.push(`declared component directory missing: ${d}`);
  }

  // 3. skills
  const skillsRoot = join(root, 'skills');
  let routerSkillText = null;
  if (existsSync(skillsRoot)) {
    for (const entry of readdirSync(skillsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const md = join(skillsRoot, entry.name, 'SKILL.md');
      if (!existsSync(md)) { errors.push(`skills/${entry.name}: SKILL.md missing`); continue; }
      try {
        const text = readFileSync(md, 'utf8');
        const { data, raw } = parseFrontmatter(text);
        if (!data.name) errors.push(`skills/${entry.name}: frontmatter name missing`);
        if (!data.description || data.description.length < 20) {
          errors.push(`skills/${entry.name}: description missing or too short to state when-to-use`);
        }
        if ((data.description ?? '').length > 1024) {
          errors.push(`skills/${entry.name}: description exceeds 1024 chars`);
        }
        if (entry.name === manifest.name) {
          routerSkillText = text;
          const m = raw.match(/^\s+version:\s*["']?([^"'\s]+)["']?\s*$/m);
          if (!m || m[1] !== manifest.version) {
            errors.push(`skills/${entry.name}: metadata version ${m ? m[1] : 'missing'} != plugin.json ${manifest.version}`);
          }
        }
      } catch (err) {
        errors.push(`skills/${entry.name}: ${err.message}`);
      }
    }
  }

  // 4. commands
  const commandsRoot = join(root, 'commands');
  if (existsSync(commandsRoot)) {
    for (const f of readdirSync(commandsRoot)) {
      if (!f.endsWith('.md')) continue;
      if (!COMMAND_NAME_RE.test(f.replace(/\.md$/, ''))) {
        errors.push(`commands/${f}: filename violates ZCode command naming`);
      }
      try {
        const text = readFileSync(join(commandsRoot, f), 'utf8');
        const { data } = parseFrontmatter(text);
        if (!data.description) errors.push(`commands/${f}: description frontmatter missing`);
        // Single source of truth: the update flow must consume
        // compatibility/remotion.json, never a memorized skill list.
        if (f === 'remotion-update.md') {
          if (!text.includes('compatibility/remotion.json')) {
            errors.push('commands/remotion-update.md: must read skill names from compatibility/remotion.json (single source of truth)');
          }
          const hardcoded = text.match(/remotion-[a-z]+.*remotion-[a-z]+.*remotion-[a-z]+/);
          if (hardcoded) {
            errors.push('commands/remotion-update.md: hard-coded skill-name list detected — use compatibility/remotion.json skills.names');
          }
          // Generic user-facing instructions must stay cross-platform:
          // $(...) is Bash-only and silently breaks PowerShell/cmd users.
          if (text.includes('$(')) {
            errors.push('commands/remotion-update.md: shell-specific $() substitution detected — use a cross-platform command form');
          }
        }
      } catch (err) {
        errors.push(`commands/${f}: ${err.message}`);
      }
    }
  }

  // 5. marketplace.json version sync + entry metadata shape
  const mpPath = join(root, 'marketplace.json');
  if (!existsSync(mpPath)) {
    errors.push('marketplace.json missing');
  } else {
    const mp = JSON.parse(readFileSync(mpPath, 'utf8'));
    const entry = (mp.plugins ?? []).find((p) => p.name === manifest.name);
    if (!entry) errors.push('marketplace.json: plugin entry not found');
    else {
      if (entry.version !== manifest.version) {
        errors.push(`version mismatch: plugin.json ${manifest.version} vs marketplace.json ${entry.version}`);
      }
      if (entry.category != null && typeof entry.category !== 'string') {
        errors.push('marketplace.json: category must be a string');
      }
      if (entry.tags != null && (!Array.isArray(entry.tags) || entry.tags.some((t) => typeof t !== 'string' || !t))) {
        errors.push('marketplace.json: tags must be an array of non-empty strings');
      }
      if (entry.strict != null && typeof entry.strict !== 'boolean') {
        errors.push('marketplace.json: strict must be a boolean');
      }
    }
  }

  // 6. compatibility manifest — canonical machine-readable upstream baseline
  const compatPath = join(root, 'compatibility', 'remotion.json');
  let compat = null;
  if (!existsSync(compatPath)) {
    errors.push('compatibility/remotion.json is missing (canonical upstream baseline)');
  } else {
    try {
      compat = JSON.parse(readFileSync(compatPath, 'utf8'));
      const compatErrors = validateManifest(compat);
      errors.push(...compatErrors.map((e) => `compatibility/remotion.json: ${e}`));
      if (compatErrors.length === 0 && routerSkillText) {
        const missing = checkRouterCoverage(compat.skills.names, routerSkillText);
        for (const name of missing) {
          errors.push(`compatibility/remotion.json: skill "${name}" has no routing coverage in skills/${manifest.name}/SKILL.md`);
        }
      }
    } catch (err) {
      errors.push(`compatibility/remotion.json: ${err.message}`);
    }
  }

  // 7. shipped-file checks: placeholders + README tested-against sync
  const shippedRoots = ['skills', 'commands', '.zcode-plugin', 'compatibility'].map((d) => join(root, d));
  const shippedFiles = [...shippedRoots.filter(existsSync).flatMap(walk),
    ...['README.md', 'README.zh-CN.md', 'marketplace.json'].map((f) => join(root, f)).filter(existsSync)];
  for (const f of shippedFiles) {
    const text = readFileSync(f, 'utf8');
    const m = text.match(PLACEHOLDER_RE);
    if (m) errors.push(`${f}: contains placeholder token ${m[0]}`);
    const normalized = text.replace(/\r\n/g, '\n').toLowerCase();
    for (const phrase of FORBIDDEN_GATE_PHRASES) {
      if (normalized.includes(phrase.toLowerCase())) {
        errors.push(`${f}: contradicts the autonomous visual-QA promise ("${phrase}") — the still gate is agent-inspected, human approval is opt-in`);
      }
    }
  }
  if (compat) {
    for (const f of ['README.md', 'README.zh-CN.md']) {
      const p = join(root, f);
      if (!existsSync(p)) continue;
      const text = readFileSync(p, 'utf8');
      const rm = text.match(/Remotion `([^`]+)`/);
      const sm = text.match(/(?:official skills|官方技能) `([^`]+)`/);
      if (!rm || !sm) errors.push(`${f}: tested-against line missing (Remotion \`x.y.z\` · official skills \`x.y.z\`)`);
      else {
        if (rm[1] !== compat.remotion.tested) errors.push(`${f}: tested Remotion ${rm[1]} != compatibility manifest ${compat.remotion.tested}`);
        if (sm[1] !== compat.skills.tested) errors.push(`${f}: tested skills ${sm[1]} != compatibility manifest ${compat.skills.tested}`);
      }
    }
  }

  // 8. CHANGELOG latest version must match the release version
  const changelogPath = join(root, 'CHANGELOG.md');
  if (existsSync(changelogPath)) {
    const m = readFileSync(changelogPath, 'utf8').match(/^##\s+(\d+\.\d+\.\d+)/m);
    if (!m || m[1] !== manifest.version) {
      errors.push(`CHANGELOG.md: latest version heading ${m ? m[1] : 'missing'} != plugin.json ${manifest.version}`);
    }
  }

  // 9. CI compatibility gate must render a real MP4 — "verified MP4" claims
  //    require MP4 evidence, not a still-only smoke.
  const ciPath = join(root, '.github', 'workflows', 'ci.yml');
  if (existsSync(ciPath)) {
    const ci = readFileSync(ciPath, 'utf8');
    if (!ci.includes('compat-smoke.mjs --mp4')) {
      errors.push('.github/workflows/ci.yml: the compat-smoke gate must run `compat-smoke.mjs --mp4` (a still-only gate cannot support verified-MP4 claims)');
    }
  }

  // 9. link check (online only)
  if (!offline) {
    const urls = new Set(shippedFiles.flatMap((f) => extractUrls(readFileSync(f, 'utf8'))));
    for (const url of urls) {
      try {
        const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
        if (!res.ok) errors.push(`link check failed (${res.status}): ${url}`);
      } catch {
        warnings.push(`link check unreachable (network?): ${url}`);
      }
    }
  }

  return { errors, warnings };
}

if (process.argv[1] && process.argv[1].endsWith('verify-plugin.mjs')) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const offline = process.argv.includes('--offline');
  const { errors, warnings } = await verifyPlugin(root, { offline });
  for (const w of warnings) console.warn(`WARN: ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`FAIL: ${e}`);
    process.exit(1);
  }
  console.log('verify-plugin: all checks passed');
}
