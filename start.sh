#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export PATH="$HOME/sdk/go1.26.2/bin:$PATH"
export GOPROXY=https://goproxy.cn,direct

echo "🚀 启动 AI 测试平台..."
echo ""

# 端口检查函数
check_port() {
    local port=$1
    local service=$2
    
    if command -v lsof &>/dev/null; then
        if lsof -Pi :"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo "❌ 错误：端口 $port 已被占用（$service）"
            echo "请先释放该端口，或使用其他端口"
            exit 1
        fi
    elif command -v netstat &>/dev/null; then
        if netstat -tuln | grep -q ":$port "; then
            echo "❌ 错误：端口 $port 已被占用（$service）"
            echo "请先释放该端口，或使用其他端口"
            exit 1
        fi
    elif command -v ss &>/dev/null; then
        if ss -tuln | grep -q ":$port "; then
            echo "❌ 错误：端口 $port 已被占用（$service）"
            echo "请先释放该端口，或使用其他端口"
            exit 1
        fi
    fi
    
    echo "✅ 端口 $port 可用（$service）"
}

echo "🔍 检查端口占用情况..."
check_port 8000 "Python Agent"
check_port 8081 "Go Backend"
check_port 3000 "Frontend"
echo ""

echo "📦 1. 启动 Python Agent 服务 (端口 8000)..."
cd "$SCRIPT_DIR/services/agent"
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY all_proxy ALL_PROXY no_proxy NO_PROXY
source ~/ai_env/bin/activate
pip install -q -r requirements.txt 2>&1 | head -20
echo "   Python Agent 服务启动中..."
nohup python main.py > /tmp/agent.log 2>&1 &
AGENT_PID=$!
echo "   Agent PID: $AGENT_PID"

cd "$SCRIPT_DIR"

sleep 2

echo "🔧 2. 启动 Go 后端服务 (端口 8081)..."
cd "$SCRIPT_DIR/services/backend"
echo "   下载 Go 依赖..."
go mod tidy
echo "   Go 后端服务启动中..."
nohup go run main.go > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

cd "$SCRIPT_DIR"

sleep 2

echo "🎨 3. 启动前端服务 (端口 3000)..."
cd "$SCRIPT_DIR/services/frontend"
nohup npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

cd "$SCRIPT_DIR"

echo ""
echo "✅ 所有服务已启动！"
echo ""
echo "📌 服务地址："
echo "   - 前端界面: http://localhost:3000"
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