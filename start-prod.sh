#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_PORT="${PORT:-8000}"
LOG_FILE="/tmp/ai_data_board.log"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
log_info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

echo ""
echo "  +-----------------------------------------------+"
echo "  |    AI Data Board — 生产模式启动                 |"
echo "  +-----------------------------------------------+"
echo ""

# ── 探测 Node.js（兼容 nvm） ──────────────────────────────────────
export NVM_DIR="$HOME/.nvm"
[[ -s "$NVM_DIR/nvm.sh" ]] && source "$NVM_DIR/nvm.sh"

if ! command -v node &>/dev/null; then
  log_error "未找到 Node.js，请先安装 Node.js >= 18"
  exit 1
fi
log_info "Node.js $(node -v)"

if ! command -v pnpm &>/dev/null; then
  log_error "未找到 pnpm，请先安装: npm install -g pnpm"
  exit 1
fi
log_info "pnpm $(pnpm -v)"

# ── 关闭旧进程 ─────────────────────────────────────────────────────
log_info "检查端口 $APP_PORT 的残留进程..."
OLD_PIDS=$(fuser $APP_PORT/tcp 2>/dev/null || true)
if [[ -n "$OLD_PIDS" ]]; then
  log_warn "正在关闭旧进程: $OLD_PIDS"
  fuser -k $APP_PORT/tcp 2>/dev/null || true
  sleep 1
fi

# 兜底：按进程名匹配
PIDS=$(pgrep -f "tsx.*backend.*dist" 2>/dev/null || true)
if [[ -n "$PIDS" ]]; then
  echo "$PIDS" | xargs kill -9 2>/dev/null || true
fi

# ── 确认构建产物存在 ──────────────────────────────────────────────
if [[ ! -f "$SCRIPT_DIR/backend/dist/index.js" ]]; then
  log_error "未找到构建产物，请先执行: pnpm build"
  exit 1
fi

if [[ ! -d "$SCRIPT_DIR/frontend/dist" ]]; then
  log_warn "未找到前端构建产物，将仅提供 API 服务"
fi

# ── 启动服务 ──────────────────────────────────────────────────────
log_info "在端口 $APP_PORT 启动服务..."
cd "$SCRIPT_DIR"

nohup pnpm --filter backend start > "$LOG_FILE" 2>&1 &
PID=$!
sleep 3

# ── 健康检查 ──────────────────────────────────────────────────────
if kill -0 $PID 2>/dev/null; then
  HEALTH=$(curl -s http://localhost:$APP_PORT/api/health 2>/dev/null || true)
  if [[ "$HEALTH" == *"ok"* ]]; then
    log_info "=============================================="
    log_info "  服务启动成功！"
    log_info "  PID:     $PID"
    log_info "  端口:    $APP_PORT"
    log_info "  日志:    $LOG_FILE"
    log_info "  URL:     http://localhost:$APP_PORT"
    log_info "=============================================="
  else
    log_warn "进程已启动但健康检查失败，查看日志: tail -f $LOG_FILE"
  fi
else
  log_error "进程启动失败，查看日志: cat $LOG_FILE"
  cat "$LOG_FILE"
  exit 1
fi
