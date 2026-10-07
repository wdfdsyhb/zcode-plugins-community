// Contract-sheet validation (contracts.yaml from the clarify-data skill).
// Importable by validate.mjs (CLI) and status.mjs (freshness markers).
// The machine contract for "what the system remembers and what crosses its
// boundaries". Same error philosophy as behavior.mjs: self-sufficient messages.
//
// Field cardinality (one value, four cases — replaces a separate `optional` flag):
//   one        exactly one, always present
//   maybe      at most one, may be absent        → absent_means REQUIRED
//   many       list, at least one
//   maybe-many list, possibly empty              → absent_means REQUIRED

const CARDINALITIES = new Set(['one', 'maybe', 'many', 'maybe-many']);
const BOUNDARIES = new Set(['api', 'ipc', 'file', 'internal']);

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
    return ans + 1;
  };
  return (pathArr) => {
    try {
      const node = doc.getIn(pathArr, true);
      const offset = node?.range?.[0];
      return typeof offset === 'number' ? lineAt(offset) : null;
    } catch { return null; }
  };
}

export function validateContracts(doc, yamlDoc, text) {
  const errors = [];
  const warnings = [];
  const lineOf = makeLineOf(yamlDoc, text);
  const at = (pathArr) => {
    const l = lineOf(pathArr);
    return l ? ` (line ${l})` : '';
  };

  const entities = doc.entities ?? {};
  const operations = doc.operations ?? {};
  const errorsReg = doc.errors ?? {};

  if (!doc.entities || typeof doc.entities !== 'object') {
    errors.push('entities block is missing or not a map');
  }

  // --- entities ---
  for (const [name, ent] of Object.entries(entities)) {
    const loc = `entity ${name}${at(['entities', name])}`;
    if (!ent || typeof ent !== 'object') { errors.push(`${loc}: must be a mapping`); continue; }
    if (!ent.owner) errors.push(`${loc}: owner is missing — which boundary owns this entity's truth?`);
    for (const [fname, field] of Object.entries(ent.fields ?? {})) {
      const floc = `${loc}.${fname}${at(['entities', name, 'fields', fname])}`;
      if (!field || typeof field !== 'object') { errors.push(`${floc}: must be a mapping`); continue; }
      if (!field.type) errors.push(`${floc}: type is missing`);
      const card = field.cardinality ?? 'one';
      if (!CARDINALITIES.has(card)) {
        errors.push(`${floc}: cardinality '${card}' must be one of ${[...CARDINALITIES].join(', ')}`);
      }
      if ((card === 'maybe' || card === 'maybe-many') && !field.absent_means) {
        errors.push(`${floc}: cardinality '${card}' requires absent_means — what does absence mean to consumers? (one line, user-approved)`);
      }
    }
  }

  // --- operations ---
  for (const [name, op] of Object.entries(operations)) {
    const loc = `operation ${name}${at(['operations', name])}`;
    if (!op || typeof op !== 'object') { errors.push(`${loc}: must be a mapping`); continue; }
    if (!BOUNDARIES.has(op.boundary)) {
      errors.push(`${loc}: boundary must be one of ${[...BOUNDARIES].join(', ')} (found ${JSON.stringify(op.boundary)})`);
    }
    for (const errId of op.errors ?? []) {
      if (!errorsReg[errId]) {
        errors.push(`${loc}: error '${errId}' is not declared in the errors registry — declare it with a meaning and user_sees`);
      }
    }
  }

  // --- error taxonomy ---
  const referenced = new Set();
  for (const op of Object.values(operations)) for (const e of op?.errors ?? []) referenced.add(e);
  for (const [name, err] of Object.entries(errorsReg)) {
    const loc = `error ${name}${at(['errors', name])}`;
    if (!err?.meaning) errors.push(`${loc}: meaning is missing (one line)`);
    if (!err?.user_sees) {
      const surfaces = Object.entries(operations).some(([opName, op]) =>
        (op?.errors ?? []).includes(name) && op?.boundary !== 'internal');
      if (surfaces) warnings.push(`${loc}: can surface outside the system (referenced by a non-internal operation) but has no user_sees — what does the user experience?`);
    }
    if (!referenced.has(name)) warnings.push(`${loc}: declared but never referenced by any operation — cut it or wire it`);
  }

  return { errors, warnings };
}
