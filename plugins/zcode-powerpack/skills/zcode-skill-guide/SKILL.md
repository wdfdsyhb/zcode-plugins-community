---
name: zcode-skill-guide
description: In-depth English guide to the ZCode skill system. Skill anatomy (SKILL.md, frontmatter), progressive disclosure, discovery order, creation workflow, writing style, and best practices. Use whenever skill, SKILL.md, frontmatter, name, description, skill creation, discovery, trigger, override, shadow, references, scripts, or best practices is mentioned — even if the user doesn't say "skill".
---

# ZCode Skill System Guide

A skill is a reusable instruction package that tells the model how to perform a specific task. Technically, it's a directory containing a `SKILL.md`. The model loads it **automatically** when relevant — so the context window isn't bloated unnecessarily.

## Skill Anatomy

```
my-skill/
+-- SKILL.md          (required - instructions)
+-- (optional)
    +-- references/   (model reads on demand)
    +-- scripts/      (executable helper scripts)
    +-- assets/       (templates, fixtures)
```

### Required Frontmatter

```yaml
---
name: my-skill                    # lowercase kebab-case, 1-64 chars, must match directory name
description: When and what for.   # Primary triggering signal
---
```

**Critical rule:** The description is the skill's **primary triggering signal**. Both *what* it does and *in what context* belong here — not in the body. Models tend to **under-trigger** skills, so write descriptions a little bit pushy.

| Wrong (under-triggers) | Right (pushy + contextual) |
|------------------------|----------------------------|
| Build a dashboard for internal data | Build a fast dashboard for internal data. Use whenever the user mentions dashboards, data visualization, internal metrics, or wants to display any company data — even if they don't say "dashboard". |

## Progressive Disclosure

ZCode loads skills in **3 layers**:

| Layer | When loaded | Recommended size |
|-------|-------------|------------------|
| 1. Metadata (name + description) | Always in context | Short - a few sentences |
| 2. SKILL.md body | Only when the skill triggers | < 500 lines |
| 3. references/ scripts/ assets/ | On demand | Unlimited |

If the body gets long, split detail into `references/` and tell the model when to read them:
```
"If the target is AWS, read references/aws.md before proceeding"
```

## Discovery Order

ZCode scans skills in this order (earlier locations take **precedence**):

| # | Location | Scope |
|---|----------|-------|
| 1 | Explicitly configured roots | custom |
| 2 | `~/.zcode/skills/` | user |
| 3 | `~/.agents/skills/` | user |
| 4 | `<project>/.zcode/skills/` (up from cwd) | workspace |
| 5 | `<project>/.agents/skills/` | workspace |
| 6 | Enabled plugin roots | plugin (lowest) |

**Conflict rule:** Identity is the file path. Same-named skills are all discovered, but only the first in discovery order is loaded — higher-precedence copies shadow the rest.

## Where to Put a New Skill

| Location | When? |
|----------|-------|
| `<project>/.agents/skills/` | This repo only (default) |
| `~/.agents/skills/` | Personal, all projects |
| `<project>/.zcode/skills/` | Override a same-named skill in this repo |
| `~/.zcode/skills/` | Personal override, all projects |

## Creation Workflow

1. **Capture Intent:** What should it do, when to trigger, output format?
2. **Draft:** Write the SKILL.md
3. **Test:** Try 2-3 realistic test prompts
4. **Review:** Evaluate outputs with the user
5. **Iterate:** Fix, retest — until satisfied

### Writing Style

- **Imperative form:** "Read the file before editing" — direct, clear
- **Explain the why:** When the rule's reason isn't obvious, include it
- **Don't shout:** All-caps MUST/NEVER usually means the rule needs better explanation
- **Examples beat rules:** Concrete format examples are stronger than prose rules

## Best Practices

1. **Description is king** — primary trigger signal, write it pushy and contextual
2. **Progressive disclosure** — metadata short, body <500 lines, details in references/
3. **Right location** — .agents/ for standard, .zcode/ for override
4. **Test and iterate** — 2-3 realistic prompts, review
5. **Stay lean** — remove rules that aren't pulling weight; give reasons instead of shouting
6. **Use examples** — concrete examples over abstract rules
7. **Diagnose when stuck** — the `diagnosing-skills` skill offers symptom→fix guidance

## Manual Invocation

If it doesn't auto-trigger, load it manually:
```
/skill <skill-name> <prompt>
```
