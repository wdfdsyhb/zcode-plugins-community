# instrument · 仪表盘

在 ZCode 里看模型回复的真实性能数据：**首字延迟**、**生成速度 (tokens/s)**、**token 用量**，
以及回复历史、模型对比、工具耗时和失败重试。

数据来自 ZCode 自己写的本地用量库（`~/.zcode/cli/db/db.sqlite` 的 `model_usage` / `tool_usage` /
`part` 表）——每个请求结束时落一行，含 `started_at` / `first_token_at` / `completed_at` 与各类
token 计数。插件只读该库，不改动任何东西，也不联网。

## 会话侧栏面板（主要用法）

在会话里打开侧栏的面板切换器（标题栏右上角的「切换面板」，或侧栏标签栏的 **+**），
选择 **仪表盘**。面板每 3 秒自动刷新，可点「跟随最新」暂停；跟随宿主主题与语言。

四个标签页：

| 标签 | 内容 |
| --- | --- |
| **总览** | 右上角 **本轮 / 会话** 切换作用域（同一个开关同时控制大数字、明细行和时间构成）：三个大数字是「平均首字 / 平均生成速度 / 输出合计」，下面是输入、缓存命中率、推理、合计、耗时、工具调用、请求数、上下文占用（超 70% 黄、85% 红）。下面是**时间构成**（等待首字 / 生成 / 工具 / 间隙四段，随作用域切换「本轮回复 / 本次会话」；本轮进行中会显示当前阶段）；速度趋势（可切换成首字 / 输出 / 命中率）；会话累计。大数字自动换单位（k/M/B，悬停看精确值） |
| **回复** | 每条回复一张卡：时间、模型、**你的提问摘要**、**回复摘要**，一行摘要（实际耗时 / 首字 / 平均速度 / 输出 / 输入命中率 / 请求数），下面一条 4px 的时间构成细条（悬停看四段具体数值）。点「展开本轮请求」看这一轮里每次请求的明细（状态、首字、生成、速度、输出、工具数、第几次尝试） |
| **模型** | 按模型的请求数、平均首字、平均速度、缓存命中率、输出/输入、失败数。可切换 **本会话 / 本工作区**（工作区范围会把同目录其他会话的记录一起算，适合做模型测速对比） |
| **工具** | 各工具的总耗时排行（含调用次数、最慢一次、报错数），**健康度**（成功率、失败、取消、重试、工具报错，最近 20 轮逐轮色块），以及**失败与重试**明细 |
| **额度** | CommandCode 订阅额度：5 小时 / 本周 / 本月三档已用与上限、重置倒计时、本月剩余，以及本期请求数与 token 总量（详见下方） |

面板只为打开它的那个会话取数（宿主把会话 id 绑在面板上），并且它调用的工具模型看不到、调不动。

## 斜杠命令与提问

```
/metrics            # 最新一条回复（含时间构成、工具耗时、失败重试、最近回复摘要）
/metrics 5          # 最近 5 轮的表格（含每轮的模型耗时 / 工具耗时 / 实际耗时）
/metrics session    # 会话累计消耗
/metrics 明细       # 追加工具耗时表、模型对比表、逐请求明细
```

直接提问也可以（技能自动生效）：

> 刚才那条回复多快？首字等了多久？
> 这个会话一共用了多少 token？时间都花在哪了？
> 最近几轮的速度趋势怎么样？哪个工具最慢？
> 对比一下 deepseek 和 glm 的速度。

## 命令行

```bash
node scripts/metrics.mjs --cwd "$PWD"                          # 紧凑文本
node scripts/metrics.mjs --limit 5 --format markdown --detail  # 表格 + 工具/模型/失败
node scripts/metrics.mjs --model-scope workspace --format markdown --detail
node scripts/metrics.mjs --session sess_xxx --format json
node scripts/metrics.mjs --help
```

## 指标口径

