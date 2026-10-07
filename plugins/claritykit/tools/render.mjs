#!/usr/bin/env node
// render.mjs <behavior.yaml> [--outdir <dir>] [--scope <state.path>]
// Render Mermaid stateDiagram-v2 machine views from a behavior model.
// Default: writes <outdir>/overview.mmd and <outdir>/detailed.mmd.
// --scope renders only the subtree of one composite state (module-level views for
// large models): writes <outdir>/<scope>.overview.mmd / <scope>.detailed.mmd and
// lists cross-boundary transitions as trailing comments.
// Default outdir: <behavior.yaml's dir>/generated-diagrams
import path from 'node:path';
import fs from 'node:fs';
import { loadModel, stateTransitions, resolveTarget } from './lib/model.mjs';

const args = process.argv.slice(2);
const file = args[0];
if (!file) {
  console.error('usage: node render.mjs <behavior.yaml> [--outdir <dir>] [--scope <state.path>]');
  process.exit(2);
}
const flagValue = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const outdir = flagValue('--outdir') ?? path.join(path.dirname(file), 'generated-diagrams');
const scope = flagValue('--scope');

const model = loadModel(file);
const machine = model.machine ?? {};
const events = model.events ?? {};
const guards = model.guards ?? {};
const actions = model.actions ?? {};

// Human-facing display text: every registry entry and state may declare `label`;
// fall back to description, then to the raw key. Labels may be any language.
const displayOf = (registry, key, fallbackDesc) =>
  registry?.[key]?.label ?? fallbackDesc ?? key;

// Mermaid resolves state names globally within a stateDiagram, so state keys must
// be unique across the whole model (including nested ones) for correct rendering.
const keyCount = new Map();
(function countKeys(states) {
  for (const [key, node] of Object.entries(states ?? {})) {
    keyCount.set(key, (keyCount.get(key) ?? 0) + 1);
    countKeys(node?.states);
  }
})(model.states);
for (const [key, n] of keyCount) {
  if (n > 1) console.warn(`warning: state key '${key}' appears ${n} times — rename for unambiguous rendering`);
}

const short = (pathStr) => pathStr.split('.').pop();

const label = (t, detailed) => {
  // Sanitize ASCII colons in display text to fullwidth — a colon in a transition
  // label is a separator to mermaid v10's parser.
  const safe = (s) => s.replace(/:/g, '：');
  if (t.event.startsWith('@')) {
    // '@onDone(actor)' -> 'onDone(actor)'  (no colon: mermaid v10 parses colons in labels as separators)
    let s = t.event.slice(1);
    if (t.guard) s += ` [${safe(displayOf(guards, t.guard))}]`;
    if (detailed && t.actions.length) s += ` / ${t.actions.map((a) => safe(displayOf(actions, a))).join(', ')}`;
    return s;
  }
  let s = safe(displayOf(events, t.event));
  if (t.guard) s += ` [${safe(displayOf(guards, t.guard))}]`; // guards also shown in overview — they disambiguate paths
  if (detailed && t.actions.length) s += ` / ${t.actions.map((a) => safe(displayOf(actions, a))).join(', ')}`;
  return s;
};

function emitState(key, node, indent, detailed, lines, noteBlocks) {
  const pad = '  '.repeat(indent);
  const display = node.label ?? node.description;

  if (node.states) {
    // Composite declaration, two lines: the description is its OWN `id : label`
    // line BEFORE the bare block. `state id : label {` (description in the block
    // header) parses clean but renders TWO phantom nodes — a layout bug the
    // parser cannot see.
    if (display) lines.push(`${pad}${key} : ${display}`);
    lines.push(`${pad}state ${key} {`);
    for (const [childKey, childNode] of Object.entries(node.states)) {
      emitState(childKey, childNode ?? {}, indent + 1, detailed, lines, noteBlocks);
    }
    // No edges inside the block — composite blocks are declarations only. The
    // initial-child edge is emitted as a regular top-level transition (render()).
    lines.push(`${pad}}`);
  } else if (display) {
    // NOTE: emit `X : text` WITHOUT the `state` keyword. mermaid v11 silently drops
    // the description in `state X : text` (label renders as the id only).
    lines.push(`${pad}${key} : ${display}`);
  }

  if (detailed) {
    const notes = [];
    if (node.entry?.length) notes.push(`entry: ${node.entry.map((a) => displayOf(actions, a)).join(', ')}`);
    if (node.exit?.length) notes.push(`exit: ${node.exit.map((a) => displayOf(actions, a)).join(', ')}`);
    if (node.invoke?.src) notes.push(`invoke: ${node.invoke.src}`);
    if (notes.length) {
      // Collect notes and emit them AFTER all transitions: mermaid v11 fails with
      // "No such shape: undefined" when `note right of X` blocks are interleaved
      // among state declarations (state ends up with no shape). Emitting notes at
      // the end renders correctly.
      noteBlocks.push(`note right of ${key}\n${notes.map((n) => `  ${n}`).join('\n')}\nend note`);
    }
  }
}

function collectTransitions(states, prefix = '') {
  const out = [];
  for (const [key, node] of Object.entries(states ?? {})) {
    const p = prefix ? `${prefix}.${key}` : key;
    out.push(...stateTransitions(p, node ?? {}));
    if (node?.states) out.push(...collectTransitions(node.states, p));
  }
  return out;
}

