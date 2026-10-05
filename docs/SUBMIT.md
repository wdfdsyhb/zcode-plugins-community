# 收录指南 / Submission Guide

## 收录标准（5 项，全部满足才收）

1. **插件结构**：仓库根有 `plugin.json`（或可代打包：`skills/` 目录、单个 SKILL.md、MCP server、hooks 脚本均可，我们帮你包一层）
2. **LICENSE**：MIT / Apache-2.0 / BSD 优先；无 LICENSE 只挂外链条目不复制代码
3. **安全审计**：`gitleaks detect` 零命中；无硬编码密钥/内网地址/账号
4. **元数据**：提供中英双语 description（缺英文我们代译）；注明原仓库
5. **合法性**：内容不违反平台规则与法律（安全类内容仅限授权测试与防御学习场景）

## 流程

1. 开 issue，标题 `Submit: <插件名>`，附仓库链接和一句话介绍
2. 维护者 clone 后跑 `python scripts/audit.py <仓库路径>`，5 项全过
3. 代打包的：维护者建 `plugins/<name>/`，`.zcode-plugin/plugin.json` + `.claude-plugin/plugin.json`，author 字段保留原作者
4. 更新 `marketplace.json` 条目，PR 合入
5. 第三方插件收录后会开 issue 通知原作者，不同意即撤条目

## 本地测试你的插件

```bash
zcode plugins marketplace add <本仓库路径> --scope user
# 桌面端商店页 → 个人分段 → 安装 → 新会话验证技能触发
```

## 分类体系（category 自定值）

`security` / `data-science` / `docs-writing` / `dev-tools` / `productivity` / `osint` / `fun`
