#!/usr/bin/env node
// validate.mjs <model.yaml> — validate a ClarityKit machine contract.
// Auto-detects the file kind: a behavior model (top-level `machine:`) or a
// contract sheet (top-level `entities:`). Exit 0 = valid (warnings allowed),
// 1 = errors, 2 = usage/IO/unrecognized.
import fs from 'node:fs';
import YAML from 'yaml';
import { validateBehavior } from './lib/behavior.mjs';
import { validateContracts } from './lib/contracts.mjs';

const file = process.argv[2];
if (!file) {
  console.error('usage: node validate.mjs <behavior.yaml | contracts.yaml>  (kind is auto-detected)');
  process.exit(2);
}

let doc, yamlDoc, text;
try {
  text = fs.readFileSync(file, 'utf8');
  yamlDoc = YAML.parseDocument(text);
  if (yamlDoc.errors.length) {
    console.error(`error: invalid YAML in ${file}:`);
    for (const e of yamlDoc.errors.slice(0, 3)) console.error(`  ${e.message.split('\n')[0]}`);
    process.exit(2);
  }
  doc = yamlDoc.toJS();
} catch (err) {
  console.error(`error: ${err.message}`);
  process.exit(2);
}

let result;
let kind;
if (doc?.machine) {
  kind = 'behavior model';
  result = validateBehavior(doc, yamlDoc, text);
} else if (doc?.entities) {
  kind = 'contract sheet';
  result = validateContracts(doc, yamlDoc, text);
} else {
  console.error(`error: ${file} is neither a behavior model (needs a top-level \`machine:\` block) nor a contract sheet (needs \`entities:\`).`);
  console.error('       schema: references/behavior-model-schema.md (behavior) · the clarify-data skill (contracts)');
  process.exit(2);
}

for (const e of result.errors) console.error(`ERROR   ${e}`);
for (const w of result.warnings) console.warn(`warning ${w}`);
if (result.errors.length) {
  console.error(`\n✖ ${file}: ${result.errors.length} error(s), ${result.warnings.length} warning(s)`);
  process.exit(1);
}
console.log(`✔ ${file}: valid ${kind} — ${result.warnings.length} warning(s)`);
