#!/usr/bin/env node
// check.mjs [dir-or-file...] — deterministically parse-check every Mermaid diagram
// (.mmd files + ```mermaid blocks in .md files) with the pinned mermaid version.
// No AI, no guessing: the real parser accepts or rejects. Exit 1 if any diagram fails.
// Additionally prints NON-BLOCKING hygiene warnings: stale/missing machine views,
// oversized hand views, declare-before-connect violations.
import path from 'node:path';
import fs from 'node:fs';

const targets = process.argv.slice(2);
if (!targets.length) {
  console.error('usage: node check.mjs [dir-or-file...]  (default: cwd)');
  process.exit(2);
}

const SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.next']);

function* walk(p) {
  const stat = fs.statSync(p);
  if (!stat.isDirectory()) {
    yield p;
    return;
  }
  for (const entry of fs.readdirSync(p, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    yield* walk(path.join(p, entry.name));
  }
}

// Collect { file, index, code } for every diagram.
const diagrams = [];
for (const t of targets.length ? targets : ['.']) {
  for (const p of walk(path.resolve(t))) {
    if (p.endsWith('.mmd')) {
      diagrams.push({ file: p, index: 1, code: fs.readFileSync(p, 'utf8').trim() });
    } else if (p.endsWith('.md')) {
      const text = fs.readFileSync(p, 'utf8');
      const re = /```mermaid\s*\n([\s\S]*?)```/g;
      let m, i = 0;
      while ((m = re.exec(text))) {
        i++;
        diagrams.push({ file: p, index: i, code: m[1].trim() });
      }
    }
  }
}

if (!diagrams.length) {
  // vacuously green: a prototype-only staging dir has nothing to check, and
  // `clarity publish` (check-then-build) must still build the site.
  console.log('no mermaid diagrams found — nothing to check');
  process.exit(0);
}

// Minimal DOM globals for mermaid's parser (no rendering, just parse).
const { JSDOM } = await import('jsdom');
const dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const mermaid = (await import('mermaid')).default;
const version = (await import('mermaid/package.json', { with: { type: 'json' } })).default.version;

let failures = 0;
const warns = [];

// ── Hygiene warnings for stateDiagram-v2 (non-blocking) ──────────────────────
// D2: a hand view larger than ~10 states / ~15 transitions (generated machine
//     views are exempt — completeness is their job).
// D3: declare-before-connect (level-wise): declarations after the first edge at
//     their level, or edge endpoints never declared anywhere in the diagram.
function stateDiagramWarnings(d) {
  const out = [];
  const lines = d.code.split('\n');
  const firstCode = (lines.find((l) => { const t = l.trim(); return t && !t.startsWith('%%'); }) ?? '');
  if (!/^stateDiagram-v2/.test(firstCode.trim())) return out;
  const title = (lines.find((l) => /^%%\s*title:/.test(l)) ?? '').replace(/^%%\s*title:\s*/, '');
  const isMachineView = title.includes('machine view');

  let depth = 0;
  let inNote = false;
  let transitions = 0;
  let declAfterEdge = false;
  const declared = new Set();
  const referenced = new Set();
  const edgeLevels = new Set();
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('%%')) continue;
    if (inNote) { if (/end note/.test(line)) inNote = false; continue; }
    if (/^note\b/.test(line)) { inNote = !/end note/.test(line); continue; }
    if (line === '}') { depth = Math.max(0, depth - 1); continue; }
    // Composite with its description in the block header — parse-clean layout bug
    // (two phantom nodes: one for the id, one for the label).
    if (/^state\s+[^\s:{]+\s*:[^{]*\{/.test(line)) {
      out.push(`composite declares its description in the block header (\`${line.replace(/\s*\{$/, '')}\`) — use a separate \`id : label\` line + bare \`state id {\``);
    }
    const comp = line.match(/^state\s+([^\s{]+)[^{]*\{/);
    if (comp) {
      if (edgeLevels.has(depth)) declAfterEdge = true;
      declared.add(comp[1]);
      depth++;
      continue;
    }
    if (line.includes('-->')) {
      // Composite blocks are declarations only — any edge inside a block (including
      // a composite's inner [*] initial edge) is a parse-clean layout bug; the
      // initial child is a top-level `id --> child` edge.
      if (depth > 0) out.push(`transition inside a composite block (\`${line}\`) — blocks are declarations only; move edges to the top level`);
      edgeLevels.add(depth);
      transitions++;
      const m = line.match(/^(\S+?)\s*-->\s*([^\s:]+)/);
      if (m) {
        if (m[1] !== '[*]') referenced.add(m[1]);
        if (m[2] !== '[*]') referenced.add(m[2]);
      }
      continue;
    }
    const decl = line.match(/^([^\s:]+)\s*:\s*\S/);
    if (decl) {
      if (edgeLevels.has(depth)) declAfterEdge = true;
      declared.add(decl[1]);
    }
  }
  if (declAfterEdge) out.push('declaration after the first transition — declare every state before connecting (level-wise; the inner [*] edge goes last inside its composite)');
  const undeclared = [...referenced].filter((id) => !declared.has(id));
  if (undeclared.length) out.push(`transition references undeclared state(s): ${undeclared.join(', ')} — declare-before-connect`);
  const stateCount = new Set([...declared, ...referenced]).size;
  if (!isMachineView && (stateCount > 10 || transitions > 15)) {
    out.push(`view too large (${stateCount} states / ${transitions} transitions) — split it, or leave the full machine to the generated machine views`);
  }
  return out;
}

for (const d of diagrams) {
  try {
    await mermaid.parse(d.code);
    console.log(`OK    ${d.file}#${d.index}`);
    for (const w of stateDiagramWarnings(d)) warns.push(`${d.file}#${d.index}: ${w}`);
  } catch (err) {
    failures++;
    const msg = String(err?.message ?? err).split('\n').slice(0, 4).join('\n      ');
    console.log(`FAIL  ${d.file}#${d.index}\n      ${msg}`);
  }
}

// ── D1: machine-view freshness (non-blocking) ─────────────────────────────────
// Every behavior.yaml must have sibling generated-diagrams/overview.mmd +
// detailed.mmd, no older than the YAML itself (missing/stale → re-run
// `clarity render`).
for (const t of targets) {
  for (const p of walk(path.resolve(t))) {
    if (!/behavior\.yaml$/.test(p)) continue;
    const views = ['overview.mmd', 'detailed.mmd'].map((f) => path.join(path.dirname(p), 'generated-diagrams', f));
    const missing = views.filter((v) => !fs.existsSync(v));
    if (missing.length) {
      warns.push(`${p}: machine view(s) missing (${missing.map((v) => path.basename(v)).join(', ')}) — run: clarity render <that behavior.yaml>`);
      continue;
    }
    const yamlMtime = fs.statSync(p).mtimeMs;
    const stale = views.filter((v) => fs.statSync(v).mtimeMs < yamlMtime);
    if (stale.length) warns.push(`${p}: machine view(s) older than behavior.yaml — re-run: clarity render <that behavior.yaml>`);
  }
}

console.log(`\nmermaid v${version} — ${diagrams.length - failures}/${diagrams.length} diagram(s) OK`);
if (warns.length) {
  console.log(`\n${warns.length} hygiene warning(s) (non-blocking):`);
  for (const w of warns) console.log(`WARN  ${w}`);
}
process.exit(failures ? 1 : 0);
