#!/usr/bin/env node
// Real compatibility smoke test: builds a throwaway Remotion project at the
// version recorded in compatibility/remotion.json, bootstraps the official
// skills from a clean state (project scope), and renders — no mocks.
//
//   node scripts/compat-smoke.mjs          still frame only (summary says so explicitly)
//   node scripts/compat-smoke.mjs --mp4    also render a minimal MP4 — REQUIRED for the
//                                          compatibility gate (ci.yml, low-drift baseline PRs)
//   node scripts/compat-smoke.mjs --keep   keep the temp project for inspection
//
// Exit 0 only if: install OK, skill names/count/version on disk match the
// manifest, `remotion versions` OK, still PNG exists and is non-trivial
// (and MP4 exists when --mp4).

import { exec } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { resolveOfficialMediabunnyVersion, checkPairing } from './compatibility.mjs';

const run = promisify(exec);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const keep = process.argv.includes('--keep');
const withMp4 = process.argv.includes('--mp4');
const STEPS = [];

const step = async (name, fn, { timeout = 420_000 } = {}) => {
  process.stdout.write(`smoke: ${name} ... `);
  const started = Date.now();
  try {
    const out = await fn({ timeout });
    console.log(`OK (${Math.round((Date.now() - started) / 1000)}s)`);
    STEPS.push([name, 'PASS', out ?? '']);
    return out;
  } catch (err) {
    console.log('FAIL');
    STEPS.push([name, 'FAIL', String(err.message || err)]);
    fail();
  }
};

const fail = () => {
  console.error('\nsmoke: FAILED — transcript:');
  for (const [name, status, detail] of STEPS) {
    console.error(`  ${status}  ${name}${status === 'FAIL' ? `\n    ${String(detail).slice(0, 800)}` : ''}`);
  }
  if (!keep) cleanup();
  process.exit(1);
};

let project = null;
// Best-effort cleanup. Windows: the esbuild daemon spawned by the Remotion CLI
// can outlive the render and hold locks in the temp project (EPERM on rm).
// Cleanup must NEVER turn a PASS into a crash — warn and keep the dir instead.
const cleanup = () => {
  if (!project || !existsSync(project)) return;
  try {
    rmSync(project, { recursive: true, force: true });
  } catch {
    console.warn(`smoke: warn — could not delete temp project (file lock, e.g. esbuild daemon): ${project}`);
  }
};
const cleanupWithRetry = async () => {
  if (!project || !existsSync(project)) return;
  try {
    rmSync(project, { recursive: true, force: true });
  } catch {
    await new Promise((r) => setTimeout(r, 1000));
    cleanup();
  }
};

const compat = JSON.parse(readFileSync(join(ROOT, 'compatibility', 'remotion.json'), 'utf8'));
const REMOTION_V = compat.remotion.tested;
const SKILLS_V = compat.skills.tested;
const SKILL_NAMES = compat.skills.names;
const MEDIABUNNY_V = compat.mediabunny?.tested ?? null;

const SRC = {
  'src/index.ts': `import { registerRoot } from 'remotion';\nimport { RemotionRoot } from './Root';\n\nregisterRoot(RemotionRoot);\n`,
  'src/Root.tsx': `import React from 'react';\nimport { Composition } from 'remotion';\nimport { Smoke } from './Smoke';\n\nexport const RemotionRoot = () => (\n  <Composition\n    id="Smoke"\n    component={Smoke}\n    durationInFrames={10}\n    fps={30}\n    width={1280}\n    height={720}\n    defaultProps={{ label: 'zcode-remotion compat smoke' }}\n  />\n);\n`,
  'src/Smoke.tsx': `import React from 'react';\nimport { useCurrentFrame, interpolate } from 'remotion';\n\nexport const Smoke = ({ label }) => {\n  const frame = useCurrentFrame();\n  const opacity = interpolate(frame, [0, 9], [1, 0.4]);\n  return (\n    <div style={{ flex: 1, background: '#0b1020', color: '#7dd3fc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 54, fontFamily: 'sans-serif', opacity }}>\n      {label} @ {frame}\n    </div>\n  );\n};\n`,
};

