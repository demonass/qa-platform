#!/usr/bin/env bash

# ==============================================================================
# 支持多种测试类型的统一运行入口
# Usage: ./run_tests.sh [smoke|api|e2e|performance|all]
# ==============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 虚拟环境路径
VENV_PATH="$HOME/ai_env"

# 测试目录
TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$TEST_DIR")"
REPORTS_DIR="$TEST_DIR/reports"

# 创建报告目录
mkdir -p "$REPORTS_DIR"

# 显示帮助信息
show_help() {
    echo -e "${BLUE}qa-platform test scropt${NC}"
    echo ""
    echo "Usage: $0 [options] [test_type]"
    echo ""
    echo "测试类型:"
    echo "  smoke        - 运行冒烟测试（快速验证核心功能）"
    echo "  api          - 运行 API 测试（完整接口测试）"
    echo "  e2e          - 运行 E2E 测试（端到端测试）"
    echo "  performance  - 运行性能测试"
    echo "  all          - 运行所有测试"
    echo ""
    echo "选项:"
    echo "  -h, --help   - 显示帮助信息"
    echo "  -v, --verbose - 详细输出"
    echo "  --no-html    - 不生成 HTML 报告"
    echo ""
    echo "示例:"
    echo "  $0 smoke              # 运行冒烟测试"
    echo "  $0 api                # 运行 API 测试"
    echo "  $0 all                # 运行所有测试"
}

# 运行测试函数
run_tests() {
    local test_type=$1
    local report_file="$REPORTS_DIR/${test_type}_report.html"
    local test_path=""
    
    case "$test_type" in
        smoke)
            test_path="smoke"
            ;;
        api)
            test_path="api"
            ;;
        e2e)
            test_path="e2e"
            ;;
        performance)
            test_path="performance"
            ;;
        all)
            test_path="."
            report_file="$REPORTS_DIR/full_report.html"
            ;;
        *)
            echo -e "${RED}错误: 未知的测试类型 '$test_type'${NC}"
            show_help
            exit 1
            ;;
    esac
    
    echo -e "${YELLOW}运行 ${test_type} 测试...${NC}"
    
    # 检查是否需要生成 HTML 报告
    if [ "$GENERATE_HTML" = true ]; then
        pytest "$test_path" -v --html="$report_file" --self-contained-html
    else
        pytest "$test_path" -v
    fi
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ ${test_type} 测试通过${NC}"
        if [ "$GENERATE_HTML" = true ]; then
            echo -e "${BLUE}报告已生成: $report_file${NC}"
        fi
    else
        echo -e "${RED}✗ ${test_type} 测试失败${NC}"
        exit 1
    fi
}

# 主函数
main() {
    # 默认值
    TEST_TYPE="all"
    GENERATE_HTML=true
    
    # 解析参数
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -h|--help)
                show_help
                exit 0
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            --no-html)
                GENERATE_HTML=false
                shift
                ;;
            smoke|api|e2e|performance|all)
                TEST_TYPE="$1"
                shift
                ;;
            *)
                echo -e "${RED}错误: 未知选项 '$1'${NC}"
                show_help
                exit 1
                ;;
        esac
    done
    
    # 检查虚拟环境是否存在
    if [ ! -d "$VENV_PATH" ]; then
        echo -e "${RED}错误: 虚拟环境不存在: $VENV_PATH${NC}"
        exit 1
    fi
    
    # 激活虚拟环境
    echo -e "${YELLOW}激活虚拟环境: $VENV_PATH${NC}"
    source "$VENV_PATH/bin/activate"
    
    # 运行测试
    echo -e "${BLUE}===========================================${NC}"
    echo -e "${BLUE}qa-platform test scropt${NC}"
    echo -e "${BLUE}===========================================${NC}"
    echo ""
    
    run_tests "$TEST_TYPE"
    
    echo ""
    echo -e "${GREEN}✓ 测试执行完成${NC}"
}

# 执行主函数
main "$@"
