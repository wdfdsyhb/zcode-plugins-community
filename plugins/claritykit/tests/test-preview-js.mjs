#!/usr/bin/env node
// Preview-client smoke: the inline client must be syntactically valid JS, and the
// built pages must actually embed it (an empty/stale embed would silently produce
// a diagram-less site).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const client = path.join(root, 'tools', 'lib', 'client-src.mjs');
let failed = 0;
const expect = (label, cond, detail = '') => {
  if (cond) console.log(`PASS  ${label}`);
  else { console.error(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`); failed++; }
};

// 1. syntax
const check = spawnSync(process.execPath, ['--check', client], { encoding: 'utf8' });
expect('client-src.mjs passes node --check', check.status === 0, check.stderr.slice(0, 300));

// 2. embedded in the built examples site
const index = path.join(root, 'examples', 'index.html');
if (fs.existsSync(index)) {
  const html = fs.readFileSync(index, 'utf8');
  const src = fs.readFileSync(client, 'utf8');
  expect('examples index embeds the client verbatim', html.includes(src.trim().slice(0, 400)));
  expect('examples index carries the generated marker', html.startsWith('<!-- clarity-generated -->'));
  expect('cdn pin present', html.includes('mermaid@'));
} else {
  console.log('SKIP  examples site not built yet');
}

// 3. theme switch actually re-renders (static assertion: renderAll is called from
//    applyTheme and from boot — guards against the initialize-only regression that
//    made theme switching a no-op)
{
  const src = fs.readFileSync(client, 'utf8');
  expect('applyTheme triggers renderAll', /applyTheme[\s\S]{0,400}renderAll\(/.test(src));
  expect('boot renders via renderAll', /renderAll\(currentTheme\)/.test(src));
}

console.log(failed ? `\n${failed} check(s) failed` : '\npreview client smoke passed');
process.exit(failed ? 1 : 0);
