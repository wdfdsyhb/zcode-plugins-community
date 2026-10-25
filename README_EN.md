# zcode-plugins-community · ZCode Community Plugin Marketplace

[![CI](https://github.com/wdfdsyhb/zcode-plugins-community/actions/workflows/discover.yml/badge.svg)](https://github.com/wdfdsyhb/zcode-plugins-community/actions/workflows/discover.yml)

> A third-party plugin catalog beyond the official marketplace: 34 plugins mounted with one command, including Chinese security packs, data-competition workflows, and community plugins scattered across GitHub.
>
> English: Community-run third-party marketplace for ZCode — 34 plugins, one command to add: security packs, data-science workflows, and curated community plugins.

## Install

Pick either method and run it in a terminal (or add it in the ZCode desktop app under **Plugin Marketplace → Add**):

```bash
# Option 1: direct git
zcode plugins marketplace add wdfdsyhb/zcode-plugins-community --scope user

# Option 2: jsDelivr mirror for mainland networks (URL source, no git)
zcode plugins marketplace add https://cdn.jsdelivr.net/gh/wdfdsyhb/zcode-plugins-community@main/marketplace.json --scope user
```

Once added, this marketplace shows up in the **Personal** section of the ZCode store page.

## Catalog (34 plugins)

**Productivity**
| Plugin | Description |
|---|---|
| [zcode-tps-monitor](plugins/zcode-tps-monitor/) | Real tok/s at the end of every reply + /tps command + live dashboard · by [shy3130](https://github.com/shy3130/zcode-tps-monitor) |
| [zcode-auto-resume](plugins/zcode-auto-resume/) | Auto-resume after busy/rate-limit/timeout interruptions · by [cv-superding](https://github.com/cv-superding/zcode-auto-resume) |
| [api-quota](plugins/zcode-quota/) | API balance and speed status bar + /quota + floating window · by [2877905731](https://github.com/2877905731/zcode-quota) |
| [picturereader](plugins/picturereader-zcode/) | Image reading for text-only models: pixel-grid analysis + OCR · by [jing-hy](https://github.com/jing-hy/picturereader-zcode) |
| [zcode-session-manager](plugins/zcode-session-manager/) | Session management + cross-device memory relay · by [Mia0a-hi](https://github.com/Mia0a-hi/zcode-session-manager) |
| [Context-Budget](plugins/Context-Budget/) | Context budget compression, multi-action turns that save tokens · by [SoftArax](https://github.com/SoftArax/Context-Budget) |
| [disk-scanner](plugins/disk-scanner/) | Windows disk space scanning and analysis · by [wdfdsyhb](https://github.com/wdfdsyhb) |

**Dev tools**
| Plugin | Description |
|---|---|
| [bruce-drawio](plugins/bruce-drawio/) | draw.io diagram generation, CLI export · by [bruc3van](https://github.com/bruc3van/bruce-drawio) |
| [awwwards-mcp](plugins/awwwards-mcp/) | MCP for award-winning website design inspiration · by [INSANE0777](https://github.com/INSANE0777/Awwwards-mcp) |
| [zcode-fence](plugins/zcode-fence/) | Gate for catastrophic commands + project write fences · by [Momenttttt](https://github.com/Momenttttt/zcode-fence) |
| [git-worktrees](plugins/zcode-git-worktrees/) | Git worktree parallel workflows · by [agallardol](https://github.com/agallardol/zcode-git-worktrees) |
| [workspace-guard](plugins/zcode-workspace-guard/) | Workspace sandbox · by [XieZongChen](https://github.com/XieZongChen/zcode-workspace-guard) |
| [multi-agent-mailbox](plugins/multi-agent-mailbox/) | Multi-agent mailbox CLI/MCP · by [WQMYH](https://github.com/WQMYH/multi-agent-mailbox) |
| [OhMyZcode (omz)](plugins/OhMyZcode/) | Multi-agent parallel orchestration · by [djt889](https://github.com/djt889/OhMyZcode) |
| [pstack](plugins/pstack-zcode/) | Skills + playbooks + principles library · by [Luks3110](https://github.com/Luks3110/pstack-zcode) |
| [tony-agents-pack](plugins/zcode_skills/) | Foreign-trade AI team, 18 roles · by [tony-apan](https://github.com/tony-apan/zcode_skills) |
| [testcase](plugins/testcase/) | Spec → tests → implementation, end to end · by [xtieume](https://github.com/xtieume/testcase) |
| [project-architecture-analyzer](plugins/project-architecture-analyzer/) | Java architecture reverse-engineering dashboard · by [WhQ-cc](https://github.com/WhQ-cc/project-architecture-analyzer) |
| [harmonyos-dev (arkpilot)](plugins/arkpilot/) | HarmonyOS ArkTS development skill pack · by [taobaoaz](https://github.com/taobaoaz/arkpilot) |
| [vmctl](plugins/vmctl/) | VMware Workstation control via vmrun · by [realweng](https://github.com/realweng/vmctl) |
| [repo-cleanup-skill](plugins/repo-cleanup-skill/) | Repo cleanup that reports first, deletes later · by [peetwan](https://github.com/peetwan/repo-cleanup-skill) |
| [ai-skill-engine](plugins/ai-skill-engine/) | Onion-model skill middleware · by [mikasaw](https://github.com/mikasaw/ai-skill-engine) |
| [zcode-handbook-en](plugins/zcode-powerpack/) | ZCode handbook collection · by [imserhatdemir](https://github.com/imserhatdemir/zcode-powerpack) |
| [remotion](plugins/zcode-remotion/) | Reliability layer for Remotion video · by [AIwork4me](https://github.com/AIwork4me/zcode-remotion) |

**Education**
| Plugin | Description |
|---|---|
| [innovation-proposal](plugins/innovation-proposal/) | College innovation / Challenge Cup proposals, with the 2026 review rules built in · by [xwu43361-sys](https://github.com/xwu43361-sys/innovation-proposal) |
| [learn](plugins/learn-skill/) | One link → AI summary / terms / knowledge graph / OCR, saved to your library · by [gtbwpkwjnb-alt](https://github.com/gtbwpkwjnb-alt/learn-skill) |
| [lessonry](plugins/lessonry/) | Single-file interactive course generation · by [zryshuaige](https://github.com/zryshuaige/lessonry) |
| [literature-review](plugins/literature-review-skill/) | Papers → literature review · by [openkills](https://github.com/openkills/literature-review-skill) |
| [academic-search](plugins/academic-search/) | Academic literature tracking + weekly digest · by [pisen233](https://github.com/pisen233/academic-search) |
| [theory-refine-loop](plugins/theory-refine-loop-skill/) | review-fix-recheck loop for theoretical proofs · by [openkills](https://github.com/openkills/theory-refine-loop-skill) |

**Other**
| Plugin | Category | Description |
|---|---|---|
| [security-cn-pack](plugins/security-cn-pack/) | security | Chinese bug-hunting bundle, four skills in one · by [wdfdsyhb](https://github.com/wdfdsyhb) |
| [data-competition-pack](plugins/data-competition-pack/) | data-science | Six-stage methodology for Tianchi/Kaggle · by [wdfdsyhb](https://github.com/wdfdsyhb) |
| [md-convert](plugins/md-convert-skill/) | docs-writing | Markdown to Word/PDF/HTML · by [whlle-yi](https://github.com/whlle-yi/md-convert-skill) |
| [crawl-content](plugins/crawl-content-skill/) | dev-tools | Chinese social-media content crawling (study and research only) · by [JJ188-coder](https://github.com/JJ188-coder/crawl-content-skill) |

> Anthropic's official skill pool (frontend-design, algorithmic-art, canvas-design, etc.) is not bundled here (those repos have no LICENSE). You can mount the official repo directly: `zcode plugins marketplace add anthropics/skills`.

See [marketplace.json](marketplace.json) for the full catalog and [docs/SUBMIT.md](docs/SUBMIT.md) for inclusion criteria.

## Submit your plugin

PRs and issues are welcome. Requirements: a LICENSE, a passing gitleaks scan, a valid plugin.json, and bilingual (Chinese/English) descriptions. Details in [docs/SUBMIT.md](docs/SUBMIT.md).

## Notes

- This marketplace is a community project with no affiliation to Z.ai; the official marketplace is [zai-org/zcode-plugins](https://github.com/zai-org/zcode-plugins).
- Listed third-party plugins remain the property of their authors; original LICENSEs and attributions are kept with links back to the source repos. If you are the author of a listed project and do not want to be included, open an issue to have it removed — no reason needed.
- Every listing passes a basic security audit before inclusion (gitleaks + entry-file checks); you use the plugins at your own risk.
- Security skill content is for authorized testing and defensive learning scenarios only.

> 🇨🇳 中文文档: [README.md](README.md)
