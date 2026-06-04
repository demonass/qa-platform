#!/bin/bash

# ========================================
# AI 测试平台 - 停止服务脚本
# ========================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 获取脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

print_header "停止 AI 测试平台"

print_info "停止所有服务..."
if docker compose down; then
    print_success "所有服务已停止"
else
    print_warning "停止服务时出现错误"
fi

echo ""
print_info "如需删除数据卷，请运行: ${YELLOW}docker compose down -v${NC}"
echo ""