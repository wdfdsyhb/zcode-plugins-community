# zcode-plugins-community

社区维护的 [ZCode](https://github.com/zai-org/ZCode) 第三方插件市场。官方市场之外的收录地：中文安全技能包、数据竞赛工作流、以及散落在 GitHub 各处的社区插件。

Community-run third-party plugin marketplace for ZCode: Chinese security packs, data-science workflows, and curated community plugins.

## 安装 / Install

任选一种，在终端执行（或在 ZCode 桌面端 **插件市场 → 新增** 中添加）：

```bash
# 方式一：git 直连
zcode plugins marketplace add wdfdsyhb/zcode-plugins-community --scope user

# 方式二：国内网络用 jsDelivr 镜像（URL 来源，不走 git）
zcode plugins marketplace add https://cdn.jsdelivr.net/gh/wdfdsyhb/zcode-plugins-community@main/marketplace.json --scope user
```

添加后打开 ZCode 商店页的 **个人** 分段即可看到本市场条目。

## 收录 / Catalog(34 plugins)

**效率 productivity**
| 插件 | 说明 |
|---|---|
| [zcode-tps-monitor](plugins/zcode-tps-monitor/) | 每轮回复末尾真实 tok/s + /tps 命令 + 实时大屏 · by [shy3130](https://github.com/shy3130/zcode-tps-monitor) |
| [zcode-auto-resume](plugins/zcode-auto-resume/) | 系统繁忙/限流/超时中断后自动续跑 · by [cv-superding](https://github.com/cv-superding/zcode-auto-resume) |
| [api-quota](plugins/zcode-quota/) | API 余额与速度状态条 + /quota + 悬浮窗 · by [2877905731](https://github.com/2877905731/zcode-quota) |
| [picturereader](plugins/picturereader-zcode/) | 纯文本模型读图：像素网格分析 + OCR · by [jing-hy](https://github.com/jing-hy/picturereader-zcode) |
| [zcode-session-manager](plugins/zcode-session-manager/) | 会话管理 + 跨端记忆中继 · by [Mia0a-hi](https://github.com/Mia0a-hi/zcode-session-manager) |
| [Context-Budget](plugins/Context-Budget/) | 上下文预算压缩，单回合多动作省 token · by [SoftArax](https://github.com/SoftArax/Context-Budget) |
| [disk-scanner](plugins/disk-scanner/) | Windows 磁盘空间扫描分析 · by [wdfdsyhb](https://github.com/wdfdsyhb) |

**开发 dev-tools**
| 插件 | 说明 |
|---|---|
| [bruce-drawio](plugins/bruce-drawio/) | draw.io 图表生成，CLI 导出 · by [bruc3van](https://github.com/bruc3van/bruce-drawio) |
| [awwwards-mcp](plugins/awwwards-mcp/) | 获奖网站设计灵感 MCP · by [INSANE0777](https://github.com/INSANE0777/Awwwards-mcp) |
| [zcode-fence](plugins/zcode-fence/) | 灾难性命令门禁 + 项目写围栏 · by [Momenttttt](https://github.com/Momenttttt/zcode-fence) |
| [git-worktrees](plugins/zcode-git-worktrees/) | Git worktree 并行工作流 · by [agallardol](https://github.com/agallardol/zcode-git-worktrees) |
| [workspace-guard](plugins/zcode-workspace-guard/) | 工作区沙箱 · by [XieZongChen](https://github.com/XieZongChen/zcode-workspace-guard) |
| [multi-agent-mailbox](plugins/multi-agent-mailbox/) | 多智能体信箱 CLI/MCP · by [WQMYH](https://github.com/WQMYH/multi-agent-mailbox) |
| [OhMyZcode (omz)](plugins/OhMyZcode/) | 多 agent 并行编排 · by [djt889](https://github.com/djt889/OhMyZcode) |
| [pstack](plugins/pstack-zcode/) | skills+playbooks+原则库 · by [Luks3110](https://github.com/Luks3110/pstack-zcode) |
| [tony-agents-pack](plugins/zcode_skills/) | 外贸 AI 员工团 18 岗位 · by [tony-apan](https://github.com/tony-apan/zcode_skills) |
| [testcase](plugins/testcase/) | spec→测试→实现全链路 · by [xtieume](https://github.com/xtieume/testcase) |
| [project-architecture-analyzer](plugins/project-architecture-analyzer/) | Java 架构逆向可视化看板 · by [WhQ-cc](https://github.com/WhQ-cc/project-architecture-analyzer) |
| [harmonyos-dev (arkpilot)](plugins/arkpilot/) | 鸿蒙 ArkTS 开发技能包 · by [taobaoaz](https://github.com/taobaoaz/arkpilot) |
| [vmctl](plugins/vmctl/) | VMware Workstation vmrun 控制 · by [realweng](https://github.com/realweng/vmctl) |
| [repo-cleanup-skill](plugins/repo-cleanup-skill/) | 先报告后删除的仓库清理 · by [peetwan](https://github.com/peetwan/repo-cleanup-skill) |
| [ai-skill-engine](plugins/ai-skill-engine/) | 洋葱模型 skill 中间件 · by [mikasaw](https://github.com/mikasaw/ai-skill-engine) |
| [zcode-handbook-en](plugins/zcode-powerpack/) | ZCode 使用手册合集 · by [imserhatdemir](https://github.com/imserhatdemir/zcode-powerpack) |
| [remotion](plugins/zcode-remotion/) | Remotion 视频可靠性层 · by [AIwork4me](https://github.com/AIwork4me/zcode-remotion) |

**教育 education**
| 插件 | 说明 |
|---|---|
| [innovation-proposal](plugins/innovation-proposal/) | 大创/挑战杯策划书，内置 2026 评审规则 · by [xwu43361-sys](https://github.com/xwu43361-sys/innovation-proposal) |
| [learn](plugins/learn-skill/) | 一个链接→AI 总结/术语/图谱/OCR 入库 · by [gtbwpkwjnb-alt](https://github.com/gtbwpkwjnb-alt/learn-skill) |
| [lessonry](plugins/lessonry/) | 单文件交互式课程生成 · by [zryshuaige](https://github.com/zryshuaige/lessonry) |
| [literature-review](plugins/literature-review-skill/) | 论文转文献综述 · by [openkills](https://github.com/openkills/literature-review-skill) |
| [academic-search](plugins/academic-search/) | 学术文献追踪 + 周报 · by [pisen233](https://github.com/pisen233/academic-search) |
| [theory-refine-loop](plugins/theory-refine-loop-skill/) | 理论证明 review-fix-recheck 循环 · by [openkills](https://github.com/openkills/theory-refine-loop-skill) |

**其他**
| 插件 | 分类 | 说明 |
|---|---|---|
| [security-cn-pack](plugins/security-cn-pack/) | security | 中文安全挖洞四合一 · by [wdfdsyhb](https://github.com/wdfdsyhb) |
| [data-competition-pack](plugins/data-competition-pack/) | data-science | 天池/Kaggle 六阶段方法论 · by [wdfdsyhb](https://github.com/wdfdsyhb) |
| [md-convert](plugins/md-convert-skill/) | docs-writing | Markdown 转 Word/PDF/HTML · by [whlle-yi](https://github.com/whlle-yi/md-convert-skill) |
| [crawl-content](plugins/crawl-content-skill/) | dev-tools | 中文社媒内容爬取(仅限学习研究) · by [JJ188-coder](https://github.com/JJ188-coder/crawl-content-skill) |

> Anthropic 官方技能池(frontend-design、algorithmic-art、canvas-design 等)未随包分发(仓库未开 LICENSE),可直接挂载官方仓库使用:`zcode plugins marketplace add anthropics/skills`。

更多条目见 [marketplace.json](marketplace.json)。收录标准见 [docs/SUBMIT.md](docs/SUBMIT.md)。

## 提交插件 / Submit your plugin

欢迎 PR 或 issue。要求：有 LICENSE、过 gitleaks 扫描、plugin.json 合法、中英双语描述。详见 [docs/SUBMIT.md](docs/SUBMIT.md)。

## 说明

- 本市场为社区项目，与 Z.ai 官方无隶属关系；官方市场见 [zai-org/zcode-plugins](https://github.com/zai-org/zcode-plugins)。
- 收录的第三方插件版权归原作者，均保留原 LICENSE 与署名并链接回原仓库；如你是收录项目的作者且不希望被收录，开一个 issue 即可撤条目，无需理由。
- 收录前已通过基础安全审计（gitleaks + 入口文件检查）；使用产生的风险自担。
- 安全技能内容仅用于授权测试与防御学习场景。
