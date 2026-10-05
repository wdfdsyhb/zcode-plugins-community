# engine-guide.md — 引擎 API 参考

> 模板 `assets/template.html` 内置全部引擎代码（标了"勿改"的部分照抄即可）。
> 本文件解释每个 API 的行为与注意点。示例章节见模板 sec1（烧水演示）。
> 目录：[1. 播放器 initSection] [2. SVG 原语] [3. 动画原语] [4. 测验 initQuiz] [5. 全局机制]

## 1. 播放器 initSection

```js
initSection(N, sec => {          // N = 章号；HTML 里需有 playN/stepN/resetN/capN/svgN
  const svg = sec.svg; svg.innerHTML = '';   // 每次重置先清空重建
  defArrow(svg, 'ahN', '#9a9a9a');           // 箭头 marker，id 每章唯一

  // ……创建静态/动态元素，动态元素 .style.opacity = 0 ……

  sec.steps = [
    {label:'本步字幕，支持 <b>加粗</b> 与 <kbd>键</kbd>', go: async () => { /* 动画 */ }},
    // …
  ];
});
```

- **生命周期**：`reset()` 会 `gen++` 并重新执行 `buildFn`（所以 SVG 里一切都要在 buildFn 里创建）。
- **并发保护**：gen/gate 机制保证播放中点单步/重置不串帧——`go` 里不需要自己防护，但
  长动画中若 `return` 提前退出需检查 `g !== sec.gen`（一般用不到）。
- **caption**：由引擎自动写 `<span class="n">n/N</span>label`；结束后显示"演示结束"。
- **要点**：`sec.steps` 必须在 buildFn 里赋值；`label` 支持 HTML；`go` 是 async。
- ⚠ **HTML 与 JS 必须成对**：每章 = HTML 五件套（playN/stepN/resetN/capN/svgN/quizN）+ JS 注册。
  只在 JS 里 initSection(N) 而忘了写 HTML，`$('playN')` 取到 null，**整页脚本从这一行断掉，
  其后所有章节与 quiz 全部失效**——且 V1 语法检查发现不了。用 V2 探针核对 `Object.keys(SECTIONS)`
  的章数即可立刻暴露。

## 2. SVG 原语

| 函数 | 签名 | 用途/注意 |
|---|---|---|
| `el(name, attrs, parent)` | attrs 里 `text` 键 = textContent | 万能 SVG 元素创建 |
| `txt(p,x,y,s,{fs,fill,anchor,w,mono})` | anchor 'start'\|'middle'\|'end' | SVG 文本**不自动换行**：长文案拆多行 txt 或放 HTML note |
| `chip(p,x,y,w,h,label,fill,{fs,tc,rx})` | label 支持 `\n` 多行自动居中 | 圆角卡片节点（返回 `<g>`，整体设 opacity） |
| `boxRect(p,x,y,w,h,fill,{rx,stroke,sw,dash})` | | 区域底板/分组框 |
| `defArrow(svg,id,color)` | id 每章唯一 | 箭头 marker，配 `marker-end:'url(#id)'` |
| `curve(x1,y1,x2,y2,bend)` | bend 默认 0.35 | 二次贝塞尔连线（正 bend 向一侧弯，负值反向） |

## 3. 动画原语（全部返回 Promise，可 await 串成时间线）

| 原语 | 行为 | 典型用法 |
|---|---|---|
| `sleep(ms)` | 受 SPEED 与 reduced-motion 影响 | 步骤内节拍 |
| `css(node,{opacity:1,width:W},ms)` | CSS transition 过渡任意样式 | 淡入、条形变宽。⚠ 元素初始 opacity:0 时，记得在某个步骤把它 css 到 1，否则永远隐形 |
| `draw(path,ms)` | 描线动画（stroke-dashoffset） | 画连线/箭头/轨迹 |
| `packet(path,color,r,dur)` | 一个圆点沿 path 匀速运动（rAF 驱动；`document.hidden` 或 reduced-motion 时瞬时完成，保证后台标签页/自动化探针不挂起） | 数据包/水滴/信号沿管线流动 |
| `pulse(node,ms)` | 闪烁一下（opacity .3→1） | 强调某元素"现在看它" |

组合范式：`go: async () => { a.style.opacity = 1; await pulse(a, 350); await draw(pipe, 600); await packet(pipe, C.c5, 6, 800); }`

## 4. 测验 initQuiz

```js
initQuiz('quizN', [
  {q:'题干', opts:['A','B','C','D'], a:1, exp:'解析（要给完整推导，让答错的人看懂）'},
]);
```
- `a` 是正确项**下标**（0 起）。每题 4 个选项、唯一正确。
- 解析 exp 里给推导过程；数字题在解析里重算一遍。
- 综合测验一章可放 5 题。

## 5. 全局机制

- **调色板**：CSS `:root` 变量与 JS `const C = {...}` **两处保持一致**；引用不存在的键
  （`C.grad` 没定义）会静默画不出颜色——新主题只改这两处。
- **键盘**：`空格`=播放/暂停（焦点所在的章），`→`=单步，`R`=重置。点击按钮/SVG 自动设 ACTIVE。
- **速度选择**：导航栏 select（0.5×/1×/2×/4×），`SPEED` 全局倍速。
- **`#autoplay`**：URL 加 `#autoplay` 时 SPEED=8、每个播放器步进到最后一帧——
  供无头截图与快速预览。动画在 `prefers-reduced-motion` 下自动瞬时完成。
- **KaTeX**：CDN 加载失败自动降级为 `data-plain` 文本，离线可用。
- **单文件原则**：不引外部 JS/CSS（KaTeX CDN 除外）；页面可直接双击打开
  （但自动化测试必须走 http，见 checklist.md）。
