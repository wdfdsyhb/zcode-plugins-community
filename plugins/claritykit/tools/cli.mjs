#!/usr/bin/env node
// clarity — single entry point for all ClarityKit tools.
// The AI never chooses paths: project root is derived (nearest .git upward,
// fallback cwd), artifacts live in <root>/docs/clarity, the server serves it.
// check/preview take NO directory argument — linting an arbitrary directory is a
// tool-layer job (node tools/check.mjs <dir>), never something skills do.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findProjectRoot, clarityDir, adrDir, nextAdrNumber } from './lib/root.mjs';
import { validateFlow, flowPath } from './lib/flow.mjs';

const TOOLS = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(TOOLS, '..');
const [cmd, ...args] = process.argv.slice(2);

// version is single-sourced from package.json; every plugin manifest must agree
// (checked by `clarity doctor` and the release smoke test).
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
function manifestVersions() {
  const slots = [
    ['plugin.json', 'plugin.json', (d) => d.version],
    ['.zcode-plugin/plugin.json', '.zcode-plugin/plugin.json', (d) => d.version],
    ['.claude-plugin/plugin.json', '.claude-plugin/plugin.json', (d) => d.version],
    ['.claude-plugin/marketplace.json (plugins[0])', '.claude-plugin/marketplace.json', (d) => d?.plugins?.[0]?.version],
    ['.claude-plugin/marketplace.json (metadata)', '.claude-plugin/marketplace.json', (d) => d?.metadata?.version],
    ['.codex-plugin/plugin.json', '.codex-plugin/plugin.json', (d) => d.version],
  ];
  return slots.map(([label, file, pick]) => {
    try { return { label, version: pick(JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'))) }; }
    catch { return { label, version: null }; }
  });
}

// flow.yaml is AI-maintained; every command validates it (warn-only) so drift is
// surfaced at the next tool call instead of silently accumulating.
function reportFlow() {
  const v = validateFlow(clarityDir());
  if (!v) return;
  for (const e of v.errors) console.error(`flow.yaml: ERROR ${e}`);
  for (const w of v.warnings) console.error(`flow.yaml: warn ${w}`);
  if (v.errors.length) console.error('flow.yaml: repair it (see the clarity-flow skill for the schema); commands still ran.');
}

function run(tool, toolArgs) {
  const r = spawnSync(process.execPath, [path.join(TOOLS, tool), ...toolArgs], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}

function usage() {
  console.log(`clarity — ClarityKit CLI

  clarity doctor                   diagnose the installation (run this first when in doubt)
  clarity version                  print the ClarityKit version (verify after any update)
  clarity status                   project snapshot: flow progress, artifacts, preview, freshness
  clarity root                     print derived project root and staging dir
  clarity init [name...]        no arg: scaffold the staging layout;
                                   with arg(s): scaffold docs/clarity/behaviors/<name>/
  clarity adr                      print next ADR path (docs/adr/ADR-NNN)
  clarity validate <model.yaml>    lint a behavior model or contract sheet (auto-detected)
  clarity render <behavior.yaml>   generate machine views (generated-diagrams/overview + detailed .mmd)
  clarity check                    verify every diagram in the staging dir parses
  clarity publish                  check, then on success build/update the preview site
  clarity preview                  build/update the preview site (skips the check)
  clarity versions <spec...>       batch-verify current versions (npm packages, gh:owner/repo)
  clarity server start|stop|status manage the per-project preview server`);
  process.exit(cmd ? 1 : 0);
}

const BUCKETS = ['direction', 'requirements', 'architecture', 'behaviors', 'data', 'prototypes', 'acceptance'];

if (cmd && cmd !== 'doctor' && cmd !== 'help' && cmd !== undefined) reportFlow();

switch (cmd) {
  case 'version':
  case '--version':
  case '-v': {
    console.log(`claritykit ${VERSION}`);
    break;
  }
  case 'doctor': {
    let fail = 0;
    const check = (ok, label, hint) => {
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  → ${hint}`}`);
      if (!ok) fail++;
    };
    console.log(`INFO  claritykit ${VERSION}`);
    // 1. all plugin manifests agree on the version (update verification)
    const mismatches = manifestVersions().filter((m) => m.version !== VERSION);
    check(!mismatches.length, 'plugin manifests agree on the version', mismatches.map((m) => `${m.label} says ${m.version ?? 'missing'}`).join('; '));
    // 1. on PATH?
    const onPath = (process.env.PATH ?? '').split(path.delimiter).some((dir) => {
      try { fs.accessSync(path.join(dir, 'clarity'), fs.constants.X_OK); return true; }
      catch { return false; }
    });
    check(onPath, '`clarity` is on PATH', 'symlink tools/clarity into ~/.local/bin (see README Install), or export PATH="$HOME/.local/bin:$PATH" for this shell session');
    // 2. node version
    const major = Number(process.versions.node.split('.')[0]);
    check(major >= 18, `node >= 18 (found ${process.versions.node})`, 'upgrade node');
    // 3. tool dependencies installed
    const dep = (n) => fs.existsSync(path.join(TOOLS, 'node_modules', n));
    check(dep('yaml') && dep('mermaid') && dep('jsdom'), 'tool dependencies installed (yaml, mermaid, jsdom)', `run: cd "${TOOLS}" && npm install`);
    // 4. registry writable
    const regDir = path.join(process.env.HOME, '.claritykit');
    let writable = true;
    try { fs.mkdirSync(regDir, { recursive: true }); fs.accessSync(regDir, fs.constants.W_OK); }
    catch { writable = false; }
    check(writable, `registry dir writable (${regDir})`, 'check permissions of your home directory');
    // 5. project root derivable
    const root = findProjectRoot();
    console.log(`INFO  project root: ${root}`);
    console.log(`INFO  staging dir:  ${clarityDir()}`);
    // 6. flow.yaml (only when the design flow was activated)
    if (fs.existsSync(flowPath(clarityDir()))) {
      const v = validateFlow(clarityDir());
      if (v.errors.length) { console.log(`FAIL  flow.yaml valid — ${v.errors.length} error(s)`); fail++; v.errors.forEach((e) => console.log(`      ${e}`)); }
      else console.log('PASS  flow.yaml valid');
      v.warnings.forEach((w) => console.log(`warn  flow.yaml: ${w}`));
    }
    console.log(fail ? `doctor: ${fail} problem(s) found` : 'doctor: all checks passed');
    process.exit(fail ? 1 : 0);
  }
  case 'root': {
    console.log(`project root: ${findProjectRoot()}`);
    console.log(`staging dir:  ${clarityDir()}`);
    break;
  }
  case 'init': {
    if (!args.length) {
      // scaffold the canonical staging layout — existing dirs bias the AI to use them
      for (const b of BUCKETS) fs.mkdirSync(path.join(clarityDir(), b), { recursive: true });
      console.log(`staging layout ready: ${clarityDir()}/ { ${BUCKETS.join(', ')} }`);
    } else {
      for (const name of args) {
        if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
          console.error('usage: clarity init [name...]  (lowercase, digits, hyphens)');
          process.exit(1);
        }
        const dir = path.join(clarityDir(), 'behaviors', name);
        fs.mkdirSync(dir, { recursive: true });
        console.log(dir);
      }
    }
    break;
  }
  case 'adr': {
    console.log(path.join(adrDir(), `ADR-${nextAdrNumber()}-<title>.md`));
    break;
  }
  case 'check':
  case 'preview': {
    if (args.length) {
      console.error(`\`clarity ${cmd}\` takes no arguments — it always uses the staging dir (${clarityDir()}).`);
      console.error(`(linting an arbitrary directory is tool-layer usage: node ${path.join(TOOLS, `${cmd}.mjs`)} <dir>)`);
      process.exit(2);
    }
    run(`${cmd}.mjs`, [clarityDir()]);
    break;
  }
  case 'publish': {
    // check-then-build: the two halves of every "verify + publish" cycle, one call.
    if (args.length) {
      console.error('`clarity publish` takes no arguments — it always uses the staging dir.');
      process.exit(2);
    }
    const check = spawnSync(process.execPath, [path.join(TOOLS, 'check.mjs'), clarityDir()], { stdio: 'inherit' });
    if (check.status !== 0) {
      console.error('publish: check failed — preview site NOT rebuilt. Fix the diagrams first.');
      process.exit(check.status ?? 1);
    }
    run('preview.mjs', [clarityDir()]);
    break;
  }
  case 'status':
    run('status.mjs', [clarityDir()]);
    break;
  case 'versions':
    if (!args.length) usage();
    run('versions.mjs', args);
    break;
  case 'validate':
  case 'render':
    if (!args.length) usage();
    run(`${cmd}.mjs`, args);
    break;
  case 'server': {
    const [sub, ...rest] = args;
    if (!['start', 'stop', 'status'].includes(sub ?? '')) {
      console.error('usage: clarity server start|stop|status');
      process.exit(2);
    }
    if (rest.length) {
      console.error('`clarity server` takes no directory argument — it always serves the staging dir of the current project.');
      console.error(`(derived now: ${clarityDir()})`);
      process.exit(2);
    }
    run('server.mjs', [sub]);
    break;
  }
  default:
    usage();
}
