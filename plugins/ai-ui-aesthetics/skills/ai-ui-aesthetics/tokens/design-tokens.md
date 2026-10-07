# 设计 Token 规范（design-tokens）

> 目的：给 AI 一套**可直接落地、保持一致**的设计令牌。颜色/圆角/阴影/间距/字体/缓动全在这里，**禁止在组件里随手写新值**。
> 搭配：同目录 `design-tokens.css`（CSS 变量版，可自托管引用）；也可作为概念映射到任意框架/设计系统。

## 设计原则（此文件对应）
统一性（设计原则.md）、色彩克制（色彩.md）、4px 间距尺度（布局留白.md）、层级（排版.md）、质感（质感与动效.md）。

## 颜色 Color
> 采用「主色 + 强调色 + 中性灰阶（带轻微色相）+ 语义色」。色阶为明度阶梯，保证对比。默认给一套「蓝」示例，可替换主色相。

| Token | 值(示例) | 用途 |
| --- | --- | --- |
| `--color-primary` | `#2563eb` | 主操作按钮、激活、链接、重点 |
| `--color-primary-hover` | `#1d4ed8` | 主色悬停 |
| `--color-primary-subtle` | `#eff6ff` | 主色浅底/选中背景 |
| `--color-accent` | `#f59e0b` | 强调/焦点点缀（小面积） |
| `--color-bg` | `#ffffff` | 页面背景 |
| `--color-bg-subtle` | `#f5f6f7` | 次级背景/分区 |
| `--color-surface` | `#ffffff` | 卡片/面板表面 |
| `--color-border` | `#e5e7eb` | 通用边框/分隔线 |
| `--color-text` | `#1f2937` | 正文（最深） |
| `--color-text-secondary` | `#6b7280` | 次级文本 |
| `--color-text-muted` | `#9ca3af` | 弱化/禁用文本 |
| `--color-text-on-primary` | `#ffffff` | 主色上的文字 |
| `--color-success` | `#16a34a` | 成功状态 |
| `--color-warning` | `#d97706` | 警告状态 |
| `--color-error` | `#dc2626` | 错误状态 |
| `--color-info` | `#0ea5e9` | 信息状态 |

> 对比度自检：正文 `--color-text` 对 `--color-bg`、`--color-bg-subtle` 均 ≥ 4.5:1。

## 字体 Font
| Token | 值 | 用途 |
| --- | --- | --- |
| `--font-sans` | `Inter, -apple-system, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif` | 无衬线/正文 |
| `--font-serif` | `Georgia, "Songti SC", "SimSun", serif` | 衬线/编辑风标题 |
| `--font-mono` | `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` | 数据/代码/数字 |

## 字号与行高 Type scale
| Token | 字号 | 行高 | 用途 |
| --- | --- | --- | --- |
| `--text-display` | 48px | 1.1 | 大标题/Hero |
| `--text-h1` | 32px | 1.2 | H1 |
| `--text-h2` | 24px | 1.3 | H2 |
| `--text-h3` | 18px | 1.4 | H3/副标题 |
| `--text-body` | 16px | 1.6 | 正文 |
| `--text-caption` | 13px | 1.5 | 标注/说明 |

## 间距 Spacing（4px 尺度）
| Token | 值 | 用途 |
| --- | --- | --- |
| `--space-1` | 4px | 组件内最细 |
| `--space-2` | 8px | 内边距 |
| `--space-3` | 12px | 紧密分组 |
| `--space-4` | 16px | 常规内边距/组件距 |
| `--space-5` | 24px | 区块分隔 |
| `--space-6` | 32px | 区块间距 |
| `--space-7` | 48px | 大区块 |
| `--space-8` | 64px | 页面级区块 |
| `--space-9` | 96px | 页面级/Hero 留白 |

## 圆角 Radius
| Token | 值 | 用途 |
| --- | --- | --- |
| `--radius-sm` | 6px | 标签/小元素 |
| `--radius-md` | 8px | 输入框/按钮 |
| `--radius-lg` | 12px | 卡片/面板 |
| `--radius-full` | 9999px | 圆形/药丸 |

## 阴影 Elevation（分层，抗青平）
| Token | 值 | 用途 |
| --- | --- | --- |
| `--shadow-xs` | `0 1px 2px rgba(0,0,0,.05)` | 最浅/悬浮的提示 |
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.04)` | 常规卡片 |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,.07), 0 2px 4px rgba(0,0,0,.05)` | 浮起面板 |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,.08), 0 4px 6px rgba(0,0,0,.06)` | 弹窗/下拉 |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,.1), 0 10px 10px rgba(0,0,0,.05)` | 模态/浮层 |

> 阴影分层 = 用不同高度/强度表达「浮起程度」，避免所有元素同一块阴影的平淡。

## 缓动 Easing 与时长 Motion
> **拒绝默认 linear 与等时速**。丝滑靠曲线 + 合理时长。更多见 patterns/easing-swatches.md。
| Token | 值 | 用途 |
| --- | --- | --- |
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | 离场/进入（最常用，多变快收） |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | 对称过渡/展开 |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | 弹性/活泼 |
| `--duration-fast` | 150ms | 悬停/按下微反馈 |
| `--duration-base` | 250ms | 常规过渡 |
| `--duration-slow` | 400ms | 开合/页面过渡 |

---

## 使用规则（强制）
1. 组件样式**全部引用以上 token**，不出现裸值（#fff、16px、2px 随手写）。
2. 需要更浅/更深的同色，优先本文档的色阶或 opacity 于 token 上，不另造色相。
3. 所有间距属于 `--space-*` 集合（4 的倍数），禁止 13/19/7 等散值。
4. 圆角只从 `--radius-*` 选；阴影只从 `--shadow-*` 选。
5. 动效时长/缓动从上表取，禁止 `transition: all 1s linear` 这种随手写。

> 若用户已有品牌/设计系统，**优先使用用户的 token**，本文档仅作通用兜底与规范示范。
