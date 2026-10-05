import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter, verifyPlugin, extractUrls } from './verify-plugin.mjs';
import { validateManifest, classifyDrift, checkRouterCoverage, versionStatus, compareSemver, checkPairing, resolveOfficialMediabunnyVersion } from './compatibility.mjs';
import { writeUpstream, githubApiHeaders } from './drift-check.mjs';
import { inspectSkillInstall, loadExpectedSkillNames, ROUTER_SKILL } from './skill-paths.mjs';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));

const V = '0.1.0';
// Router text mentions every fixture manifest skill → routing coverage holds.
const ROUTER_SKILL_MD = `---\nname: remotion\ndescription: "Make videos. Use when the user wants a video / 视频."\nlicense: MIT\nmetadata:\n  author: t\n  version: "${V}"\n---\n# Router\n\n| intent | official skill |\n|---|---|\n| create | remotion-create |\n| render | remotion-render |\n`;

const makePlugin = (root, {
  pluginJson = { name: 'remotion', version: V, description: 'd', skills: ['skills/remotion'], commands: ['commands'] },
  marketplaceJson = { name: 'm', plugins: [{ name: 'remotion', source: './', version: V, category: 'productivity', tags: ['remotion', 'video'] }] },
  skillMd = ROUTER_SKILL_MD,
  commandMd = '---\ndescription: "Set up Remotion skills"\n---\nBody\n',
  compatJson = { remotion: { tested: '4.0.519' }, skills: { tested: '4.0.519', count: 2, names: ['remotion-create', 'remotion-render'] } },
  readmeMd = 'Tested against: Remotion `4.0.519` · official skills `4.0.519`\n',
  readmeZhMd = '测试基线：Remotion `4.0.519` · 官方技能 `4.0.519`\n',
  changelogMd = `# Changelog\n\n## ${V}\n\n- initial\n`,
} = {}) => {
  mkdirSync(join(root, '.zcode-plugin'), { recursive: true });
  writeFileSync(join(root, '.zcode-plugin', 'plugin.json'), JSON.stringify(pluginJson));
  writeFileSync(join(root, 'marketplace.json'), JSON.stringify(marketplaceJson));
  mkdirSync(join(root, 'compatibility'), { recursive: true });
  writeFileSync(join(root, 'compatibility', 'remotion.json'), JSON.stringify(compatJson));
  mkdirSync(join(root, 'skills', 'remotion'), { recursive: true });
  writeFileSync(join(root, 'skills', 'remotion', 'SKILL.md'), skillMd);
  mkdirSync(join(root, 'commands'), { recursive: true });
  writeFileSync(join(root, 'commands', 'remotion-setup.md'), commandMd);
  writeFileSync(join(root, 'README.md'), readmeMd);
  writeFileSync(join(root, 'README.zh-CN.md'), readmeZhMd);
  writeFileSync(join(root, 'CHANGELOG.md'), changelogMd);
};

const withTempPlugin = async (overrides) => {
  const root = mkdtempSync(join(tmpdir(), 'verify-plugin-'));
  makePlugin(root, overrides);
  const result = await verifyPlugin(root, { offline: true });
  rmSync(root, { recursive: true, force: true });
  return result;
};

test('parseFrontmatter extracts yaml-ish fields', () => {
  const { data, body } = parseFrontmatter('---\nname: x\ndescription: "y"\n---\nbody');
  assert.equal(data.name, 'x');
  assert.equal(data.description, 'y');
  assert.ok(body.includes('body'));
});

test('parseFrontmatter parses CRLF files (Windows autocrlf checkout)', () => {
  const { data } = parseFrontmatter('---\r\nname: remotion\r\nlicense: MIT\r\nmetadata:\r\n---\r\nbody');
  assert.equal(data.name, 'remotion');
  assert.equal(data.license, 'MIT');
  assert.equal(data.metadata, '');
});

test('parseFrontmatter throws without closing delimiter', () => {
  assert.throws(() => parseFrontmatter('---\nname: x\n'));
});

test('extractUrls strips trailing punctuation', () => {
  const urls = extractUrls('see https://example.com/docs. and (https://x.dev/a))');
  assert.deepEqual(urls, ['https://example.com/docs', 'https://x.dev/a']);
  for (const u of urls) {
    assert.ok(!u.endsWith('.') && !u.endsWith(')'));
  }
});

test('extractUrls strips trailing backtick (markdown code span)', () => {
  assert.deepEqual(extractUrls('paste `https://github.com/x/y` here'), ['https://github.com/x/y']);
});

