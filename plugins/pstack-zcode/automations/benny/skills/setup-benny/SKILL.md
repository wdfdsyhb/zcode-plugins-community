---
name: setup-benny
description: Configure Benny and prepare its triage and repro automations. Use when installing Benny or changing its Slack, tracker, repository, routing, control, model, or budget settings.
disable-model-invocation: true
---

# Set up Benny

Benny ships as a dormant automation pack inside pstack. The plugin manifest exposes only pstack's normal skill root; this file and the two operational files are not slash skills.

The human enters setup by pointing the ZCode agent at the pack's `FOR_AGENTS.md`. The bootstrap flow copies the whole pack into the target repository, then reads this file directly at `.zcode/automations/benny/skills/setup-benny/SKILL.md`.

Benny needs external configuration and two live ZCode scheduled automations (registered with the Cron tools).

Do not create or update an automation until the user explicitly asks. Never put a secret value in plugin files, prompts, or committed configuration.

## 1. Copy the pack and enable shared pstack skills

Do this before asking for Benny configuration and before registering any automation.

Ask which repository will run the automations. The source pack is the directory containing `FOR_AGENTS.md`. The destination is `<target-repository>/.zcode/automations/benny/`.

Merge the entire source pack into the destination:

1. Create the destination when it is absent.
2. Copy every source file to the same relative path.
3. Preserve destination-only files. Never delete unrelated files during install or refresh.
4. Keep user-owned configuration, feature maps, and routing maps outside the destination. Never overwrite them.
5. When an existing source-managed file differs, inspect the diff and merge without discarding local edits. If ownership is ambiguous, stop and ask before replacing it.
6. Verify that the destination contains `FOR_AGENTS.md`, this setup file, both operational files, their references, and the templates.

If this file is already being read from the target destination, treat the copy as complete and run the same verification before continuing.

Confirm the pstack plugin is enabled for the user (Settings → Plugin Management). ZCode plugins are enabled at user scope, not through the target repository's config; do not merge a plugin entry into `.zcode/config.json`.

Start a fresh agent rooted in the target repository. Verify that these shared pstack skills resolve for it:

- `how`
- `why`
- `tdd`
- `unslop`
- `principle-separate-before-serializing-shared-state`
- `principle-minimize-reader-load`
- `principle-guard-the-context-window`
- `principle-sequence-verifiable-units`
- `principle-fix-root-causes`
- `principle-prove-it-works`

Do not count a skill that only happens to be loaded into the current setup session. The check must show that a fresh agent in the target repository receives pstack through the enabled plugin.

If the pstack plugin is not enabled or any shared dependency does not resolve, stop and explain the failure.

The Benny files are read directly from `.zcode/automations/benny/`. Do not add that directory to a plugin manifest or expect its `SKILL.md` files to appear in the slash-skill list.

Tell the user that `.zcode/automations/benny/`, the workspace `.zcode/config.json` when it declares automation-relevant MCP servers, and any referenced secret-free configuration must be committed before either automation is enabled. Do not commit them unless the user asks.

Once this check passes, live automation prompts may read the committed operational files by their stable repository-relative paths. They must not embed a plugin cache path or copy the file contents.

## 2. Adapt the configuration

Open these copied examples:

- `../../templates/configuration.example.yaml`
- `../reproduce-and-fix-issues/references/feature-map.example.md`

Create user-owned copies outside `.zcode/automations/benny/`. These are configuration files, not pack files. Example locations:

- Project config, such as `.zcode/benny/configuration.yaml`
- Project feature map, such as `.zcode/benny/feature-map.md`
- Project routing map, such as `.zcode/benny/routing.md`
- User config, such as `~/.config/benny/configuration.yaml`
- User feature map, such as `~/.config/benny/feature-map.md`

Fill one feature-map section for every user-facing feature the automation may reproduce. Keep it at the user point of view. Do not freeze implementation details or current code paths in the map.

Do not edit the copied examples. Pack refreshes may update source-managed files after conflict review, but they must never touch the user-owned copies.

Prefer committed, secret-free files in the target repository when a fresh automation run must read them. Otherwise paraphrase the required values into the live prompt. Reference a repository file only after confirming that the file is committed in the repository where the automation runs.

Use stable repository-relative paths for committed pack and configuration files. Never reference the plugin source directory or a plugin cache path from a live automation.

## 3. Fill the required choices

Ask for or confirm:

- Source Slack channel ID
- Optional operations or status channel ID
- Repository URL and default branch
- Triage identity or Slack user ID
- Issue tracker type, team, project, labels, and intake status
- Tracker adapter skill or MCP actions
- Optional routing map path
- Required control skill name
- Required user-facing feature-map path
- Status emoji strings
- Pull request URL format
- Polling and effort budgets
- Subagent role types for triage, repro, code work, and media review (from `~/.zcode/pstack-roles.md`)

Use only subagent types available in this session. Do not guess a type and do not carry over a private default.

The source channel, triage identity, repository, tracker adapter, control skill, and feature map must be explicit. Fail setup if any required value stays ambiguous.

Use pstack's `unslop` skill on the final automation names, descriptions, and prompt shims before saving them.

## 4. Check integration capabilities

The triage automation needs:

- Read access to the configured source Slack channel and its threads
- Thread-reply access in that channel
- Attachment metadata and file download access when reports include media
- Search, read, create, and update access through the configured issue-tracker adapter

The repro automation needs:

