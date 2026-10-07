# 缓动与动效预设（Easing Swatches）

> 质感与动效的可落地参考。对应 tokens 的 `--ease-*` / `--duration-*`。
> 目的：让 AI 不再写 `transition: all .3s ease`，而是用「端正缓动 + 合理时长 + 分层阴影」做出丝滑感。

## 1. 缓动曲线速查（cubic-bezier）

| 名称 | 曲线 | 何时用 |
| --- | --- | --- |
| `--ease-out`（多变快收） | `cubic-bezier(0.22, 1, 0.36, 1)` | 最常用：进入、浮起、弹窗、按钮——快启动、优雅收尾 |
| `--ease-in-out`（对称） | `cubic-bezier(0.65, 0, 0.35, 1)` | 展开/收起、宽度/高度变化 |
| `--ease-spring`（弹性） | `cubic-bezier(0.34, 1.56, 0.64, 1)` | 活泼品牌动效（值 >1 会轻微回弹），功能性控件慎用 |

### 原理一句话
「快速开始、缓慢结束」比「匀速」或「缓慢开始、快速结束」**感知上更丝滑、更自然**。
斯威夫特的 ease-out 曲线是「高级质感」的通用秘诀——元素像被轻轻弹出并柔柔停住。

## 2. 时长速查
| Token | 值 | 场景 |
| --- | --- | --- |
| `--duration-fast` | 150ms | 悬停/按下的微反馈 |
| `--duration-base` | 250ms | 常规过渡 |
| `--duration-slow` | 400ms | 开合/页面级大动作 |

- < 100ms：几乎不可感知；> 600ms：拖沓、显慢。
- 微交互用 fast；功能性大动作用 base；装饰/页面级用 slow。

## 3. 常用动效配方（可直接套用）

### 3.1 按钮按压
```css
.btn {
  transition: transform var(--duration-fast) var(--ease-out),
              background-color var(--duration-fast) var(--ease-out),
              box-shadow var(--duration-fast) var(--ease-out);
}
.btn:hover { transform: translateY(-1px); }
.btn:active { transform: translateY(1px); }
```

### 3.2 卡片悬停抬升（阴影分层 + 上移）
```css
.card {
  transition: transform var(--duration-fast) var(--ease-out),
              box-shadow var(--duration-fast) var(--ease-out);
}
.card:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); }
```

### 3.3 弹窗入场（缩放 + 淡入）
```css
.modal {
  opacity: 0;
  transform: scale(.97) translateY(8px);
  transition: opacity var(--duration-base) var(--ease-out),
              transform var(--duration-base) var(--ease-out);
}
.modal.is-open { opacity: 1; transform: none; }
```

### 3.4 内容入场（淡入 + 上移，少量错开）
```css
.reveal { opacity: 0; transform: translateY(16px); transition: opacity .5s var(--ease-out), transform .5s var(--ease-out); }
.reveal.visible { opacity: 1; transform: none; }
/* 错开：第二项 delay .08s，第三项 .16s，最多递进 3–4 项 */
.reveal:nth-child(2) { transition-delay: .08s; }
.reveal:nth-child(3) { transition-delay: .16s; }
```

### 3.5 聚焦发光（表单焦点环）
```css
.input:focus-visible {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-subtle);
  transition: box-shadow var(--duration-fast) var(--ease-out);
}
```

### 3.6 骨架屏 shimmer
```css
.skeleton {
  background: linear-gradient(90deg, var(--color-bg-subtle) 25%, #ececec 37%, var(--color-bg-subtle) 63%);
  background-size: 400% 100%;
  animation: shimmer 1.4s var(--ease-in-out) infinite;
}
@keyframes shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }
```

## 4. 禁用/降级原则
- **永远**加 `prefers-reduced-motion` 兜底（见 rules/响应式.md），或至少保证动效不阻碍内容可读。
- 动效只用于「状态变化」「焦点引导」，不作为永久背景刷屏（不真正的广告式闪烁）。
- 同一时刻动画数量克制，避免「所有东西一起动」的混乱。

## 5. 速记口诀
> **快开始、慢结束；微反馈 150、常规 250、大动作 400；悬停三件套（色变+位移+阴影）。** 有了这套，丝滑是默认，不是运气。
