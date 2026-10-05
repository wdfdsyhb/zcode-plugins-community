#!/usr/bin/env node
// Upstream compatibility observation for zcode-remotion.
//
// Observes the CURRENT upstream state (latest stable Remotion via
// `npm view remotion version`, remotion-dev/skills package version and skill
// names from the official repo), compares it against
// compatibility/remotion.json and classifies the drift.
//
// Modes:
//   node scripts/drift-check.mjs           human-readable report, exit 0
//   node scripts/drift-check.mjs --json    machine-readable JSON on stdout
//   node scripts/drift-check.mjs --write   rewrite the manifest + README
//                                          tested-against lines to the observed
//                                          upstream state (call only after
//                                          validation, e.g. in the nightly PR)
//
// This script never opens issues/PRs itself — the workflow owns that, using the
// JSON emitted here. Pure classification lives in compatibility.mjs.

import { exec } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { classifyDrift, validateManifest, compareSemver } from './compatibility.mjs';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = join(ROOT, 'compatibility', 'remotion.json');
const README_PATHS = [join(ROOT, 'README.md'), join(ROOT, 'README.zh-CN.md')];

const SKILLS_RAW_PKG = 'https://raw.githubusercontent.com/remotion-dev/skills/main/package.json';
const SKILLS_API_DIRS = 'https://api.github.com/repos/remotion-dev/skills/contents/skills';

const npmView = async (pkg, field = 'version') => {
  // exec (shell) is required on Windows: spawning npm.cmd via execFile throws
  // EINVAL since the Node argv-injection fix. The arguments are literals below,
  // never user input.
  if (!/^[@a-z0-9./-]+$/i.test(pkg) || !/^[a-z0-9.]+$/i.test(field)) {
    throw new Error(`unsafe npm view arguments: ${pkg} ${field}`);
  }
  const { stdout } = await promisify(exec)(`npm view ${pkg} ${field}`, { timeout: 60_000, windowsHide: true });
  return stdout.trim();
};

// Authorization for GitHub API requests when a token is available (GitHub
// Actions sets GITHUB_TOKEN). Exported for unit tests; the token is only ever
// placed in the Authorization header, never logged.
export function githubApiHeaders(env = process.env) {
  const headers = { 'user-agent': 'zcode-remotion-drift-check' };
  if (env.GITHUB_TOKEN) headers.authorization = `Bearer ${env.GITHUB_TOKEN}`;
  return headers;
}

const fetchJson = async (url, { withAuth = false } = {}) => {
  const headers = withAuth ? githubApiHeaders() : { 'user-agent': 'zcode-remotion-drift-check' };
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
};

export async function observeUpstream() {
  const upstream = { remotion: null, skillsVersion: null, skillNames: null, mediabunnyVersion: null };
  const failures = [];
  try { upstream.remotion = await npmView('remotion'); }
  catch (e) { failures.push(`npm view remotion version: ${e.message}`); }
  // The official Mediabunny pairing is observed FROM the observed Remotion
  // version (what this exact Remotion release officially declares) — never
  // "latest mediabunny", and never independently of R.
  if (upstream.remotion) {
    try { upstream.mediabunnyVersion = await npmView(`@remotion/media@${upstream.remotion}`, 'dependencies.mediabunny'); }
    catch (e) { failures.push(`official Mediabunny pairing lookup: ${e.message}`); }
  }
  try { upstream.skillsVersion = (await fetchJson(SKILLS_RAW_PKG)).version; }
  catch (e) { failures.push(`skills package.json: ${e.message}`); }
  try {
    const entries = await fetchJson(SKILLS_API_DIRS, { withAuth: true });
    upstream.skillNames = entries.filter((e) => e.type === 'dir').map((e) => e.name);
  } catch (e) { failures.push(`skills listing: ${e.message}`); }
  return { upstream, failures };
}

