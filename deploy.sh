#!/bin/bash

# ========================================
# AI 测试平台 - 一键部署脚本
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

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

# 检查命令是否存在
check_command() {
    if ! command -v "$1" &> /dev/null; then
        return 1
    fi
    return 0
}

# 检查端口是否被占用
check_port() {
    local port=$1
    local service=$2

    if check_command lsof; then
        if lsof -i :"$port" &> /dev/null; then
            print_warning "端口 $port 已被占用 ($service)"
            return 1
        fi
    elif check_command netstat; then
        if netstat -tuln | grep -q ":$port "; then
            print_warning "端口 $port 已被占用 ($service)"
            return 1
        fi
    fi

    return 0
}

# 等待服务健康
wait_for_service() {
    local url=$1
    local service=$2
    local max_attempts=30
    local attempt=0

    print_info "等待 $service 启动..."

    while [ $attempt -lt $max_attempts ]; do
        if curl -sf "$url" > /dev/null 2>&1; then
            print_success "$service 已就绪"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 2
    done

    print_error "$service 启动超时"
    return 1
}

# ========================================
# 1. 环境检查
# ========================================
print_header "环境检查"

# 检查 Docker
if ! check_command docker; then
    print_error "Docker 未安装，请先安装 Docker"
    print_info "访问 https://docs.docker.com/get-docker/ 安装 Docker"
    exit 1
fi
print_success "Docker 已安装"

# 检查 Docker Compose
if ! docker compose version &> /dev/null; then
    print_error "Docker Compose 未安装"
    print_info "请升级 Docker 到最新版本或安装 docker-compose"
    exit 1
fi
print_success "Docker Compose 已安装"

# 检查端口占用
print_info "检查端口占用..."
PORTS=(
    "8000:Agent 服务"
    "8081:后端服务"
    "3000:前端服务"
)

PORTS_OCCUPIED=0
for port_info in "${PORTS[@]}"; do
    IFS=':' read -r port service <<< "$port_info"
    if ! check_port "$port" "$service"; then
        PORTS_OCCUPIED=1
    fi
done

if [ $PORTS_OCCUPIED -eq 1 ]; then
    print_error "部分端口已被占用，请先释放端口或修改 .env 中的端口配置"
    exit 1
fi

print_success "所有端口可用"

# ========================================
# 2. 配置检查
# ========================================
print_header "配置检查"

# 检查 .env 文件
if [ ! -f .env ]; then
    print_info ".env 文件不存在，从 .env.example 创建..."
    cp .env.example .env
    print_success ".env 文件已创建"
else
    print_success ".env 文件已存在"
fi

# 检查 LLM 配置
source .env

LLM_CONFIGURED=0
if [ "$LLM_PROVIDER" = "qwen" ] && [ -n "$QWEN_API_KEY" ] && [ "$QWEN_API_KEY" != "your-qwen-api-key-here" ]; then
    LLM_CONFIGURED=1
    print_success "通义千问已配置"
elif [ "$LLM_PROVIDER" = "deepseek" ] && [ -n "$DEEPSEEK_API_KEY" ] && [ "$DEEPSEEK_API_KEY" != "your-deepseek-api-key-here" ]; then
    LLM_CONFIGURED=1
    print_success "DeepSeek 已配置"
elif [ "$LLM_PROVIDER" = "openai" ] && [ -n "$OPENAI_API_KEY" ] && [ "$OPENAI_API_KEY" != "your-openai-api-key-here" ]; then
    LLM_CONFIGURED=1
    print_success "OpenAI 已配置"
elif [ "$LLM_PROVIDER" = "local" ]; then
    LLM_CONFIGURED=1
    print_success "本地模型已配置"
fi

if [ $LLM_CONFIGURED -eq 0 ]; then
    print_warning "LLM API Key 未配置"
    print_info "请编辑 .env 文件，配置以下之一："
    echo "  - QWEN_API_KEY (通义千问)"
    echo "  - DEEPSEEK_API_KEY (DeepSeek)"
    echo "  - OPENAI_API_KEY (OpenAI)"
    echo ""
    read -p "是否现在配置？(y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ${EDITOR:-nano} .env
    else
        print_warning "继续部署，但 AI 功能将不可用"
    fi
fi

# ========================================
# 3. 停止旧容器
# ========================================
print_header "清理旧容器"

if docker compose ps -q &> /dev/null; then
    print_info "停止旧容器..."
    docker compose down 2>/dev/null || true
    print_success "旧容器已停止"
else
    print_info "没有运行中的容器"
fi

# ========================================
# 4. 构建镜像
# ========================================
print_header "构建镜像"

print_info "开始构建 Docker 镜像（首次构建可能需要 5-10 分钟）..."
if docker compose build; then
    print_success "镜像构建成功"
else
    print_error "镜像构建失败"
    exit 1
fi

# ========================================
# 5. 启动服务
# ========================================
print_header "启动服务"

print_info "启动所有服务..."
if docker compose up -d; then
    print_success "服务启动成功"
else
    print_error "服务启动失败"
    exit 1
fi

# ========================================
# 6. 健康检查
# ========================================
print_header "健康检查"

# 等待 Agent 服务
AGENT_PORT=${AGENT_PORT:-8000}
wait_for_service "http://localhost:$AGENT_PORT/health" "Agent 服务"

# 等待后端服务
BACKEND_PORT=${BACKEND_PORT:-8081}
wait_for_service "http://localhost:$BACKEND_PORT/health" "后端服务"

# 等待前端服务
FRONTEND_PORT=${FRONTEND_PORT:-3000}
wait_for_service "http://localhost:$FRONTEND_PORT" "前端服务"

# ========================================
# 7. 显示服务状态
# ========================================
print_header "服务状态"

docker compose ps

# ========================================
# 8. 部署完成
# ========================================
print_header "部署完成"

echo ""
echo -e "${GREEN}🎉 AI 测试平台部署成功！${NC}"
echo ""
echo "📌 访问地址："
echo "   - 前端界面: ${BLUE}http://localhost:$FRONTEND_PORT${NC}"
echo "   - 后端 API: ${BLUE}http://localhost:$BACKEND_PORT${NC}"
echo "   - Agent API: ${BLUE}http://localhost:$AGENT_PORT${NC}"
echo ""
echo "📝 常用命令："
echo "   - 查看日志: ${BLUE}docker compose logs -f${NC}"
echo "   - 停止服务: ${BLUE}docker compose down${NC}"
echo "   - 重启服务: ${BLUE}docker compose restart${NC}"
echo "   - 查看状态: ${BLUE}docker compose ps${NC}"
echo ""
echo "📖 更多信息请查看 README.md"
echo ""