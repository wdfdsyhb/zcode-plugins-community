---
name: remotion
description: "Remotion video workflow for ZCode: scaffold projects, write React video components, preview in Remotion Studio, render MP4s. Use when the user wants to create/edit/preview/render a video or animation, mentions Remotion, or says 视频/动画/宣传片/字幕/渲染/出片. 自动引导安装 Remotion 官方 Agent Skills 并驱动建项目、预览、渲染全流程。"
license: MIT
metadata:
  author: ZCode Remotion Plugin Contributors
  version: "0.2.5"
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

Check whether official skills are installed — and whether the installation is
COMPLETE. No single skill (not even `remotion-best-practices`) proves a healthy
install: any ONE expected skill with a valid SKILL.md means an installation
exists; the expected set comes exclusively from `compatibility/remotion.json`
→ `skills.names`.

Detection priority (scopes are never mixed):

1. Project scope: `<repo>/.zcode/skills/`
2. User scope, ZCode-native: `~/.zcode/skills/`
3. User scope, installer: `~/.agents/skills/`

The first scope containing ANY expected skill is THE detected installation
(automatic mode — run `node scripts/skill-paths.mjs` for a ready-made report,
`--global` / `--project .` to check one scope explicitly). Then:

- **complete** (every expected skill has a SKILL.md) → done, no reinstall.
  Extra `remotion-*` folders are not a failure — report them, upstream
  topology may have changed.
- **incomplete** (1..N-1 expected skills present — including a router-only
  install or an install missing the router) → report, e.g.
  `Official Remotion skills: 10/12 present — Missing: remotion-render,
  remotion-captions`, then REPAIR IN THE DETECTED SCOPE via the installer
  below (never fill a project install from user scope or vice versa).
- **absent** (no expected skill in any scope) → bootstrap now (never silently
  skip, never proceed without):

```bash
npx -y skills add remotion-dev/skills -s '*' -y --copy -g
```

- Default is user scope (`-g`: installs into `~/.agents/skills/` and mirrors to
  `~/.zcode/skills/`, so the skills work across all projects). Drop `-g` for
  project scope (same command without `-g`, installs into `.zcode/skills/`
  etc.) only when the user explicitly wants the skills pinned to one repo.
- `--copy` is required on Windows (default symlink needs elevated privileges).
- A cosmetic warning "PromptScript does not support global skill installation"
  is expected with `-g` and harmless.
- Inside an existing Remotion project, the official CLI can do the same:
  `npx remotion skills add` / `npx remotion skills update` (first-party
  wrappers around the official installer).
- Tell the user the skills were installed by the official Remotion installer and
  are licensed by Remotion (see NOTICE in the plugin repo).

**If the official installer fails, preserve the requested scope and be honest
about what is possible:**

```text
official installer fails
│
├─ network / GitHub still reachable
│    └─ fetch the skill folders directly from the official
│       https://github.com/remotion-dev/skills into the REQUESTED scope
│       directory (user scope → ~/.zcode/skills/; project scope → .zcode/skills/)
│
└─ truly offline
     ├─ use an already-installed/cached copy of the official skills if one exists
     └─ otherwise say so plainly: official skills cannot be installed right now
```

Never convert a failed user-scope install into a project-scope install (or the
reverse) without asking. **Verify (mandatory, every path):** confirm on disk
that every expected skill (the canonical list in
`compatibility/remotion.json` → `skills.names`) has its SKILL.md in the
requested scope — `node scripts/skill-paths.mjs --global` (or `--project .`)
prints the report and only a COMPLETE report counts as success. Do not
rely on the installer's exit code or console output alone; check the
filesystem.

> **Never report that skills/components were installed without verifying the files
> exist on disk.** If nothing could be installed, report failure honestly and
This plugin's own skill/commands register automatically on plugin enable. The
official Remotion skills are EXTERNAL skill files: per the current ZCode docs,
after installing or updating them open **Settings → Skills**, click **Refresh**,
and confirm each skill is listed and enabled; only fall back to a new
conversation if Refresh does not surface them. Do not toggle the plugin as a
refresh mechanism for externally installed skills. Within the CURRENT session,
read the installed SKILL.md files directly when you need their guidance.
directories at session spawn. If they are not visible in the `/` menu, check
Settings → Skills first, then start a new conversation. Within the CURRENT
session, read the installed SKILL.md files directly when you need their
guidance.

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
| Upgrade Remotion deps | `remotion-upgrade` | official-first flow, also see /remotion-update |
| Audio/video metadata, conversion | `remotion-multimedia` | Mediabunny-based |
| Unsure | `remotion-best-practices` | the official router |

Routing is prefix-tolerant: if an official skill name changed upstream, match on
the `remotion-` prefix and consult `.zcode/skills/` listing or
https://www.remotion.dev/docs/ai/skills.

## 4. No-rework render loop (mandatory for render requests)

The still-frame gate is autonomous: the AGENT visually inspects the still and,
on PASS, proceeds to the full render without interrupting the user. This is
what keeps "one prompt → verified MP4" truthful.

1. **Still-frame gate**: render one representative frame — `npx remotion still
   <comp> out/frame.png --frame=<representative-frame>`.
2. **Agent visual QA** (mandatory): actually inspect the generated image with
   the environment's image-reading/vision capability. Check at least: blank or
   failed render · missing images/assets · text clipping or overflow ·
   obvious overlap · bad framing · unreadable typography · low contrast ·
   unexpected transparent/black areas · broken layout · obvious artifacts.
   If problems exist: fix markup → rerender still → inspect again. Iterate
   here, NOT after the full render.
3. **Decide**: objective QA PASS → proceed to full render automatically. Ask
   the user ONLY when they explicitly requested approval, the choice is
   inherently subjective, brand/aesthetic intent is ambiguous, or confidence
   is low (e.g. "which logo treatment do you prefer?"). Never interrupt a
   straightforward render just to ask "is this frame OK?".
4. **Full render**: proceed after QA PASS. For renders expected >1 min, run in
   background and report progress.
5. **Output verification**: confirm the MP4 exists and is non-empty; prefer
   `ffprobe` (when available) for duration and dimensions vs the composition.
   If `ffprobe` is unavailable, say exactly what was verified (existence, size,
   render exit status) and what was not — never claim "video verified" from an
   exit code alone. Report the absolute path.

## 5. Failure triage

| Symptom | Likely cause | Action |
|---|---|---|
| `npx skills add` fails | Node missing/old, network | Check `node -v`; retry; fallback ladder in §1 |
| Chrome/Chromium download failure | Network or proxy blocks storage.googleapis.com | Retry; see https://www.remotion.dev/docs/chrome-headless-shell; /remotion-doctor |
| `Error: Could not find composition with ID <id>. Available compositions: ...` | Root not registering composition | Check `registerRoot` and `<Composition id=...>` match the CLI arg |
| `delayRender() ... timed out` | Unresolved handle | Ensure every `delayRender` has `continueRender`; avoid unawaited promises in `calculateMetadata` |
| `Module not found` | Deps not installed | Run detected package manager install; verify lockfile |
| License banner in render output | Company-size entity | Free tier covers individuals/≤3-employee companies; else https://www.remotion.pro — inform user, don't work around |
| Anything else | — | /remotion-doctor, then official `remotion-docs` skill |

## 6. Platform quick notes

- Windows: all commands here run in Git Bash/PowerShell; quote paths containing
  spaces; `--copy` installs (§1).
- macOS/Linux: defaults work; no `--copy` needed but harmless.
- Long renders: always background + progress; never block the session silently.