- Read access to the source thread
- Thread-reply access in the source channel
- Optional post and edit access in the configured operations channel
- Repository read and history access
- A pull request action that can open a draft pull request
- The configured control-adapter skill

Prefer configured Slack MCP tools for reads and posts. The optional `BENNY_SLACK_BOT_TOKEN` may fill a narrow gap such as editing one operations status message or downloading an attachment. Store the value in a secret manager or environment, not in YAML.

Do not use undocumented integration endpoints.

## 5. Prepare the routing map

If the user wants reroutes or owner pings:

1. Copy `../triage-issue-reports/references/routing.example.md` outside `.zcode/automations/benny/`.
2. Replace every placeholder with public or organization-local values.
3. Keep owner pings off by default.
4. Allow a ping only for a configured feature owner or a confirmed likely regression author.

If no routing map is configured, triage may classify a report but must not guess a destination or owner.

## 6. Verify the control adapter

Read `../reproduce-and-fix-issues/references/control-adapter.md` and the user's completed feature map.

Confirm that the named skill can:

- Bring up the target app
- Navigate every mapped feature through the real UI
- Exercise mapped states through declared adapter actions
- Inspect state without forcing the result
- Capture screenshots
- Start and stop a recording
- Clean up its processes and temporary data

If any capability is missing, leave the repro automation disabled. It must fail closed rather than claim a reproduction it did not perform.

## 7. Prepare the live automations

Ask whether this is first-time creation or configuration of existing automations.

Read `../../FOR_AGENTS.md` from the copied pack as the primary user-intent source for either path. Use it to understand the two triggers, tools, instructions, outcomes, and shared rules.

### First-time creation

Create one automation at a time, with the Cron tools (`CronCreate`). ZCode automations run on a schedule, so each automation's prompt itself polls for work: the triage prompt scans the source channel for new top-level reports since the last run (state file under `.zcode/benny/`), and the repro prompt looks for reports the triage marker cleared.

For each automation:

1. Read the matching copied prompt template as secondary internal source material.
2. Turn `FOR_AGENTS.md`, the finished Benny configuration, and the template intent into a complete natural-language prompt.
3. Tell the live prompt to read and follow its exact committed operational file under `.zcode/automations/benny/`.
4. Use the stable repository-relative path, not a plugin source or cache path. Do not copy the operational file contents into the live prompt.
5. Confirm that the copied pack and any referenced configuration files are committed in the same repository where the automation will run.
6. Register the automation with `CronCreate`: a recurring schedule whose interval matches the channel's report volume (for example every 20 or 30 minutes), a concise title (`benny-triage`, `benny-reproduce`), and the finished prompt.
7. Finish the first automation and confirm it before starting the second one.

Register the triage automation (`benny-triage`) with this intent, filled from configuration:

- Name `benny-triage`.
- Read and follow `.zcode/automations/benny/skills/triage-issue-reports/SKILL.md` for every run.
- Poll the configured source Slack channel for new top-level reports since the last run; process each while keeping its original thread coordinates.
- Read the triggering thread and reply only inside it.
- Use the configured issue-tracker integration.
- Classify, inspect evidence, trace cause, dedupe, and create only clear new bugs.
- End one thread-only verdict with the configured `[benny:bug]`, `[benny:performance]`, or `[benny:other]` marker and optional tracker URL.
- Never post a source-channel root message.

After the triage automation is confirmed, register the repro and fix automation (`benny-reproduce`) with this intent:

- Name `benny-reproduce`.
- Read and follow `.zcode/automations/benny/skills/reproduce-and-fix-issues/SKILL.md` for every run.
- Poll for the same new top-level reports in the configured source Slack channel, acting only after a trusted triage marker.
- Use the configured repository and default branch.
- Read the source thread and reply only inside it.
- Include pull request creation and the configured tracker, control-adapter, and feature-map requirements. Paraphrase mapped user paths and states unless an eligible committed file exists in the same repository.
- Reproduce the exact symptom twice through the mapped real UI and capture evidence.
- Verify an existing fix without authoring over it.
- Attempt an optional bounded fix only after confirmed repro, then open a draft pull request when proof and checks pass.
- Never post a source-channel root message.

### Existing automations

Inspect and update existing automations with `CronList` and `CronUpdate` only. Finish configuration, routing, control-adapter, and feature-map validation first. Then update each automation's title, schedule, and prompt to match the finished configuration, and confirm with the user. Do not create replacements or duplicates.

### Creation boundary

Only the Cron tools (`CronCreate`, `CronList`, `CronUpdate`, `CronDelete`) manage automations. Never call a direct automation backend service, and never use a browser URL that carries draft fields.

Do not enable either automation until the thread-safety test passes after registration.

## 8. Test thread safety

Use a test channel or a harmless test report.

Before testing, confirm that the target repository's `.zcode/config.json`, `.zcode/automations/benny/`, and every referenced secret-free configuration file are committed on the branch used by the automation checkout. Confirm that both live prompts point at their exact committed operational files. If any check fails, stop. Tell the user that the automation cannot be enabled yet.

Verify:

1. Triage stores the root `thread_ts` and posts exactly one verdict as a reply.
2. The verdict contains one configured marker.
3. Repro accepts the marker only from the configured triage identity.
4. Repro keeps the same immutable source coordinates.
5. No source-channel root message appears.
6. A delegated worker cannot use any Slack write action.
7. Missing coordinates, a deleted parent, or a failed preflight produces no post and no tracker issue.

Enable normal traffic only after all seven checks pass.
