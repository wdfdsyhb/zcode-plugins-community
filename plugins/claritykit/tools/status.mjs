#!/usr/bin/env node
// status.mjs [stagingDir] — one call that replaces the session-opening probe
// chain (clarity root + ls/cat flow.yaml + directory listing + server status).
// Prints: root/staging, preview server state, flow progress, per-bucket artifact
// inventory with owner skill, model validity markers, preview-site freshness.
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { validateFlow, FLOW_ORDERS } from './lib/flow.mjs';
import { validateBehavior } from './lib/behavior.mjs';
import { validateContracts } from './lib/contracts.mjs';

const staging = path.resolve(process.argv[2] ?? '.');
const rel = (p) => path.relative(staging, p);

const httpOk = (port) => new Promise((resolve) => {
  const req = http.get(`http://localhost:${port}/`, (res) => { res.resume(); resolve(res.statusCode === 200); });
  req.on('error', () => resolve(false));
  req.setTimeout(1500, () => { req.destroy(); resolve(false); });
});

// generated preview files are outputs, not sources. Only the staging ROOT index.html
// is generated — a prototype's index.html (prototypes/<name>/index.html) is a real
// source prototype and must be counted.
const isGenerated = (p) => {
  const b = path.basename(p);
  if (b === 'clarity-preview.html') return true;
  if (b === 'index.html' && path.dirname(p) === staging) return true;
  try { return fs.readFileSync(p, 'utf8').slice(0, 200).includes('<!-- clarity-generated -->'); } catch { return false; }
};

