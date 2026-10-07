# Design Research MCP Server

`ai-ui-aesthetics` 插件的**工具型**组件（MCP）：让 AI 能**真实抓参考站、扫图取色、产出配色建议**，用来生成更有依据、更漂亮的前端 UI。

这是本插件的「手脚」部分——与 `SKILL.md`（「脑子」，教审美）互补。

## 工具一览

| 工具 | 入参 | 返回 |
| --- | --- | --- |
| `research_reference_site(url)` | 参考站完整 URL | 标题、主色板（高频色+占比）、字体族、圆角/间距线索、亮暗主题 |
| `scan_colors(source, max_colors=8)` | 图片 URL 或本地路径 | 主导色板（hex + 占比） |
| `suggest_color_palette(style)` | 风格关键词 | 配色方案（主/强调/中性/语义）+ WCAG 对比度检查 |

`style` 支持：`minimal/极简`、`glass/玻璃`、`editorial/编辑`、`bold/撞色`、`dark/深色`、`soft/柔`、`data/数据`。

## 运行

推荐通过自举启动器 `launch_mcp.py` 运行：它会在首次运行时自动创建本地虚拟环境（`.venv/`）并按 `requirements.txt` 安装依赖，之后复用，**无需手动建环境**（机器需有 `python` 3.10+）：

```bash
python launch_mcp.py        # 首次会自动建 .venv 并装依赖，然后拉起 server
```

也可直接用已建好的 venv 手动运行（等价）：

```bash
./.venv/Scripts/python.exe mcp_server.py       # Windows（Linux/macOS 用 .venv/bin/python）
```

## 接入 ZCode / 其他 harness

### 方式 A：随本插件自动连接（导入即用）
插件 `.zcode-plugin/plugin.json` 已注册 `mcpServers`，通过 `${ZCODE_PLUGIN_ROOT}` 模板变量指向本目录的 `launch_mcp.py`。ZCode 安装插件后会自动把模板解析为插件实际根目录并连接 server；首次使用自动建环境，**克隆 / 导入后无需任何手动配置**。

### 方式 B：手动注册（通用 harness）
在任何支持手动注册的 MCP 客户端添加 stdio server，命令用系统 `python` + 启动器（自动处理环境），Linux/macOS 同样适用：

```json
{
  "command": "python",
  "args": ["<此目录绝对路径>/launch_mcp.py"]
}
```

> 若希望用一个可脱离 ZCode 模板、真正“开箱即用”的可执行文件，可把上面的 `command` 指向你本机已建好的 `.venv/Scripts/python.exe`，`args` 指向 `mcp_server.py`——只是这样换机器会失效，故建议优先用启动器方案。

## 边界与伦理
- 仅做**设计调研**：抓取限速、超时、遵 robots；提炼设计原则与 token，**不复制目标站点的像素资产**。
- 不持久化任何用户数据，不追踪。
- 请确保你有权访问所抓取的站点。

## 依赖
见 `requirements.txt`：`fastmcp`、`httpx`、`beautifulsoup4`、`Pillow`。

## 冒烟测试
```bash
python launch_mcp.py --smoke
```
应输出三个工具名（`research_reference_site_tool` / `scan_colors_tool` / `suggest_color_palette_tool`）。更完整的 MCP 握手验证见 `tests/`（可选）。
