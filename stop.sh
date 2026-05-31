#!/bin/bash

echo "🛑 停止所有服务..."
pkill -f "python.*main.py" 2>/dev/null
pkill -f "go run main.go" 2>/dev/null
pkill -f "vite" 2>/dev/null
echo "✅ 所有服务已停止"
