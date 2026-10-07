#!/usr/bin/env node
// DOM-level test of the preview client: boot, live edit, revert, theme switch.
// Runs the REAL client-src.mjs inside jsdom with a fake mermaid (injected via the
// CK.mermaid test seam — no network, no rendering engine needed).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// jsdom lives in tools/node_modules (dependencies live only in tools/)
const { JSDOM } = createRequire(path.join(root, 'tools', 'package.json'))('jsdom');

// ---- fake mermaid: records initialize/render calls, returns a valid svg ----
function makeFakeMermaid() {
  const calls = { init: [], render: [] };
  let n = 0;
  return {
    calls,
    initialize: (cfg) => { calls.init.push(cfg); },
    render: async (id, code) => {
      calls.render.push({ id, code });
      n++;
      return { svg: `<svg id="${id}" viewBox="0 0 120 60" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="60" fill="#eee"/><text>render#${n}</text></svg>` };
    },
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const expect = (label, cond, detail = '') => {
  if (cond) console.log(`PASS  ${label}`);
  else { console.error(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`); failed++; }
};

// Build a real generated page via preview.mjs on a tiny fixture dir — including a
// behavior module with a generated-diagrams/ subdir, so the module page carries the
// static link card (regression: a `.ck-card` without `.ck-src` crashed the client
// at module top level — dead theme button, blank diagrams).
const tmp = path.join('/tmp', `ck-dom-${Date.now()}`);
fs.mkdirSync(path.join(tmp, 'data'), { recursive: true });
fs.writeFileSync(path.join(tmp, 'data', 'a.mmd'), '%% title: T\nflowchart TD\n  A --> B\n');
fs.mkdirSync(path.join(tmp, 'behaviors', 'mod', 'generated-diagrams'), { recursive: true });
fs.writeFileSync(path.join(tmp, 'behaviors', 'mod', 'views.md'),
  '# views\n\n```mermaid\n%% title: V\nstateDiagram-v2\n  a : A\n  b : B\n  a --> b : go\n```\n');
fs.writeFileSync(path.join(tmp, 'behaviors', 'mod', 'generated-diagrams', 'overview.mmd'),
  '%% title: M · machine view · overview (generated)\nstateDiagram-v2\n  a : A\n  b : B\n  a --> b : go\n');
{
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(process.execPath, [path.join(root, 'tools', 'preview.mjs'), tmp], { encoding: 'utf8' });
  if (r.status !== 0) { console.error(r.stdout, r.stderr); process.exit(2); }
}
const pagePath = path.join(tmp, 'data', 'clarity-preview.html');
const html = fs.readFileSync(pagePath, 'utf8');

// jsdom: strip the module script (jsdom can't run ES modules) — we eval the client
// ourselves. Also strip the CK bootstrap script; we set our own __CK.
const clientSrc = fs.readFileSync(path.join(root, 'tools', 'lib', 'client-src.mjs'), 'utf8');
const stripped = html
  .replace(/<script>window\.__CK[\s\S]*?<\/script>/, '')
  .replace(/<script type="module">[\s\S]*<\/script>/, '');

const dom = new JSDOM(stripped, { url: 'http://localhost/', pretendToBeVisual: true, runScripts: 'outside-only' });
const { window } = dom;
window.matchMedia = window.matchMedia ?? (() => ({ matches: false }));
const fake = makeFakeMermaid();
window.__CK = { cdn: '', mermaid: fake };
window.eval(`window.__CK = ${JSON.stringify({ cdn: '' })};`);
window.__CK = { cdn: '', mermaid: fake };

let evalError = null;
try {
  window.eval(clientSrc);
} catch (e) {
  evalError = e;
}
expect('client evaluates without error', !evalError, evalError?.stack ?? '');

await sleep(50); // let boot renderAll complete
const doc = window.document;
const stage = doc.querySelector('.ck-stage');
expect('boot rendered a diagram', stage && stage.querySelector('svg') !== null);
const bootCount = fake.calls.render.length;
const diagramCards = [...doc.querySelectorAll('.ck-card')].filter((c) => c.querySelector('.ck-src')).length;
expect('boot rendered one diagram per card', bootCount === diagramCards, `rendered ${bootCount}`);

// ---- live edit ----
const ta = doc.querySelector('textarea.ck-src');
const original = ta.value;
ta.value = 'flowchart TD\n  A[edited] --> B';
ta.dispatchEvent(new window.Event('input', { bubbles: true }));
await sleep(800); // > 600ms debounce
const editCall = fake.calls.render[fake.calls.render.length - 1];
expect('live edit re-renders with edited code', editCall && editCall.code.includes('A[edited]'), JSON.stringify(editCall));

// ---- revert ----
const revertBtn = doc.querySelector('.ck-revert');
revertBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
await sleep(100);
expect('revert restores the textarea content', ta.value === original);
const revertCall = fake.calls.render[fake.calls.render.length - 1];
expect('revert re-renders with the original code', revertCall && revertCall.code === original, JSON.stringify(revertCall));
expect('revert produced a new render call', fake.calls.render.length > bootCount + 1);

// ---- theme switch preserves content and calls renderAll again ----
const before = fake.calls.render.length;
doc.querySelector('#theme-toggle').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await sleep(100);
expect('theme switch re-renders everything', fake.calls.render.length > before);

// ---- module page with the static generated-views link card ----
// The link card is a `.ck-card` WITHOUT `.ck-src`; the client must skip it, not
// crash (regression: null `.value` at module top level killed the whole page).
{
  const modHtml = fs.readFileSync(path.join(tmp, 'behaviors', 'mod', 'clarity-preview.html'), 'utf8');
  const modStripped = modHtml
    .replace(/<script>window\.__CK[\s\S]*?<\/script>/, '')
    .replace(/<script type="module">[\s\S]*<\/script>/, '');
  const modDom = new JSDOM(modStripped, { url: 'http://localhost/', pretendToBeVisual: true, runScripts: 'outside-only' });
  const mw = modDom.window;
  mw.matchMedia = mw.matchMedia ?? (() => ({ matches: false }));
  const modFake = makeFakeMermaid();
  mw.__CK = { cdn: '', mermaid: modFake };
  let modEvalError = null;
  try { mw.eval(clientSrc); } catch (e) { modEvalError = e; }
  expect('client evaluates on a page with a static link card', !modEvalError, modEvalError?.stack ?? '');
  await sleep(50);
  const modDoc = mw.document;
  expect('module page rendered its diagram', modDoc.querySelector('.ck-stage svg') !== null);
  expect('module page links to the generated-diagrams sub-page',
    !!modDoc.querySelector(`a[href="${path.join('generated-diagrams', 'clarity-preview.html')}"]`));
  const modRenders = modFake.calls.render.length;
  const modDiagramCards = [...modDoc.querySelectorAll('.ck-card')].filter((c) => c.querySelector('.ck-src')).length;
  expect('static link card is skipped by the renderer', modRenders === modDiagramCards, `rendered ${modRenders}`);
  const modThemeBtn = modDoc.querySelector('#theme-toggle');
  modThemeBtn.dispatchEvent(new mw.MouseEvent('click', { bubbles: true }));
  await sleep(100);
  expect('theme button works on the module page', modFake.calls.render.length > modRenders);
}

// ---- anchor integrity on EVERY generated page ----
// Regression: nav hrefs used a per-directory index while card ids used a
// cross-page cumulative index — every page after the first got #dN hrefs that
// pointed at nothing (URL hash changed, no scroll).
{
  const checkPage = (pagePath) => {
    const html = fs.readFileSync(pagePath, 'utf8');
    const hrefs = [...html.matchAll(/<a[^>]+href="#(d\d+)"/g)].map((m) => m[1]);
    const ids = new Set([...html.matchAll(/id="(d\d+)"/g)].map((m) => m[1]));
    return hrefs.every((h) => ids.has(h));
  };
  const dataPage = path.join(tmp, 'data', 'clarity-preview.html');
  expect('every data-page nav anchor has a target', checkPage(dataPage));
  const subPage = path.join(tmp, 'behaviors', 'mod', 'generated-diagrams', 'clarity-preview.html');
  expect('every sub-page nav anchor has a target', checkPage(subPage));
  const indexPage = path.join(tmp, 'index.html');
  expect('index page has no dangling # anchors',
    ![...fs.readFileSync(indexPage, 'utf8').matchAll(/href="#([^"]*)"/g)].length);
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failed ? `\n${failed} check(s) failed` : '\npreview client DOM test passed');
process.exit(failed ? 1 : 0);
