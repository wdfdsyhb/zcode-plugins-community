// Shared helpers for loading and walking ClarityKit behavior models.
import fs from 'node:fs';
import YAML from 'yaml';

export function loadModel(file) {
  const text = fs.readFileSync(file, 'utf8');
  const doc = YAML.parse(text);
  if (doc === null || typeof doc !== 'object') {
    throw new Error(`Empty or invalid YAML: ${file}`);
  }
  return doc;
}

// Normalize a transition (object form) into a consistent shape.
export function normTransition(t) {
  return {
    target: t?.target,
    guard: t?.guard,
    actions: t?.actions ? [...t.actions] : [],
  };
}

// Every transition declared on a state: from `on` (object or list per event)
// and from `invoke.onDone` / `invoke.onError`.
export function stateTransitions(stateKey, node) {
  const out = [];
  if (node?.on && typeof node.on === 'object') {
    for (const [event, t] of Object.entries(node.on)) {
      const list = Array.isArray(t) ? t : [t];
      for (const item of list) {
        out.push({ from: stateKey, event, ...normTransition(item) });
      }
    }
  }
  if (node?.invoke && typeof node.invoke === 'object') {
    for (const kind of ['onDone', 'onError']) {
      const t = node.invoke[kind];
      if (t) {
        // Same tolerance as `on:`: single transition object or a list of them.
        const list = Array.isArray(t) ? t : [t];
        for (const item of list) {
          out.push({ from: stateKey, event: `@${kind}(${node.invoke.src ?? '?'})`, ...normTransition(item) });
        }
      }
    }
  }
  return out;
}

// Walk all states (recursing into compound/parallel children), calling fn(path, node).
// `path` is the dot path from the machine root.
export function walkStates(states, fn, prefix = '') {
  if (!states || typeof states !== 'object') return;
  for (const [key, node] of Object.entries(states)) {
    const path = prefix ? `${prefix}.${key}` : key;
    fn(path, node ?? {});
    if (node?.states) walkStates(node.states, fn, path);
  }
}

export function allTransitions(model) {
  const out = [];
  walkStates(model.states, (path, node) => out.push(...stateTransitions(path, node)));
  return out;
}

// Resolve a target written in state `fromPath` (dot path or bare key).
// Resolution order: root dot path → sibling scope → root level.
export function resolveTarget(model, fromPath, target) {
  if (typeof target !== 'string' || !target) return null;
  const findByPath = (path) => {
    let scope = model.states;
    let node = null;
    for (const part of path.split('.')) {
      node = scope?.[part];
      if (!node) return null;
      scope = node.states;
    }
    return node;
  };
  if (target.includes('.')) return findByPath(target) ? target : null;
  const scope = fromPath.includes('.') ? fromPath.slice(0, fromPath.lastIndexOf('.')) : '';
  if (scope && findByPath(`${scope}.${target}`)) return `${scope}.${target}`;
  if (findByPath(target)) return target;
  return null;
}
