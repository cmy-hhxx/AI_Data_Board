#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_PORT="${PORT:-8000}"
LOG_FILE="/tmp/ai_data_board.log"
PID_FILE="/tmp/ai_data_board.pid"

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
# 注意：服务器可能没有 lsof/fuser/ss，所以用 PID 文件 + pgrep 做进程管理
log_info "检查残留进程..."

# 1) 优先使用 PID 文件
if [[ -f "$PID_FILE" ]]; then
  OLD_PID=$(cat "$PID_FILE" 2>/dev/null)
  if [[ -n "$OLD_PID" ]] && kill -0 "$OLD_PID" 2>/dev/null; then
    log_warn "根据 PID 文件关闭旧进程: $OLD_PID"
    kill -9 "$OLD_PID" 2>/dev/null || true
    sleep 1
  fi
  rm -f "$PID_FILE"
fi

# 2) 通过 /proc 检查端口占用（比 fuser 更可靠）
for pid_dir in /proc/[0-9]*; do
  pid=$(basename "$pid_dir")
  if [[ -f "$pid_dir/cmdline" ]]; then
    cmdline=$(tr '\0' ' ' < "$pid_dir/cmdline" 2>/dev/null || true)
    if [[ "$cmdline" == *"dist/index.js"* ]]; then
      log_warn "发现残留进程: pid=$pid cmd=$cmdline"
      kill -9 "$pid" 2>/dev/null || true
    fi
  fi
done
sleep 1


log_info "残留进程清理完毕"

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

export PORT="$APP_PORT"
nohup pnpm --filter backend start > "$LOG_FILE" 2>&1 &
PNPM_PID=$!

# 等待服务就绪（最多等 30 秒）
for i in $(seq 1 15); do
  sleep 2
  if ! kill -0 "$PNPM_PID" 2>/dev/null; then
    log_error "服务进程已意外退出"
    tail -20 "$LOG_FILE"
    exit 1
  fi
  HEALTH=$(curl -s http://localhost:$APP_PORT/api/health 2>/dev/null || true)
  if [[ "$HEALTH" == *"ok"* ]]; then
    break
  fi
done

# 获取实际的服务进程 PID 并写入文件
SERVER_PID=$(pgrep -f "tsx.*dist/index\.js" 2>/dev/null | tail -1 || true)
if [[ -z "$SERVER_PID" ]]; then
  # 尝试匹配 node 进程
  SERVER_PID=$(pgrep -f "node.*dist/index\.js" 2>/dev/null | tail -1 || true)
fi
if [[ -n "$SERVER_PID" ]]; then
  echo "$SERVER_PID" > "$PID_FILE"
  log_info "服务 PID: $SERVER_PID（已写入 $PID_FILE）"
else
  log_warn "无法获取服务 PID，使用 pnpm PID: $PNPM_PID"
  echo "$PNPM_PID" > "$PID_FILE"
fi

# ── 健康检查 ──────────────────────────────────────────────────────
HEALTH=$(curl -s http://localhost:$APP_PORT/api/health 2>/dev/null || true)
if [[ "$HEALTH" == *"ok"* ]]; then
  log_info "=============================================="
  log_info "  服务启动成功！"
  log_info "  PID:     ${SERVER_PID:-$PNPM_PID}"
  log_info "  端口:    $APP_PORT"
  log_info "  日志:    $LOG_FILE"
  log_info "  URL:     http://localhost:$APP_PORT"
  log_info "=============================================="
else
  log_error "健康检查失败，查看日志: tail -f $LOG_FILE"
  tail -20 "$LOG_FILE"
  exit 1
fi