// Declaration order at the root level: breadth-first from the initial state over
// the transition graph (references/mermaid-safe-syntax.md — declaration order drives
// layout order, so declare in narrative order: initial → main flow → outcomes →
// failure → recovery). States unreachable from the initial keep document order at
// the end (dead states surfacing last is itself informative).
function rootOrder(rootStates, initial) {
  const keys = Object.keys(rootStates);
  if (!initial) return keys;
  const adj = new Map();
  for (const t of collectTransitions(rootStates, '')) {
    if (!t.target) continue;
    const resolved = resolveTarget(model, t.from, t.target) ?? t.target;
    const from = short(t.from), to = short(resolved);
    if (!adj.has(from)) adj.set(from, new Set());
    adj.get(from).add(to);
  }
  const seen = new Set([initial]);
  const queue = [initial];
  const reached = [];
  while (queue.length) {
    const k = queue.shift();
    if (keys.includes(k)) reached.push(k);
    for (const to of adj.get(k) ?? []) if (!seen.has(to)) { seen.add(to); queue.push(to); }
  }
  return [...reached, ...keys.filter((k) => !seen.has(k))];
}

function render(detailed, scopePath = null) {
  const lines = ['stateDiagram-v2'];
  const noteBlocks = [];
  let rootStates = model.states ?? {};
  let initial = machine.initial;
  let scopedKeys = null; // Set of short keys inside the scope
  const external = [];

  if (scopePath) {
    let node = null, scopeObj = model.states;
    for (const part of scopePath.split('.')) { node = scopeObj?.[part]; scopeObj = node?.states; }
    if (!node) {
      console.error(`error: scope '${scopePath}' not found`);
      process.exit(2);
    }
    if (!node.states) {
      console.error(`error: scope '${scopePath}' has no child states (it is not compound/parallel)`);
      process.exit(2);
    }
    rootStates = node.states;
    initial = node.initial ?? null;
    scopedKeys = new Set();
    (function gather(states) {
      for (const [key, n] of Object.entries(states ?? {})) {
        scopedKeys.add(key);
        gather(n?.states);
      }
    })(rootStates);
  }

  for (const key of rootOrder(rootStates, initial)) {
    emitState(key, rootStates[key] ?? {}, 1, detailed, lines, noteBlocks);
  }
  // Initial edge after ALL state declarations — declare-before-connect.
  // Composite initial-child edges are NOT drawn inside the blocks (blocks are
  // declarations only); they are regular top-level transitions, spliced right
  // after the first edge entering the composite (narrative order). Composites
  // never entered externally get theirs at the end.
  const initialEdges = new Map(); // composite key -> initial child key
  (function findComposites(states) {
    for (const [key, node] of Object.entries(states ?? {})) {
      if (node?.states && node.initial) initialEdges.set(key, node.initial);
      if (node?.states) findComposites(node.states);
    }
  })(rootStates);
  const emittedInitials = new Set();
  const flushInitialOf = (key) => {
    if (initialEdges.has(key) && !emittedInitials.has(key)) {
      lines.push(`  ${key} --> ${initialEdges.get(key)}`);
      emittedInitials.add(key);
    }
  };
  if (initial) {
    lines.push(`  [*] --> ${initial}`);
    flushInitialOf(initial);
  }

  // Emit all transitions flat at top level using short names (Mermaid resolves
  // state names globally within stateDiagram-v2; keys must be unique — checked above).
  for (const t of collectTransitions(rootStates, scopePath ?? '')) {
    if (!t.target) continue;
    const resolved = resolveTarget(model, t.from, t.target) ?? t.target;
    const from = short(t.from);
    const to = short(resolved);
    if (scopedKeys && (!scopedKeys.has(from) || !scopedKeys.has(to))) {
      external.push(`${from} --> ${to} : ${label(t, false)}`);
      continue;
    }
    lines.push(`  ${from} --> ${to} : ${label(t, detailed)}`);
    flushInitialOf(to);
  }
  for (const key of initialEdges.keys()) flushInitialOf(key);

  (function emitFinals(states) {
    for (const [key, node] of Object.entries(states ?? {})) {
      if ((node?.type ?? 'atomic') === 'final') lines.push(`  ${key} --> [*]`);
      emitFinals(node?.states);
    }
  })(rootStates);

  for (const nb of noteBlocks) lines.push(nb);
  if (external.length) {
    lines.push(`  %% cross-boundary transitions (outside this view):`);
    for (const e of external) lines.push(`  %% ${e}`);
  }
  return lines.join('\n') + '\n';
}

fs.mkdirSync(outdir, { recursive: true });
const id = machine.id ?? path.basename(file, '.behavior.yaml');
const titleFor = (detailed, scopePath) =>
  `%% title: ${id}${scopePath ? ` · ${short(scopePath)}` : ''} · machine view · ${detailed ? 'detailed' : 'overview'} (generated)`;
const captionFor = (detailed) =>
  detailed
    ? 'mechanical full render of behavior.yaml — debugging/derivation view: edges carry actions, states carry entry/exit/invoke notes. Do not hand-edit; re-run clarity render after YAML changes.'
    : 'mechanical full render of behavior.yaml — completeness baseline (every state, every transition) to review coverage against. Hand views select from it; they never replace it.';
const meta = (detailed, scopePath) =>
  `${titleFor(detailed, scopePath)}\n%% group: ${id}\n%% caption: ${captionFor(detailed)}`;
const base = scope ? `${short(scope)}.overview.mmd` : 'overview.mmd';
const baseDetailed = scope ? `${short(scope)}.detailed.mmd` : 'detailed.mmd';
const overview = path.join(outdir, base);
const detailedFile = path.join(outdir, baseDetailed);
fs.writeFileSync(overview, `${meta(false, scope)}\n${render(false, scope)}`);
fs.writeFileSync(detailedFile, `${meta(true, scope)}\n${render(true, scope)}`);
console.log(`wrote ${overview}`);
console.log(`wrote ${detailedFile}`);
