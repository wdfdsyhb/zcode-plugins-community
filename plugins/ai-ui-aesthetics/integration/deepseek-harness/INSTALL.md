# DeepSeek Harness 接入说明

> 目标：让 `ai-ui-aesthetics` 在 DeepSeek Harness 中可用。本包是通用 Skill 结构，DeepSeek 若支持 Skill/插件装载则直接可用；否则按「系统提示词注入」接入。

## 方式 1：作为插件/Skill 装载（若 DeepSeek Harness 支持）
1. 将 `ai-ui-aesthetics/` 目录放入 DeepSeek Harness 的插件/Skill 目录。
2. 保留 `SKILL.md` 的 frontmatter（这是 DeepSeek 兼容格式所需的 name/description）。

## 方式 2：字段映射（若格式要求不同）
若 DeepSeek 的插件需要特定字段，按此映射自 `SKILL.md` frontmatter 提取：

| DeepSeek 字段 | 来源 | 值示例 |
| --- | --- | --- |
| name / 名称 | `SKILL.md` frontmatter `name` | `ai-ui-aesthetics` |
| description / 描述 | `SKILL.md` frontmatter `description` | 前端美学增强包…… |
| prompt / 主提示 | `SKILL.md` 正文（工作流 + 使用铁律） | 见下「最小可用提示词」 |
| 引用资源 | 目录内 `skills/ai-ui-aesthetics/{knowledge,tokens,rules,references,patterns}` | 按相对路径引用 |

> 不同版本 DeepSeek Harness 字段名可能不同（如 `prompt` / `instructions` / `system`），用「主提示」承载 SKILL.md 正文即可。

## 方式 3：系统提示词最小可用片段（最稳妥）
若不愿做复杂配置，把下面这段作为系统提示注入，即获得核心能力：

```text
你是审美优秀的前端工程师。写任何前端/UI 代码前必须：
1. 先选 1 种风格原型（极简克制/玻璃拟态/编辑排版/大胆撞色/深色高级/柔和拟态/数据密集），说明理由。
2. 所有样式走统一设计 Token：颜色、间距(4/8/12/16/24/32/48/64/96px)、圆角、阴影分层、动效缓动；不写裸值。
3. 建立视觉层级：标题/正文/标注字号字重颜色有主次；页面有 1 个主焦点。
4. 把控对比度(正文≥4.5:1)、留白、响应式、语义化标签与焦点环。
5. 动效用 cubic-bezier 缓动(如 0.22,1,0.36,1)，时长150/250/400ms，禁 linear。
完成后对照检查清单自检统一性、层级、质感、可访问性。
```

完整版建议引用本目录下各文档获得最佳效果：
- `skills/ai-ui-aesthetics/references/style-archetypes.md`（风格表）
- `skills/ai-ui-aesthetics/tokens/design-tokens.md`（token 表）
- `skills/ai-ui-aesthetics/rules/代码检查清单.md`（自检）
- `skills/ai-ui-aesthetics/examples/before-after.md`（改造示范）

## 校验
生成一段前端，确认代码引用了 `--color-primary` / `--space-*` / `--radius-*` token、声明了风格原型、无 `linear` 与裸色值，即接入成功。
