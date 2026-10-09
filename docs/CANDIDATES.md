# 候选插件清单(2026-10-07 batch5 收录完毕)

自动发现的候选见 GitHub issue 标签 `discovery`(每日扫描)。本表记录最终收录结论。

## 已收录(58 plugins,见 marketplace.json)

第一批(10):security-cn-pack、data-competition-pack、bruce-drawio、awwwards-mcp、zcode-tps-monitor、zcode-auto-resume、api-quota、picturereader、innovation-proposal、md-convert

第二批(24):Context-Budget、OhMyZcode(omz)、academic-search、ai-skill-engine、harmonyos-dev(arkpilot)、crawl-content、disk-scanner、learn、lessonry、literature-review、multi-agent-mailbox、project-architecture-analyzer、pstack、repo-cleanup-skill、testcase、theory-refine-loop、vmctl、zcode-fence、git-worktrees、zcode-handbook-en、remotion、zcode-session-manager、workspace-guard、tony-agents-pack

第四批(21,2026-10-07 消化 issue#1 候选):ai-ui-aesthetics、bufatechno-webgamedev、chuigong、claritykit、dragon-agents、fun-code、garmin-connect(DSH 生态兼容)、Game-Studios(adopt)、multi-model-bridge、senmu-buildos、software-project-governance(已删 1 个假密钥测试 fixture)、taskswarm、zcode-toolkit(zcode-tokenspeed)、zcode-repo-wiki、zcode-websearch(Tavily MCP)、lazyzcode、autoresearch、token-meter、zcode-tokline、session-mailbox、fusion-zcode-plugin
(注:第三批=第二批 24 含在内,第四批编号沿流水线 batch 记法)

第五批(3,2026-10-07 当日第二轮扫描):zcode-fox-widget(20★,DeepSeek 峰谷计价余额挂件)、blender-design(Blender 场景设计/评审/导出)、dreamina-design(即梦图片视频创作)

### 第五批撤下(full-aigc-plugins 系列,收录后复核不合格)
artcraft / filmcraft / photocraft:Apache-2.0 合规,但均为 dev 版(自述 host acceptance pending)、单插件体积 64-95M(三件共 243M,占市场总体积 70%)、skills 下每个子技能重复 7.7M 快照、含 104M 开发验收 evidence 目录。gitleaks 922 处命中经查全为 sha256 分发锁误报(字段名含 token),非密钥。待其发布正式版且瘦身后再收。

## 未收录

### 无 LICENSE(不可再分发,等作者开放)
touchine-ojo/OJO-Design-Sills、JJack27/Forge、GreendaMi/ZcodeTouchBar、Zeppeli777/concept-mastery、yzhai002/dev-flow、warter666/experiment-report、Zeppeli777/feynman-learning、GlotTale/novelist、winterallen/zcode-ext-stats、cv-superding/zcode-gpt-image2
batch4 新增(2026-10-07):gothamkismet-cyber/genshin-continue、nimabhk/zcode-nvidia-ratelimit-hook、stack-wuh/shadow-dev-workflow、p4leqwq/zcode-image-gen、sumitake/agent-collab、kingsword09/zcode-plugins
batch5 新增(2026-10-07):iBobbyTS/dsh-zcode-bridge(DSH↔ZCode 桥,无 LICENSE)

### 形态不适配插件(维持观察)
| 仓库 | 原因 |
|---|---|
| wasintoh/toh-framework | npm 安装器形态 |
| ZekerTop/ai-cli-complete-notify | 独立工具(脚本+Tauri) |
| emo-xiaoyu/harness-mix | 桌面 App |
| notmike101/zcode-extensions | SDK/扩展宿主,改官方 Electron,风险高 |
| Jovan1666/zcode-command-code-usage | 仓库仅 README,代码在 release |
| jack021124/rathena-scripting | 代码在 zip 包里未解包 |
| Thanhtran-165/equity-research-vn | tarball 下载失败(小众,低优) |
| notmike101/zcode-scheduler | Desktop Extensions SDK 系(同 zcode-extensions) |
| Masterchiefm/zcode-speed-panel | Tauri 独立桌面仪表盘(同 ai-cli-notify 形态) |
| **ZepiGit/ZCode-Agent-Kit(79★)** | **LICENSE 实为标准 MIT(GitHub 误判 NOASSERTION,已人工核对全文)**,但形态为独立 CLI(npm 包 zcode-agent-kit + install.sh/ps1)+ 需整仓 clone 的本地 MCP server(mcp/zcode-harness-mcp,node dist/index.js),非插件格式。README 给挂载指引,作者若补 plugin.json 即收 |

### 排除(合规)
shuze7360-afk/xianyu-virtual-materials(灰产边缘)、rockmoons/heygem-avatar(平台合规风险)

### Anthropic 官方池(仓库未开 LICENSE,不打包)
README 已给出挂载指引:`zcode plugins marketplace add anthropics/skills`(frontend-design/algorithmic-art/canvas-design/theme-factory/web-artifacts-builder/mcp-builder 等 19 技能)。
