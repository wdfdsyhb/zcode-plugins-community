// Canonical official-skill discovery + installation integrity for zcode-remotion.
// Pure logic over paths — unit-tested with fake temp homes; no network, no mutation.
//
// Expected skill names come exclusively from compatibility/remotion.json →
// skills.names (the single canonical list). A candidate directory counts as
// containing an installation when it has at least ONE expected skill with a
// valid <skill>/SKILL.md — the router skill alone is NOT a sentinel, and a
// missing router does NOT mean "not installed" (it means INCOMPLETE).
//
// ZCode scans BOTH of these user-scope locations (canonical first):
//   ~/.zcode/skills   (ZCode-native path)
//   ~/.agents/skills  (where the official `skills` installer puts global installs)
// Project scope is always <repo>/.zcode/skills.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROUTER_SKILL = 'remotion-best-practices';

export const userSkillDirs = (home = homedir()) =>
  [join(home, '.zcode', 'skills'), join(home, '.agents', 'skills')];

export const projectSkillDir = (projectRoot) => join(projectRoot, '.zcode', 'skills');

export const loadExpectedSkillNames = () =>
  JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'compatibility', 'remotion.json'), 'utf8')).skills.names;

const listInstalled = (dir) => {
  if (!existsSync(dir)) return [];
  // Test the SKILL.md path (existsSync follows symlinks) rather than the
  // Dirent type: the installer mirrors user-scope skills as symlinks/junctions,
  // whose Dirent.isDirectory() is false on real machines.
  try {
    return readdirSync(dir)
      .filter((name) => name.startsWith('remotion-') && existsSync(join(dir, name, 'SKILL.md')));
  } catch {
    return []; // unreadable dir — treat as no listing
  }
};

// Inspects one candidate directory against the expected skill list.
function inspectCandidate(dir, expected) {
  const installed = new Set(listInstalled(dir));
  const presentExpected = expected.filter((n) => installed.has(n));
  const missing = expected.filter((n) => !installed.has(n));
  return {
    dir,
    expected: expected.length,
    found: presentExpected.length,
    missing,
    extra: [...installed].filter((n) => !expected.includes(n)),
    complete: presentExpected.length === expected.length,
    hasInstall: presentExpected.length > 0,
  };
}

// Inspect the official-skill installation.
//
// mode (default 'auto'):
//   'project' — inspect ONLY <projectRoot>/.zcode/skills; no user fallback.
//   'global'  — inspect ONLY ~/.zcode/skills and ~/.agents/skills. These two
//               paths are two representations of the same logical GLOBAL
//               scope; they are inspected independently and never unioned:
//               a complete install in either wins; otherwise the incomplete
//               one with the most found skills is reported (tie → canonical
//               ~/.zcode/skills first). Contents are never merged across
//               paths, and never with project scope.
//   'auto'    — general doctor/bootstrap discovery. Strict priority:
//               project → global. The FIRST scope holding ANY expected skill
//               is THE installation, even if incomplete (a partial project
//               install is reported for project repair — never silently
//               replaced by a complete user install).
//
// Result: { mode, scope: 'project'|'user'|'none', dir, expected, found,
//           missing, extra, complete } (scope 'none' → bootstrap/absent).
export function inspectSkillInstall({ mode = 'auto', projectRoot = null, home = homedir(), expectedSkillNames } = {}) {
  if (!['auto', 'project', 'global'].includes(mode)) {
    throw new Error(`unknown mode: ${mode}`);
  }
  if (mode === 'project' && !projectRoot) {
    throw new Error('projectRoot is required in project mode');
  }
  const expected = expectedSkillNames ?? loadExpectedSkillNames();

  let candidates;
  if (mode === 'project') {
    candidates = [{ scope: 'project', dir: projectSkillDir(projectRoot) }];
  } else if (mode === 'global') {
    candidates = userSkillDirs(home).map((dir) => ({ scope: 'user', dir }));
  } else {
    candidates = [
      { scope: 'project', dir: projectSkillDir(projectRoot) },
      ...userSkillDirs(home).map((dir) => ({ scope: 'user', dir })),
    ];
  }

  if (mode === 'global') {
    // One logical scope, two paths: prefer complete, then most-found, then
    // canonical order. Never union contents across paths.
    const inspected = candidates.map((c) => ({ ...c, ...inspectCandidate(c.dir, expected) }));
    const withInstall = inspected.filter((r) => r.hasInstall);
    if (withInstall.length === 0) return absent('global', expected);
    const complete = withInstall.find((r) => r.complete);
    const best = complete ?? withInstall.reduce((a, b) => (b.found > a.found ? b : a));
    return { mode, scope: 'user', ...pick(best) };
  }

  // auto + project: strict priority — first candidate holding ANY expected
  // skill is THE installation (complete or not); scopes never mix.
  for (const c of candidates) {
    const r = inspectCandidate(c.dir, expected);
    if (r.hasInstall) return { mode, scope: c.scope, ...pick(r) };
  }
  return absent(mode, expected);

  function pick(r) {
    return { dir: r.dir, expected: r.expected, found: r.found, missing: r.missing, extra: r.extra, complete: r.complete };
  }
  function absent(m, exp) {
    return { mode: m, scope: 'none', dir: null, expected: exp.length, found: 0, missing: [], extra: [], complete: false };
  }
}

