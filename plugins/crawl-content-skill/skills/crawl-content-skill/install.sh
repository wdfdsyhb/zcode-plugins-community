#!/usr/bin/env bash
# crawl-content-skill 一键安装脚本
# 用法: bash install.sh
set -euo pipefail

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
err()   { echo -e "${RED}[✗]${NC} $1"; }

# 判断脚本所在目录（支持从任意路径执行）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 默认路径（可通过环境变量覆盖）
SKILL_INSTALL_DIR="${SKILL_INSTALL_DIR:-$HOME/.agents/skills/crawl-content}"
MC_HOME="${MC_HOME:-$HOME/MediaCrawler-main}"

echo "=========================================="
echo "  crawl-content-skill 安装"
echo "=========================================="
echo "Skill 安装位置: $SKILL_INSTALL_DIR"
echo "MediaCrawler 位置: $MC_HOME"
echo ""

# ---------- 1. 装 skill ----------
info "安装 skill 到 $SKILL_INSTALL_DIR"
mkdir -p "$(dirname "$SKILL_INSTALL_DIR")"

if [ -d "$SKILL_INSTALL_DIR" ]; then
  warn "目标目录已存在，覆盖 SKILL.md: $SKILL_INSTALL_DIR"
fi
cp "$SCRIPT_DIR/SKILL.md" "$SKILL_INSTALL_DIR/SKILL.md"
info "SKILL.md 已安装"

# ---------- 2. 检查 uv ----------
if ! command -v uv >/dev/null 2>&1; then
  if [ -x "$HOME/.local/bin/uv" ]; then
    export PATH="$HOME/.local/bin:$PATH"
  else
    warn "未检测到 uv，正在安装..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
  fi
fi
info "uv 版本: $(uv --version)"

# ---------- 3. clone MediaCrawler ----------
if [ -d "$MC_HOME" ] && [ -f "$MC_HOME/main.py" ]; then
  info "MediaCrawler 已存在，跳过 clone: $MC_HOME"
else
  warn "未检测到 MediaCrawler，开始 clone..."
  mkdir -p "$(dirname "$MC_HOME")"
  git clone https://github.com/NanmiCoder/MediaCrawler.git "$MC_HOME"
  info "MediaCrawler 已 clone 到 $MC_HOME"
fi

# ---------- 4. 装 Python 依赖 ----------
info "在 MediaCrawler 内执行 uv sync（装 Python 依赖）"
(
  cd "$MC_HOME"
  uv sync --quiet 2>&1 | tail -5
) || warn "uv sync 失败，请稍后手动 cd \"$MC_HOME\" && uv sync"

# ---------- 5. 提示 Chromium ----------
if ! ls "$HOME/Library/Caches/ms-playwright"/chromium* >/dev/null 2>&1; then
  warn "未检测到 Playwright Chromium，首次抓取前请执行:"
  echo "    cd \"$MC_HOME\" && uv run playwright install chromium"
fi

# ---------- 6. 完成 ----------
echo ""
echo "=========================================="
info "安装完成！"
echo ""
echo "下一步:"
echo "  1. 重启 ZCode / Claude Code，让 skill 生效"
echo "  2. 在会话里试: /crawl-content bili 价值投资"
echo ""
echo "可选自定义（加到 ~/.zshrc）:"
echo "  export MC_HOME=\"$MC_HOME\""
echo "  export CRAWL_WORKDIR=\"\$HOME/Documents/crawl-content\""
echo "=========================================="