| 指标 | 计算方式 | 说明 |
| --- | --- | --- |
| 首字延迟 | `first_token_at - started_at` | 一轮取**第一个成功请求**的值；重试请求自己的首个 token 不计入 |
| 生成速度 | `输出 tokens ÷ (completed_at - first_token_at)` | 与 ZCode 自带 Token 调试面板同口径，只含"首个 token → 请求结束"的纯生成时间 |
| 输入 / 输出 / 推理 / 合计 | 直接取记录 | 输入含缓存复用部分；括号内为缓存命中量。推理 tokens 由 provider 单独上报，部分 provider 已计入输出 |
| 本轮汇总 | 该轮 `main_turn` 请求求和 | **实际耗时** = 首个请求开始 → 最后一个请求结束（含工具执行与等待） |
| 本轮回复时间构成 | 等待首字 = 各请求首字之和；生成 = 各请求生成段之和；工具 = `tool_usage` 区间（与模型重叠的部分记给模型）；间隙 = 本轮时长减去以上三者 | 四段互斥，相加等于本轮实际耗时 |
| 本次会话时间构成 | 上面四段按**每一轮**分别计算后求和 | 分母是各轮活跃时间之和，**不含轮次之间的空闲**（否则跨天空闲会把"其他"撑成几天） |
| 会话累计 | `model_usage` 全部记录 | 含子代理、上下文压缩、标题生成，因此大于各轮之和 |
| 工具耗时 | `tool_usage` 按工具聚合 | 含调用数、最慢一次、报错/取消数、输出字节 |
| 模型对比 | 按 model + variant 聚合 | 平均首字、加权速度、命中率、失败数；`--model-scope workspace` 时含同目录其他会话 |

只有 `query_source = 'main_turn'` 的请求计入"最新回复 / 本轮汇总 / 模型对比"；子代理、压缩、
标题生成只出现在会话累计与时间构成里。

## 数据来源与隐私

- 只读打开 `~/.zcode/cli/db/db.sqlite`（SQLite `readOnly`），不影响正在运行的 ZCode；从不写入。
- 默认只读**当前会话**；`模型` 标签的"本工作区"范围和 CLI 的 `--model-scope workspace`
  会读同目录下其他会话的记录，这是显式操作。
- 路径可用 `--db` 覆盖；`ZCODE_HOME` 环境变量会被尊重。
- 会话选择顺序：`--session` / 面板绑定的会话 → `CLAUDE_SESSION_ID` 环境变量 →
  按工作目录匹配最近活跃会话 → 全库最近的会话。
- 无网络访问、无遥测。面板的资源声明了 `connectDomains: []` / `resourceDomains: []`，沙箱里发不出请求。

## Provider 显示名

数据库里记录的是**内部 provider id**（`new-provider-2`、`account:zai-start-plan`、UUID 形式），
插件会自动去 ZCode 自己的配置里查显示名，读这两个文件：

| 来源 | 文件 | 覆盖 |
| --- | --- | --- |
| 你自建的 provider | `~/.zcode/v2/provider_config.json` → `config.providerConfigRules.providerRules` | `new-provider-2` → `GOAT(LiteLLM)`、UUID provider → `MyAPI` / `OpenRouter` / `字节CodingPlan` … |
| 内置 / 账号 provider | `<安装目录>/resources/config/provider/zcode-builtin.json` | `account:zai-start-plan` → `Start Plan` 等 |

顺带用同一份配置里的 `providerOrder`，让「模型」标签的排序和 ZCode 选择器里的顺序一致。
（安装目录按 `%LOCALAPPDATA%\Programs\ZCode`、`%ProgramFiles%\ZCode`、macOS/Linux 常见路径依次探测，
也可用环境变量 `ZCODE_BUILTIN_PROVIDER_CONFIG` 指定。）

查不到就显示内部 id，不猜不编。想改名（或临时修正）时用插件配置项覆盖：

**设置 → 插件 → 仪表盘 → `providerNames`**，逗号分隔：

```
new-provider-2=GOAT(LiteLLM 新加坡),account:zai-start-plan=Z.ai 订阅
```

命令行同理：`--provider-names "new-provider-2=GOAT(LiteLLM 新加坡)"`，或环境变量 `INSTRUMENT_PROVIDER_NAMES`。
手动映射优先级最高。改完面板配置后新建会话（或重连 MCP server）生效。

## 「工作中」的那段时间在干什么

发送一条消息后、回复出现前的"工作中 N 秒"是一整条链：模型请求 → 工具调用 → 再请求 → ……
面板的 **本轮时间** 把它切成四段，四段之和等于这一轮的实际耗时：