function* walk(d) {
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

const mermaidBlocks = (text) => (text.match(/```mermaid/g) ?? []).length;
const age = (ms) => {
  const s = (Date.now() - ms) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};

const BUCKETS = [
  ['direction', 'clarify-direction'],
  ['requirements', 'clarify-requirements'],
  ['architecture', 'clarify-architecture'],
  ['behaviors', 'clarify-behavior'],
  ['data', 'clarify-data'],
  ['prototypes', 'clarify-ui'],
  ['acceptance', 'clarify-acceptance'],
];

function modelMark(p) {
  try {
    const text = fs.readFileSync(p, 'utf8');
    const yamlDoc = YAML.parseDocument(text);
    if (yamlDoc.errors.length) return '✖ invalid-yaml';
    const doc = yamlDoc.toJS();
    const r = doc?.machine
      ? validateBehavior(doc, yamlDoc, text)
      : doc?.entities
        ? validateContracts(doc, yamlDoc, text)
        : null;
    if (!r) return '?';
    if (r.errors.length) return `✖ ${r.errors.length} error(s)`;
    return r.warnings.length ? `✔ ${r.warnings.length} warn` : '✔';
  } catch { return '?'; }
}

// --- flow state ---
function flowBlock() {
  const file = path.join(staging, 'flow.yaml');
  if (!fs.existsSync(file)) return null;
  const v = validateFlow(staging);
  let doc = null;
  try { doc = YAML.parse(fs.readFileSync(file, 'utf8')); } catch { /* reported below */ }
  const order = doc?.flow?.order;
  const steps = FLOW_ORDERS[order] ?? Object.keys(doc?.steps ?? {});
  const line = steps.map((id) => `${id}:${doc?.steps?.[id]?.status ?? '?'}`).join(' ');
  const active = Object.entries(doc?.steps ?? {}).filter(([, s]) => s?.status === 'active');
  const activeNote = active.length && active[0][1].note ? ` — ${active[0][1].note}` : '';
  return { order, line, active, activeNote, v };
}

// --- main ---
async function main() {
  // staging is <root>/docs/clarity → root is two levels up (CLI always passes
  // the derived staging dir; tool-layer callers passing another dir accept the
  // same approximation).
  const root = path.resolve(staging, '..', '..');
  console.log(`project root:  ${root}`);
  console.log(`staging dir:   ${staging}`);

  // preview server (registry keyed by staging dir)
  let serverLine = 'not running';
  try {
    const reg = JSON.parse(fs.readFileSync(path.join(process.env.HOME, '.claritykit', 'servers.json'), 'utf8'));
    const e = reg[staging];
    if (e) {
      const alive = await httpOk(e.port);
      serverLine = alive ? `running @ http://localhost:${e.port}/` : `registered (pid ${e.pid}) but NOT answering — \`clarity server start\` to recover`;
    }
  } catch { /* no registry */ }
  console.log(`preview:       ${serverLine}`);

  const flow = flowBlock();
  if (flow) {
    console.log(`flow:          ${flow.order} · ${flow.line}`);
    if (flow.active.length) console.log(`active step:   ${flow.active.map(([id]) => id).join(', ')}${flow.activeNote}`);
    for (const e of flow.v.errors) console.log(`flow.yaml: ERROR ${e}`);
    for (const w of flow.v.warnings) console.log(`flow.yaml: warn ${w}`);
  } else {
    console.log('flow:          not activated (skills run only when named or flow-invoked)');
  }

  console.log('\nartifacts:');
  const SOURCE_EXT = new Set(['.md', '.yaml', '.yml', '.mmd', '.html']);
  let newestSource = 0;
  for (const [bucket, owner] of BUCKETS) {
    const dir = path.join(staging, bucket);
    if (!fs.existsSync(dir)) { console.log(`  ${bucket.padEnd(15)} ${owner}  (absent)`); continue; }
    const docs = [], models = [], protos = [];
    let diagrams = 0, newest = 0;
    for (const p of walk(dir)) {
      if (isGenerated(p)) continue;
      const st = fs.statSync(p);
      newest = Math.max(newest, st.mtimeMs);
      if (SOURCE_EXT.has(path.extname(p))) newestSource = Math.max(newestSource, st.mtimeMs);
      if (/behavior\.yaml$|contracts\.yaml$/.test(p)) {
        models.push(`${rel(p)} ${modelMark(p)}`);
      } else if (p.endsWith('.md')) {
        docs.push(rel(p));
        diagrams += mermaidBlocks(fs.readFileSync(p, 'utf8'));
      } else if (p.endsWith('.mmd')) {
        diagrams++;
      } else if (p.endsWith('.html')) {
        protos.push(rel(p));
      }
    }
    if (!docs.length && !models.length && !protos.length && !diagrams) {
      console.log(`  ${bucket.padEnd(15)} ${owner}  (empty)`);
      continue;
    }
    const bits = [];
    if (newest) bits.push(`updated ${age(newest)}`);
    if (docs.length) bits.push(`${docs.length} doc(s): ${docs.slice(0, 3).join(', ')}${docs.length > 3 ? ', …' : ''}`);
    if (models.length) bits.push(models.join(' · '));
    if (diagrams) bits.push(`${diagrams} diagram(s)`);
    if (protos.length) bits.push(`prototype(s): ${protos.join(', ')}`);
    console.log(`  ${bucket.padEnd(15)} ${owner}`);
    for (const b of bits) console.log(`${' '.repeat(19)} ${b}`);
    // feature sub-directories get their own line
    if (bucket === 'behaviors') {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!e.isDirectory()) continue;
        const fdir = path.join(dir, e.name);
        const files = fs.readdirSync(fdir).filter((f) => !isGenerated(path.join(fdir, f)));
        const tier = files.includes('behavior.yaml') ? 'YAML tier' : 'light tier';
        console.log(`${' '.repeat(19)} └ ${e.name} (${tier}): ${files.join(', ')}`);
      }
    }
  }

  // ADR handoff
  const adrDir = path.join(root, 'docs', 'adr');
  const adrCount = fs.existsSync(adrDir)
    ? fs.readdirSync(adrDir).filter((f) => /^ADR-\d+/.test(f)).length : 0;
  console.log(`\nadr handoff:   ${adrDir} · ${adrCount} ADR(s)`);

  // preview freshness
  const idx = path.join(staging, 'index.html');
  if (fs.existsSync(idx)) {
    const stale = newestSource > fs.statSync(idx).mtimeMs;
    console.log(`preview site:  ${stale ? 'STALE — run `clarity publish`' : 'current'}`);
  } else if (newestSource) {
    console.log('preview site:  not built — run `clarity publish`');
  }
}

main();
