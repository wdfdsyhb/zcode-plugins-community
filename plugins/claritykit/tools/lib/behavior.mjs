// Behavior-model validation, importable by validate.mjs (CLI) and status.mjs
// (freshness markers). Errors are self-sufficient: state path + line number +
// a concrete fix hint for the incident-prone classes — the AI should never need
// to read this file (or any validator source) to repair a model.
import { walkStates, stateTransitions, allTransitions, resolveTarget } from './model.mjs';

// Build a pathArray → line-number lookup from the parsed YAML document.
// Returns a no-op returning null when no doc is available.
function makeLineOf(doc, text) {
  if (!doc) return () => null;
  let lineStarts = null;
  const lineAt = (offset) => {
    if (!lineStarts) {
      lineStarts = [0];
      for (let i = 0; i < text.length; i++) if (text[i] === '\n') lineStarts.push(i + 1);
    }
    let lo = 0, hi = lineStarts.length - 1, ans = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (lineStarts[mid] <= offset) { ans = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return ans + 1; // 1-based
  };
  return (pathArr) => {
    try {
      const node = doc.getIn(pathArr, true);
      const offset = node?.range?.[0];
      return typeof offset === 'number' ? lineAt(offset) : null;
    } catch { return null; }
  };
}

export function validateBehavior(model, doc, text) {
  const errors = [];
  const warnings = [];
  const VALID_TYPES = new Set(['atomic', 'compound', 'parallel', 'final', 'history']);
  const VALID_SOURCES = new Set(['user', 'system', 'actor', 'timer', 'external']);
  const lineOf = makeLineOf(doc, text);
  const at = (pathArr) => {
    const l = lineOf(pathArr);
    return l ? ` (line ${l})` : '';
  };

  const machine = model.machine ?? {};
  const events = model.events ?? {};
  const guards = model.guards ?? {};
  const actions = model.actions ?? {};
  const actors = model.actors ?? {};

  const nodeAt = (path) => {
    let node = null, scope = model.states;
    for (const part of path.split('.')) { node = scope?.[part]; scope = node?.states; }
    return node;
  };

  // --- machine block ---
  if (!machine.id) errors.push('machine.id is missing');
  if (!machine.initial) {
    errors.push('machine.initial is missing');
  } else if (!model.states?.[machine.initial]) {
    errors.push(`machine.initial '${machine.initial}' does not exist in states`);
  }
  if (!model.states || typeof model.states !== 'object') {
    errors.push('states block is missing or not a map');
  }

  // --- event registry ---
  for (const [name, ev] of Object.entries(events)) {
    if (!VALID_SOURCES.has(ev?.source)) {
      errors.push(`event ${name}${at(['events', name])}: source must be one of ${[...VALID_SOURCES].join(', ')} (found ${JSON.stringify(ev?.source)})`);
    }
  }

  // --- per-state structural rules ---
  walkStates(model.states, (path, node) => {
    const type = node.type ?? 'atomic';
    const pathArr = ['states', ...path.split('.')];
    const loc = `${path}${at(pathArr)}`;
    if (!VALID_TYPES.has(type)) errors.push(`${loc}: unknown type '${type}'`);

    const has = (k) => node[k] !== undefined;
    if (type === 'compound') {
      if (!has('states')) errors.push(`${loc}: compound state requires 'states'`);
      if (!has('initial')) errors.push(`${loc}: compound state requires 'initial' — add \`initial: <child-key>\``);
      if (has('invoke')) errors.push(`${loc}: compound state must not have 'invoke'`);
      if (has('initial') && node.states && !node.states[node.initial]) {
        errors.push(`${loc}: initial child '${node.initial}' does not exist in its states`);
      }
    }
    if (type === 'parallel') {
      if (!has('states')) errors.push(`${loc}: parallel state requires 'states'`);
      if (has('initial')) errors.push(`${loc}: parallel state must not have 'initial'`);
      if (has('invoke')) errors.push(`${loc}: parallel state must not have 'invoke'`);
    }
    if (type === 'final') {
      if (has('on')) errors.push(`${loc}: final state must not have 'on' (final states are absorbing)`);
      if (has('invoke')) errors.push(`${loc}: final state must not have 'invoke'`);
      if (has('states')) errors.push(`${loc}: final state must not have 'states'`);
    }
    if (type === 'history' && (has('on') || has('invoke'))) {
      errors.push(`${loc}: history state must not have 'on' or 'invoke'`);
    }
    if (type === 'atomic' && (has('states') || has('initial'))) {
      errors.push(`${loc}: atomic state must not have 'states' or 'initial'`);
    }

    if (has('invoke')) {
      if (!node.invoke?.src) {
        errors.push(`${loc}: invoke.src is missing — add \`src: <actor-name>\` declared in the actors registry`);
      } else if (!actors[node.invoke.src]) {
        errors.push(`${loc}: invoke.src '${node.invoke.src}' is not declared in actors`);
      }
      if (!node.invoke?.onError) {
        errors.push(`${loc}: invoke must declare onError (async work can fail) — add \`onError: { target: <failure-state> }\` to the invoke block`);
      } else if (!node.on || Object.keys(node.on).length === 0) {
        warnings.push(`${loc}: invoked state has no cancellation path (no 'on' events alongside invoke)`);
      }
    }

    for (const bucket of ['entry', 'exit']) {
      for (const a of node[bucket] ?? []) {
        if (!actions[a]) errors.push(`${loc}: ${bucket} action '${a}' is not declared in actions`);
      }
    }
  });

  // --- transitions ---
  const seen = new Map(); // "state event guard" -> count
  for (const t of allTransitions(model)) {
    if (!t.event.startsWith('@') && !events[t.event]) {
      errors.push(`${t.from} [${t.event}]: event is not declared in the events registry — declare it under \`events:\` with a source`);
    }
    if (!t.target) {
      errors.push(`${t.from} [${t.event}]: transition target is missing`);
    } else if (!resolveTarget(model, t.from, t.target)) {
      errors.push(`${t.from} [${t.event}]: target '${t.target}' does not resolve to a state (dot paths resolve from the machine root; bare keys resolve in the parent scope first, then the root)`);
    }
    if (t.guard && !guards[t.guard]) {
      errors.push(`${t.from} [${t.event}]: guard '${t.guard}' is not declared in guards`);
    }
    for (const a of t.actions) {
      if (!actions[a]) errors.push(`${t.from} [${t.event}]: action '${a}' is not declared in actions`);
    }
    const key = `${t.from} ${t.event} ${t.guard ?? ''}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  for (const [key, count] of seen) {
    if (count > 1) {
      const [from, event, guard] = key.split(' ');
      errors.push(guard
        ? `${from}: ${count} duplicate transitions on ${event} with guard '${guard}'`
        : `${from}: ${count} unguarded transitions on ${event} (ambiguous — add distinct guards)`);
    }
  }

  // --- behavioral warnings ---
  // labels: the skill mandates labels on states and events (views display them);
  // the validator warns so docs and tool agree without hard-failing.
  walkStates(model.states, (path, node) => {
    if (!node.label) warnings.push(`${path}: no label — give every state a label in the user's language (views display labels, not ids)`);
  });
  for (const [name, ev] of Object.entries(events)) {
    if (!ev?.label) warnings.push(`event ${name}: no label — give every event a label in the user's language`);
  }

  const reachable = new Set();
  const queue = machine.initial && model.states?.[machine.initial] ? [machine.initial] : [];
  while (queue.length) {
    const path = queue.shift();
    if (reachable.has(path)) continue;
    reachable.add(path);
    const node = nodeAt(path);
    if (!node) continue;
    if ((node.type ?? 'atomic') === 'parallel' && node.states) {
      for (const child of Object.keys(node.states)) queue.push(`${path}.${child}`);
    } else if (node.initial) {
      queue.push(`${path}.${node.initial}`);
    }
    for (const t of stateTransitions(path, node)) {
      const resolved = resolveTarget(model, path, t.target);
      if (resolved) queue.push(resolved);
    }
  }
  walkStates(model.states, (path, node) => {
    if (!reachable.has(path)) warnings.push(`${path}: unreachable from machine.initial`);
    const type = node.type ?? 'atomic';
    if (type !== 'final' && !node.states) {
      const hasOutgoing =
        (node.on && Object.keys(node.on).length > 0) || node.invoke?.onDone || node.invoke?.onError;
      if (!hasOutgoing) warnings.push(`${path}: dead-end state (no outgoing transitions, not final)`);
    }
  });
  for (const name of Object.keys(events)) {
    const used = allTransitions(model).some((t) => t.event === name);
    if (!used) warnings.push(`event ${name}: declared but never used in any transition`);
  }

  return { errors, warnings };
}