| 段 | 含义 | 怎么算 |
| --- | --- | --- |
| **等待首字** | 请求发出到第一个 token 到达（provider 排队 + 预填充） | 每次请求的 `first_token_at - started_at` 求和 |
| **生成** | 首 token 到请求结束 | `completed_at - first_token_at` 求和 |
| **工具** | 工具执行占用的时间（与模型请求重叠的部分记给模型） | `tool_usage.duration_ms` 的并集 |
| **间隙** | 谁都没占的时间：宿主组装上下文、等审批、等用户 | 总时长减去前三个的并集 |

一轮是多次请求串起来的，所以**等待首字会累加**：一次请求首字 20s、一轮 10 次请求，
光等首字就 200s。这就是长任务"卡很久"的主要原因，而不是工具慢。
`模型` 标签里的平均首字能直接对比不同网关（同一模型走 GOAT 43.8 tok/s、走 GOAT(LiteLLM) 142.7 tok/s）。

> 面板里有三个容易混淆的"首字"：
> **单次请求的首字**（回复标签展开后每行）、**本轮等待首字**（四段里的累计值，= 各次请求首字之和，
> 已验证逐次相加与累计值相等）、**首个请求首字**（本轮汇总/趋势图里用的，只取第一个成功请求）。
> 另外约三成请求没有首字时间记录，它们的时间计入了"生成"，所以"等待首字"是**下限**，
> 面板会标出有几条这样的请求。

进行中时面板会显示当前阶段：**正在执行工具 X（已 Ys）** 或 **正在等待模型响应（已 Ys）**。
（正在跑的那次请求在数据库里还没有记录，所以"等待模型"的计时从上一个事件结束算起。）

## 上下文占用

用 `输入 tokens / 模型窗口` 表示。窗口按 ZCode 自己的规则解析：
内置 `modelRules`（正则，后者覆盖前者）→ provider 配置里的 per-model 规则 → 手动模型规则；
面板会标注来源（内置 / provider / 模型规则 / 手动）。超过 70% 变黄、85% 变红。
识别错了可以用配置项 `contextWindows` 覆盖：

```
deepseek/deepseek-v4.1-flash=800000
```

或命令行 `--context-windows "模型=窗口"`、环境变量 `INSTRUMENT_CONTEXT_WINDOWS`。

## 健康度

**工具** 标签里按"轮"统计：每轮请求数、成功、失败、取消、重试、工具报错，最近 20 轮用色块表示
（绿=正常、橙=有工具报错、红=有请求失败），悬停看明细。顶部是整会话的成功率与各项计数。

## 订阅额度（额度标签）

数据直接来自 CommandCode 的用量接口（`cmd` CLI 的 `/usage` 用的同一批 alpha 端点）：

| 端点 | 用途 |
| --- | --- |
| `GET https://api.commandcode.ai/alpha/billing/credits` | 5 小时 / 每周窗口的已用、上限、重置时间；月度剩余额度 |
| `GET https://api.commandcode.ai/alpha/billing/subscriptions` | 套餐 id、状态、计费周期 |
| `GET https://api.commandcode.ai/alpha/usage/summary` | 本期请求数、输入/输出 token、总花费 |

- **Key 从哪来**：优先用插件配置 `commandCodeKey`；否则自动读 `~/.zcode/v2/provider_config.json` 里
  `baseUrl` 指向 `api.commandcode.ai` 的 provider 的 API key（`user_...`）。**key 不会写进日志、不会出现在面板或工具输出里**，
  只会发给 `api.commandcode.ai`。
- **月度上限**：接口只报"剩余"，上限按套餐 id 映射（`individual-goat` → $70、`individual-pro` → $80、
  `max-10` → $150、`max-20` → $300、`team-pro` → $40、`individual-go` → $10）；未知套餐只显示剩余、不算百分比。
- **缓存**：服务端缓存 60 秒，面板在「额度」标签打开时每 60 秒刷新一次，也可点「刷新额度」强制查询。
- **这些是 alpha 内部端点**，官方没有承诺稳定性，字段可能变；接口失败时面板会明确报错，不会显示成 0。
- 面板沙箱没有网络权限，所有请求都由本插件的 MCP server 发起。

## 图标

