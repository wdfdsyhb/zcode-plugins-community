# Remotion for ZCode

[![CI](https://github.com/AIwork4me/zcode-remotion/actions/workflows/ci.yml/badge.svg)](https://github.com/AIwork4me/zcode-remotion/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.2.5-8b5cf6.svg)](CHANGELOG.md)
[![ZCode Plugin](https://img.shields.io/badge/ZCode-Plugin-22d3ee.svg)](https://zcode.z.ai/cn/docs/plugin)

**一句话，从想法到 MP4。**
**ZCode 上的 Remotion 可靠性层。**

一句提示 → 官方 Remotion 技能 → 环境预检 → 视觉门禁 → 校验过的 MP4。

[ZCode](https://zcode.z.ai) 是 AI 编程智能体；[Remotion](https://www.remotion.dev) 用 React 写视频。
Remotion 自带的官方 Agent Skills 非常优秀——本插件**不替代**它们，而是在 ZCode 内**可靠地编排**它们：
自动引导安装官方技能、环境预检、每次渲染先过静帧门禁、校验产物，并持续监控上游兼容性，
让这套工作流随 Remotion 演进始终保持可用。

[English](README.md) · **简体中文**

![Demo 预览 —— 代码即画面，一句话，一部片](docs/assets/preview.gif)

完整 23 秒 demo：[docs/assets/demo.mp4](docs/assets/demo.mp4) · 工程源码：[demo/](demo/)

> **没错——这条 demo 就是插件自己做的。** 一句提示词，零手工修改。
> 视频讲述它自己的诞生：一条提示词穿过 代码 → 时间线 → 渲染 → 成片。

## 看它发生

```text
你：    帮我做一个10秒的产品宣传视频，主题是 ZCode Remotion Plugin
智能体：✅ 加载 remotion skill → 引导安装 Remotion 官方技能
        ✅ 脚手架建项目（自动识别包管理器）
        ✅ 写分镜场景 → 渲染代表性静帧并自主视觉检查
        ✅ 有问题先修复 → 全量渲染 → 校验产物
你：    （23 分钟后，全程零干预）🎉
```

## 为什么选 zcode-remotion？

一个显然的问题：*为什么不直接安装 Remotion 官方技能？*
可以——但安装引导、环境检查、渲染门禁、版本漂移这些"胶水"就得你自己负责。
这些胶水就是本插件。**我们不替代 Remotion 官方技能，我们让它们在 ZCode 里变得可靠。**

| 能力 | Remotion 官方技能 | zcode-remotion |
|---|---|---|
| Remotion 领域知识 | 有 | 直接使用官方技能 |
| 官方技能引导安装 | 手动（官方 CLI） | ZCode 工作流内自动完成 |
| ZCode 自然语言触发 | — | 有 |
| 中文 + 英文路由验证 | — | 已测试 |
| 环境预检 | — | 有 |
| 包管理器识别 | — | 有 |
| 静帧视觉门禁 | — | 有 |
| 渲染产物校验 | — | 有 |
| `/remotion-doctor` | — | 有 |
| 上游兼容性监控 | — | 有（每日，含已验证的自动 PR） |
| ZCode 真机端到端证据 | — | 当前版本稳态真机 E2E + 干净状态 CI 兼容性证据（[报告](docs/verification-report.md)） |

## 安装

1. 在 ZCode 中打开 **设置 → 插件**（需先打开工作区），点击右上角 **创建 → 添加插件市场**，
   粘贴本仓库地址：`https://github.com/AIwork4me/zcode-remotion`
2. 安装并启用 **remotion** 插件。
3. 直接开口——`帮我做一个 10 秒的产品宣传视频`，或先跑 `/remotion-setup`。

需要 Node ≥ 18（[点此安装](https://nodejs.org)），支持 Windows / macOS / Linux。

插件自带组件（remotion 技能与 `/remotion-*` 命令）在安装时自动注册。官方 Remotion
技能属于外部安装：按 ZCode 当前文档，打开 **设置 → 技能**，点击 **刷新**，确认技能
已列出并保持开启。若仍未显示，新开一个会话即可。

## 你会得到什么

| 组成 | 作用 |
|---|---|
| `remotion` 技能 | 视频请求自动触发（中英文皆可）；引导安装官方技能、环境预检、路由到正确的官方技能 |
| `/remotion-setup` | 用官方安装器安装 Remotion 官方技能（默认用户级；`--project` 可固定到单个仓库）+ 磁盘验证发现 |
| `/remotion-doctor` | 环境体检：Node、包管理器、技能、已装版本对比最新版、一致性、Chrome Headless Shell——以 X/8 通过数 + 一条修复命令收尾 |
| `/remotion-update` | 走官方升级路径（`npx remotion upgrade`，或官方手动回退方案）+ 刷新官方技能 + 校验一致性 |

## 工作原理

```text
 你要一条视频 ──▶ remotion 技能（本插件的可靠性层）
                    │  1. 引导门槛 ──▶ 官方技能安装器
                    │  2. 环境预检（node / 包管理器 / 平台）
                    │  3. 路由到正确的官方技能 ──┐
                    ▼                          ▼
          静帧门禁（智能体视觉 QA）   Remotion 官方技能
                    │                 create · markup · studio · render
                    ▼                          │
          全量渲染 ──▶ 产物校验 ────────────────┘
```

插件**从不内置 Remotion 的内容**——官方技能由你的机器通过 Remotion 官方安装器获取，
永远最新，许可关系保留在你与 Remotion 之间（个人及 ≤3 人公司免费，
详见 [NOTICE.md](NOTICE.md)）。

## 作品墙

用 zcode-remotion 做了视频？
欢迎到 [GitHub Discussions → Show and tell](https://github.com/AIwork4me/zcode-remotion/discussions) 分享。

## 故障排查

| 症状 | 解法 |
|---|---|
| `npx skills add` 失败 | `node -v` ≥ 18、检查网络，重试；网络/缓存恢复阶梯见 remotion 技能内说明 |
| Chrome/Chromium 下载失败 | 网络或代理拦截——见 [chrome-headless-shell 文档](https://www.remotion.dev/docs/chrome-headless-shell) |
| `Could not find composition with ID …` | `<Composition id>` 必须与命令行参数一致 |
| `delayRender() … timed out` | 每个 `delayRender` 都要有 `continueRender` |
| `Module not found` | 用对应包管理器装依赖；检查锁文件 |
| 其他 | `/remotion-doctor`，再问官方 `remotion-docs` 技能 |

## 许可

- 插件代码/内容：[MIT](LICENSE)
- Remotion 官方技能：Copyright Remotion，Remotion License——个人及 ≤3 人公司免费；
  更大规模公司需购买许可（[remotion.pro](https://www.remotion.pro)）

测试基线：Remotion `4.0.520` · 官方技能 `4.0.520` —— 基线记录于
[compatibility/remotion.json](compatibility/remotion.json)，核验证据见
[docs/verification-report.md](docs/verification-report.md)。

## 参与贡献

欢迎 PR——见 [CONTRIBUTING.md](CONTRIBUTING.md)。门禁两条命令：
`node --test scripts/verify-plugin.test.mjs && node scripts/verify-plugin.mjs --offline`。

如果这个插件帮你省下一下午的剪片时间，一颗 ⭐ 能让更多人看到它。
