# 改造样例：丑 → 美（before / after）

> 用一次「登录卡片」改造，演示 AI 如何运用本插件的四支柱逻辑，把单调的界面变得漂亮而高级。
> 选择风格原型：**极简克制风**（references/style-archetypes.md）。

---

## 一、改造前（杂乱 → 单调 + 随手值）

```html
<!-- 问题：所有东西均匀用力，无层级、随手配色、无留白、无质感 -->
<div style="text-align:center">
  <h2 style="color:#666; margin-top:120px">欢迎回来</h2>
  <p style="color:#aaa">请登录你的账户</p>
  <input style="width:300px; height:45px; border:1px solid #ccc; border-radius:8px; padding:0 12px; margin:8px">
  <input style="width:300px; height:45px; border:1px solid #ccc; border-radius:8px; padding:0 12px; margin:8px" type="password">
  <button style="background:#333; color:#fff; border-radius:8px; width:300px; height:45px; margin-top:16px">登录</button>
  <p style="color:#aaa; font-size:12px; margin-top:24px">忘记密码？</p>
</div>
```

**死因诊断**（对照 rules/代码检查清单.md）：
- 无统一 token：`#666` / `#aaa` / `#ccc` / `#333` 随手散落。
- 无层级对比：标题 `#666` 与正文 `#aaa` 都偏灰，弱化焦点。
- 间距随手：`120px`/`8px`/`16px`/`24px` 无尺度系统。
- 无质感：纯平、无阴影、无动效、无过渡。
- 无风格方向：看起来像「默认模板」。

---

## 二、改造后（统一 token + 层级 + 留白 + 适度质感）

```html
<div class="auth-card">
  <div class="auth-head">
    <h1 class="auth-title">欢迎回来</h1>
    <p class="auth-sub">登录以继续你的工作空间</p>
  </div>
  <form class="auth-form">
    <label class="field">
      <span class="field-label">邮箱</span>
      <input class="field-input" type="email" placeholder="you@example.com">
    </label>
    <label class="field">
      <span class="field-label">密码</span>
      <input class="field-input" type="password" placeholder="••••••••">
    </label>
    <button class="btn-primary" type="submit">登录</button>
    <a class="link-secondary" href="#">忘记密码？</a>
  </form>
</div>
```

```css
/* 卡片容器：限宽 + 大留白 + 分层阴影（浮起） */
.auth-card {
  max-width: 400px;
  margin: 120px auto;            /* 4px 尺度：--space-9 级大留白 */
  padding: 40px;                 /* --space-7 */
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);   /* 12px */
  box-shadow: var(--shadow-md);      /* 分层阴影而非纯平 */
}
/* 标题层级：大+粗+深，建立焦点 */
.auth-title { font-size: var(--text-h1); font-weight: 700; letter-spacing: -0.02em; color: var(--color-text); }
.auth-sub   { margin-top: 8px; color: var(--color-text-secondary); font-size: var(--text-body); }

/* 表单：间距来自 4px 尺度，focus 发光 */
.field { display: block; margin-top: 20px; }          /* --space-5 */
.field-label { display: block; margin-bottom: 8px; font-size: 14px; color: var(--color-text-secondary); }
.field-input {
  width: 100%; padding: 12px 14px; border: 1px solid var(--color-border);
  border-radius: var(--radius-md); background: var(--color-bg);
  transition: border-color var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out);
}
.field-input:focus-visible { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-subtle); outline: none; }

/* 主按钮：唯一视觉焦点，悬停按压反馈 */
.btn-primary {
  width: 100%; margin-top: 24px; padding: 13px;          /* --space-6 前距 */
  background: var(--color-primary); color: var(--color-text-on-primary);
  border: none; border-radius: var(--radius-md); font-weight: 600;
  transition: background-color var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--ease-out);
}
.btn-primary:hover { background: var(--color-primary-hover); transform: translateY(-1px); }
.btn-primary:active { transform: translateY(1px); }

/* 次级链接：弱于主按钮，形成对比 → 不单调 */
.link-secondary { display: block; margin-top: 16px; text-align: center; color: var(--color-text-secondary); font-size: 14px; text-decoration: underline; }
```

---

## 三、改造对照（哪些原则被修复）

| 维度 | 改造前 | 改造后 | 依据 |
| --- | --- | --- | --- |
| 风格方向 | 默认模板 | 极简克制风 | references/style-archetypes.md |
| 颜色 | `#666/#aaa/#ccc/#333` 随手 | 引用 `--color-*` token | tokens/design-tokens.md |
| 层级 | 标题正文都灰，无焦点 | 标题黑+大+粗，正文次级 | knowledge/排版.md |
| 间距 | 随意 1px 值 | 4px 尺度（8/20/24/40/120） | knowledge/布局留白.md |
| 质感 | 纯平 | 分层阴影 + focus 发光 + 悬停反馈 | rules/质感与动效.md + patterns/easing-swatches.md |
| 焦点 | 无（一片平均） | 一个主按钮 + 一个主焦点 | knowledge/设计原则.md（统一里做对比） |

> 这种「选风格 → 定主色层级 → 用 token → 加一点质感」的流程，就是插件四步工作流的实例化（见 SKILL.md）。