process.on('exit', () => { if (!keep) cleanup(); });

// 0. preflight: the recorded pairing must equal the OFFICIAL pairing that
// Remotion REMOTION_V declares (independently resolved from Remotion's
// published metadata). This catches a stale recorded pairing BEFORE any
// install/render — proving self-consistency is not proving compatibility.
let officialPair = null;
await step('official Mediabunny pairing check', async ({ timeout }) => {
  officialPair = await resolveOfficialMediabunnyVersion(REMOTION_V);
  const r = checkPairing(REMOTION_V, MEDIABUNNY_V, officialPair);
  if (!r.ok) throw new Error(r.error);
  return `Remotion ${REMOTION_V} officially pairs with mediabunny ${r.official} — matches the manifest`;
}, { timeout: 120_000 });

// 1. fresh project at the recorded baseline version (+ recorded Mediabunny pair)
project = mkdtempSync(join(tmpdir(), 'compat-smoke-'));
await step('fresh project at remotion@' + REMOTION_V + (MEDIABUNNY_V ? ` + mediabunny@${MEDIABUNNY_V}` : ''), async ({ timeout }) => {
  writeFileSync(join(project, 'package.json'), JSON.stringify({
    name: 'compat-smoke', version: '1.0.0', private: true,
  }));
  const media = MEDIABUNNY_V ? ` @remotion/media-utils@${REMOTION_V} mediabunny@${MEDIABUNNY_V}` : '';
  const { stdout } = await run(`npm i --save-exact --no-audit --no-fund remotion@${REMOTION_V} @remotion/cli@${REMOTION_V}${media} react react-dom`, { cwd: project, timeout, windowsHide: true });
  mkdirSync(join(project, 'src'), { recursive: true });
  for (const [name, content] of Object.entries(SRC)) {
    writeFileSync(join(project, name), content);
  }
  return stdout.split('\n').slice(-2).join(' | ');
}, { timeout: 600_000 });

// 1b. the recorded Remotion + Mediabunny pair must coexist without conflicts
if (MEDIABUNNY_V) {
  await step(`consistency: remotion@${REMOTION_V} + mediabunny@${MEDIABUNNY_V}`, async ({ timeout }) => {
    const { stdout } = await run('npm ls remotion @remotion/cli @remotion/media-utils mediabunny --depth=0', { cwd: project, timeout, windowsHide: true });
    for (const [pkg, v] of [['remotion', REMOTION_V], ['@remotion/media-utils', REMOTION_V], ['mediabunny', MEDIABUNNY_V]]) {
      if (!stdout.includes(`${pkg}@${v}`)) throw new Error(`npm ls missing ${pkg}@${v}:\n${stdout.slice(0, 400)}`);
    }
    return 'pair coexists, single versions resolved';
  });
}

// 2. bootstrap official skills from a clean state (project scope)
await step(`bootstrap official skills (expect ${SKILL_NAMES.length}, v${SKILLS_V})`, async ({ timeout }) => {
  const { stdout } = await run('npx -y skills add remotion-dev/skills -s "*" -y --copy', { cwd: project, timeout, windowsHide: true });
  const roots = ['.zcode/skills', '.agents/skills', 'skills'].map((r) => join(project, r));
  const base = roots.find((r) => existsSync(join(r, SKILL_NAMES[0], 'SKILL.md')));
  if (!base) throw new Error(`no installed skill dir found; looked in ${roots.join(', ')}`);
  const missing = SKILL_NAMES.filter((n) => !existsSync(join(base, n, 'SKILL.md')));
  if (missing.length) throw new Error(`missing skills on disk: ${missing.join(', ')}`);
  const installed = readdirCount(base);
  if (installed !== SKILL_NAMES.length) throw new Error(`skill count ${installed} != expected ${SKILL_NAMES.length}`);
  const fm = readFileSync(join(base, SKILL_NAMES[0], 'SKILL.md'), 'utf8');
  const m = fm.match(/^version:\s*([^\s]+)$/m);
  if (!m || m[1] !== SKILLS_V) throw new Error(`skills frontmatter version ${m ? m[1] : 'missing'} != ${SKILLS_V}`);
  return `${installed} skills in ${base}, frontmatter v${m[1]}`;
});