// Rewrites the manifest and the README tested-against lines to the observed
// upstream state: candidate Remotion, candidate skills, AND the candidate
// official Mediabunny pairing resolved from the candidate Remotion version.
// The result is a CANDIDATE baseline — the real smoke must still pass before
// it can be considered verified.
export function writeUpstream(manifest, upstream, today, { manifestPath = MANIFEST_PATH, readmePaths = README_PATHS } = {}) {
  const next = {
    ...manifest,
    remotion: { ...manifest.remotion, tested: upstream.remotion },
    skills: {
      ...manifest.skills,
      tested: upstream.skillsVersion,
      count: upstream.skillNames.length,
      names: [...upstream.skillNames].sort(),
    },
    // Root-cause fix (PR #9): the candidate baseline carries the OFFICIAL
    // Mediabunny pairing observed for the candidate Remotion version — the
    // previous pairing must never be silently preserved.
    mediabunny: {
      ...manifest.mediabunny,
      tested: upstream.mediabunnyVersion,
    },
    verifiedAt: today,
  };
  writeFileSync(manifestPath, JSON.stringify(next, null, 2) + '\n');
  for (const path of readmePaths) {
    let text = readFileSync(path, 'utf8');
    text = text
      .replace(/Remotion `[^`]+`/, `Remotion \`${upstream.remotion}\``)
      .replace(/(?:official skills|官方技能) `[^`]+`/, (m) =>
        m.startsWith('官方') ? `官方技能 \`${upstream.skillsVersion}\`` : `official skills \`${upstream.skillsVersion}\``)
    writeFileSync(path, text);
  }
  return next;
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
const manifestErrors = validateManifest(manifest);
if (manifestErrors.length) {
  console.error('compatibility/remotion.json is invalid:');
  for (const e of manifestErrors) console.error(`  - ${e}`);
  process.exit(1);
}

const { upstream, failures } = await observeUpstream();
const drift = classifyDrift(manifest, upstream);
const write = process.argv.includes('--write');
const json = process.argv.includes('--json');

if (write) {
  if (drift.level === 'unknown') {
    console.error('--write refused: upstream state unreadable');
    process.exit(1);
  }
  if (drift.level === 'high') {
    console.error('--write refused: high-risk upstream drift requires maintainer review');
    process.exit(1);
  }
  if (drift.level === 'none') {
    console.error('--write skipped: manifest already matches upstream');
  } else if (drift.added.length || drift.removed.length) {
    console.error('--write refused: skill topology changed — maintainer review required (high-risk drift)');
    process.exit(1);
  } else if (compareSemver(upstream.remotion, manifest.remotion.tested) < 0 ||
             compareSemver(upstream.skillsVersion, manifest.skills.tested) < 0 ||
             compareSemver(upstream.mediabunnyVersion, manifest.mediabunny?.tested) < 0) {
    console.error(`--write refused: UPSTREAM VERSION REGRESSION DETECTED (recorded ${manifest.remotion.tested}/${manifest.skills.tested}/${manifest.mediabunny?.tested ?? 'n/a'}, observed ${upstream.remotion}/${upstream.skillsVersion}/${upstream.mediabunnyVersion}) — no automatic downgrade`);
    process.exit(1);
  } else {
    writeUpstream(manifest, upstream, new Date().toISOString().slice(0, 10));
    console.log(`manifest + README updated to Remotion ${upstream.remotion} / skills ${upstream.skillsVersion} / mediabunny ${upstream.mediabunnyVersion}`);
  }
}

if (json) {
  console.log(JSON.stringify({
    level: drift.level,
    reasons: drift.reasons,
    recorded: {
      remotion: manifest.remotion.tested,
      skills: manifest.skills.tested,
      mediabunny: manifest.mediabunny?.tested ?? null,
    },
    upstream: drift.level === 'unknown' ? null : {
      remotion: upstream.remotion,
      skills: upstream.skillsVersion,
      mediabunny: upstream.mediabunnyVersion,
      skillNames: upstream.skillNames,
    },
    prTitle: `chore(remotion): validate compatibility with ${drift.level === 'unknown' ? 'unknown' : upstream.remotion}`,
    prBranch: `chore/compat-remotion-${drift.level === 'unknown' ? 'unknown' : upstream.remotion}`,
    issueTitle: drift.level === 'unknown' ? null :
      `Compatibility review required: Remotion ${upstream.remotion} / skills ${upstream.skillsVersion}`,
    failures,
  }, null, 2));
} else {
  console.log(`recorded : Remotion ${manifest.remotion.tested} / skills ${manifest.skills.tested} / mediabunny ${manifest.mediabunny?.tested ?? 'n/a'} (${manifest.skills.count} skills)`);
  if (drift.level === 'unknown') {
    console.log('upstream : unreadable');
  } else {
    console.log(`upstream : Remotion ${upstream.remotion} / skills ${upstream.skillsVersion} / mediabunny ${upstream.mediabunnyVersion} (${upstream.skillNames.length} skills)`);
  }
  console.log(`drift    : ${drift.level}`);
  for (const r of drift.reasons) console.log(`  - ${r}`);
  for (const f of failures) console.log(`  warn: ${f}`);
}
