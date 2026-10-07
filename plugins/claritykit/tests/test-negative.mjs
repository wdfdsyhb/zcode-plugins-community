#!/usr/bin/env node
// Negative fixtures: the tools must actually FAIL on broken inputs — a green-only
// regression can't prove the validators reject anything.
//  - broken.mmd            → check.mjs exit 1
//  - bad.behavior.yaml     → validate exit 1, error text mentions the real causes
//  - bad.contracts.yaml    → validate exit 1, error text mentions the real causes
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const node = process.execPath;
let failed = 0;

const run = (script, args) => spawnSync(node, [path.join(root, 'tools', script), ...args], { encoding: 'utf8' });

function expect(label, cond, detail = '') {
  if (cond) console.log(`PASS  ${label}`);
  else { console.error(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`); failed++; }
}

// 1. broken mermaid
{
  const r = run('check.mjs', [path.join(root, 'tests', 'fixtures', 'broken.mmd')]);
  expect('check rejects broken.mmd', r.status === 1, `exit ${r.status}`);
  expect('check names the failing file', r.stdout.includes('broken.mmd'), r.stdout.slice(0, 200));
}

// 2. broken behavior model
{
  const f = path.join(root, 'tests', 'fixtures', 'bad.behavior.yaml');
  const r = run('validate.mjs', [f]);
  const out = r.stdout + r.stderr;
  expect('validate rejects bad.behavior.yaml', r.status === 1, `exit ${r.status}`);
  expect('  duplicate unguarded transitions reported', out.includes('unguarded transitions on GO'));
  expect('  undeclared actor reported', out.includes("'worker' is not declared in actors"));
  expect('  missing onError reported', out.includes('must declare onError'));
  expect('  unreachable state reported', out.includes('unreachable'), out);
}

// 3. broken contract sheet
{
  const f = path.join(root, 'tests', 'fixtures', 'bad.contracts.yaml');
  const r = run('validate.mjs', [f]);
  const out = r.stdout + r.stderr;
  expect('validate rejects bad.contracts.yaml', r.status === 1, `exit ${r.status}`);
  expect('  maybe without absent_means reported', out.includes("requires absent_means"));
  expect('  undeclared operation error reported', out.includes("'exploded' is not declared in the errors registry"));
  expect('  orphan error warned', out.includes('never referenced by any operation'), out);
}

console.log(failed ? `\n${failed} check(s) failed` : '\nnegative fixtures: all rejected as expected');
process.exit(failed ? 1 : 0);