test('valid plugin passes', async () => {
  const { errors, warnings } = await withTempPlugin({});
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test('CRLF checkout keeps the full plugin valid (end-to-end)', async () => {
  await withTempPlugin({}); // fixture sanity
  const root = mkdtempSync(join(tmpdir(), 'verify-plugin-'));
  makePlugin(root, { skillMd: ROUTER_SKILL_MD.replaceAll('\n', '\r\n') });
  const { errors } = await verifyPlugin(root, { offline: true });
  rmSync(root, { recursive: true, force: true });
  assert.deepEqual(errors, []);
});

test('invalid plugin name is flagged', async () => {
  const { errors } = await withTempPlugin({
    pluginJson: { name: 'Bad Name!', version: V },
  });
  assert.ok(errors.some((e) => e.includes('plugin name')));
});

test('version mismatch between manifests is flagged', async () => {
  const { errors } = await withTempPlugin({
    marketplaceJson: { name: 'm', plugins: [{ name: 'remotion', source: './', version: '0.2.0' }] },
  });
  assert.ok(errors.some((e) => e.includes('version')));
});

test('forbidden fields are reported as project policy, not spec', async () => {
  const { errors } = await withTempPlugin({
    pluginJson: { name: 'remotion', version: V, hooks: {}, mcpServers: {}, userConfig: {}, dependencies: [] },
  });
  for (const key of ['hooks', 'mcpServers', 'userConfig', 'dependencies']) {
    const e = errors.find((x) => x.includes(key));
    assert.ok(e, `${key} should be flagged`);
    assert.ok(e.includes('forbidden by zcode-remotion project policy'), e);
    assert.ok(!e.includes('by spec'), `wording must not blame the spec: ${e}`);
  }
});

test('missing skill description is flagged', async () => {
  const { errors } = await withTempPlugin({
    skillMd: '---\nname: remotion\ndescription: ""\n---\nbody',
  });
  assert.ok(errors.some((e) => e.includes('description')));
});

test('overlong description is flagged', async () => {
  const { errors } = await withTempPlugin({
    skillMd: `---\nname: remotion\ndescription: "${'x'.repeat(1025)}"\n---\nbody`,
  });
  assert.ok(errors.some((e) => e.includes('1024')));
});

test('command without description is flagged', async () => {
  const { errors } = await withTempPlugin({
    commandMd: '---\nfoo: bar\n---\nBody\n',
  });
  assert.ok(errors.some((e) => e.includes('remotion-setup')));
});

test('placeholder tokens in shipped files are flagged', async () => {
  const root = mkdtempSync(join(tmpdir(), 'verify-plugin-'));
  makePlugin(root);
  writeFileSync(join(root, 'skills', 'remotion', 'SKILL.md'),
    '---\nname: remotion\ndescription: "Make videos. Use when 视频."\n---\nTODO fix\n');
  const { errors } = await verifyPlugin(root, { offline: true });
  rmSync(root, { recursive: true, force: true });
  assert.ok(errors.some((e) => e.includes('TODO')));
});

test('declared-but-missing component dir is flagged', async () => {
  const root = mkdtempSync(join(tmpdir(), 'verify-plugin-'));
  makePlugin(root);
  rmSync(join(root, 'commands'), { recursive: true, force: true });
  const { errors } = await verifyPlugin(root, { offline: true });
  rmSync(root, { recursive: true, force: true });
  assert.ok(errors.some((e) => e.includes('commands')));
});

test('string-form skills/commands declarations are accepted', async () => {
  const { errors } = await withTempPlugin({
    pluginJson: {
      name: 'remotion', version: V, description: 'd',
      skills: 'skills', commands: 'commands',
    },
  });
  assert.deepEqual(errors, []);
});

// --- compatibility manifest (validateManifest) ---

test('valid compatibility manifest produces no errors', () => {
  assert.deepEqual(validateManifest({
    remotion: { tested: '4.0.519' },
    skills: { tested: '4.0.519', count: 2, names: ['remotion-create', 'remotion-render'] },
    mediabunny: { tested: '1.55.4' },
    verifiedAt: '2026-09-01',
  }), []);
});

test('malformed compatibility manifests are flagged', () => {
  assert.ok(validateManifest(null).length > 0);
  assert.ok(validateManifest([]).length > 0);
  assert.ok(validateManifest({ skills: { tested: '1.0.0', count: 1, names: ['a'] } }).some((e) => e.includes('remotion')));
  assert.ok(validateManifest({ remotion: { tested: 'latest' }, skills: { tested: '1.0.0', count: 1, names: ['a'] } }).some((e) => e.includes('remotion.tested')));
  assert.ok(validateManifest({ remotion: { tested: '4.0.519' }, skills: { tested: 'x', count: 1, names: ['a'] } }).some((e) => e.includes('skills.tested')));
  assert.ok(validateManifest({ remotion: { tested: '4.0.519' }, skills: { tested: '1.0.0', count: 1, names: ['a'] } }).length === 0);
});

test('skill count must match names length', () => {
  const errors = validateManifest({
    remotion: { tested: '4.0.519' },
    skills: { tested: '4.0.519', count: 3, names: ['a', 'b'] },
  });
  assert.ok(errors.some((e) => e.includes('skills.count')));
});

test('duplicate skill names fail', () => {
  const errors = validateManifest({
    remotion: { tested: '4.0.519' },
    skills: { tested: '4.0.519', count: 2, names: ['a', 'a'] },
  });
  assert.ok(errors.some((e) => e.includes('duplicate')));
});

test('router coverage gaps are flagged against the routing table', async () => {
  const { errors } = await withTempPlugin({
    compatJson: { remotion: { tested: '4.0.519' }, skills: { tested: '4.0.519', count: 1, names: ['remotion-notrouted'] } },
  });
  assert.ok(errors.some((e) => e.includes('remotion-notrouted') && e.includes('routing coverage')));
});

test('missing compatibility manifest is flagged', async () => {
  const root = mkdtempSync(join(tmpdir(), 'verify-plugin-'));
  makePlugin(root);
  rmSync(join(root, 'compatibility'), { recursive: true, force: true });
  const { errors } = await verifyPlugin(root, { offline: true });
  rmSync(root, { recursive: true, force: true });
  assert.ok(errors.some((e) => e.includes('compatibility/remotion.json')));
});

test('README tested-against lines must match the compatibility manifest', async () => {
  const { errors } = await withTempPlugin({
    readmeMd: 'Tested against: Remotion `4.0.1` · official skills `4.0.1`\n',
  });
  assert.ok(errors.some((e) => e.includes('README.md') && e.includes('4.0.1')));
  const { errors: zhErrors } = await withTempPlugin({
    readmeZhMd: '测试基线：Remotion `4.0.1` · 官方技能 `4.0.1`\n',
  });
  assert.ok(zhErrors.some((e) => e.includes('README.zh-CN.md')));
});

test('router skill metadata version must match plugin.json', async () => {
  const { errors } = await withTempPlugin({
    skillMd: ROUTER_SKILL_MD.replace(`version: "${V}"`, 'version: "9.9.9"'),
  });
  assert.ok(errors.some((e) => e.includes('metadata version')));
});

test('CHANGELOG latest heading must match plugin.json version', async () => {
  const { errors } = await withTempPlugin({
    changelogMd: '# Changelog\n\n## 9.9.9\n\n- other\n',
  });
  assert.ok(errors.some((e) => e.includes('CHANGELOG.md')));
});

test('marketplace entry with invalid tags shape is flagged', async () => {
  const { errors } = await withTempPlugin({
    marketplaceJson: { name: 'm', plugins: [{ name: 'remotion', source: './', version: V, tags: 'remotion' }] },
  });
  assert.ok(errors.some((e) => e.includes('tags')));
});

// --- drift classification (classifyDrift) ---

const recorded = {
  remotion: { tested: '4.0.519' },
  skills: { tested: '4.0.519', count: 2, names: ['remotion-create', 'remotion-render'] },
  mediabunny: { tested: '1.55.4' },
};
const upstreamOf = (over = {}) => ({
  remotion: '4.0.519', skillsVersion: '4.0.519',
  skillNames: ['remotion-create', 'remotion-render'], mediabunnyVersion: '1.55.4', ...over,
});

test('drift: none when upstream matches the baseline', () => {
  const d = classifyDrift(recorded, upstreamOf());
  assert.equal(d.level, 'none');
});

test('drift: version-only movement is low-risk', () => {
  const d = classifyDrift(recorded, upstreamOf({ remotion: '4.0.520', skillsVersion: '4.0.520' }));
  assert.equal(d.level, 'low');
  assert.ok(d.reasons.some((r) => r.includes('4.0.520')));
});

test('drift: new upstream skill is high-risk with routing warning', () => {
  const d = classifyDrift(recorded, upstreamOf({ skillNames: ['remotion-create', 'remotion-render', 'remotion-xxx'] }));
  assert.equal(d.level, 'high');
  assert.ok(d.reasons.some((r) => r.includes('NEW UPSTREAM SKILL DETECTED: remotion-xxx')));
  assert.ok(d.reasons.some((r) => r.includes('Routing coverage missing'.toLowerCase()) || r.toLowerCase().includes('routing coverage missing')));
});

test('drift: removed upstream skill is high-risk', () => {
  const d = classifyDrift(recorded, upstreamOf({ skillNames: ['remotion-create'] }));
  assert.equal(d.level, 'high');
  assert.ok(d.reasons.some((r) => r.includes('remotion-render')));
});

test('drift: renamed upstream skill is high-risk (removed + added)', () => {
  const d = classifyDrift(recorded, upstreamOf({ skillNames: ['remotion-create', 'remotion-rendering'] }));
  assert.equal(d.level, 'high');
  assert.ok(d.added.includes('remotion-rendering'));
  assert.ok(d.removed.includes('remotion-render'));
});

test('drift: major Remotion bump is high-risk even with same topology', () => {
  const d = classifyDrift(recorded, upstreamOf({ remotion: '5.0.0', skillsVersion: '5.0.0' }));
  assert.equal(d.level, 'high');
});

test('drift: upstream BELOW recorded baseline is a high-risk regression, never a downgrade PR', () => {
  for (const over of [
    { remotion: '4.0.518', skillsVersion: '4.0.519' },
    { remotion: '4.0.519', skillsVersion: '4.0.513' },
    { remotion: '4.0.100', skillsVersion: '4.0.100' }, // big regression
  ]) {
    const d = classifyDrift(recorded, upstreamOf(over));
    assert.equal(d.level, 'high');
    const reg = d.reasons.find((r) => r.includes('UPSTREAM VERSION REGRESSION DETECTED'));
    assert.ok(reg, `expected regression reason for ${JSON.stringify(over)}`);
    assert.ok(reg.includes('Recorded baseline:'));
    assert.ok(reg.includes('Observed upstream:'));
    assert.ok(reg.includes('No automatic downgrade will be proposed.'));
  }
});

test('drift: upstream strictly above baseline (same major) is still low-risk', () => {
  const d = classifyDrift(recorded, upstreamOf({ remotion: '4.1.0', skillsVersion: '4.0.520' }));
  assert.equal(d.level, 'low');
});

test('drift: Mediabunny unchanged adds no drift', () => {
  assert.equal(classifyDrift(recorded, upstreamOf()).level, 'none');
});

test('drift: official Mediabunny pairing movement alone is low-risk (never none)', () => {
  const d = classifyDrift(recorded, upstreamOf({ mediabunnyVersion: '1.55.5' }));
  assert.equal(d.level, 'low');
  assert.ok(d.reasons.some((r) => r.includes('Mediabunny pairing 1.55.4 → 1.55.5')));
});

test('drift: Remotion/skills/Mediabunny moving up together → low with pairing reason', () => {
  const d = classifyDrift(recorded, upstreamOf({
    remotion: '4.0.520', skillsVersion: '4.0.520', mediabunnyVersion: '1.55.5',
  }));
  assert.equal(d.level, 'low');
  assert.ok(d.reasons.some((r) => r.includes('Mediabunny pairing 1.55.4 → 1.55.5')));
  assert.ok(d.reasons.some((r) => r.includes('Remotion 4.0.519 → 4.0.520')));
});

test('drift: missing official Mediabunny observation → unknown (fail closed)', () => {
  const d = classifyDrift(recorded, { remotion: '4.0.520', skillsVersion: '4.0.520', skillNames: recorded.skills.names });
  assert.equal(d.level, 'unknown');
  assert.ok(d.reasons.some((r) => r.includes('Mediabunny pairing')));
});

test('drift: recorded Mediabunny above observed official pairing → high-risk regression', () => {
  const d = classifyDrift(recorded, upstreamOf({ mediabunnyVersion: '1.55.3' }));
  assert.equal(d.level, 'high');
  assert.ok(d.reasons.some((r) => r.includes('UPSTREAM VERSION REGRESSION DETECTED (Mediabunny official pairing)')));
});

test('drift: baseline without a recorded Mediabunny pairing → low, forced re-validation', () => {
  const recordedNoMb = { remotion: recorded.remotion, skills: recorded.skills };
  const d = classifyDrift(recordedNoMb, upstreamOf());
  assert.equal(d.level, 'low');
  assert.ok(d.reasons.some((r) => r.includes('Mediabunny pairing not recorded')));
});

test('checkPairing: recorded pairing must equal the independently resolved official pairing', () => {
  const stale = checkPairing('4.0.520', '1.55.4', '1.55.5');
  assert.equal(stale.ok, false);
  assert.ok(stale.error.includes('compatibility baseline pairing mismatch'));
  assert.ok(stale.error.includes('officially pairs with Mediabunny 1.55.5'));
  assert.ok(stale.error.includes('records 1.55.4'));
  assert.deepEqual(checkPairing('4.0.520', '1.55.5', '1.55.5'), { ok: true, official: '1.55.5' });
  assert.equal(checkPairing('4.0.520', '1.55.4', null).ok, false); // unresolvable → fail closed
  assert.equal(checkPairing('4.0.520', null, '1.55.5').ok, false); // nothing recorded → fail closed
});

test('resolveOfficialMediabunnyVersion: invalid Remotion version → null without lookup', async () => {
  for (const bad of [null, 'latest', '4.0', '']) {
    assert.equal(await resolveOfficialMediabunnyVersion(bad), null);
  }
});

test('workflow policy: validation vs delivery failure paths are distinct and correctly gated', () => {
  const yml = readFileSync(join(SCRIPTS_DIR, '..', '.github', 'workflows', 'drift-check.yml'), 'utf8');
  // stable stage IDs exist
  for (const id of ['candidate_write', 'static_validation', 'compat_validation', 'pr_delivery']) {
    assert.ok(yml.includes(`id: ${id}`), `missing id: ${id}`);
  }
  // validation-failure path is gated on VALIDATION step outcomes, not bare failure()
  assert.ok(yml.includes("steps.static_validation.outcome == 'failure' || steps.compat_validation.outcome == 'failure'"));
  // a distinct delivery-failure path exists, requiring validation SUCCESS
  assert.ok(yml.includes('Compatibility PR delivery FAILED'));
  assert.ok(yml.includes("steps.compat_validation.outcome == 'success'"));
  // the PR body carries machine evidence + the patch-release reminder
  assert.ok(yml.includes('official pairing lookup PASS'));
  assert.ok(yml.includes('publish a plugin patch release'));
});

test('drift: malformed upstream response is unknown, never a false claim', () => {
  for (const bad of [null, {}, { remotion: 'x', skillsVersion: '4.0.519', skillNames: [] }, { remotion: '4.0.519', skillsVersion: null, skillNames: ['a'] }]) {
    assert.equal(classifyDrift(recorded, bad).level, 'unknown');
  }
});

test('checkRouterCoverage lists unmentioned skills', () => {
  const text = 'route to remotion-create only';
  assert.deepEqual(checkRouterCoverage(['remotion-create', 'remotion-render'], text), ['remotion-render']);
});

// --- writeUpstream (nightly PR file updates) ---

test('writeUpstream rewrites manifest + both READMEs deterministically', () => {
  const root = mkdtempSync(join(tmpdir(), 'drift-write-'));
  const manifestPath = join(root, 'remotion.json');
  const readmeEn = join(root, 'README.md');
  const readmeZh = join(root, 'README.zh-CN.md');
  writeFileSync(manifestPath, JSON.stringify(recorded));
  writeFileSync(readmeEn, 'Tested against: Remotion `4.0.519` · official skills `4.0.519`\n');
  writeFileSync(readmeZh, '测试基线：Remotion `4.0.519` · 官方技能 `4.0.519`\n');
  const next = writeUpstream(recorded, upstreamOf({ remotion: '4.0.520', skillsVersion: '4.0.520', mediabunnyVersion: '1.55.5' }), '2026-09-01', {
    manifestPath, readmePaths: [readmeEn, readmeZh],
  });
  assert.equal(next.remotion.tested, '4.0.520');
  const written = JSON.parse(readFileSync(manifestPath, 'utf8'));
  assert.equal(written.skills.count, 2);
  assert.deepEqual(written.skills.names, ['remotion-create', 'remotion-render']);
  assert.equal(written.mediabunny.tested, '1.55.5');
  assert.equal(written.verifiedAt, '2026-09-01');
  assert.ok(readFileSync(readmeEn, 'utf8').includes('Remotion `4.0.520` · official skills `4.0.520`'));
  assert.ok(readFileSync(readmeZh, 'utf8').includes('Remotion `4.0.520` · 官方技能 `4.0.520`'));
  rmSync(root, { recursive: true, force: true });
});

// --- canonical ZCode skill discovery + installation integrity (skill-paths.mjs) ---

const EXPECTED = loadExpectedSkillNames(); // from compatibility/remotion.json — no literal counts

// Creates an install in one scope: a subset of expected names + optional extras.
const makeInstall = (root, where, names, extra = []) => {
  const bases = {
    project: join(root, 'repo', '.zcode', 'skills'),
    zcode: join(root, 'home', '.zcode', 'skills'),
    agents: join(root, 'home', '.agents', 'skills'),
  };
  const dir = bases[where];
  for (const n of [...names, ...extra]) {
    mkdirSync(join(dir, n), { recursive: true });
    writeFileSync(join(dir, n, 'SKILL.md'), '---\nname: x\n---\n');
  }
  return { project: join(root, 'repo'), home: join(root, 'home'), dir };
};
const allBut = (n) => EXPECTED.filter((x) => x !== n);
const inspect = (fx, mode) => inspectSkillInstall({ mode, home: fx.home, projectRoot: fx.project, expectedSkillNames: EXPECTED });

test('integrity: router-only install is INCOMPLETE (never a sentinel for "installed")', () => {
  const root = mkdtempSync(join(tmpdir(), 'skill-int-'));
  const fx = makeInstall(root, 'zcode', [ROUTER_SKILL]);
  const r = inspect(fx, 'auto');
  assert.equal(r.scope, 'user');
  assert.equal(r.complete, false);
  assert.equal(r.found, 1);
  assert.ok(r.missing.includes('remotion-render') && r.missing.includes('remotion-captions'));
  rmSync(root, { recursive: true, force: true });
});

test('integrity: missing router but all other skills present → INCOMPLETE with router missing', () => {
  const root = mkdtempSync(join(tmpdir(), 'skill-int-'));
  const fx = makeInstall(root, 'zcode', allBut(ROUTER_SKILL));
  const r = inspect(fx, 'auto');
  assert.equal(r.scope, 'user'); // an installation EXISTS — not 'none'
  assert.equal(r.complete, false);
  assert.deepEqual(r.missing, [ROUTER_SKILL]);
  assert.equal(r.found, EXPECTED.length - 1);
  rmSync(root, { recursive: true, force: true });
});

test('integrity: one non-router skill only → detected as incomplete installation', () => {
  const root = mkdtempSync(join(tmpdir(), 'skill-int-'));
  const fx = makeInstall(root, 'zcode', ['remotion-render']);
  const r = inspect(fx, 'auto');
  assert.equal(r.scope, 'user');
  assert.equal(r.complete, false);
  assert.equal(r.found, 1);
  assert.ok(!r.missing.includes('remotion-render'));
  rmSync(root, { recursive: true, force: true });
});

test('integrity: complete install — no reinstall', () => {
  const root = mkdtempSync(join(tmpdir(), 'skill-int-'));
  const fx = makeInstall(root, 'agents', EXPECTED);
  const r = inspect(fx, 'auto');
  assert.deepEqual({ scope: r.scope, complete: r.complete, found: r.found, missing: r.missing, extra: r.extra },
    { scope: 'user', complete: true, found: EXPECTED.length, missing: [], extra: [] });
  rmSync(root, { recursive: true, force: true });
});

test('integrity: one and several missing non-router skills are incomplete', () => {
  const root = mkdtempSync(join(tmpdir(), 'skill-int-'));
  let fx = makeInstall(root, 'zcode', allBut('remotion-render'));
  let r = inspect(fx, 'auto');
  assert.deepEqual(r.missing, ['remotion-render']);
  const root2 = mkdtempSync(join(tmpdir(), 'skill-int-'));
  const missing = ['remotion-render', 'remotion-captions', 'remotion-maps'];
  fx = makeInstall(root2, 'zcode', EXPECTED.filter((n) => !missing.includes(n)));
  r = inspect(fx, 'auto');
  assert.equal(r.complete, false);
  assert.equal(r.missing.length, 3);
  rmSync(root, { recursive: true, force: true });
  rmSync(root2, { recursive: true, force: true });
});

test('integrity: no expected skills anywhere → absent (bootstrap)', () => {
  const root = mkdtempSync(join(tmpdir(), 'skill-int-'));
  mkdirSync(join(root, 'home'), { recursive: true });
  const r = inspectSkillInstall({ home: join(root, 'home'), projectRoot: join(root, 'repo'), expectedSkillNames: EXPECTED });
  assert.deepEqual({ mode: r.mode, scope: r.scope, dir: r.dir, found: r.found, complete: r.complete },
    { mode: 'auto', scope: 'none', dir: null, found: 0, complete: false });
  rmSync(root, { recursive: true, force: true });
});

test('integrity: unknown extra remotion-* only → NOT an installation (expected skills define it)', () => {
  const root = mkdtempSync(join(tmpdir(), 'skill-int-'));
  const fx = makeInstall(root, 'zcode', [], ['remotion-legacy-thing']);
  const r = inspect(fx, 'auto');
  assert.equal(r.scope, 'none'); // no expected skill present → nothing installed
  rmSync(root, { recursive: true, force: true });
});

test('integrity: complete + extra unknown skill → complete with extra surfaced', () => {
  const root = mkdtempSync(join(tmpdir(), 'skill-int-'));
  const fx = makeInstall(root, 'zcode', EXPECTED, ['remotion-legacy-thing']);
  const r = inspect(fx, 'auto');
  assert.equal(r.complete, true);
  assert.deepEqual(r.extra, ['remotion-legacy-thing']);
  rmSync(root, { recursive: true, force: true });
});

// --- scope modes (auto / project / global) ---

test('scope: auto prefers a PARTIAL project install over a complete global one', () => {
  const root = mkdtempSync(join(tmpdir(), 'skill-scope-'));
  const proj = makeInstall(root, 'project', [ROUTER_SKILL, 'remotion-render']); // partial project
  makeInstall(root, 'zcode', EXPECTED); // complete global
  const r = inspect(proj, 'auto');
  assert.equal(r.scope, 'project');
  assert.equal(r.complete, false); // reported for project repair — not silently replaced
  rmSync(root, { recursive: true, force: true });
});

test('scope: --global ignores a complete project install', () => {
  const root = mkdtempSync(join(tmpdir(), 'skill-scope-'));
  const proj = makeInstall(root, 'project', EXPECTED); // complete project
  makeInstall(root, 'zcode', [ROUTER_SKILL]);          // partial global
  const r = inspect(proj, 'global');
  assert.equal(r.scope, 'user');
  assert.equal(r.complete, false); // user-scope truth, not the project's
  rmSync(root, { recursive: true, force: true });
});

test('scope: --project ignores a complete global install', () => {
  const root = mkdtempSync(join(tmpdir(), 'skill-scope-'));
  const proj = makeInstall(root, 'project', [ROUTER_SKILL]); // partial project
  makeInstall(root, 'zcode', EXPECTED);                       // complete global
  const r = inspect(proj, 'project');
  assert.equal(r.scope, 'project');
  assert.equal(r.complete, false);
  rmSync(root, { recursive: true, force: true });
});

test('scope: global finds a complete install in either user path, prefers complete', () => {
  const root = mkdtempSync(join(tmpdir(), 'skill-scope-'));
  const fx = makeInstall(root, 'zcode', EXPECTED);
  assert.equal(inspect(fx, 'global').dir.includes(join('.zcode', 'skills')), true);
  const root2 = mkdtempSync(join(tmpdir(), 'skill-scope-'));
  makeInstall(root2, 'zcode', [ROUTER_SKILL]);  // incomplete canonical path
  const fx2 = makeInstall(root2, 'agents', EXPECTED); // complete installer path
  const r = inspect(fx2, 'global');
  assert.equal(r.complete, true);
  assert.ok(r.dir.includes(join('.agents', 'skills'))); // the complete one wins
  rmSync(root, { recursive: true, force: true });
  rmSync(root2, { recursive: true, force: true });
});

test('scope: global with no install → absent; project with partial stays partial', () => {
  const root = mkdtempSync(join(tmpdir(), 'skill-scope-'));
  const fx = makeInstall(root, 'project', EXPECTED);
  assert.equal(inspect(fx, 'global').scope, 'none'); // --global ignores project entirely
  const root2 = mkdtempSync(join(tmpdir(), 'skill-scope-'));
  const fx2 = makeInstall(root2, 'project', [ROUTER_SKILL]);
  const r = inspect(fx2, 'project');
  assert.equal(r.scope, 'project');
  assert.equal(r.complete, false);
  rmSync(root, { recursive: true, force: true });
  rmSync(root2, { recursive: true, force: true });
});

test('scope: invalid mode throws', () => {
  assert.throws(() => inspectSkillInstall({ mode: 'both', expectedSkillNames: EXPECTED }));
});

// --- CLI behavior (real child-process runs) ---

const runCli = (args, opts = {}) => {
  const r = spawnSync(process.execPath, [join(SCRIPTS_DIR, 'skill-paths.mjs'), ...args], { encoding: 'utf8', ...opts });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
};
const cliFixture = (projectNames, zcodeNames) => {
  const root = mkdtempSync(join(tmpdir(), 'skill-cli-'));
  const fx = makeInstall(root, 'project', projectNames);
  makeInstall(root, 'zcode', zcodeNames);
  return { root, fx };
};

test('CLI: --global checks user scope only; --project checks project only', () => {
  const { root, fx } = cliFixture(EXPECTED, [ROUTER_SKILL]);
  const g = runCli(['--global', '--home', fx.home]);
  assert.equal(g.code, 1); // partial global
  assert.ok(g.out.includes('mode: global') && g.out.includes('status: INCOMPLETE'));
  const p = runCli(['--project', fx.project]);
  assert.equal(p.code, 0); // complete project
  assert.ok(p.out.includes('mode: project') && p.out.includes('status: COMPLETE'));
  const a = runCli(['--home', fx.home], { cwd: fx.project }); // no flag → auto → complete project wins
  assert.ok(a.out.includes('mode: auto') && a.out.includes('scope: project'));
  rmSync(root, { recursive: true, force: true });
});

test('CLI: conflicting flags → exit 64; unknown flag → exit 64', () => {
  const root = mkdtempSync(join(tmpdir(), 'skill-cli-'));
  const conflict = runCli(['--global', '--project', '.']);
  assert.equal(conflict.code, 64);
  assert.ok(conflict.out.includes('mutually exclusive'));
  const unknown = runCli(['--wat']);
  assert.equal(unknown.code, 64);
  assert.ok(unknown.out.includes('unknown option'));
  const noArg = runCli(['--project']);
  assert.equal(noArg.code, 64);
  rmSync(root, { recursive: true, force: true });
});

test('CLI: exit codes 0/1/2 map to complete/incomplete/absent', () => {
  const root = mkdtempSync(join(tmpdir(), 'skill-cli-'));
  const fxFull = makeInstall(root, 'project', EXPECTED);
  assert.equal(runCli(['--project', fxFull.project]).code, 0);
  const root2 = mkdtempSync(join(tmpdir(), 'skill-cli-'));
  const fxPartial = makeInstall(root2, 'project', [ROUTER_SKILL]);
  assert.equal(runCli(['--project', fxPartial.project]).code, 1);
  const home2 = join(root2, 'empty-home');
  mkdirSync(home2, { recursive: true });
  assert.equal(runCli(['--global', '--home', home2]).code, 2);
  rmSync(root, { recursive: true, force: true });
  rmSync(root2, { recursive: true, force: true });
});

// --- SemVer comparison (compareSemver / versionStatus) ---

test('compareSemver: numeric, not lexicographic', () => {
  assert.equal(compareSemver('4.0.518', '4.0.519'), -1);
  assert.equal(compareSemver('4.0.519', '4.0.519'), 0);
  assert.equal(compareSemver('4.0.520', '4.0.519'), 1);
  assert.equal(compareSemver('0.9.0', '0.10.0'), -1);   // lexicographic would say >
  assert.equal(compareSemver('1.9.9', '1.10.0'), -1);   // lexicographic would say >
  assert.equal(compareSemver('0.2.2', '0.2.1'), 1);
});

test('compareSemver: prerelease and build metadata per SemVer 2.0.0', () => {
  assert.equal(compareSemver('1.0.0-alpha', '1.0.0'), -1);        // prerelease < release
  assert.equal(compareSemver('1.0.0-alpha', '1.0.0-beta'), -1);
  assert.equal(compareSemver('1.0.0-alpha.2', '1.0.0-alpha.10'), -1); // numeric identifiers
  assert.equal(compareSemver('1.0.0+build.1', '1.0.0+build.99'), 0);  // build ignored
  assert.equal(compareSemver('1.0.0-rc.1', '1.0.0'), -1);
});

test('compareSemver: invalid input → null (callers map to unknown)', () => {
  for (const bad of ['latest', '4.0', '', null, undefined, 'v1.2.3']) {
    assert.equal(compareSemver(bad, '1.0.0'), null);
    assert.equal(compareSemver('1.0.0', bad), null);
  }
});

test('versionStatus: outdated / current / AHEAD (newer than upstream is not a failure)', () => {
  assert.equal(versionStatus('4.0.518', '4.0.519'), 'outdated');
  assert.equal(versionStatus('4.0.519', '4.0.519'), 'current');
  assert.equal(versionStatus('4.0.520', '4.0.519'), 'ahead'); // dist-tag lag, NOT outdated
  assert.equal(versionStatus('0.9.0', '0.10.0'), 'outdated'); // no lexicographic bug
});

// --- doctor version logic: each artifact vs its OWN source ---

test('versionStatus: both current / remotion-only / skills-only / both differ', () => {
  assert.equal(versionStatus('4.0.519', '4.0.519'), 'current');
  assert.equal(versionStatus('4.0.513', '4.0.519'), 'outdated'); // remotion outdated only
  assert.equal(versionStatus('4.0.519', '4.0.520'), 'outdated'); // skills outdated only (its own source)
  assert.equal(versionStatus('4.0.500', '4.1.0'), 'outdated');   // both, intentionally different
});

test('versionStatus: unavailable upstream source is unknown, never "outdated"', () => {
  for (const bad of [null, undefined, '', 'unknown', '4.0']) {
    assert.equal(versionStatus('4.0.519', bad), 'unknown');
    assert.equal(versionStatus(bad, '4.0.519'), 'unknown');
  }
});

// --- authenticated upstream observation ---

test('githubApiHeaders: no token → no auth header; token → Bearer, never logged elsewhere', () => {
  assert.deepEqual(githubApiHeaders({}), { 'user-agent': 'zcode-remotion-drift-check' });
  const h = githubApiHeaders({ GITHUB_TOKEN: 'tok-123' });
  assert.equal(h.authorization, 'Bearer tok-123');
  assert.equal(Object.keys(h).length, 2);
});

// --- single-source skill list (scripts/skill-names.mjs) ---

test('skill-names helper prints exactly the manifest skill list', () => {
  const out = execFileSync(process.execPath, [join(SCRIPTS_DIR, 'skill-names.mjs')], { encoding: 'utf8' });
  const manifest = JSON.parse(readFileSync(join(SCRIPTS_DIR, '..', 'compatibility', 'remotion.json'), 'utf8'));
  assert.equal(out.trim(), manifest.skills.names.join(' '));
  const count = execFileSync(process.execPath, [join(SCRIPTS_DIR, 'skill-names.mjs'), '--count'], { encoding: 'utf8' });
  assert.equal(Number(count.trim()), manifest.skills.names.length);
});

test('update command regression: missing manifest reference is flagged', async () => {
  const root = mkdtempSync(join(tmpdir(), 'verify-plugin-'));
  makePlugin(root);
  writeFileSync(join(root, 'commands', 'remotion-update.md'),
    '---\ndescription: u\n---\nnpx skills update remotion-best-practices remotion-create remotion-render --yes\n');
  const { errors } = await verifyPlugin(root, { offline: true });
  rmSync(root, { recursive: true, force: true });
  assert.ok(errors.some((e) => e.includes('remotion-update.md') && e.includes('compatibility/remotion.json')));
});

test('update command regression: hard-coded skill list is flagged', async () => {
  const root = mkdtempSync(join(tmpdir(), 'verify-plugin-'));
  makePlugin(root);
  writeFileSync(join(root, 'commands', 'remotion-update.md'),
    '---\ndescription: u\n---\nRead compatibility/remotion.json then: npx skills update remotion-best-practices remotion-create remotion-render --yes\n');
  const { errors } = await verifyPlugin(root, { offline: true });
  rmSync(root, { recursive: true, force: true });
  assert.ok(errors.some((e) => e.includes('remotion-update.md') && e.includes('hard-coded')));
});

test('update command regression: Bash-only $() substitution is flagged (Windows safety)', async () => {
  const root = mkdtempSync(join(tmpdir(), 'verify-plugin-'));
  makePlugin(root);
  writeFileSync(join(root, 'commands', 'remotion-update.md'),
    '---\ndescription: u\n---\nRead compatibility/remotion.json. Recovery: npx --package=@remotion/cli@$(npm view remotion version) -- remotion upgrade\n');
  const { errors } = await verifyPlugin(root, { offline: true });
  rmSync(root, { recursive: true, force: true });
  assert.ok(errors.some((e) => e.includes('remotion-update.md') && e.includes('cross-platform')));
});

test('product consistency: human-approval-gate wording contradicts the one-prompt promise', async () => {
  const { errors } = await withTempPlugin({
    readmeMd: 'Tested against: Remotion `4.0.519` · official skills `4.0.519`\n\nrenders a still frame for approval\n',
  });
  assert.ok(errors.some((e) => e.includes('autonomous visual-QA promise') && e.includes('still frame for approval')));
});

test('marketplace entry: strict must be boolean, true is accepted', async () => {
  const ok = await withTempPlugin({
    marketplaceJson: { name: 'm', plugins: [{ name: 'remotion', source: './', version: V, strict: true }] },
  });
  assert.deepEqual(ok.errors, []);
  const bad = await withTempPlugin({
    marketplaceJson: { name: 'm', plugins: [{ name: 'remotion', source: './', version: V, strict: 'yes' }] },
  });
  assert.ok(bad.errors.some((e) => e.includes('strict')));
});

// --- evidence semantics (v0.2.4) ---

test('evidence wording: stale human-approval phrasing fails, legitimate optional-approval passes', async () => {
  const stale = await withTempPlugin({
    readmeMd: 'Tested against: Remotion `4.0.519` · official skills `4.0.519`\ngates every render on a still frame you approve\n',
  });
  assert.ok(stale.errors.some((e) => e.includes('still frame you approve')));
  const legit = await withTempPlugin({
    skillMd: ROUTER_SKILL_MD + '\nAsk the user only when they explicitly requested approval.\n',
  });
  assert.deepEqual(legit.errors, []);
});

test('evidence wording: every known stale default-approval phrase is caught', async () => {
  for (const phrase of ['still frame you approve', 'still frame for you to approve', 'wait for your approval', 'wait for user approval', 'only after your approval']) {
    const r = await withTempPlugin({
      commandMd: '---\ndescription: d\n---\nfull render ' + phrase + '\n',
    });
    assert.ok(r.errors.some((e) => e.includes(phrase)), phrase + ' should be flagged');
  }
});

test('CI gate: compat-smoke must run --mp4 (verified-MP4 claims need MP4 evidence)', async () => {
  const root = mkdtempSync(join(tmpdir(), 'verify-plugin-'));
  makePlugin(root);
  mkdirSync(join(root, '.github', 'workflows'), { recursive: true });
  writeFileSync(join(root, '.github', 'workflows', 'ci.yml'), 'jobs:\n  compat-smoke:\n    steps:\n      - run: node scripts/compat-smoke.mjs\n');
  const stale = await verifyPlugin(root, { offline: true });
  assert.ok(stale.errors.some((e) => e.includes('--mp4')));
  writeFileSync(join(root, '.github', 'workflows', 'ci.yml'), 'jobs:\n  compat-smoke:\n    steps:\n      - run: node scripts/compat-smoke.mjs --mp4\n');
  const good = await verifyPlugin(root, { offline: true });
  assert.ok(!good.errors.some((e) => e.includes('--mp4')));
  rmSync(root, { recursive: true, force: true });
});

test('CLI: --home without a value is a usage error (exit 64)', () => {
  const r = spawnSync(process.execPath, [join(SCRIPTS_DIR, 'skill-paths.mjs'), '--home'], { encoding: 'utf8' });
  assert.equal(r.status, 64);
  assert.ok((r.stderr || '').includes('--home requires a directory argument'));
});

test('project mode without projectRoot fails fast with a clear error', () => {
  assert.throws(() => inspectSkillInstall({ mode: 'project', projectRoot: null, expectedSkillNames: EXPECTED }),
    /projectRoot is required in project mode/);
});
