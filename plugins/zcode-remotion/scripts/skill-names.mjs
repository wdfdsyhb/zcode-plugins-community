#!/usr/bin/env node
// Prints the official Remotion skill names recorded in
// compatibility/remotion.json — the ONE canonical list.
//
//   node scripts/skill-names.mjs           space-separated names (for xargs / `npx skills update`)
//   node scripts/skill-names.mjs --count   just the count
//
// The update workflow (/remotion-update) must consume THIS list — never a
// memorized copy — so a new upstream skill recorded in the manifest is
// automatically included.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { skills } = JSON.parse(readFileSync(join(ROOT, 'compatibility', 'remotion.json'), 'utf8'));

if (process.argv.includes('--count')) {
  console.log(skills.count);
} else {
  console.log(skills.names.join(' '));
}
