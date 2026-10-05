# Set up pstack

In this page you install the plugin, pick which subagent types pstack uses, and run your first task. Setup is a few clicks plus a short conversation.

## Install the plugin

This repository doubles as a local ZCode marketplace. In ZCode:

1. Open Settings → Plugin Management → Discover.
2. Click **+** and add this repository's directory as a local marketplace (its root carries the `marketplace.json`).
3. Install **pstack** from the list.

The plugin appears under Installed when ZCode confirms it.

## Pick your subagent roles

Run:

```text
/setup-pstack
```

[`/setup-pstack`](../../skills/setup-pstack/SKILL.md) detects the subagent types available in your session (built-ins like `general-purpose`, `Explore`, `code-reviewer`, plus plugin-contributed types like `poteto-agent`), shows you each role (code delegates, judgment, the review panels), and asks what you want. Answer the questions. It writes `~/.zcode/pstack-roles.md`, a small file every pstack skill reads.

ZCode runs every subagent on the session model, so what the file configures is the subagent type per role — that is where the diversity comes from. You only override what you care about. A role with no line in the file keeps the skill's default. To restore a default later, delete that role's line, or just run `/setup-pstack` again.

For a panel role the value is a list, and one subagent runs per entry, so the list length sets the panel size. Setup also configures `swarm workers`, the default type for every `/swarm` worker unless a race names a type for each arm.

## Accept the verification offer, or don't

At the end of setup, `/setup-pstack` looks for a way to prove app behavior in your project, either a `verify-*` skill or an existing harness. If it finds neither, it offers once to generate one with [`/create-verification-skill`](../../skills/create-verification-skill/SKILL.md).

Say yes and it writes `.zcode/skills/verify-<app>/`, a project-local skill that teaches agents to drive your app the way a user does. It proves the skill works once before handing it over. Say no and setup moves on. You can run `/create-verification-skill` yourself any time. [Verify and ship](./06-verify-and-ship.md#create-a-project-verification-skill) covers when it earns its place.

After setup, start a new chat so the skills load fresh.

## Run your first task

Pick something real but small, and describe it the way you'd describe it to a colleague:

```text
/poteto-mode add a --json flag to this command. text output stays byte-identical. verify both.
```

Watch the todo list. The first item is always "read the Principles section". The rest are the matched playbook's steps copied in, the Feature playbook for this prompt. If `/poteto-mode` skips a step, the step stays in the list with `skip: <reason>`, so you can see what it chose not to do.

From here you can type normal follow-ups. `/poteto-mode` is sticky. It stays on for the conversation until you opt out by saying so.

Next: [Route work through `/poteto-mode`](./02-poteto-mode.md).
