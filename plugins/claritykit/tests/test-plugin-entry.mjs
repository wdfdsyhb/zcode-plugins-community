// Smoke test: the OpenCode plugin entry must resolve via package.json `main` and load.
// Regression guard for "skills not detected" (missing main → silent load failure).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

if (!pkg.main) {
  console.error('FAIL: package.json has no "main" — OpenCode cannot locate the plugin entry');
  process.exit(1);
}
const entry = path.join(root, pkg.main);
if (!fs.existsSync(entry)) {
  console.error(`FAIL: main points at ${pkg.main}, which does not exist`);
  process.exit(1);
}
const mod = await import(entry);
const pluginFactory = mod.default ?? mod.ClarityKitPlugin;
if (typeof pluginFactory !== 'function') {
  console.error('FAIL: plugin module does not export a plugin factory');
  process.exit(1);
}
const plugin = await pluginFactory();
const cfg = {};
await plugin.config(cfg);
const skillsDir = path.join(root, 'skills');
if (!cfg.skills?.paths?.includes(skillsDir)) {
  console.error(`FAIL: config hook did not register ${skillsDir}`);
  process.exit(1);
}
const skillCount = fs.readdirSync(skillsDir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && fs.existsSync(path.join(skillsDir, e.name, 'SKILL.md'))).length;

// Manifest consistency: every plugin manifest slot must agree with package.json.version.
// Slots: root plugin.json (Agent Plugins standard), .zcode-plugin, .claude-plugin
// (manifest + marketplace ×2), .codex-plugin. Mirrors `clarity doctor` check #1.
const slots = [
  ['plugin.json', (d) => d.version, (d) => d.$schema === 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json' && /^[a-z0-9][a-z0-9.-]*$/.test(d.name ?? '')],
  ['.zcode-plugin/plugin.json', (d) => d.version, (d) => /^[a-z0-9][a-z0-9._-]{0,127}$/.test(d.name ?? '')],
  ['.claude-plugin/plugin.json', (d) => d.version, () => true],
  ['.claude-plugin/marketplace.json', (d) => d?.plugins?.[0]?.version, () => true],
  ['.claude-plugin/marketplace.json metadata', (d) => d?.metadata?.version, () => true],
  ['.codex-plugin/plugin.json', (d) => d.version, () => true],
];
for (const [label, pick, valid] of slots) {
  const file = label.replace(/ metadata$| \(.+\)$/, '');
  let doc;
  try { doc = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')); }
  catch { console.error(`FAIL: ${file} missing or unparsable`); process.exit(1); }
  if (pick(doc) !== pkg.version) {
    console.error(`FAIL: ${label} version is ${pick(doc) ?? 'missing'}, expected ${pkg.version}`);
    process.exit(1);
  }
  if (!valid(doc)) {
    console.error(`FAIL: ${label} fails format validation (name/schema)`);
    process.exit(1);
  }
}
// Pi package declaration must point at the skills dir.
if (pkg.pi?.skills?.[0] !== './skills' || !pkg.keywords.includes('pi-package')) {
  console.error('FAIL: package.json pi manifest (pi.skills / pi-package keyword) is wrong');
  process.exit(1);
}
console.log(`PASS: plugin loads via main, skills dir registered, ${skillCount} skills present`);
console.log('PASS: all 8 manifest version slots agree on ' + pkg.version + ' (agent-plugins, zcode, claude ×3, codex, pi)');
