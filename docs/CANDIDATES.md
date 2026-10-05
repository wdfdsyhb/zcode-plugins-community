# 候选插件清单(全方向摸底,2026-10-05)

数据源:`topic:zcode-plugin` 47 个、`topic:zcode-skill` 19 个、gh 关键词搜索、Claude 官方技能池。逐条收录前仍需过 audit.py + 联系作者。

## 优先级说明
- **P1 下轮即收**:结构清晰、方向通用、LICENSE 或联系成本低
- **P2 待验**:有价值但需确认结构/形态
- **P3 观望**:小众、维护弱或与已有条目重叠
- **排除**:合规风险

## A. ZCode 原生工具插件(topic:zcode-plugin)

| 仓库 | star | 方向 | 优先级 | 备注 |
|---|---|---|---|---|
| ZepiGit/ZCode-Agent-Kit | 80 | 工具 | P2 | token 多 harness 复用,形态待查(是否插件) |
| shy3130/zcode-tps-monitor | 19 | 效率 | P1 | tok/s 监控+大屏+MCP |
| c80361619/zcode-toolkit | 5 | 效率 | P1 | 桌面增强:思考档位/用量图表/状态栏 |
| 2877905731/zcode-quota | 3 | 效率 | P1 | 余额+速度状态条 |
| cv-superding/zcode-auto-resume | 4 | 效率 | P1 | 系统繁忙自动续跑(痛点向) |
| jing-hy/picturereader-zcode | 2 | 效率 | P1 | 图片转文字,纯文本模型福音 |
| agallardol/zcode-git-worktrees | 4 | 开发 | P2 | 并行 worktree 管理 |
| Mia0a-hi/zcode-session-manager | 5 | 效率 | P2 | 会话管理+跨端记忆中继 |
| XieZongChen/zcode-workspace-guard | 2 | 安全 | P2 | 工作区沙箱(与 mimosa 互补) |
| Momenttttt/zcode-fence | 1 | 安全 | P2 | 危险命令门禁,Windows-first |
| cv-superding/zcode-gpt-image2 | 2 | 创意 | P2 | 图标/banner/README 插图生成 |
| djt889/OhMyZcode | 3 | 编排 | P2 | 多 agent 编排(OMZ 移植) |
| WQMYH/multi-agent-mailbox | 2 | 编排 | P2 | 多智能体信箱 CLI/MCP |
| GlotTale/novelist | 1 | 写作 | P2 | 网文写作基础设施,8 hooks |
| taobaoaz/arkpilot | 1 | 开发 | P3 | 鸿蒙 ArkTS 开发 30 MCP 工具 |
| AIwork4me/zcode-remotion | 1 | 创意 | P3 | Remotion 视频可靠性层 |
| winterallen/zcode-ext-stats | 1 | 效率 | P3 | 会话统计扩展 |
| Jovan1666/zcode-command-code-usage | 1 | 效率 | P3 | 订阅用量窗口显示 |
| notmike101/zcode-extensions | 3 | 工具 | P3 | 抗更新扩展宿主(改宿主,谨慎) |
| imserhatdemir/zcode-powerpack | 3 | 合集 | P3 | 待看内容 |

## B. ZCode 专属技能(topic:zcode-skill / 关键词)

