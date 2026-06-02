#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export PATH="$HOME/sdk/go1.26.2/bin:$HOME/.npm-global/bin:$PATH"
export GOPROXY=https://goproxy.cn,direct

echo "🚀 启动 AI 测试平台..."
echo ""

# 释放被占用的端口（不直接退出，先尝试清理）
free_port() {
    local port=$1
    local service=$2
    if fuser -s "$port"/tcp 2>/dev/null; then
        echo "⚠️  端口 $port 已被占用（$service），尝试释放..."
        fuser -k "$port"/tcp 2>/dev/null
        sleep 1
        if fuser -s "$port"/tcp 2>/dev/null; then
            echo "❌ 无法释放端口 $port，请手动处理后重试"
            exit 1
        fi
        echo "   ✅ 端口 $port 已释放"
    else
        echo "✅ 端口 $port 可用（$service）"
    fi
}

echo "🔍 检查端口占用情况..."
free_port 8000 "Python Agent"
free_port 8081 "Go Backend"
free_port 3000 "Frontend"
echo ""

echo "📦 1. 启动 Python Agent 服务 (端口 8000)..."
cd "$SCRIPT_DIR/agent"
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY all_proxy ALL_PROXY no_proxy NO_PROXY
source ~/ai_env/bin/activate
pip install -q -r requirements.txt 2>&1 | tail -3
echo "   Python Agent 服务启动中..."
nohup python main.py > /tmp/agent.log 2>&1 &
AGENT_PID=$!
echo "   Agent PID: $AGENT_PID"

cd "$SCRIPT_DIR"

echo "🔧 2. 启动 Go 后端服务 (端口 8081)..."
cd "$SCRIPT_DIR/backend"
echo "   下载 Go 依赖..."
go mod tidy 2>&1 | tail -1
echo "   Go 后端服务启动中..."
nohup go run main.go > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

cd "$SCRIPT_DIR"

echo "🎨 3. 启动前端服务 (端口 3000)..."
cd "$SCRIPT_DIR/frontend"
# 彻底清理旧缓存（之前 fuser -k 可能造成 .next 损坏）
rm -rf .next
nohup pnpm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

cd "$SCRIPT_DIR"

echo ""
echo "⏳ 等待服务就绪..."

# ── Agent ──
for i in $(seq 1 15); do
  if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "   ✅ Agent 服务就绪 (port 8000)"
    break
  fi
  [ "$i" -eq 15 ] && echo "   ⚠️  Agent 启动超时，查看 /tmp/agent.log"
  sleep 1
done

# ── Go Backend ──
for i in $(seq 1 15); do
  if curl -s http://localhost:8081/health > /dev/null 2>&1; then
    echo "   ✅ Go 后端就绪 (port 8081)"
    break
  fi
  [ "$i" -eq 15 ] && echo "   ⚠️  Go 后端启动超时，查看 /tmp/backend.log"
  sleep 1
done

# ── Frontend ──
# Next.js 会在日志中打印实际端口，先尝试 3000，失败则从日志解析
FRONTEND_PORT=""
for i in $(seq 1 20); do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null | grep -q 200; then
    FRONTEND_PORT=3000
    echo "   ✅ 前端就绪 (port $FRONTEND_PORT)"
    break
  fi
  # 检查日志中是否有 "using available port" 字样
  ALT_PORT=$(grep -oP 'using available port \K\d+' /tmp/frontend.log 2>/dev/null | tail -1)
  if [ -n "$ALT_PORT" ]; then
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$ALT_PORT" 2>/dev/null | grep -q 200; then
      FRONTEND_PORT=$ALT_PORT
      echo "   ✅ 前端就绪 (port $FRONTEND_PORT)"
      break
    fi
  fi
  [ "$i" -eq 20 ] && echo "   ⚠️  前端启动超时，查看 /tmp/frontend.log"
  sleep 1
done

[ -z "$FRONTEND_PORT" ] && FRONTEND_PORT=3000

echo ""
echo "✅ 所有服务已启动！"
echo ""
echo "📌 服务地址："
echo "   - 前端界面: http://localhost:$FRONTEND_PORT"
echo "   - Go 后端:  http://localhost:8081"
echo "   - Agent:    http://localhost:8000"
echo ""
echo "📝 日志文件："
echo "   - Agent:    /tmp/agent.log"
echo "   - Backend:  /tmp/backend.log"
echo "   - Frontend: /tmp/frontend.log"
echo ""
echo "按 Ctrl+C 停止所有服务..."

trap "kill $AGENT_PID $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT

wait
