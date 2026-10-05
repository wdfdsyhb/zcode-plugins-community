# ZCode Remotion Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify the `remotion` ZCode plugin (router skill + 3 commands + verification tooling + CI) that bootstraps Remotion's 12 official Agent Skills via the official installer and ships as a marketplace-ready repo.

**Architecture:** The plugin never vendors upstream content (Remotion License forbids redistribution). It is an original MIT integration layer: one auto-triggering router skill plus `/remotion-setup`, `/remotion-doctor`, `/remotion-update` commands. The official `skills` CLI (spike-verified) installs upstream skills into directories ZCode natively scans (`.zcode/skills/` project scope, `~/.agents/skills/` user scope).

**Tech Stack:** Plain Markdown (skills/commands), JSON (manifests), Node.js ≥18 ESM scripts with `node --test` (verifier + its unit tests), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-31-zcode-remotion-plugin-design.md`

## Global Constraints

- Plugin name: `remotion` (regex `^[a-z0-9][a-z0-9._-]{0,127}$`); NO hooks, NO MCP, NO `userConfig`, NO plugin dependencies.
- `marketplace.json` version MUST equal `.zcode-plugin/plugin.json` version (enforced by verifier).
- SKILL.md frontmatter: `name` + `description` required; description ≤1024 chars, bilingual (English + Chinese trigger words), states when to use.
- Command filenames match `^[a-z0-9][a-z0-9_:-]{0,63}$`; each has a frontmatter `description`.
- Content language: English bodies, bilingual descriptions. No Chinese-only bodies.
- Upstream bootstrap command (spike-verified, verbatim): `npx -y skills add remotion-dev/skills -s '*' -y --copy` (project scope → `.zcode/skills/` etc.); append `-g` for user scope (→ `~/.agents/skills/`). Update: `npx -y skills update`. `--copy` is mandatory on Windows (default symlink needs privileges).
- License: MIT for all original content; `NOTICE.md` documents that upstream skills come from `remotion-dev/skills` under the Remotion License via the official installer.
- No `TBD`/`TODO`/`FIXME`/`XXX` in any shipped file (enforced by verifier).
- Initial version: `0.1.0`. Docs live under `docs/`; the repo root is the marketplace root.
- Git: commit after every task; conventional commit messages.

## Spike Facts (verified 2026-08-31, do not re-derive)

- `npx -y skills add remotion-dev/skills -s '*' -y --copy` in a git repo installs 12 skills into `.zcode/skills/`, `.claude/skills/`, `.agents/skills/`, and `skills/`.
- With `-g`: installs into `~/.agents/skills/` (ZCode user-scope directory, discovery precedence #3). One cosmetic warning "PromptScript does not support global skill installation" is expected and harmless.
- Installed SKILL.md frontmatter is ZCode-compatible (`name`, `description`, extra fields ignored by ZCode).
- 12 upstream skills: `remotion-best-practices`, `-captions`, `-create`, `-docs`, `-interactivity`, `-maps`, `-markup`, `-multimedia`, `-render`, `-saas`, `-studio`, `-upgrade`.

## File Structure (final state)

```
C:\Users\Tinkerclaw\Desktop\ZCode-Remotion\
├── .zcode-plugin/plugin.json      # manifest (Task 1)
├── skills/remotion/SKILL.md       # router skill (Task 3)
├── commands/remotion-setup.md     # Task 4
├── commands/remotion-doctor.md    # Task 4
├── commands/remotion-update.md    # Task 4
├── scripts/verify-plugin.mjs      # verifier (Task 2)
├── scripts/verify-plugin.test.mjs # unit tests for verifier (Task 2)
├── .github/workflows/ci.yml       # Task 6
├── .github/workflows/drift-check.yml # Task 6
├── marketplace.json               # Task 1
├── LICENSE                        # Task 1
├── NOTICE.md                      # Task 1
├── CHANGELOG.md                   # Task 5
├── CONTRIBUTING.md                # Task 5
├── README.md                      # Task 5
├── .gitignore                     # Task 1
└── docs/superpowers/{specs,plans}/… + docs/verification-report.md (Task 7/8)
```

---

### Task 1: Repo scaffolding + manifests + legal files

**Files:**
- Create: `.zcode-plugin/plugin.json`, `marketplace.json`, `LICENSE`, `NOTICE.md`, `.gitignore`

**Interfaces:**
- Produces: `plugin.json` with `name: "remotion"`, `version: "0.1.0"`; `marketplace.json` with a single plugin entry whose `source` is `"./"` and version `"0.1.0"` — Tasks 2/5/6 read both files.

- [ ] **Step 1: Write `.zcode-plugin/plugin.json`**

```json
{
  "name": "remotion",
  "version": "0.1.0",
  "description": "Create, preview and render videos with Remotion in ZCode. Bootstraps the 12 official Remotion Agent Skills via the official installer, then guides the full workflow: scaffold project, write React video components, Studio preview, still-frame check, MP4 render.",
  "author": "ZCode Remotion Plugin Contributors",
  "homepage": "https://github.com/AIwork4me/zcode-remotion",
  "repository": "https://github.com/AIwork4me/zcode-remotion",
  "license": "MIT",
  "keywords": ["remotion", "video", "animation", "render", "mp4", "react"],
  "skills": ["skills/remotion"],
  "commands": ["commands"]
}
```

(If the GitHub repo URL differs at publish time, update `homepage`/`repository` in Task 9.)

- [ ] **Step 2: Write `marketplace.json`**

```json
{
  "name": "zcode-remotion",
  "plugins": [
    {
      "name": "remotion",
      "source": "./",
      "description": "Remotion video creation for ZCode: official Agent Skills bootstrap + full create/preview/render workflow. 用官方安装器引导 Remotion 官方技能，覆盖建项目、预览、渲染全流程。",
      "version": "0.1.0",
      "category": "productivity",
      "tags": ["remotion", "video", "animation", "render"]
    }
  ]
}
```

- [ ] **Step 3: Write `LICENSE`** — standard MIT text, `Copyright (c) 2026 ZCode Remotion Plugin Contributors`.

- [ ] **Step 4: Write `NOTICE.md`**

```markdown
# NOTICE

