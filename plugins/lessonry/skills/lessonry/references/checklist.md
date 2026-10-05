# checklist.md — 交付前验证管线 + 血泪坑清单

> 写完页面 ≠ 交付。本文件是强制验证流程（顺序执行）+ 历史事故清单。
> 目录：[V1 语法与结构] [V2 功能回归] [V3 视觉验收] [V4 内容审查] [已知坑清单]

## V1 语法与结构

1. 提取 `<script>` 做 JS 语法检查（无需浏览器）：
   `node -e "const s=require('fs').readFileSync('页.html','utf8');const m=s.match(/<script>([\s\S]*)<\/script>/);new Function(m[1]);console.log('ok')"`
2. 确认单文件原则：除 KaTeX CDN 外无外部依赖；页面可直接双击打开。

## V2 功能回归（必须，不可省）

1. 启动本地服务（**内置浏览器无法打开 file:**，必须 http）：
   `python -m http.server 8613 --directory <页面目录>`（后台运行）
2. 浏览器打开页面，逐步骤驱动**所有**播放器、捕获所有异常。**先给 rAF 打桩**
   （`packet()` 用 requestAnimationFrame 驱动；在后台/非聚焦的嵌入式标签页里 rAF 完全不触发，
   探针会永久挂起——真实事故）：
   ```js
   // 在页面上下文执行（务必在干净的标签页里跑；被挂死的探针会堵住后续求值）：
   const orig = window.requestAnimationFrame;
   window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16);
   try {
     SPEED = 60;  const errs = [], hidden = {};
     for (const k of Object.keys(SECTIONS)) {
       const s = SECTIONS[k]; if (!s || !s.steps) continue;
       for (let i = 0; i < s.steps.length; i++) {
         try { await s.steps[i].go(); } catch (e) { errs.push(k + '.' + i + ':' + e); }
       }
       const svg = document.getElementById('svg' + k);
       hidden[k] = [...svg.querySelectorAll('*')]
         .filter(n => n.style && n.style.opacity === '0' && n.tagName !== 'g').length;
     }
     // errs 必须为空（引擎会吞步骤异常，必须显式收集）；
     // hidden 每章必须为 0（残留 = 永远隐形的内容）；
     // 核对 Object.keys(SECTIONS) 章数 = HTML 章数；各 .quiz 选项数 = 4×题数。
   } finally { window.requestAnimationFrame = orig; }
   ```
   注：引擎会 try/catch 步骤错误（字幕照常推进），所以**必须在探针里显式收集 errs**，
   只看画面发现不了。
   注 2：探针可在后台标签页跑——模板版 packet() 已用 `document.hidden` 兜底（rAF 在后台
   不触发，会挂死探针）；若页面基于未打补丁的旧引擎，先补上这个兜底或把标签页置前台。
3. 交互件逐个点一遍（滑块预设/点击探索/终端按钮），核对读数与文案。

## V3 视觉验收（截图 + 逐章检查）

1. 无头截图（整页、每章动画到终态）：
   ```
   msedge --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1
     --force-prefers-reduced-motion --user-data-dir=<临时目录>
     --run-all-compositor-stages-before-draw --window-size=1265,<页高+50>
     --virtual-time-budget=90000 --screenshot=<输出.png> "http://localhost:8613/页.html#autoplay"
   ```
   - `#autoplay` + `--force-prefers-reduced-motion` 让所有动画瞬时到终态（否则截图停在半路）。
   - 页高先用浏览器量（`document.documentElement.scrollHeight`）。
   - ⚠ Edge 偶发**静默失败**：截图后必须校验文件存在 + mtime 更新 + PNG 尺寸正确，
     否则误把旧图当新图（真实事故：复检用了旧图，误判修复未生效）。
   - 超过 16384px 的长页可分`#锚点`两次截图拼接，或按章分批截。
2. 按章切片（System.Drawing/PIL 按 layout.json 的 y/h 裁剪），逐章检查：
   文字溢出/重叠/截断、SVG 文本是否超出画布、字幕与画面是否对齐、
   图例颜色与实际使用一致、quiz 选项完整。
3. 有 judge/视觉评审子代理可用时，逐章派发验收；修复后**只重截受影响章节**并复检。

## V4 内容审查（发布前）

- 逐题验算 quiz（正确下标、解析推导、数字算得平）。
- 公式四步链完整（例子→公式→点名→变式）；黑话首次出现有括号白话。
- 数字单一口径（图/字幕/quiz 一致）；倍数折扣不混用；单位写法统一。
- 章节依赖：后章概念前章讲过；跨页引用具体（"⑦ 第 2 章"）。

## 已知坑清单（全部为真实事故，写代码前过一遍）

| # | 坑 | 根因与对策 |
|---|---|---|
| 1 | 代码面板 9 行挤成 1 行被裁 | `pre` 的 `white-space:pre` 吞掉 inline-block 间换行点 → `.ln` 用 `display:block` |
| 2 | 引用了不存在的调色板键（`C.grad`），线静默画不出 | 新增颜色两处同步：CSS `:root` + JS `C`；写完 grep `C\.\w+` 对账 |
| 3 | 元素创建时 `opacity:0`，没有任何步骤点亮它 → 内容永远隐形 | V2 的隐藏元素审计；点亮动作写进对应步骤 |
| 4 | 字幕说"第 2 轮超时"，画面高亮第 1 轮 | notes 数组与卡片数组逐条对齐；写一步核一步 |
| 5 | SVG 文本太长溢出画布/压住别的元素 | SVG 不换行：先量字符宽（CJK≈fs 像素/字），或挪进 HTML note |
| 6 | `if not x` 的逻辑在字幕里讲反 | 负条件逐字翻译成"是不是没有…？是/否"再下笔 |
| 7 | python heredoc 写 `\theta` 被转义层吃掉，替换静默失败 | 反斜杠内容用 `chr(92)` 构造或 Edit 工具；所有批量替换必须 assert 命中数 |
| 8 | 批量替换没 assert，静默 no-op 后又按"已修"复检 | 同上：替换脚本一律校验 count==1 |
| 9 | `querySelectorAll(...)[8]` 越界取 undefined，pulse 静默失败 | 索引前确认集合长度；动画对 undefined 不报错但没效果 |
| 10 | "打 4 折"vs"×4.0 折"vs"省 8 倍"混用 | 全页统一口径（见 pedagogy 第 5 节） |
| 11 | 方向语义教反（"往左迈"画面往右滚；箭头朝上数据朝下） | 方向类文案写完对照画面/坐标逐一确认 |
| 12 | 内置浏览器打不开 file: 链接 | 一律 http.server |
| 13 | Edge 截图偶发静默失败/旧图残留 | 截图后校验存在+mtime+尺寸（V3） |
| 14 | goto 带 hash 不触发重载，读到的还是旧页 | 测量/回归用新 query 参数（?v=N）或先 reload |
| 15 | 同一页两套 ①②③④ 编号（页内路线图 vs 系列页码）撞车 | 页内路线图用文字或"第 X 章"标签，不用圈号 |
| 16 | 交互件初始空白（进章看不到内容） | 点击探索类默认先 select(0)；面板加操作提示行 |