| 仓库 | star | 方向 | 优先级 | 备注 |
|---|---|---|---|---|
| Luks3110/pstack-zcode | 6 | 开发 | P2 | Cursor 插件移植:skills+playbooks |
| shuze7360-afk/xianyu-virtual-materials | 8 | — | **排除** | 闲鱼虚拟资料发货 SOP,灰产边缘 |
| tony-apan/zcode_skills | 4 | 外贸 | P2 | 外贸 AI 员工团 18 岗位,内容多需抽查 |
| SoftArax/Context-Budget | 3 | 效率 | P1 | 压 token 成本,单回合多动作 |
| xwu43361-sys/innovation-proposal | 3 | 教育 | P1 | 创新创业大赛策划书(挑战杯/三创赛),学生刚需 |
| JJ188-coder/crawl-content-skill | 2 | 数据 | P2 | 中文社媒内容爬取(MediaCrawler),合规提示要做 |
| JJack27/Forge | 2 | 学习 | P1 | 个性化多文件 HTML 学习书 |
| openkills/literature-review-skill | 1 | 学术 | P2 | DOI→文献综述 |
| pisen233/academic-search | 1 | 学术 | P2 | 学术追踪周报 |
| whlle-yi/md-convert-skill | 0 | 文档 | P1 | MD 转 Word/PDF/HTML |
| warter666/experiment-report | 2 | 教育 | P2 | 实验报告截图批处理 |
| WhQ-cc/project-architecture-analyzer | 0 | 开发 | P2 | Java 架构逆向看板 |
| realweng/vmctl | 1 | 运维 | P1 | VMware vmrun 控制技能 |
| Zeppeli777/feynman-learning | 0 | 学习 | P2 | 费曼学习法教练 |
| Zeppeli777/concept-mastery | 0 | 学习 | P3 | 概念精讲 |
| zryshuaige/lessonry | 0 | 教育 | P3 | 单文件交互课程生成 |
| rockmoons/heygem-avatar | 4 | — | **排除** | 抖音数据爬取+数字人,平台合规风险 |
| Thanhtran-165/equity-research-vn | 1 | 金融 | P3 | 越南股研(小众) |
| jack021124/rathena-scripting | 0 | 游戏 | P3 | rAthena NPC 脚本(小众) |
| gtbwpkwjnb-alt 系列(learn/summarize/audit) | 1 | 学习 | P3 | 三件套,需验质量 |
| openkills/theory-refine-loop-skill | 0 | 学术 | P3 | 理论证明循环 |
| mikasaw/ai-skill-engine | 0 | 编排 | P3 | 洋葱模型 skill 中间件(早期) |
| GreendaMi/ZcodeTouchBar | 0 | 效率 | P3 | MacBook TouchBar(macOS only) |
| yzhai002/dev-flow | 1 | 开发 | P3 | 任务按规模路由 |
| xtieume/testcase | 4 | 开发 | P2 | spec→测试→实现 |
| peetwan/repo-cleanup-skill | 1 | 运维 | P3 | 仓库清理报告 |

## C. Claude 官方技能池(anthropics/skills,179k★,ZCode 兼容其格式)

ZCode 官方市场已有 docx/pdf/pptx/xlsx(spreadsheets)等,只收官方市场**没有**的:

| 技能 | 方向 | 优先级 |
|---|---|---|
| skills/algorithmic-art | 创意/生成艺术 | P2 |
| skills/canvas-design | 设计 | P2 |
| skills/frontend-design | 前端 | P1(通用刚需) |
| skills/theme-factory | 主题 | P2 |
| skills/web-artifacts-builder | 前端 | P2 |
| skills/mcp-builder | 开发 | P2(与用户技能库同名上游,收官方版) |
| skills/claude-api | 开发 | P3(GLM 用户用途有限) |
| skills/brand-guidelines、internal-comms、slack-gif-creator 等 | 企业 | P3(偏海外职场) |

长期选品池:awesome-claude-skills(15.3k★)、awesome-claude-code(55k★)——每周扫增量。

## D. 自制增量(无上游争议)

| 内容 | 方向 | 优先级 |
|---|---|---|
| disk-scanner(单技能版) | Windows 运维 | P1(之前 windows-lab-pack 砍掉的干净部分) |
| 数据竞赛/安全包的后续增强 | — | 随版本迭代 |

## 收录节奏建议

每批 4-6 个,主题成组:下一批建议 = **效率主题**(tps-monitor + auto-resume + quota + picturereader)+ **学习主题**(Forge + innovation-proposal + md-convert)。全部需:clone → audit.py → 打包 → issue 通知作者 → 入列。