`assets/icon.svg` 是插件图标（仪表盘造型：橙→蓝的刻度弧 + 指针）。现在它以内联 SVG 的形式显示在
面板标题左侧。插件列表里的图标由**市场条目**的 `icon` 字段决定，而宿主只接受 `https://` 开头的 URL
（`function $z(e){return typeof e==='string'&&e.startsWith('https://')}`），本地路径、相对路径、
`data:` URI 都不会显示。所以想让它出现在插件列表里，需要把 SVG 放到任意 HTTPS 地址
（GitHub raw、自己的域名、图床都行），然后把地址填进 `marketplace.json` 的 `"icon"`。

## 已知限制

- **面板在会话侧栏，不在消息悬浮工具条里**：消息工具条那一行没有插件扩展点；插件能用的宿主 UI
  就是侧栏面板（`ui.surfaces` + `ui://` 资源）。面板已按"每条回复都能看到指标"的方向做了回复列表。
- **正在生成的那条回复还没有数据**：记录在请求结束时写入。面板会回退显示"最近一条已完成请求"
  并给出黄字提示；命令 / 工具显示上一个请求。
- 需要 Node ≥ 22.5（`node:sqlite`）。MCP server 用 PATH 上的 `node` 启动；面板本身不需要网络。
- 回复摘要来自 `part` 表里的文本片段，超长会截断到 220 字符（提问 160 字符）。
- ZCode 自带一个隐藏的「Token 调试」面板（开发者工具，逐轮 Input/Output/Total/Reasoning/Cache/TPS），
  由渲染进程 `localStorage` 的 `zcode:developer-tools:enabled` 或 `zcode:token-debug:enabled` 控制，
  当前版本没有任何界面入口会写这两个键。

## 目录结构

```
.zcode-plugin/plugin.json      插件清单（skills / commands / mcpServers / ui.surfaces）
scripts/metrics.mjs            数据层与格式化：请求、轮次、回复预览、工具、模型、失败、时间构成
scripts/quota.mjs              CommandCode 额度查询（credits / subscriptions / usage summary，60s 缓存）
mcp/server.mjs                 零依赖 stdio MCP server：metrics 工具、quota 工具、panel_snapshot（App 专用）、
                               ui:// 面板资源
ui/panel.html                  会话侧栏面板（MCP Apps 握手 + 四标签 + 自刷新，离线自包含）
skills/instrument/             何时用、怎么解释口径
commands/metrics.md            /metrics 命令
test/mcp-smoke.mjs             MCP 冒烟测试（握手 / 资源 / 工具可见性 / 会话绑定 / 载荷结构）
test/panel-harness.html        面板测试宿主（模拟 ZCode 侧，可切换数据与状态）
assets/icon.svg                插件图标（仪表盘造型）
assets/metrics-card.html       可选的内联卡片模板（占位符替换后渲染）
```

## 排查

| 现象 | 处理 |
| --- | --- |
| `找不到 ZCode 用量数据库` | 用 `--db` 指定实际路径；确认这台机器上跑过 ZCode 会话 |
| 数字对不上刚看到的回复 | 那条还在生成中，或它不是 `main_turn` 请求；用 `--detail` 看逐请求明细 |
| `/metrics` 不在命令列表里 | 确认插件已启用（设置 → 插件管理），且没有同名命令覆盖它 |
| `metrics` 工具不存在 | MCP server 启动失败：确认 PATH 上有 `node`（`node -v` ≥ 22.5），在 设置 → MCP 里看 `instrument` 状态 |
| 面板切换器里没有「仪表盘」 | 插件需为启用状态并**重新打开会话**；清单里 `ui.surfaces.server` 必须与 `mcpServers` 的键一致 |
| 面板显示"连接宿主失败" | MCP server 没起来或资源读取失败：看 设置 → MCP 里 `instrument` 状态，再点面板里的「重试」 |
| 之前装过 `response-metrics` | 那是本插件的旧名字，请在插件管理里卸载它，再安装 `instrument`（面板里显示为「仪表盘」） |
| 额度显示「没找到 CommandCode API key」 | 在插件配置 `commandCodeKey` 里填 `user_...` 的 key，或在 ZCode 里配置一个 `api.commandcode.ai` 的 provider |
| 额度查询失败（HTTP 4xx/5xx） | alpha 接口可能变更或网络不通；点「刷新额度」重试，错误信息会显示在面板里 |
| 想单独验证服务端 | `node test/mcp-smoke.mjs`；面板 UI 用 `python -m http.server` 起静态服务后打开 `test/panel-harness.html` |
