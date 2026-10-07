---
name: multi-model-bridge
description: >-
  Route capability gaps to external models (multi-model collaboration). Try current provider first; if the active model lacks the needed capability — most commonly image/vision understanding — delegate that subtask to a configured external model and fold the returned text into your reasoning. Triggers when the user pastes or shares an image, screenshot, photo, diagram, or asks what text/visuals are in an image; also after browser-use captures a webpage screenshot or document-skills pdf extracts an image. Casual phrasings like "看下这张图 / 图里写的什么 / 这截图有什么问题" should trigger too. Other capabilities (math, long-context, review) can be added through the same pattern.
---

# Multi-Model Bridge（多模型协同桥）

## 原理
当前模型的能力可能不全（例如无图像输入）。先判断"当前模型能不能直接干"：能，就正常处理；**不能，就把这个子任务路由给外部模型**，拿回它的文字结果继续干活。这是真正的协同（外部模型做它擅长的事），不是取巧。

## 已实现能力：图像/视觉理解

调用打包脚本把图片发给外部视觉模型（默认人格 Luna）：

```bash
node <本技能目录>/scripts/describe_image.mjs <图片绝对路径> [问题…]
```

- 输出一行 `[Luna] <中文描述/回答>`。
- 路径是相对路径时先基于工作区解析为绝对路径；文件不存在就向用户要图或路径。
- 组问题：默认"请尽可能详细、准确地用中文描述这张图";用户有具体问题就原样带上。

### 图片从哪来
- **聊天粘贴**：消息里有 `[Image: source: <绝对路径>]`，直接用。
- **网页**：先用 browser-use（control-browser）截图到文件，再传给桥。
- **PDF**：先用 document-skills 的 pdf 抽图到文件，再传给桥。

### 配置（用户侧，别硬编码）
优先级：环境变量 > 用户配置文件 `~/.config/multi-model-bridge.json`。
- env: `LUNASEE_API_KEY`（回退 `OPENAI_API_KEY`）、`LUNASEE_API_BASE`（默认官方）、`LUNASEE_MODEL`（默认 gpt-4o）
- 配置文件可写 `{ "apiKey": "...", "apiBase": "...", "model": "...", "personaName": "Luna" }`

## 扩展其他能力（同一模式）
在主/子 agent 流程里新增"能力 → 外部端点 → 调用脚本"即可。原则：
1. 先问"当前模型能不能做这件事"；不能才外派，不要什么都外派（浪费且慢）。
2. 每能力一个独立脚本或子命令，可单独测试。
3. 外派结果必须整合回主线任务，并把关键内容（尤其抄录的文字/数字）引给用户。
4. 新能力写进配置与 README，保持可复现。

## 安全
- 密钥只在环境变量或 `~/.config/multi-model-bridge.json`；**绝不打印、绝不写进聊天/日志**。
- API 报错只报告 HTTP 状态与错误信息（去掉密钥）。
- 发送给外部 API 的图片来自用户明确授权，脚本不做额外落盘缓存。
