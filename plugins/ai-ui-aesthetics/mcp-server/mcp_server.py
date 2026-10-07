"""AI UI Aesthetics — Design Research MCP Server.

让 AI 能真实去抓参考站、扫图取色、产出配色建议，用来生成更漂亮、有依据的前端 UI。

工具：
1. research_reference_site(url)   — 抓取参考站 HTML+CSS，提取设计 Token（主色板/字体/圆角间距线索/亮暗）
2. scan_colors(source)            — 从图片 URL 或本地路径量化主色板（色值+占比+名称）
3. suggest_color_palette(style)   — 结合风格原型库，产出配色方案 + 对比度检查

仅做「设计调研」，尊重 robots / 限速 / 超时；提炼设计原则，不复制像素资产。
"""

from __future__ import annotations

import io
import re
import sys
from typing import Any
from urllib.parse import urlparse

try:
    from fastmcp import FastMCP
except ImportError:  # 提示缺失依赖
    print("缺少依赖 fastmcp，请先运行: pip install -r requirements.txt", file=sys.stderr)
    raise

import httpx

# Pillow 与 BeautifulSoup 为可选加载，缺失时对应工具返回说明
try:
    from PIL import Image
    _HAS_PIL = True
except ImportError:
    _HAS_PIL = False

try:
    from bs4 import BeautifulSoup
    _HAS_BS4 = True
except ImportError:
    _HAS_BS4 = False


# ---------------------------------------------------------------
# 常量与配置
# ---------------------------------------------------------------
DEFAULT_TIMEOUT = httpx.Timeout(15.0)
HEADERS = {
    "User-Agent": "ai-ui-aesthetics-design-research/1.0 (+design token extraction)",
    "Accept": "text/html,application/xhtml+xml,application/css,*/*;q=0.8",
}

# 通用颜色名称（用于把 hex 归到可读名字；用于 scan_colors 的展示辅助）
COLOR_NAMES: dict[tuple[int, int, int], str] = {}


# ---------------------------------------------------------------
# 通用工具函数
# ---------------------------------------------------------------
def _is_url(s: str) -> bool:
    p = urlparse(s)
    return p.scheme in ("http", "https") and bool(p.netloc)


def _hex(rgb: tuple[int, int, int]) -> str:
    return "#{:02x}{:02x}{:02x}".format(*rgb).upper()


def _parse_css_text(content: str) -> list[dict[str, str]]:
    """极简 CSS 规则扫描：抓取常见设计 token 的值（颜色/字体/圆角/间距）。

    不引入完整 CSS 解析器，只做有代表性的正则采样，返回原始线索供 AI 归纳。
    """
    rules: list[dict[str, str]] = []
    # 每个 {} 块
    for block in re.findall(r"[^{}]+\{[^{}]*\}", content):
        decl = block.split("{", 1)[1].rstrip("}")
        color = re.search(r"(?:background|color|border(?:-top|-right|-bottom|-left)?|fill|stroke)\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\))", decl)
        font = re.search(r"(?:font-family|font)\s*:\s*([^;]+)", decl)
        radius = re.search(r"border-radius\s*:\s*([^;]+)", decl)
        spacing = re.search(r"(?:margin|padding)\s*:\s*([^;]+)", decl)
        item: dict[str, str] = {}
        if color:
            item["color"] = color.group(1).strip()
        if font:
            item["font"] = font.group(1).strip()
        if radius:
            item["radius"] = radius.group(1).strip()
        if spacing:
            item["spacing"] = spacing.group(1).strip()
        if item:
            rules.append(item)
    return rules


def _freq_colors_from_css(css_rules: list[dict[str, str]]) -> list[dict[str, Any]]:
    """从 CSS 规则里统计高频颜色（用于主色倾向判断）。"""
    counts: dict[str, int] = {}
    for r in css_rules:
        c = r.get("color")
        if not c:
            continue
        key = c.lower()
        counts[key] = counts.get(key, 0) + 1
    ranked = sorted(counts.items(), key=lambda kv: kv[1], reverse=True)
    total = sum(kv[1] for kv in ranked) or 1
    return [
        {"color": k, "count": v, "share": round(v / total, 3)}
        for k, v in ranked[:12]
    ]