// CLI: node scripts/skill-paths.mjs [--global | --project <dir>] [--home <dir>]
// Default (no scope flag): auto mode (project → global).
// Exit codes: 0 complete · 1 incomplete · 2 absent · 64 CLI usage error.
if (process.argv[1] && process.argv[1].endsWith('skill-paths.mjs')) {
  const args = process.argv.slice(2);
  const KNOWN = new Set(['--global', '--project', '--home']);
  const badFlag = args.find((a) => a.startsWith('--') && !KNOWN.has(a));
  const projectIdx = args.indexOf('--project');
  const wantsGlobal = args.includes('--global');
  const projectArg = projectIdx !== -1 ? args[projectIdx + 1] : undefined;

  if (badFlag) {
    console.error(`skill-paths: unknown option ${badFlag}\nusage: node scripts/skill-paths.mjs [--global | --project <dir>] [--home <dir>]`);
    process.exit(64);
  }
  if (wantsGlobal && projectIdx !== -1) {
    console.error('skill-paths: --global and --project are mutually exclusive\nusage: node scripts/skill-paths.mjs [--global | --project <dir>] [--home <dir>]');
    process.exit(64);
  }
  if (projectIdx !== -1 && (projectArg === undefined || projectArg.startsWith('--'))) {
    console.error('skill-paths: --project requires a directory argument');
    process.exit(64);
  }
  const homeIdx = args.indexOf('--home');
  if (homeIdx !== -1 && (args[homeIdx + 1] === undefined || args[homeIdx + 1].startsWith('--'))) {
    console.error('skill-paths: --home requires a directory argument');
    process.exit(64);
  }

  const mode = wantsGlobal ? 'global' : projectIdx !== -1 ? 'project' : 'auto';
  const result = inspectSkillInstall({
    mode,
    projectRoot: mode === 'global' ? null : projectArg ?? process.cwd(),
    home: homeIdx !== -1 ? args[homeIdx + 1] : homedir(),
  });

  console.log(`mode: ${result.mode}`);
  console.log(`scope: ${result.scope}`);
  if (result.scope === 'none') {
    console.log('Official Remotion skills: not installed');
    console.log(`Repair: /remotion-setup${mode === 'project' ? ' --project' : ''}`);
  } else {
    console.log(`dir: ${result.dir}`);
    console.log(`Official Remotion skills: ${result.found}/${result.expected} present`);
    console.log(`status: ${result.complete ? 'COMPLETE' : 'INCOMPLETE'}`);
    if (result.missing.length) console.log(`Missing:\n${result.missing.map((n) => `- ${n}`).join('\n')}`);
    if (result.extra.length) console.log(`Extra (upstream topology may have changed):\n${result.extra.map((n) => `- ${n}`).join('\n')}`);
    console.log(result.complete
      ? 'Repair: none needed (/remotion-update keeps them current)'
      : `Repair: /remotion-setup${result.scope === 'project' ? ' --project' : ''} (repairs the detected scope — never a different one)`);
  }
  process.exit(result.scope === 'none' ? 2 : result.complete ? 0 : 1);
}