This plugin contains only original integration-layer content (routing, environment
checks, workflow guidance), licensed under the MIT License (see LICENSE).

The Remotion Agent Skills that this plugin bootstraps are NOT distributed by this
plugin. They are fetched directly from the official source by your own machine via
the official installer:

    npx -y skills add remotion-dev/skills

The upstream skills are Copyright (c) Remotion and licensed under the Remotion
License (https://github.com/remotion-dev/remotion/blob/main/LICENSE.md). Review the
upstream license terms — eligibility for free use depends on your entity type
(individuals and small teams qualify; larger for-profit organizations need a
company license, see https://www.remotion.pro).
```

- [ ] **Step 5: Write `.gitignore`**

```
node_modules/
*.log
.DS_Store
```

- [ ] **Step 6: Sanity-check JSON validity**

Run: `node -e "JSON.parse(require('fs').readFileSync('.zcode-plugin/plugin.json')); JSON.parse(require('fs').readFileSync('marketplace.json')); console.log('json ok')"`
Expected: `json ok`

- [ ] **Step 7: Commit**

```bash
git add .zcode-plugin marketplace.json LICENSE NOTICE.md .gitignore
git commit -m "chore: scaffold plugin manifests and legal files"
```

---

### Task 2: Verifier `scripts/verify-plugin.mjs` (TDD)

**Files:**
- Create: `scripts/verify-plugin.mjs`, `scripts/verify-plugin.test.mjs`

**Interfaces:**
- Produces: exported pure functions `parseFrontmatter(text) -> {data, body}` (throws on invalid YAML-ish frontmatter), `verifyPlugin(root, {offline}) -> {errors: string[], warnings: string[]}`. CLI mode: `node scripts/verify-plugin.mjs [--offline]` exits 1 on any error. Tests import from `./verify-plugin.mjs`.
- Consumes: file tree from Task 1 (skills/commands dirs are validated for existence only at this stage).

- [ ] **Step 1: Write the failing tests**

`scripts/verify-plugin.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseFrontmatter, verifyPlugin } from './verify-plugin.mjs';

const makePlugin = (root, overrides = {}) => {
  const {
    pluginJson = {
      name: 'remotion', version: '0.1.0',
      description: 'd', skills: ['skills/remotion'], commands: ['commands'],
    },
    marketplaceJson = { name: 'm', plugins: [{ name: 'remotion', source: './', version: '0.1.0' }] },
    skillMd = '---\nname: remotion\ndescription: "Make videos. Use when the user wants a video / 视频."\n---\n# Router\n',
    commandMd = '---\ndescription: "Set up Remotion skills"\n---\nBody\n',
  } = overrides;
  mkdirSync(join(root, '.zcode-plugin'), { recursive: true });
  writeFileSync(join(root, '.zcode-plugin', 'plugin.json'), JSON.stringify(pluginJson));
  writeFileSync(join(root, 'marketplace.json'), JSON.stringify(marketplaceJson));
  mkdirSync(join(root, 'skills', 'remotion'), { recursive: true });
  writeFileSync(join(root, 'skills', 'remotion', 'SKILL.md'), skillMd);
  mkdirSync(join(root, 'commands'), { recursive: true });
  writeFileSync(join(root, 'commands', 'remotion-setup.md'), commandMd);
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

test('parseFrontmatter throws without closing delimiter', () => {
  assert.throws(() => parseFrontmatter('---\nname: x\n'));
});

test('valid plugin passes', async () => {
  const { errors, warnings } = await withTempPlugin({});
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test('invalid plugin name is flagged', async () => {
  const { errors } = await withTempPlugin({
    pluginJson: { name: 'Bad Name!', version: '0.1.0' },
  });
  assert.ok(errors.some((e) => e.includes('plugin name')));
});

test('version mismatch between manifests is flagged', async () => {
  const { errors } = await withTempPlugin({
    marketplaceJson: { name: 'm', plugins: [{ name: 'remotion', source: './', version: '0.2.0' }] },
  });
  assert.ok(errors.some((e) => e.includes('version')));
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/`
Expected: FAIL — cannot find module `./verify-plugin.mjs`

- [ ] **Step 3: Implement `scripts/verify-plugin.mjs`**

```js
#!/usr/bin/env node
// Static verifier for the ZCode remotion plugin. CI gate + local dev tool.
// Pure functions are exported for unit tests; CLI mode runs the full check.

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN_NAME_RE = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const COMMAND_NAME_RE = /^[a-z0-9][a-z0-9_:-]{0,63}$/;
const PLACEHOLDER_RE = /\b(TBD|TODO|FIXME|XXX)\b/;

export function parseFrontmatter(text) {
  if (!text.startsWith('---')) throw new Error('frontmatter: missing opening ---');
  const end = text.indexOf('\n---', 3);
  if (end === -1) throw new Error('frontmatter: missing closing ---');
  const raw = text.slice(4, end).trim();
  const data = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (m) data[m[1]] = m[2].replace(/^['"]|['"]$/g, '').trim();
  }
  return { data, body: text.slice(end + 4) };
}

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = join(dir, e.name);
  return e.isDirectory() ? walk(p) : [p];
});

const extractUrls = (text) => [...text.matchAll(/https?:\/\/[^\s)\]>'"]+/g)].map((m) => m[0]);

export async function verifyPlugin(root, { offline = false } = {}) {
  const errors = [];
  const warnings = [];

  // 1. plugin.json
  const manifestPath = join(root, '.zcode-plugin', 'plugin.json');
  if (!existsSync(manifestPath)) return { errors: ['.zcode-plugin/plugin.json is missing'], warnings };
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (!PLUGIN_NAME_RE.test(manifest.name ?? '')) errors.push(`invalid plugin name: ${manifest.name}`);
  if (!/^\d+\.\d+\.\d+/.test(manifest.version ?? '')) errors.push('plugin.json: version must be semver');
  for (const key of ['hooks', 'mcpServers', 'userConfig', 'dependencies']) {
    if (manifest[key]) errors.push(`plugin.json: ${key} is forbidden by spec (zero-config plugin)`);
  }

  // 2. declared component dirs exist
  const declaredDirs = [...(manifest.skills ?? []), ...(manifest.commands ?? [])]
    .filter((p) => typeof p === 'string' && !p.endsWith('.md'));
  for (const d of declaredDirs) {
    if (!existsSync(join(root, d))) errors.push(`declared component directory missing: ${d}`);
  }

  // 3. skills
  const skillsRoot = join(root, 'skills');
  if (existsSync(skillsRoot)) {
    for (const entry of readdirSync(skillsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const md = join(skillsRoot, entry.name, 'SKILL.md');
      if (!existsSync(md)) { errors.push(`skills/${entry.name}: SKILL.md missing`); continue; }
      try {
        const { data } = parseFrontmatter(readFileSync(md, 'utf8'));
        if (!data.name) errors.push(`skills/${entry.name}: frontmatter name missing`);
        if (!data.description || data.description.length < 20) {
          errors.push(`skills/${entry.name}: description missing or too short to state when-to-use`);
        }
        if ((data.description ?? '').length > 1024) {
          errors.push(`skills/${entry.name}: description exceeds 1024 chars`);
        }
      } catch (err) {
        errors.push(`skills/${entry.name}: ${err.message}`);
      }
    }
  }

  // 4. commands
  const commandsRoot = join(root, 'commands');
  if (existsSync(commandsRoot)) {
    for (const f of readdirSync(commandsRoot)) {
      if (!f.endsWith('.md')) continue;
      if (!COMMAND_NAME_RE.test(f.replace(/\.md$/, ''))) {
        errors.push(`commands/${f}: filename violates ZCode command naming`);
      }
      try {
        const { data, body } = parseFrontmatter(readFileSync(join(commandsRoot, f), 'utf8'));
        if (!data.description && !body.trim()) errors.push(`commands/${f}: needs description or body`);
      } catch (err) {
        errors.push(`commands/${f}: ${err.message}`);
      }
    }
  }

  // 5. marketplace.json version sync
  const mpPath = join(root, 'marketplace.json');
  if (!existsSync(mpPath)) {
    errors.push('marketplace.json missing');
  } else {
    const mp = JSON.parse(readFileSync(mpPath, 'utf8'));
    const entry = (mp.plugins ?? []).find((p) => p.name === manifest.name);
    if (!entry) errors.push('marketplace.json: plugin entry not found');
    else if (entry.version !== manifest.version) {
      errors.push(`version mismatch: plugin.json ${manifest.version} vs marketplace.json ${entry.version}`);
    }
  }

  // 6. placeholder scan in shipped files
  const shippedRoots = ['skills', 'commands', '.zcode-plugin'].map((d) => join(root, d));
  const shippedFiles = [...shippedRoots.filter(existsSync).flatMap(walk),
    ...['README.md', 'marketplace.json'].map((f) => join(root, f)).filter(existsSync)];
  for (const f of shippedFiles) {
    const text = readFileSync(f, 'utf8');
    if (PLACEHOLDER_RE.test(text)) errors.push(`${f}: contains placeholder token`);
  }

  // 7. link check (online only)
  if (!offline) {
    const urls = new Set(shippedFiles.flatMap((f) => extractUrls(readFileSync(f, 'utf8'))));
    for (const url of urls) {
      try {
        const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
        if (!res.ok) errors.push(`link check failed (${res.status}): ${url}`);
      } catch {
        warnings.push(`link check unreachable (network?): ${url}`);
      }
    }
  }

  return { errors, warnings };
}

if (process.argv[1] && process.argv[1].endsWith('verify-plugin.mjs')) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const offline = process.argv.includes('--offline');
  const { errors, warnings } = await verifyPlugin(root, { offline });
  for (const w of warnings) console.warn(`WARN: ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`FAIL: ${e}`);
    process.exit(1);
  }
  console.log('verify-plugin: all checks passed');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/`
Expected: all PASS (10 tests)

- [ ] **Step 5: Run the verifier against the real plugin tree**

Run: `node scripts/verify-plugin.mjs --offline`
Expected: may FAIL on `skills/remotion` SKILL.md missing (Task 3 hasn't run) — acceptable ONLY at this point; record actual output. All other checks pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/
git commit -m "feat: add plugin verifier with unit tests"
```

---

### Task 3: Router skill `skills/remotion/SKILL.md`

**Files:**
- Create: `skills/remotion/SKILL.md`

**Interfaces:**
- Consumes: bootstrap command from Global Constraints.
- Produces: the plugin's single auto-trigger skill; Tasks 4–8 assume its routing table and section names.

- [ ] **Step 1: Write the full skill content**

```markdown
---
name: remotion
description: "Remotion video workflow for ZCode: scaffold projects, write React video components, preview in Remotion Studio, render MP4s. Use when the user wants to create/edit/preview/render a video or animation, mentions Remotion, or says 视频/动画/宣传片/字幕/渲染/出片. 自动引导安装 Remotion 官方 Agent Skills 并驱动建项目、预览、渲染全流程。"
license: MIT
metadata:
  author: ZCode Remotion Plugin Contributors
  version: "0.1.0"
---

# Remotion Workflow — ZCode Integration Layer

You are helping the user make videos with Remotion (React-based programmatic video).
Official Remotion skills carry the domain depth; this skill owns bootstrap,
environment, routing, and the no-rework render loop.

## 0. Scope

Use this skill for ANY Remotion/video/animation request. Do not use it for
non-video frontend work. If the user only asks about video editing of existing
files (cut/concat/extract audio), that is @remotion/media-utils / Mediabunny
territory — route to the official `remotion-multimedia` skill after bootstrap.

## 1. Bootstrap gate (always run first)

Check whether official skills are installed:

- Project scope: `<repo>/.zcode/skills/remotion-best-practices/SKILL.md`
- User scope: `~/.agents/skills/remotion-best-practices/SKILL.md`

If NEITHER exists, bootstrap now (never silently skip, never proceed without):

```bash
npx -y skills add remotion-dev/skills -s '*' -y --copy
```

- Default is project scope (installs into `.zcode/skills/` and mirrors). Add `-g`
  for user scope (`~/.agents/skills/`) when the user wants it across all projects.
- `--copy` is required on Windows (default symlink needs elevated privileges).
- A cosmetic warning "PromptScript does not support global skill installation"
  is expected with `-g` and harmless.
- Tell the user the skills were installed by the official Remotion installer and
  are licensed by Remotion (see NOTICE in the plugin repo).
- If the user is offline or `npx` fails, fall back: download the 12 skill folders
  from https://github.com/remotion-dev/skills into `.zcode/skills/` — user-side
  fetch from the official repo, never vendored by this plugin.

After bootstrap, the official skills appear as `remotion-*` skills/commands in a
NEW session. Within the current session, read the installed SKILL.md files
directly when you need their guidance.

## 2. Environment pre-flight (before create/render)

1. Node: run `node -v`. Require ≥18 (LTS 20/22 recommended). If missing or old,
   point the user to https://nodejs.org before continuing.
2. Package manager: detect lockfile in this order — `bun.lock/bun.lockb` → bun,
   `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, else npm. Use matching commands
   (`bunx`/`pnpm exec`/`yarn`/`npx`).
3. New project? Use `npm create video@latest` (or `bun create video`) in the
   target directory; it scaffolds a Remotion template and offers to install the
   official skills.
4. Windows notes: use forward slashes in Bash; prefer `--copy` installs; if a
   render complains about Chrome, see triage below.

## 3. Routing table (after bootstrap)

| User intent | Official skill | Notes |
|---|---|---|
| New video project / composition | `remotion-create` | templates, folder layout |
| Writing/modifying video components | `remotion-markup` | animation, layout, typography, audio, fonts |
| Live preview | `remotion-studio` | `npx remotion studio` |
| Export MP4/still | `remotion-render` | see §4 loop first |
| Map animations | `remotion-maps` | paths, markers, Mapbox/Cesium |
| Captions/subtitles | `remotion-captions` | transcribe, display, animate |
| App/product integration | `remotion-saas` | rendering infra, licensing tiers |
| Studio interactivity | `remotion-interactivity` | editable/selectable in Studio |
| Look up an API/prop | `remotion-docs` | search + fetch remotion.dev docs |
| Upgrade Remotion deps | `remotion-upgrade` | also see /remotion-update |
| Audio/video metadata, conversion | `remotion-multimedia` | Mediabunny-based |
| Unsure | `remotion-best-practices` | the official router |

Routing is prefix-tolerant: if an official skill name changed upstream, match on
the `remotion-` prefix and consult `.zcode/skills/` listing or
https://www.remotion.dev/docs/ai/skills.

## 4. No-rework render loop (mandatory for render requests)

1. **Still-frame gate**: render one frame first — `npx remotion still <comp> out/frame.png --frame=<representative-frame>` — then display it to the user (image Read) and get visual confirmation. Iterate markup here, NOT after full render.
2. **Full render**: only after the user approves the still. For renders expected
   >1 min, run in background and report progress.
3. **Output verification**: confirm the MP4 exists, and check duration/dimensions match the composition (`ffprobe` if available, else trust render logs). Report absolute path to the user.

## 5. Failure triage

| Symptom | Likely cause | Action |
|---|---|---|
| `npx skills add` fails | Node missing/old, network | Check `node -v`; retry; offline fallback in §1 |
| Chrome/Chromium download failure | Network or proxy blocks storage.googleapis.com | Retry; see https://www.remotion.dev/docs/chrome-headers; /remotion-doctor |
| `Composition "<id>" not found` | Root not registering composition | Check `registerRoot` and `<Composition id=...>` match the CLI arg |
| `delayRender() ... timed out` | Unresolved handle | Ensure every `delayRender` has `continueRender`; avoid unawaited promises in `calculateMetadata` |
| `Module not found` | Deps not installed | Run detected package manager install; verify lockfile |
| License banner in render output | Company-size entity | Free tier covers individuals/≤3-employee companies; else https://www.remotion.pro — inform user, don't work around |
| Anything else | — | /remotion-doctor, then official `remotion-docs` skill |

## 6. Platform quick notes

- Windows: all commands here run in Git Bash/PowerShell; quote paths containing
  spaces; `--copy` installs (§1).
- macOS/Linux: defaults work; no `--copy` needed but harmless.
- Long renders: always background + progress; never block the session silently.
```

- [ ] **Step 2: Verify with the checker**

Run: `node scripts/verify-plugin.mjs --offline && node --test scripts/`
Expected: `verify-plugin: all checks passed` + all tests PASS

- [ ] **Step 3: Commit**

```bash
git add skills/
git commit -m "feat: add remotion router skill (integration layer)"
```

---

### Task 4: Commands `/remotion-setup`, `/remotion-doctor`, `/remotion-update`

**Files:**
- Create: `commands/remotion-setup.md`, `commands/remotion-doctor.md`, `commands/remotion-update.md`

**Interfaces:**
- Consumes: bootstrap command + scopes from Task 3 §1; triage expectations from Task 3 §5.
- Produces: three slash commands; Tasks 7–8 execute them against the real client.

- [ ] **Step 1: Write `commands/remotion-setup.md`**

```markdown
---
description: Install the 12 official Remotion Agent Skills into ZCode and verify discovery
argument-hint: "[--global]"
---

Install the official Remotion Agent Skills via the official installer, then verify
ZCode can discover them. Idempotent — safe to re-run.

1. Pre-flight: run `node -v`. If Node is missing or <18, stop and tell the user
   to install Node ≥18 from https://nodejs.org first.
2. Scope decision:
   - `$ARGUMENTS` contains `--global` → user scope.
   - Else if the current directory is inside a git repo / project → project scope.
   - Else default to `--global` (nothing to pin skills to).
3. Install (spike-verified):

   ```bash
   npx -y skills add remotion-dev/skills -s '*' -y --copy    # project scope
   npx -y skills add remotion-dev/skills -s '*' -y --copy -g # user scope
   ```

   `--copy` is mandatory on Windows. The warning
   "PromptScript does not support global skill installation" is expected and harmless.
4. Verify: confirm 12 `remotion-*` folders each containing SKILL.md under
   `.zcode/skills/` (project) or `~/.agents/skills/` (user). List them.
5. Report to the user: installed skills table, scope used, licensing note
   (skills are Copyright Remotion under the Remotion License, fetched from the
   official source — this plugin does not redistribute them), and that a NEW
   ZCode session will list them in the `/` menu. If any check fails, run the
   /remotion-doctor flow and report findings instead of guessing.
```

- [ ] **Step 2: Write `commands/remotion-doctor.md`**

```markdown
---
description: Diagnose the Remotion + ZCode environment (Node, package manager, Chrome, versions)
---

Run each check, collect results, then print ONE pass/fail table with fixes. Do not
attempt fixes before reporting.

1. Node: `node -v` — pass if ≥18. Fix: install from https://nodejs.org.
2. npx: `npx -v` — pass if prints a version.
3. Package manager: detect lockfile (bun.lock/bun.lockb, pnpm-lock.yaml,
   yarn.lock, package-lock.json). Report which one ZCode should use here.
4. Official skills installed? Check `.zcode/skills/remotion-best-practices/` and
   `~/.agents/skills/remotion-best-practices/`. Fail fix: /remotion-setup.
5. If inside a Remotion project (package.json with `remotion` dependency):
   `npm ls remotion --depth=0` (or matching pm) and report the version; compare
   with latest at https://www.remotion.dev/docs/upgrade. Fail fix: /remotion-update.
6. Chrome Headless Shell: run `npx remotion browser ensure` in the project (if
   no project, skip with a note). Fail fix: check network/proxy, see
   https://www.remotion.dev/docs/chrome-headers.
7. License awareness: print a one-line note that Remotion is free for
   individuals and companies ≤3 employees, otherwise a company license is
   required (https://www.remotion.pro). No technical check — informational.

End with: summary count (X/7 pass), the single most important next action, and
suggest the official `remotion-docs` skill for anything Remotion-API-specific.
```

- [ ] **Step 3: Write `commands/remotion-update.md`**

```markdown
---
description: Refresh the official Remotion skills and upgrade Remotion deps in the current project
---

Two independent steps — run both, report both, continue past failures.

A. Refresh official skills (spike-verified):

   ```bash
   npx -y skills update -y   # updates installed skills to latest
   ```

   If inside a project → add `-p`; for user-scope only → `-g`. Verify afterwards
   that `remotion-*` folders still contain SKILL.md and report the count (expect 12).

B. Upgrade project deps, ONLY if package.json contains `remotion`:

   ```bash
   npm i remotion @remotion/cli@latest --save-exact   # or matching package manager
   ```

   Then follow the official `remotion-upgrade` skill guidance for related
   packages (`@remotion/*`, `@remotion/media-utils`, Mediabunny compat) and check
   the changelog at https://www.remotion.dev/docs/upgrade for breaking changes.

Report: skills refreshed (Y/N + count), deps upgraded (from → to versions), any
breaking-change callouts the user must review.
```

- [ ] **Step 4: Verify**

Run: `node scripts/verify-plugin.mjs --offline && node --test scripts/`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add commands/
git commit -m "feat: add remotion-setup, remotion-doctor, remotion-update commands"
```

---

### Task 5: README, CHANGELOG, CONTRIBUTING

**Files:**
- Create: `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`

**Interfaces:**
- Consumes: component list from Tasks 1–4; verified behavior from Spike Facts.
- Produces: user-facing docs; README URL set is verified online in Task 6 CI (links must be real).

- [ ] **Step 1: Write `README.md`**

````markdown
# Remotion for ZCode

Create React-based videos inside ZCode: scaffold a project, write components,
preview in Remotion Studio, render MP4s — one prompt at a time.

This plugin bootstraps Remotion's **12 official Agent Skills** through the
official installer, then adds a ZCode-native integration layer: environment
pre-flight, bilingual (EN/中文) auto-triggering, a still-frame-before-render
verification loop, and failure triage.

## Install

1. ZCode → Settings → Plugin Management → add this repo as a plugin marketplace.
2. Install and enable the **remotion** plugin.
3. Just ask: `帮我做一个 10 秒的产品宣传视频` — or run `/remotion-setup` first.

## What you get

| Piece | What it does |
|---|---|
| `remotion` skill | Auto-triggers on video requests; bootstraps official skills, pre-flights the environment, routes to the right official skill |
| `/remotion-setup` | Installs the 12 official skills (project or user scope) + verifies discovery |
| `/remotion-doctor` | Environment health check: Node, package manager, Chrome Headless Shell, versions |
| `/remotion-update` | Refreshes official skills + upgrades Remotion deps |

The 12 official skills (installed by `npx skills add remotion-dev/skills`, they
appear as `remotion-*` in a new session): best-practices, create, markup, studio,
render, maps, captions, saas, interactivity, docs, upgrade, multimedia.

## How it stays fresh

Official skills are fetched from Remotion's official channel by your machine —
re-run `/remotion-update` anytime to pull the latest. This plugin never vendors
upstream content, so nothing here can go stale.

## Licensing

- Plugin code/content: MIT.
- Official Remotion skills: Copyright Remotion, Remotion License — free for
  individuals and companies ≤3 employees; larger companies need a license
  (https://www.remotion.pro). See NOTICE.md.

Tested against: Remotion Skills `4.0.518` (see docs/verification-report.md).
````

- [ ] **Step 2: Write `CHANGELOG.md`**

```markdown
# Changelog

## 0.1.0 — 2026-08-31

- Initial release.
- `remotion` router skill: bootstrap gate, environment pre-flight, routing table,
  still-frame render loop, failure triage.
- Commands: `/remotion-setup`, `/remotion-doctor`, `/remotion-update`.
- Verifier (`scripts/verify-plugin.mjs`) + CI (verify, link check, weekly drift check).
```

- [ ] **Step 3: Write `CONTRIBUTING.md`**

```markdown
# Contributing

- `node --test scripts/` and `node scripts/verify-plugin.mjs` must pass locally
  before every commit; CI enforces both.
- Never vendor content from `remotion-dev/skills` or the Remotion repo into this
  plugin — Remotion License forbids redistribution. Reference upstream by URL or
  via the official installer instead.
- Content is English; descriptions are bilingual (EN + 中文 trigger words).
- After changing user-facing behavior, update README + CHANGELOG in the same PR.
- Verification reports live in docs/verification-report.md — rerun the journey
  audit (spec §6 layer 3) before releasing.
```

- [ ] **Step 4: Verify (offline first, then online link check)**

Run: `node scripts/verify-plugin.mjs --offline && node scripts/verify-plugin.mjs`
Expected: both pass (online run checks every URL in shipped files resolves)

- [ ] **Step 5: Commit**

```bash
git add README.md CHANGELOG.md CONTRIBUTING.md
git commit -m "docs: add README, CHANGELOG, CONTRIBUTING"
```

---

### Task 6: CI workflows

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/drift-check.yml`

**Interfaces:**
- Consumes: verifier from Task 2 (CI must not depend on tests that don't exist yet).
- Produces: `ci` badge workflow; weekly drift issue.

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: ci
on:
  push: { branches: [main] }
  pull_request:
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: node --test scripts/
      - run: node scripts/verify-plugin.mjs
```

- [ ] **Step 2: Write `.github/workflows/drift-check.yml`**

```yaml
name: drift-check
on:
  schedule:
    - cron: "0 6 * * 1" # Mondays 06:00 UTC
  workflow_dispatch:
jobs:
  check:
    runs-on: ubuntu-latest
    permissions: { issues: write }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - name: Compare upstream skills version
        run: |
          set -e
          UPSTREAM=$(curl -fsSL https://raw.githubusercontent.com/remotion-dev/skills/main/package.json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).version||'unknown'))" 2>/dev/null || echo unknown)
          RECORDED=$(grep -o 'Remotion Skills `[0-9.]*`' README.md | grep -o '[0-9.]*' || echo none)
          echo "upstream=$UPSTREAM recorded=$RECORDED"
          if [ "$UPSTREAM" != "$RECORDED" ] && [ "$UPSTREAM" != "unknown" ]; then
            echo "DRIFT_DETECTED=$UPSTREAM" >> "$GITHUB_ENV"
          fi
      - name: Open drift issue
        if: env.DRIFT_DETECTED
        uses: actions/github-script@v7
        with:
          script: |
            const v = process.env.DRIFT_DETECTED;
            const title = `Drift: upstream Remotion skills ${v} not covered`;
            const existing = await github.rest.issues.listForRepo({...context.repo, state: 'open'});
            if (existing.data.some(i => i.title === title)) return;
            await github.rest.issues.create({
              ...context.repo,
              title,
              body: 'Upstream remotion-dev/skills is at ' + v + '. Review the routing table and environment guidance in skills/remotion/SKILL.md, bump "Tested against" in README.md, then rerun the journey audit (docs/verification-report.md).'
            });
```

- [ ] **Step 3: Validate YAML locally**

Run: `node -e "const fs=require('fs');for(const f of ['.github/workflows/ci.yml','.github/workflows/drift-check.yml']){const t=fs.readFileSync(f,'utf8');if(/\t/.test(t))throw new Error(f+': tabs forbidden');console.log(f,'ok (syntactic spot checks)')}"`
Expected: both ok. (Full YAML validation happens on first CI run; if a local YAML parser is available via npx, prefer `npx -y yaml-lint .github/workflows/*.yml`.)

- [ ] **Step 4: Commit**

```bash
git add .github/
git commit -m "ci: add verify gate and weekly upstream drift check"
```

---

### Task 7: Real-client install test + verification report (layer 2)

**Files:**
- Create: `docs/verification-report.md`

**Interfaces:**
- Consumes: finished plugin tree (Tasks 1–6).
- Produces: `docs/verification-report.md` layer-2 results; blocker list fed into fixes before Task 8.

- [ ] **Step 1: Run the local-marketplace install**

In ZCode: Settings → Plugin Management → Create/Add marketplace → point at the local path `C:\Users\Tinkerclaw\Desktop\ZCode-Remotion` → install `remotion` → enable it.

- [ ] **Step 2: Command discovery check**

New ZCode session → open `/` menu → confirm `remotion-setup`, `remotion-doctor`, `remotion-update` appear. Run `/remotion-doctor` and confirm it executes and prints the 7-check table.

- [ ] **Step 3: Trigger matrix (≥10 prompts, mixed languages)**

In test sessions, verify the `remotion` skill loads for each of: `帮我做一个10秒的产品宣传视频` / `做个动画` / `渲染一下这个项目` / `给视频加字幕` / `make me a promo video` / `animate this chart into a video` / `render my composition` / `add captions to my video` / `preview my remotion project` / `把这段做成视频`。 Record load/pass per prompt. Any miss → tighten `description` wording, re-verify.

- [ ] **Step 4: Bootstrap check**

Run `/remotion-setup` in a scratch git repo → confirm 12 skills land in `.zcode/skills/` → new session shows `remotion-*` in `/` menu → then REMOVE the scratch install (keep machine clean for Task 8).

- [ ] **Step 5: Write `docs/verification-report.md` (layer-2 section)**

Record: date, plugin version, ZCode client version, OS, each check above with PASS/FAIL + evidence (counts, paths), trigger matrix table (10/10 required to proceed).

- [ ] **Step 6: Commit**

```bash
git add docs/verification-report.md
git commit -m "docs: layer-2 real-client verification report"
```

---

### Task 8: End-to-end user-journey audit from clean state (layer 3, one-pass gate)

**Files:**
- Modify: `docs/verification-report.md` (append layer-3 section)
- Modify: `README.md` (Tested-against line if version differs)

**Interfaces:**
- Consumes: installable plugin (Task 7 state), clean machine state (no `remotion-*` skills anywhere).
- Produces: the one-pass evidence the spec requires; release gate for Task 9.

- [ ] **Step 1: Ensure clean state**

Run: `ls ~/.agents/skills/ 2>/dev/null; ls ~/.zcode/skills/ 2>/dev/null` — no `remotion-*` anywhere. Delete leftovers from Task 7 scratch tests.

- [ ] **Step 2: Fresh-install the plugin via local marketplace** (as in Task 7 Step 1, after removing and re-adding the marketplace to simulate first contact).

- [ ] **Step 3: The journey (single prompt, no hints)**

New session, in an empty scratch directory, say: `帮我做一个10秒的产品宣传视频，主题是 ZCode Remotion Plugin`。Expected chain, verify each hop:
1. `remotion` skill auto-triggers; bootstrap gate installs official skills;
2. project scaffolded (create video template);
3. deps installed; components written (markup guidance);
4. Studio preview offered/started (`npx remotion studio`, background);
5. still-frame gate: one frame rendered and shown for confirmation;
6. full render after approval → MP4 exists, duration ≈10s, dimensions correct;
7. final answer includes the absolute MP4 path + how to preview.

- [ ] **Step 4: Failure-path spot check**

Break one thing on purpose (e.g., rename the composition id in the project), ask to render, confirm triage routes to the right fix (§5 table) instead of flailing; then restore.

- [ ] **Step 5: Record evidence**

Append to `docs/verification-report.md`: wall-clock time of the journey, per-hop PASS/FAIL, upstream skills version used (from installed SKILL.md frontmatter `version:`), MP4 path/duration/dimensions, and the exact ZCode + Node versions. Update README `Tested against:` if needed. If ANY hop failed, stop — fix, rerun from Step 1. No pass, no release.

- [ ] **Step 6: Commit**

```bash
git add docs/verification-report.md README.md
git commit -m "docs: layer-3 one-pass journey audit evidence"
```

---

### Task 9: Release packaging

**Files:**
- Modify: `.zcode-plugin/plugin.json`, `marketplace.json` (repo URL if it changed), `CHANGELOG.md` (if needed)

**Interfaces:**
- Consumes: green Task 8 evidence.
- Produces: publishable repo state.

- [ ] **Step 1: Final full gate** — `node --test scripts/ && node scripts/verify-plugin.mjs` → all green.

- [ ] **Step 2: Cross-check repo URLs** in `plugin.json` / `marketplace.json` / README match the actual GitHub repo; update if different.

- [ ] **Step 3: Push to GitHub** (or hand off the bundle: `git bundle create zcode-remotion.bundle main`) and add the marketplace locally from the GitHub URL once, to prove the remote path installs.

- [ ] **Step 4: Submit to the official ZCode marketplace** per the official process at https://zcode.z.ai/cn/docs/plugin (repo with root marketplace.json). Record submission status in the final summary.

- [ ] **Step 5: Tag and commit**

```bash
git add -A && git commit -m "chore: release 0.1.0" --allow-empty
git tag v0.1.0
```

---

## Self-Review (done at plan time)

- **Spec coverage:** §3 architecture → Tasks 1,3,4; §4 components → Tasks 1,3,4; §5 UX (bilingual trigger, zero config) → Tasks 3,5 + verifier constraints Task 2; §6 testing three layers → Tasks 2 (static), 7 (client), 8 (journey); §7 release/CI → Tasks 5,6,9; §8 risks (CLI behavior — spike-verified; drift — Task 6; license watch — NOTICE + drift-check) ✓
- **Placeholders:** none; every file's full content is inline.
- **Type consistency:** `verifyPlugin(root, {offline}) -> {errors, warnings}` and `parseFrontmatter(text)` used identically in tests and implementation; bootstrap command string identical in Task 3 §1 and Task 4 setup (verbatim from Global Constraints).