def _detect_theme(css_rules: list[dict[str, str]]) -> str:
    """粗略判断亮/暗主题：统计 color 里深色背景与浅色背景倾向。"""
    dark = 0
    light = 0
    for r in css_rules:
        c = (r.get("color") or "").lower()
        m = re.fullmatch(r"#([0-9a-f]{6})", c)
        if not m:
            continue
        r6, g6, b6 = (int(m.group(1)[i : i + 2], 16) for i in (0, 2, 4))
        lum = 0.299 * r6 + 0.587 * g6 + 0.114 * b6
        if lum < 60:
            dark += 1
        elif lum > 200:
            light += 1
    if dark > light:
        return "dark"
    if light > dark:
        return "light"
    return "unknown"


# ---------------------------------------------------------------
# 工具 1：research_reference_site
# ---------------------------------------------------------------
def research_reference_site(url: str) -> dict[str, Any]:
    """抓取一个参考网站的 HTML 与 CSS，提取设计 Token 与风格线索。

    返回：URL、标题、主色板（含占比）、字体族、圆角/间距线索、亮暗主题、以及代表性的 CSS 采样。
    只做设计调研；请确保你有权访问该站点。
    """
    if not _is_url(url):
        return {"error": "无效的 URL（需以 http:// 或 https:// 开头）"}

    if not _HAS_BS4:
        return {"error": "缺少依赖 beautifulsoup4，请安装 requirements.txt"}

    result: dict[str, Any] = {"url": url}

    try:
        with httpx.Client(headers=HEADERS, timeout=DEFAULT_TIMEOUT, follow_redirects=True) as client:
            resp = client.get(url)
            resp.raise_for_status()
            html = resp.text
    except httpx.HTTPError as e:
        return {"error": f"抓取失败: {type(e).__name__}: {e}"}

    soup = BeautifulSoup(html, "html.parser")
    title = soup.title.get_text(strip=True) if soup.title else ""
    result["title"] = title or url

    # 收集内联 <style> 与外部样式表
    css_sources: list[str] = []
    for st in soup.find_all("style"):
        css_sources.append(st.get_text())
    for link in soup.find_all("link", rel="stylesheet"):
        href = link.get("href")
        if href:
            css_sources.append(href)

    css_rules: list[dict[str, str]] = []
    for src in css_sources:
        if src.lstrip().startswith("http") or src.startswith("//") or "{" not in src:
            # 外部样式表，尝试抓取
            ext = src if src.startswith("http") else (f"https:{src}" if src.startswith("//") else None)
            if ext:
                try:
                    with httpx.Client(headers=HEADERS, timeout=DEFAULT_TIMEOUT, follow_redirects=True) as c:
                        r = c.get(ext)
                        if r.status_code == 200:
                            css_rules.extend(_parse_css_text(r.text))
                except httpx.HTTPError:
                    continue
        else:
            css_rules.extend(_parse_css_text(src))

    result["color_frequencies"] = _freq_colors_from_css(css_rules)
    result["theme"] = _detect_theme(css_rules)

    # 字体、圆角、间距线索（去重取前若干）
    fonts: list[str] = []
    radius: list[str] = []
    spacing: list[str] = []
    for r in css_rules:
        if r.get("font") and r["font"] not in fonts:
            fonts.append(r["font"])
        if r.get("radius") and r["radius"] not in radius:
            radius.append(r["radius"])
        if r.get("spacing") and r["spacing"] not in spacing:
            spacing.append(r["spacing"])
    result["fonts"] = fonts[:12]
    result["radius_evidence"] = radius[:12]
    result["spacing_evidence"] = spacing[:12]
    result["css_rule_count"] = len(css_rules)

    return result


