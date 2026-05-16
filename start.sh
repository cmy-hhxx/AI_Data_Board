#!/bin/bash
set -e

# 网络代理（Supabase 连接需要）
export https_proxy=http://127.0.0.1:7897
export http_proxy=http://127.0.0.1:7897
export all_proxy=socks5://127.0.0.1:7897

# 清理旧进程
kill $(lsof -ti:8787) 2>/dev/null || true
kill $(lsof -ti:5173) 2>/dev/null || true

echo "=================================="
echo " AI Data Board - 启动中..."
echo " 前端: http://localhost:5173"
echo " 后端: http://localhost:8787"
echo "=================================="

# 并行启动前后端
pnpm --filter backend dev &
pnpm --filter frontend dev &

wait
