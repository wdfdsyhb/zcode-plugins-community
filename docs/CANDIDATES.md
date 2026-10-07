# 候选插件清单(2026-10-07 batch4 收录完毕)

自动发现的候选见 GitHub issue 标签 `discovery`(每日扫描)。本表记录最终收录结论。

## 已收录(55 plugins,见 marketplace.json)

第一批(10):security-cn-pack、data-competition-pack、bruce-drawio、awwwards-mcp、zcode-tps-monitor、zcode-auto-resume、api-quota、picturereader、innovation-proposal、md-convert

第二批(24):Context-Budget、OhMyZcode(omz)、academic-search、ai-skill-engine、harmonyos-dev(arkpilot)、crawl-content、disk-scanner、learn、lessonry、literature-review、multi-agent-mailbox、project-architecture-analyzer、pstack、repo-cleanup-skill、testcase、theory-refine-loop、vmctl、zcode-fence、git-worktrees、zcode-handbook-en、remotion、zcode-session-manager、workspace-guard、tony-agents-pack

第四批(21,2026-10-07 消化 issue#1 候选):ai-ui-aesthetics、bufatechno-webgamedev、chuigong、claritykit、dragon-agents、fun-code、garmin-connect(DSH 生态兼容)、Game-Studios(adopt)、multi-model-bridge、senmu-buildos、software-project-governance(已删 1 个假密钥测试 fixture)、taskswarm、zcode-toolkit(zcode-tokenspeed)、zcode-repo-wiki、zcode-websearch(Tavily MCP)、lazyzcode、autoresearch、token-meter、zcode-tokline、session-mailbox、fusion-zcode-plugin
(注:第三批=第二批 24 含在内,第四批编号沿流水线 batch 记法)

## 未收录

### 无 LICENSE(不可再分发,等作者开放)
touchine-ojo/OJO-Design-Sills、JJack27/Forge、GreendaMi/ZcodeTouchBar、Zeppeli777/concept-mastery、yzhai002/dev-flow、warter666/experiment-report、Zeppeli777/feynman-learning、GlotTale/novelist、winterallen/zcode-ext-stats、cv-superding/zcode-gpt-image2
batch4 新增(2026-10-07):**ZepiGit/ZCode-Agent-Kit(80★,license=NOASSERTION 自定义协议,候选池最大鱼,作者开放标准协议即收)**、gothamkismet-cyber/genshin-continue、nimabhk/zcode-nvidia-ratelimit-hook、stack-wuh/shadow-dev-workflow、p4leqwq/zcode-image-gen、sumitake/agent-collab、kingsword09/zcode-plugins

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

### 排除(合规)
shuze7360-afk/xianyu-virtual-materials(灰产边缘)、rockmoons/heygem-avatar(平台合规风险)

### Anthropic 官方池(仓库未开 LICENSE,不打包)
README 已给出挂载指引:`zcode plugins marketplace add anthropics/skills`(frontend-design/algorithmic-art/canvas-design/theme-factory/web-artifacts-builder/mcp-builder 等 19 技能)。
