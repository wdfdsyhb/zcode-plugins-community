// flow.yaml — the state file of the clarity-flow design flow.
// Written and maintained by the AI (clarity-flow skill) with its file-editing tool;
// structurally validated here on every `clarity` command (warn-only: commands proceed,
// but the AI must repair the file when problems are reported).
//
// The validator checks STRUCTURE, not process: ids, statuses, order legality,
// single active step, commission not skipped, artifact files existing. Ordering
// discipline (the DAG) is the skill prompt's job, not the validator's.
import fs from 'node:fs';
import path from 'node:path';

const yaml = await import('yaml');

export const FLOW_STEPS = ['direction', 'requirements', 'behavior', 'architecture', 'data', 'ui', 'commission'];
export const FLOW_ORDERS = {
  'behavior-first': ['direction', 'requirements', 'behavior', 'architecture', 'data', 'ui', 'commission'],
  'arch-first': ['direction', 'requirements', 'architecture', 'behavior', 'data', 'ui', 'commission'],
};
const STATUSES = new Set(['pending', 'active', 'done', 'skipped', 'given']);
// "given" = settled elsewhere (e.g. existing system re-entry): consulted read-only, not performed here.

export function flowPath(clarityDir) {
  return path.join(clarityDir, 'flow.yaml');
}

// Validate flow.yaml inside clarityDir. Returns null when no flow.yaml exists
// (perfectly normal — the flow was never activated), otherwise { errors, warnings }.
export function validateFlow(clarityDir) {
  const file = flowPath(clarityDir);
  if (!fs.existsSync(file)) return null;

  const errors = [];
  const warnings = [];
  const bad = (msg) => errors.push(msg);

  let doc;
  try {
    doc = yaml.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return { errors: [`invalid YAML: ${String(e.message).split('\n')[0]}`], warnings };
  }

  const flow = doc?.flow;
  if (!flow || typeof flow !== 'object') {
    bad('missing top-level `flow` mapping (keys: id, order, steps)');
    return { errors, warnings };
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(String(flow.id ?? ''))) bad('flow.id missing or not kebab-case');
  const order = flow.order;
  if (!FLOW_ORDERS[order]) bad(`flow.order must be one of: ${Object.keys(FLOW_ORDERS).join(', ')} (found ${JSON.stringify(order)})`);

  const steps = doc?.steps;
  if (!steps || typeof steps !== 'object') {
    bad('missing top-level `steps` mapping (one entry per flow step)');
    return { errors, warnings };
  }

  const present = Object.keys(steps);
  for (const id of FLOW_STEPS) if (!present.includes(id)) bad(`steps.${id} missing`);
  for (const id of present) if (!FLOW_STEPS.includes(id)) bad(`steps.${id} is not a known flow step (${FLOW_STEPS.join(', ')})`);

  let active = 0;
  for (const [id, s] of Object.entries(steps)) {
    if (!s || typeof s !== 'object') { bad(`steps.${id} must be a mapping`); continue; }
    if (!STATUSES.has(s.status ?? '')) bad(`steps.${id}.status must be one of: ${[...STATUSES].join(', ')} (found ${JSON.stringify(s.status)})`);
    if (s.status === 'active') active++;
    if (s.status === 'skipped' && !s.note) warnings.push(`steps.${id}: skipped without a note — a skip is a decision, record the one-line reason`);
    if (id === 'commission' && s.status === 'skipped') bad('steps.commission may not be skipped — it is the terminal control of the flow');
    const arts = s.artifacts ?? [];
    if (!Array.isArray(arts)) { bad(`steps.${id}.artifacts must be a list`); continue; }
    for (const a of arts) {
      if (typeof a !== 'string') { bad(`steps.${id}.artifacts entries must be strings`); continue; }
      if (path.isAbsolute(a)) { bad(`steps.${id}.artifacts entry ${a} must be relative to the staging dir`); continue; }
      const p = path.join(clarityDir, a);
      if (!fs.existsSync(p)) warnings.push(`steps.${id}.artifacts entry not found on disk: ${a} (stale entry, or not yet written)`);
    }
  }
  if (active > 1) bad(`${active} steps are active at once — at most one step may be 'active'`);

  return { errors, warnings };
}

// One-line summary for doctor / diagnostics. Returns null when no flow.yaml.
export function describeFlow(clarityDir) {
  const v = validateFlow(clarityDir);
  if (!v) return null;
  const doc = yaml.parse(fs.readFileSync(flowPath(clarityDir), 'utf8'));
  const steps = FLOW_ORDERS[doc.flow.order] ?? FLOW_STEPS;
  const counts = {};
  for (const s of Object.values(doc.steps ?? {})) counts[s.status] = (counts[s.status] ?? 0) + 1;
  const summary = steps.map((id) => `${id}:${doc.steps?.[id]?.status ?? '?'}`).join(' ');
  return { order: doc.flow.order, summary, counts, errors: v.errors, warnings: v.warnings };
}