# ---------------------------------------------------------------
# 工具 2：scan_colors
# ---------------------------------------------------------------
def scan_colors(source: str, max_colors: int = 8) -> dict[str, Any]:
    """从一张图片（URL 或本地文件路径）量化出主导色板。

    返回：来源、图片尺寸、主色板（hex + 近似占比 + 可读名称）。
    用于扫描设计稿/截图/参考素材取色。
    """
    if not _HAS_PIL:
        return {"error": "缺少依赖 Pillow，请安装 requirements.txt"}

    try:
        if _is_url(source):
            resp = httpx.get(source, headers=HEADERS, timeout=DEFAULT_TIMEOUT, follow_redirects=True)
            resp.raise_for_status()
            img = Image.open(io.BytesIO(resp.content))
        else:
            img = Image.open(source)
        img.load()
    except Exception as e:  # noqa: BLE001 - 统一为用户可读错误
        return {"error": f"无法读取图片: {type(e).__name__}: {e}"}

    # 缩小以减少计算量
    img = img.convert("RGB")
    img.thumbnail((200, 200))
    pixels = list(img.getdata())

    # 量化：把颜色归并到接近的桶（阶化），统计占比
    def quant(rgb: tuple[int, int, int]) -> tuple[int, int, int]:
        return tuple((c // 16) * 16 for c in rgb)  # type: ignore[return-value]

    buckets: dict[tuple[int, int, int], int] = {}
    for px in pixels:
        b = quant(px)
        buckets[b] = buckets.get(b, 0) + 1

    ranked = sorted(buckets.items(), key=lambda kv: kv[1], reverse=True)[:max_colors]
    total = len(pixels) or 1
    palette = []
    for bucket, count in ranked:
        palette.append(
            {
                "hex": _hex(bucket),
                "share": round(count / total, 3),
                "count": count,
            }
        )

    return {
        "source": source,
        "width": img.width,
        "height": img.height,
        "palette": palette,
    }


# ---------------------------------------------------------------
# 工具 3：suggest_color_palette
# ---------------------------------------------------------------
# 风格原型的配色建议（对应 references/style-archetypes.md）
_STYLE_PROFILES: dict[str, dict[str, Any]] = {
    "minimal": {
        "name": "极简克制",
        "base": "#ffffff", "text": "#1a1a1a",
        "primary": "#2563eb", "accent": "#0ea5e9",
        "neutrals": ["#f5f5f5", "#e5e5e5", "#a3a3a3", "#525252"],
        "hint": "以中性灰阶为主，单一强调色，小面积使用。",
    },
    "glass": {
        "name": "玻璃拟态",
        "base": "#0b1020", "text": "#eef2ff",
        "primary": "#8b5cf6", "accent": "#22d3ee",
        "neutrals": ["#1e2a45", "#2a3a5c", "#8093b0", "#cbd5e1"],
        "hint": "深色底 + 半透明白/彩色光斑，面板用 backdrop-blur，前景文字保持高对比。",
    },
    "editorial": {
        "name": "编辑排版",
        "base": "#faf9f6", "text": "#1c1917",
        "primary": "#b91c1c", "accent": "#92400e",
        "neutrals": ["#e7e5e4", "#d6d3d1", "#a8a29e"],
        "hint": "米白底 + 衬线大标题，少量单色点缀（警觉色），网格严谨。",
    },
    "bold": {
        "name": "大胆撞色",
        "base": "#ffffff", "text": "#111827",
        "primary": "#2563eb", "accent": "#f59e0b",
        "neutrals": ["#f3f4f6", "#9ca3af"],
        "hint": "高饱和主色 + 撞色次色，大色块做分隔，适合年轻品牌。",
    },
    "dark": {
        "name": "深色高级",
        "base": "#0f1115", "text": "#f3f4f6",
        "primary": "#10b981", "accent": "#fbbf24",
        "neutrals": ["#1f242b", "#2b313a", "#6b7280", "#9ca3af"],
        "hint": "带色相的深底 + 单强调色，低强度阴影 + 高光描边，避免纯黑。",
    },
    "soft": {
        "name": "柔和拟态",
        "base": "#eef0f3", "text": "#2d2d2d",
        "primary": "#6d7b8f", "accent": "#a3b18a",
        "neutrals": ["#dfe3e8", "#c8ced6"],
        "hint": "低饱和同色系底，大圆角 + 柔和对角阴影；适度使用避免平浅。",
    },
    "data": {
        "name": "数据密集",
        "base": "#ffffff", "text": "#111827",
        "primary": "#2563eb", "accent": "#059669",
        "neutrals": ["#f3f4f6", "#e5e7eb", "#9ca3af"],
        "hint": "浅底 + 中性文字，强调色用于数据/状态，等宽字体用于数字。",
    },
}
# 别名归一（中英）
_STYLE_ALIASES = {
    "极简": "minimal", "极简克制": "minimal", "minimal": "minimal", "apple": "minimal",
    "玻璃": "glass", "玻璃拟态": "glass", "glassmorphism": "glass", "glass": "glass",
    "编辑": "editorial", "编辑排版": "editorial", "editorial": "editorial", "杂志": "editorial",
    "撞色": "bold", "大胆撞色": "bold", "bold": "bold", "playful": "bold",
    "深色": "dark", "深色高级": "dark", "dark": "dark", "premium": "dark",
    "柔": "soft", "柔和": "soft", "柔拟": "soft", "soft": "soft", "neumorphism": "soft",
    "数据": "data", "数据密集": "data", "data": "data", "dash": "data",
}


def _lum(rgb: tuple[int, int, int]) -> float:
    r, g, b = (c / 255 for c in rgb)
    def lin(c: float) -> float:
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)


def _contrast(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    la, lb = _lum(a), _lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def _hex_to_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def suggest_color_palette(style: str = "minimal") -> dict[str, Any]:
    """按一种风格原型给出配色方案，并做文本/背景对比度检查（WCAG）。

    风格可传：极简/minimal、玻璃/glass、编辑/editorial、撞色/bold、深色/dark、柔/soft、数据/data。
    """
    key = _STYLE_ALIASES.get(style.strip().lower(), "minimal")
    prof = _STYLE_PROFILES[key]

    scheme = {
        "style": key,
        "style_name": prof["name"],
        "background": prof["base"],
        "text": prof["text"],
        "primary": prof["primary"],
        "accent": prof["accent"],
        "neutrals": prof["neutrals"],
        "semantic": {
            "success": "#16a34a",
            "warning": "#d97706",
            "error": "#dc2626",
            "info": "#0ea5e9",
        },
        "hint": prof["hint"],
    }

    # 对比度检查
    bg = _hex_to_rgb(prof["base"])
    checks = {
        "text_on_background": round(_contrast(_hex_to_rgb(prof["text"]), bg), 2),
        "primary_on_background": round(_contrast(_hex_to_rgb(prof["primary"]), bg), 2),
    }
    scheme["contrast_checks"] = checks
    scheme["a11y_notes"] = (
        "正文对背景需 ≥ 4.5:1，大号文本 ≥ 3:1。以上为参考值，实际请结合你选用的具体色值复核。"
    )
    return scheme


# ---------------------------------------------------------------
# FastMCP 实例 & 注册
# ---------------------------------------------------------------
mcp = FastMCP(
    "ai-ui-aesthetics-design-research",
    instructions=(
        "为「AI UI 美学」插件的设计调研服务。可用工具："
        "research_reference_site(url) 抓参考站提设计 Token；"
        "scan_colors(source) 从图片扫码色盘；"
        "suggest_color_palette(style) 按风格原型给配色方案。"
    ),
)


@mcp.tool()
def research_reference_site_tool(url: str) -> dict[str, Any]:
    """抓取参考网站，提取设计 Token（主色板/字体/圆角间距线索/亮暗主题）。

    参数：
        url: 参考网站的完整地址（http/https）。

    返回结构化 JSON，供 AI 据此生成漂亮的配色与布局。
    """
    return research_reference_site(url)


@mcp.tool()
def scan_colors_tool(source: str, max_colors: int = 8) -> dict[str, Any]:
    """从一张图片（URL 或本地路径）量取主导色板。

    参数：
        source: 图片 URL 或本地文件路径。
        max_colors: 返回主色数量上限（默认 8）。

    返回色板（hex + 占比），用于扫描设计稿/截图取色。
    """
    return scan_colors(source, max_colors)


@mcp.tool()
def suggest_color_palette_tool(style: str = "minimal") -> dict[str, Any]:
    """按风格原型给出配色方案并检查对比度。

    参数：
        style: 风格关键词（minimal/极简、glass/玻璃、editorial/编辑、bold/撞色、
               dark/深色、soft/柔、data/数据），默认 minimal。

    返回主色/强调/中性/语义色 + WCAG 对比度检查。
    """
    return suggest_color_palette(style)


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