// 3. official CLI consistency check
await step('npx remotion versions', async ({ timeout }) => {
  const { stdout } = await run('npx remotion versions', { cwd: project, timeout, windowsHide: true });
  if (!stdout.includes('correct version')) throw new Error(`unexpected versions output: ${stdout.slice(0, 400)}`);
  return stdout.includes(REMOTION_V) ? `consistent @ ${REMOTION_V}` : stdout.slice(0, 200);
});

// 4. real still render
const still = await step('render still frame', async ({ timeout }) => {
  const out = 'out/frame.png';
  await run(`npx remotion browser ensure`, { cwd: project, timeout, windowsHide: true });
  await run(`npx remotion still src/index.ts Smoke ${out} --frame=5`, { cwd: project, timeout, windowsHide: true });
  const p = join(project, out);
  if (!existsSync(p)) throw new Error('still PNG missing');
  const bytes = statSync(p).size;
  if (bytes < 1000) throw new Error(`still PNG suspiciously small: ${bytes} bytes`);
  return `out/frame.png ${bytes} bytes`;
});

// 5. minimal MP4 (required for the compatibility gate via --mp4)
let mp4Summary = 'MP4: not requested (still-only run)';
if (withMp4) {
  const mp4 = await step('render minimal MP4', async ({ timeout }) => {
    const out = 'out/smoke.mp4';
    await run(`npx remotion render src/index.ts Smoke ${out}`, { cwd: project, timeout, windowsHide: true });
    const p = join(project, out);
    if (!existsSync(p)) throw new Error('MP4 missing');
    const bytes = statSync(p).size;
    if (bytes < 10_000) throw new Error(`MP4 suspiciously small: ${bytes} bytes`);
    // ffprobe when available (GitHub runners ship it): duration + dimensions.
    let probe = '';
    try {
      const { stdout } = await run(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height -show_entries format=duration -of csv=p=0 ${out}`, { cwd: project, timeout: 60_000, windowsHide: true });
      const [dims, duration] = stdout.trim().split('\n');
      const [w, h] = (dims || '').split(',').map((n) => Number.parseInt(n, 10));
      if (!Number.isFinite(w) || !Number.isFinite(h) || !(Number(duration) > 0)) throw new Error(`unusable ffprobe output: ${stdout.slice(0, 120)}`);
      if (w !== 1280 || h !== 720) throw new Error(`dimensions ${w}x${h} != composition 1280x720`);
      probe = `, duration ${Number(duration).toFixed(2)}s, ${w}x${h} (ffprobe)`;
    } catch (err) {
      if (err.message?.includes('dimensions') || err.message?.includes('unusable ffprobe')) throw err;
      probe = ' (ffprobe unavailable — verified: render exit status, existence, size)';
    }
    return `out/smoke.mp4 ${bytes} bytes${probe}`;
  });
  mp4Summary = `MP4: PASS (${mp4})`;
}

// Unambiguous evidence summary: the MP4 line states PASS only when --mp4 ran.
console.log('smoke: PASS');
console.log(`Remotion: ${REMOTION_V}`);
console.log(`official skills: ${SKILL_NAMES.length} (v${SKILLS_V})`);
console.log(`official Mediabunny pairing: ${officialPair}`);
console.log(`still: PASS (${still})`);
console.log(mp4Summary);
await cleanupWithRetry();

function readdirCount(dir) {
  return readdirSync(dir).length;
}
