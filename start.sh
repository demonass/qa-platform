#!/bin/bash

echo "🚀 启动 AI 测试平台..."
echo ""

echo "📦 1. 启动 Python Agent 服务 (端口 8000)..."
cd services/agent
source ~/ai_env/bin/activate
pip install -q -r requirements.txt
python main.py &
AGENT_PID=$!
cd ../..

sleep 2

echo "🔧 2. 启动 Go 后端服务 (端口 8080)..."
cd services/backend
go mod tidy
go run main.go &
BACKEND_PID=$!
cd ../..

sleep 2

echo "🎨 3. 启动前端服务 (端口 3000)..."
cd services/frontend
npm install --silent
npm run dev &
FRONTEND_PID=$!
cd ../..

echo ""
echo "✅ 所有服务已启动！"
echo ""
echo "📌 服务地址："
echo "   - 前端界面: http://localhost:3000"
echo "   - Go 后端:  http://localhost:8080"
echo "   - Agent:    http://localhost:8000"
echo ""
echo "按 Ctrl+C 停止所有服务..."

trap "kill $AGENT_PID $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT

wait
