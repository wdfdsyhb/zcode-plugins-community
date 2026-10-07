#!/usr/bin/env node
// versions.mjs <spec...> — batch-verify current versions so compatibility
// analysis is ONE shell call instead of one curl per package.
//   npm packages:  plain names            → name@latest + peerDependencies
//   GitHub repos:  gh:owner/repo          → latest release tag
// Exit 0 = all resolved, 1 = any failure (all results still printed).
const specs = process.argv.slice(2);
if (!specs.length) {
  console.error('usage: node versions.mjs <npm-package... | gh:owner/repo ...>');
  process.exit(2);
}

const TIMEOUT = 15000;

async function npmVersion(pkg) {
  const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg)}/latest`, { signal: AbortSignal.timeout(TIMEOUT) });
  if (res.status === 404) throw new Error('package not found on npm');
  if (!res.ok) throw new Error(`registry HTTP ${res.status}`);
  const j = await res.json();
  const peers = Object.entries(j.peerDependencies ?? {})
    .map(([k, v]) => `${k}@${v}`).join(', ');
  return { label: `${pkg}@${j.version}`, note: peers ? `peers: ${peers}` : '' };
}

async function ghVersion(repo) {
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'claritykit' },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (res.status === 404) throw new Error('no releases / repo not found');
  if (res.status === 403) throw new Error('rate-limited (GitHub API) — retry later');
  if (!res.ok) throw new Error(`GitHub HTTP ${res.status}`);
  const j = await res.json();
  return { label: `gh:${repo}`, note: j.tag_name };
}

const fetchOne = async (spec) => {
  try {
    return spec.startsWith('gh:')
      ? await ghVersion(spec.slice(3))
      : await npmVersion(spec);
  } catch (err) {
    return { label: spec, note: `FAILED — ${err.message}`, failed: true };
  }
};

// bounded concurrency
const results = new Array(specs.length);
let next = 0;
async function worker() {
  while (next < specs.length) {
    const i = next++;
    results[i] = await fetchOne(specs[i]);
  }
}
await Promise.all(Array.from({ length: Math.min(8, specs.length) }, worker));

const width = Math.max(...results.map((r) => r.label.length));
for (const r of results) console.log(`${r.label.padEnd(width)}  ${r.note}`);
const failed = results.filter((r) => r.failed).length;
if (failed) {
  console.error(`\n${failed} spec(s) failed — verify network, names, and GitHub rate limits.`);
  process.exit(1);
}
