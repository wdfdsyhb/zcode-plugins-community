# multi-model-bridge — ZCode 多模型协同技能

让一个 agent 在**当前模型缺失某项能力**时，把该子任务路由给外部模型去处理。第一个落地能力是**图像/视觉理解**（人格 Luna），设计上可扩展更多能力（数学、长上下文、代码审查等）。

## 工作方式

```
用户需求 ──▶ 主 agent（可能无视觉）
                 │ 识别到需要"看图"：当前模型没有图像输入
                 ▼
        scripts/describe_image.mjs  （打包在技能内）
                 │ base64 图片 + 问题 ──▶ 外部视觉模型 API（Luna）
                 ▼
             返回中文描述 ──▶ 主 agent 整合继续推理
```

## 安装

这个仓库即插件包。把 `multi-model-bridge/` 整个目录给目标环境：

- **本地直接当技能用**：把 `skills/multi-model-bridge` 放进 `~/.agents/skills/` 或项目 `.agents/skills/`。
- **作为插件安装**：打包成 zip，通过 ZCode 本地/远端 marketplace 安装（`package.json` + `.zcode-plugin/plugin.json` 用于插件识别）。

## 配置（每个使用者配自己的 key，绝不硬编码）

优先级：**环境变量 > 用户配置文件**。

1. 环境变量：
   - `LUNASEE_API_KEY`（或回退 `OPENAI_API_KEY`）
   - `LUNASEE_API_BASE`（默认 `https://api.openai.com/v1`）
   - `LUNASEE_MODEL`（默认 `gpt-4o`）
2. 配置文件 `~/.config/multi-model-bridge.json`：
   ```json
   { "apiKey": "sk-...", "apiBase": "https://api.openai.com/v1", "model": "gpt-4o", "personaName": "Luna" }
   ```

## 用法（给 agent 的调用）

```bash
node <技能目录>/scripts/describe_image.mjs <图片路径> [问题…]
```
输出一行 `[Luna] <中文描述/回答>`。图片路径可来自：聊天粘贴的 `[Image: source: ...]`、browser-use 网页截图、document-skills pdf 抽图。

## 扩展成更多能力（多模型协同设计）

在 `skills/multi-model-bridge/SKILL.md` 里按"能力 → 外部端点 → 调用脚本"的方式追加即可。原则：

1. 主 agent 先判断**当前模型能不能干**；不能 → 明确交给能力对应的外部模型。
2. 每个能力一个独立脚本（或一个脚本多个子命令），保持可测。
3. 密钥只在用户侧配置，脚本只读它的环境变量/配置文件，**永不打印**。

## 安全

- 密钥只存在于环境变量或 `~/.config/multi-model-bridge.json`，脚本不写日志、不回显。
- 发送给外部 API 的图片内容属于"用户明确授权"的数据，脚本不把它落盘缓存。

## License

MIT
