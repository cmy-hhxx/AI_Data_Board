#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONF_FILE="$SCRIPT_DIR/servers.conf"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

# ── Parse servers.conf ──────────────────────────────────────────────
if [[ ! -f "$CONF_FILE" ]]; then
  log_error "servers.conf 不存在: $CONF_FILE"
  exit 1
fi

parse_ini() {
  local section="$1" key="$2"
  awk -F '=' -v sec="[$section]" -v k="$key" '
    $0 ~ /^\[/ { in_sec = ($0 == sec) }
    in_sec && $1 ~ /^[[:space:]]*'"$key"'[[:space:]]*$/ {
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", $2)
      print $2
      exit
    }
  ' "$CONF_FILE"
}

HOST=$(parse_ini ths_board host)
USER=$(parse_ini ths_board user)
PORT=$(parse_ini ths_board port)
KEY=$(parse_ini ths_board key)
REMOTE_PATH=$(parse_ini ths_board remote_path)
Eval_PORT=$(parse_ini ths_board eval_path_port)

for var in HOST USER PORT KEY REMOTE_PATH; do
  if [[ -z "${!var:-}" ]]; then
    log_error "无法从 servers.conf 解析 $var"
    exit 1
  fi
done

SSH_OPTS="-p $PORT -i $KEY -o StrictHostKeyChecking=no -o ConnectTimeout=10"
SSH_DEST="$USER@$HOST"
SCP_OPTS="-P $PORT -i $KEY -o StrictHostKeyChecking=no -o ConnectTimeout=10"

log_info "目标服务器: $SSH_DEST:$PORT"
log_info "远程路径:   $REMOTE_PATH"
log_info "服务端口:   ${Eval_PORT:-8000}"

# ── 检查本地 SSH 连通性 ──────────────────────────────────────────────
if ! ssh $SSH_OPTS "$SSH_DEST" "echo ok" &>/dev/null; then
  log_error "无法连接到服务器 $SSH_DEST:$PORT"
  exit 1
fi
log_info "SSH 连接正常"

# ── 复制 .env 文件 ──────────────────────────────────────────────────
if [[ -f "$SCRIPT_DIR/.env" ]]; then
  log_info "上传 .env 到服务器..."
  scp $SCP_OPTS "$SCRIPT_DIR/.env" "$SSH_DEST:$REMOTE_PATH/"
else
  log_warn ".env 文件不存在,跳过上传"
fi

# ── 本地构建（避免服务器编译慢） ──────────────────────────────────
log_info "本地构建项目..."
pnpm build || { log_error "本地构建失败"; exit 1; }
log_info "本地构建完成"

# ── Rsync 源码到服务器 ──────────────────────────────────────────────
log_info "同步源码到服务器 (rsync)..."
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.env' \
  --exclude 'backup' \
  -e "ssh $SSH_OPTS" \
  "$SCRIPT_DIR/" "$SSH_DEST:$REMOTE_PATH/"

log_info "源码同步完成"

# ── 远程构建脚本 ────────────────────────────────────────────────────
# 捕获脚本为字面量，通过 stdin 传给远程 bash
REMOTE_SCRIPT=$(cat <<'SCRIPT'
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
log_info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

	cd "$REMOTE_PATH"

# ── 关闭残留服务 ─────────────────────────────────────────────────
	log_info "清理残留服务..."
	APP_PORT="${APP_PORT:-8000}"

	# 优先使用 PID 文件（服务器可能无 lsof/fuser/ss）
	if [[ -f /tmp/ai_data_board.pid ]]; then
	  OLD_PID=$(cat /tmp/ai_data_board.pid 2>/dev/null)
	  if [[ -n "$OLD_PID" ]] && kill -0 "$OLD_PID" 2>/dev/null; then
	    log_warn "根据 PID 文件关闭旧进程: $OLD_PID"
	    kill -9 "$OLD_PID" 2>/dev/null || true
	    sleep 1
	  fi
	  rm -f /tmp/ai_data_board.pid
	fi

	# 通过 /proc 扫描进程（不依赖 lsof/fuser/ss）
	for pid_dir in /proc/[0-9]*; do
	  pid=$(basename "$pid_dir")
	  if [[ -f "$pid_dir/cmdline" ]]; then
	    cmdline=$(tr '\0' ' ' < "$pid_dir/cmdline" 2>/dev/null || true)
	    if [[ "$cmdline" == *"dist/index.js"* ]]; then
	      log_warn "发现残留进程: pid=$pid"
	      kill -9 "$pid" 2>/dev/null || true
	    fi
	  fi
	done
	sleep 1


	log_info "残留服务清理完毕"

		# 验证端口已释放
		if command -v ss &>/dev/null; then
		  if ss -tlnp 2>/dev/null | grep -q ":$APP_PORT "; then
		    log_error "端口 $APP_PORT 仍被占用，无法启动"
		    exit 1
		  fi
		elif command -v netstat &>/dev/null; then
		  if netstat -tlnp 2>/dev/null | grep -q ":$APP_PORT "; then
		    log_error "端口 $APP_PORT 仍被占用，无法启动"
		    exit 1
		  fi
		fi
		log_info "端口 $APP_PORT 可用"

# ── 探测 Node.js ───────────────────────────────────────────────
# 非交互 SSH 不会 source .bashrc / .profile，手动探测 nvm
export NVM_DIR="$HOME/.nvm"
export NVM_NODEJS_ORG_MIRROR=https://npmmirror.com/mirrors/node
[[ -s "$NVM_DIR/nvm.sh" ]] && source "$NVM_DIR/nvm.sh"

if ! command -v node &>/dev/null; then
  log_warn "未检测到 Node.js，尝试安装..."
  if command -v curl &>/dev/null; then
    log_info "通过 nvm 安装 Node.js 22（gitee 镜像）..."
    bash <(curl -fsSL https://gitee.com/mirrors/nvm/raw/master/install.sh)
    export NVM_DIR="$HOME/.nvm"
    [[ -s "$NVM_DIR/nvm.sh" ]] && source "$NVM_DIR/nvm.sh"
    nvm install 22
  elif command -v apt-get &>/dev/null; then
    log_info "通过 apt 安装 Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
  elif command -v yum &>/dev/null; then
    log_info "通过 yum 安装 Node.js..."
    curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
    yum install -y nodejs
  else
    log_error "无法自动安装 Node.js，请手动安装 Node.js >= 18 后重试"
    exit 1
  fi
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [[ "$NODE_VERSION" -lt 18 ]]; then
  log_error "Node.js 版本过低 ($NODE_VERSION)，需要 >= 18"
  exit 1
fi
log_info "Node.js $(node -v)"

# ── 配置 npm 国内镜像 ──────────────────────────────────────────
log_info "配置 npm 镜像源..."
npm config set registry https://registry.npmmirror.com

# ── 安装 pnpm ───────────────────────────────────────────────────
if ! command -v pnpm &>/dev/null; then
  log_info "安装 pnpm..."
  npm install -g pnpm
fi
log_info "pnpm $(pnpm -v)"

# ── 安装依赖（dist 已本地构建） ─────────────────────────────────
log_info "安装依赖..."
pnpm install

# ── 数据库迁移 ──────────────────────────────────────────────────
log_info "执行数据库迁移..."
pnpm --filter backend db:migrate || log_warn "数据库迁移警告（可能已是最新）"


	# ── 启动服务 ────────────────────────────────────────────────────
	log_info "启动服务..."
	export PORT="$APP_PORT"
	bash start-prod.sh

	echo ""
	log_info "=============================================="
	log_info "  部署完成！"
	log_info "=============================================="
SCRIPT
)

log_info "开始远程构建..."
# 脚本通过 stdin 传给远程 bash，env 变量在远程命令中设置
echo "$REMOTE_SCRIPT" | ssh $SSH_OPTS "$SSH_DEST" \
  "export REMOTE_PATH='$REMOTE_PATH' APP_PORT='${Eval_PORT:-8000}'; bash -s"

log_info "部署脚本执行完毕"
