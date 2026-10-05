#!/usr/bin/env node
// Release consistency check.
//
// Local mode (deterministic, no network): plugin.json version must match the
// latest CHANGELOG heading. The full static sync (marketplace.json, SKILL.md,
// README badges) is enforced by scripts/verify-plugin.mjs.
//
//   node scripts/release-check.mjs             local checks
//   node scripts/release-check.mjs --github    additionally compare against
//                                              the latest GitHub release tag
//                                              (needs authenticated `gh`;
//                                              skipped with a note otherwise)
//
// Exit 1 on real drift, 0 otherwise.

import { exec } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { compareSemver } from './compatibility.mjs';

const run = promisify(exec);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(readFileSync(join(ROOT, '.zcode-plugin', 'plugin.json'), 'utf8')).version;
let failed = false;

const fail = (msg) => { console.error(`release-check FAIL: ${msg}`); failed = true; };

// 1. CHANGELOG latest heading
const changelog = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8');
const m = changelog.match(/^##\s+(\d+\.\d+\.\d+)/m);
if (!m || m[1] !== version) fail(`CHANGELOG latest heading ${m ? m[1] : 'missing'} != plugin.json ${version}`);
else console.log(`release-check: CHANGELOG ${m[1]} == plugin.json ${version}`);

// 2. optional: latest GitHub release (only when explicitly requested + gh works)
if (process.argv.includes('--github')) {
  try {
    const { stdout } = await run('gh api repos/:owner/:repo/releases/latest --jq .tag_name', { timeout: 30_000, windowsHide: true });
    const latest = stdout.trim().replace(/^v/, '');
    const c = compareSemver(latest, version);
    if (c === null) fail(`cannot parse versions: release v${latest} vs plugin.json ${version}`);
    else if (c === 0) console.log(`release-check: GitHub latest release v${latest} == plugin.json ${version}`);
    else if (c > 0) fail(`GitHub latest release v${latest} is NEWER than plugin.json ${version} — source/release version drift`);
    else console.log(`release-check: GitHub latest release v${latest} is older than plugin.json ${version} (release for v${version} not yet published)`);
  } catch {
    console.log('release-check: gh unavailable/unauthenticated — GitHub release comparison skipped (local checks are authoritative)');
  }
}

process.exit(failed ? 1 : 0);
