---
description: 查看回复指标：首字延迟、生成速度(tokens/s)、token 用量、时间构成、工具与模型对比
argument-hint: [轮数 | session | 明细 | 模型]
allowed-tools: Bash
---

用户想查看模型回复的性能数据。参数：`$ARGUMENTS`

执行步骤：

1. 调用 MCP 工具 `metrics`（server：`instrument`）。按参数选择视图：
   - 参数里有「session」「会话」「累计」→ `view: "session"`
   - 参数里有「明细」「详情」「工具」「时间」「失败」→ `view: "all"`、`detail: true`
   - 参数里有「模型」「对比」→ `view: "all"`、`detail: true`，并说明可以切到工作区范围看多模型对比
   - 参数是数字（如 `5`）或「多轮」「趋势」→ `view: "turns"` 且 `limit` 为该数字
   - 参数为空或其他 → `view: "reply"`（默认，最新一条回复）
   - 一律传 `cwd` 为当前工作目录，避免匹配到别的会话。
2. 工具不可用时，用 Glob 找到本插件 `scripts/metrics.mjs` 的绝对路径，用 Bash 运行：
   `node "<绝对路径>" --cwd "$PWD" --limit 5 --format markdown --detail`
   （做模型对比时加 `--model-scope workspace`）。
3. 把结果**原样呈现**给用户（紧凑文本块或表格都不要再改写结构）。
   不要在前后加你自己的指标解读或复述字段含义。

如果数据库里没有可用记录（例如刚开新会话、当前回复还在生成中），
直接说明「暂无已完成的请求记录」，不要估算或编造数字。

如果用户想要一直看着这些数字，告诉他可以在会话侧栏的面板切换器里打开「仪表盘」面板
（总览 / 回复 / 模型 / 工具四个标签，每 3 秒自动刷新，不需要再执行命令）。
