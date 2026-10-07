# Pi

ClarityKit is a valid Pi package: the repo declares its skills under the `pi` key in
`package.json` (`pi.skills: ["./skills"]`), so Pi loads all nine skills from a git (or
npm) install.

## Install

```bash
pi install git:github.com/maxi3777/claritykit            # tracks the default branch
pi install git:github.com/maxi3777/claritykit@v2.1.0     # pinned to a tag (recommended)
# project-scoped instead of user-scoped (lands in .pi/settings.json, shareable with a team):
pi install -l git:github.com/maxi3777/claritykit@v2.1.0
```

Skills register as `/skill:clarity-flow`, `/skill:clarify-behavior`, … Pi also injects
their descriptions into the system prompt, so asking the agent to "use clarify-data"
works the same way. Enable/disable individual resources with `pi config`.

**The CLI is separate** (Pi packages don't inject PATH):

```bash
npm install -g github:maxi3777/claritykit    # installs the `clarity` command from git
```

Pi runs `npm install` on git packages, but ClarityKit keeps its tool dependencies inside
`tools/` with its own self-bootstrap — nothing extra happens at install time.

## Update

```bash
pi update --extensions      # reconciles every installed package to its pinned ref
# moving a pin to a new release:
pi install git:github.com/maxi3777/claritykit@v2.1.0
```

Then re-run the CLI install command if you used `npm install -g`, and verify with
`clarity version`.

## Fallback: shared skills directory

Pi also reads `~/.agents/skills/` (and `.agents/skills/` in the project):

```bash
git clone https://github.com/maxi3777/claritykit.git ~/agent-kits/claritykit
mkdir -p ~/.agents/skills
ln -s ~/agent-kits/claritykit/skills/* ~/.agents/skills/
```

This directory is also read by Codex and Cursor — one install serves several agents.

## Verify

`clarity doctor` passes; `pi list` shows the package; `/skill:clarity-flow` works.
