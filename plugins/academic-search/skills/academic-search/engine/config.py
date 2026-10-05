#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
academic-search skill · 集中配置文件
=====================================

本文件是引擎的唯一配置入口，分两层：
  1. 基线配置（路径 / API / 限流 / LLM prompt）—— 本文件内固定
  2. 用户主题配置 —— 从同级 topics.yaml 加载（load_topics）

用户自定义追踪方向只需编辑 topics.yaml，无需改本文件。
API Key 通过 .env 文件或系统环境变量提供，绝不写入代码。
"""

import os
from pathlib import Path

# ======================================================================
# 0. 加载 .env（若 python-dotenv 可用）
# ======================================================================
try:
    from dotenv import load_dotenv
    # .env 在 skill 根目录（engine 的父目录）
    load_dotenv(Path(__file__).parent.parent / ".env")
except ImportError:
    pass  # 未装 dotenv 时回退到纯系统环境变量

# ======================================================================
# 1. 路径配置（自动相对定位，跨平台无需修改）
# ======================================================================
# ENGINE_DIR = engine/ 目录（本文件所在）
# WORKSPACE = skill 根目录（engine 的父目录），存放 topics.yaml/.env/references/templates
ENGINE_DIR = Path(__file__).parent.resolve()
WORKSPACE = ENGINE_DIR.parent

# 用户工作区：数据库 + 报告输出（跨会话持久，不随 skill 分发）
WORKSPACE_DATA = WORKSPACE / "workspace"

# 数据库
DB_PATH = WORKSPACE_DATA / "doi_registry" / "literature.db"

# 期刊白名单目录
REFERENCES_DIR = WORKSPACE / "references"

# 报告输出目录（HTML/Markdown 保存位置）
OUTPUT_DIR = WORKSPACE_DATA / "output"

# PDF 存档目录（可选）
PDF_DIR = WORKSPACE_DATA / "doi_registry" / "pdfs"

# HTML 报告模板
TEMPLATE_DIR = WORKSPACE / "templates"

# 用户主题配置文件
TOPICS_FILE = WORKSPACE / "topics.yaml"
TOPICS_EXAMPLE = WORKSPACE / "topics.yaml.example"

# ======================================================================
# 2. API Key 配置（从环境变量读取，不要把 key 写在代码里）
# ======================================================================
# OpenAlex polite pool 邮箱（推荐填写你自己的邮箱，获得更宽松限频）
OA_MAILTO = os.environ.get("OA_MAILTO", "")
OPENALEX_API_KEY = os.environ.get("OPENALEX_API_KEY", "")
# 别名：部分 backfill 脚本直接 import OA_API_KEY
OA_API_KEY = OPENALEX_API_KEY

# Semantic Scholar API Key（强烈推荐，免费申请，即时发放）
# 申请地址: https://www.semanticscholar.org/product/api#api-key
# 无 key: 限频 1次/5秒；有 key: 1次/秒，稳定得多
S2_API_KEY = os.environ.get("S2_API_KEY", "")

# ======================================================================
# 3. LLM 中文摘要配置（OpenAI 兼容接口，可选）
# ======================================================================
# 不配 LLM 也能生成报告（只有英文 Abstract）；配置后可自动生成中文概述。
#
# 国内主流兼容服务示例：
#   - 火山引擎豆包: base_url=https://ark.cn-beijing.volces.com/api/v3
#   - DeepSeek:    base_url=https://api.deepseek.com/v1
#   - 通义千问:     base_url=https://dashscope.aliyuncs.com/compatible-mode/v1
#   - OpenAI:      base_url=https://api.openai.com/v1
LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "")
LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
LLM_MODEL = os.environ.get("LLM_MODEL", "")

# 逐篇论文摘要 Prompt 模板（可用变量：{title}, {abstract}, {journal}）
LLM_PAPER_PROMPT = (
    "你是一位学术文献分析助手。请根据以下论文信息，"
    "用中文撰写一段 100-150 字的概述，帮助读者快速判断是否值得精读。\n\n"
    "要求：\n"
    "1. 直接说研究内容/方法/结论，不要客套话\n"
    "2. 突出创新点和关键发现\n"
    "3. 专业术语保留英文或中英对照\n"
    "4. 不要翻译标题，直接开始概述\n\n"
    "标题：{title}\n"
    "期刊：{journal}\n"
    "Abstract：{abstract}\n\n"
    "中文概述："
)

# 主题级综述 Prompt（可用变量：{display}, {papers_text}）
LLM_TOPIC_PROMPT = (
    "你是一位学术领域分析专家。以下是 {display} 方向近期收录的若干篇论文"
    "标题与概述，请用中文撰写一段 150-250 字的综述，概括本期研究趋势与热点。\n\n"
    "要求：\n"
    "1. 归纳 2-4 个主要研究方向或热点\n"
    "2. 指出值得关注的方法/材料/应用趋势\n"
    "3. 语言简练，分条或段落均可\n\n"
    "论文列表：\n{papers_text}\n\n"
    "本期综述："
)

# ======================================================================
# 4. 请求限流参数（一般不需要改）
# ======================================================================
REQUEST_TIMEOUT = 20          # HTTP 请求超时（秒）
REQUEST_MAX_RETRIES = 4       # 429/503 最大重试次数
S2_RATE_LIMIT_DELAY = 1.1     # S2 调用间隔（秒），有 key 限 1次/s，保守设 1.1
OA_RATE_LIMIT_DELAY = 0.3     # OpenAlex 调用间隔（秒）

# ======================================================================
# 5. 用户主题配置（从 topics.yaml 加载）
# ======================================================================
# topics.yaml 定义用户追踪的方向、排除词、年份窗口等。
# 首次使用：复制 topics.yaml.example 为 topics.yaml 后编辑。
#
# 以下全局变量在 load_topics() 调用后被填充：
TOPICS = []
EXCLUDE_TITLE_KEYWORDS = []
EXCLUDE_JOURNAL_KEYWORDS = []
YEAR_START = 2025
YEAR_END = 2026
NUM_RESULTS_PER_TOPIC = 50
SORT_BY = "date"


def load_topics(topics_file=None):
    """从 topics.yaml 加载用户主题配置，填充模块级全局变量。

    读取 topics_file（默认 TOPICS_FILE）并设置：
      TOPICS, EXCLUDE_TITLE_KEYWORDS, EXCLUDE_JOURNAL_KEYWORDS,
      YEAR_START, YEAR_END, NUM_RESULTS_PER_TOPIC, SORT_BY

    topics.yaml 不存在时，各全局变量保持上面的默认空值，
    引擎可正常 import 但无主题可跑（提示用户先配置）。

    返回 TOPICS 列表（便于调用方直接使用）。
    """
    global TOPICS, EXCLUDE_TITLE_KEYWORDS, EXCLUDE_JOURNAL_KEYWORDS
    global YEAR_START, YEAR_END, NUM_RESULTS_PER_TOPIC, SORT_BY

    if topics_file is None:
        topics_file = TOPICS_FILE

    if not Path(topics_file).exists():
        return TOPICS

    try:
        import yaml
    except ImportError:
        print(f"[ERR] 需要 pyyaml 来读取 {topics_file}，请运行: pip install pyyaml")
        return TOPICS

    with open(topics_file, "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f) or {}

    # 年份窗口
    yw = cfg.get("year_window") or [2025, 2026]
    if isinstance(yw, list) and len(yw) == 2:
        YEAR_START, YEAR_END = int(yw[0]), int(yw[1])

    NUM_RESULTS_PER_TOPIC = int(cfg.get("num_results", NUM_RESULTS_PER_TOPIC))
    SORT_BY = cfg.get("sort_by", SORT_BY) or "date"

    # 全局排除词（可被用户在 yaml 中整体覆盖或留空）
    EXCLUDE_TITLE_KEYWORDS = list(cfg.get("exclude_title_keywords", []))
    EXCLUDE_JOURNAL_KEYWORDS = list(cfg.get("exclude_journal_keywords", []))

    # 主题列表：规范化字段，补齐缺省值
    topics = []
    for raw in cfg.get("topics", []):
        if not raw or not raw.get("key") or not raw.get("query"):
            continue
        wl = raw.get("whitelist", "auto")
        # whitelist 接受 null/None（不限）、字符串文件名、"auto"
        if wl is None:
            wl_file = None
        elif wl == "auto":
            wl_file = "auto"
        else:
            wl_file = str(wl)
        topics.append({
            "key": str(raw["key"]),
            "display": str(raw.get("display", raw["key"])),
            "query": str(raw["query"]),
            "allow_preprint": bool(raw.get("allow_preprint", False)),
            "whitelist_file": wl_file,
            "theme_color": str(raw.get("theme_color", "#2874a6")),
        })
    TOPICS = topics
    return TOPICS


# 模块加载时自动尝试读取 topics.yaml（若文件存在则填充全局变量）
load_topics()
