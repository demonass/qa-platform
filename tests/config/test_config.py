"""
企业级测试配置文件

包含测试环境配置、常量定义和环境变量管理
"""
import os
from typing import Optional

# 服务端口配置
AGENT_PORT = int(os.getenv("AGENT_PORT", "8000"))
FRONTEND_PORT = int(os.getenv("FRONTEND_PORT", "3000"))
GO_BACKEND_PORT = int(os.getenv("GO_BACKEND_PORT", "8081"))

# 服务基础 URL
AGENT_BASE_URL = f"http://localhost:{AGENT_PORT}"
FRONTEND_BASE_URL = f"http://localhost:{FRONTEND_PORT}"
GO_BACKEND_BASE_URL = f"http://localhost:{GO_BACKEND_PORT}"

# 测试超时配置（秒）
API_TIMEOUT = 30
E2E_TIMEOUT = 60
SELENIUM_TIMEOUT = 15

# 测试数据目录
TEST_DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

# 浏览器配置
CHROME_HEADLESS = os.getenv("CHROME_HEADLESS", "true").lower() == "true"

# 测试用户配置
TEST_USER = {
    "username": os.getenv("TEST_USERNAME", "test_user"),
    "password": os.getenv("TEST_PASSWORD", "test_password"),
    "email": os.getenv("TEST_EMAIL", "test@example.com"),
}

# 管理员用户配置
ADMIN_USER = {
    "username": os.getenv("ADMIN_USERNAME", "admin"),
    "password": os.getenv("ADMIN_PASSWORD", "admin_password"),
}


def get_service_url(service: str) -> str:
    """获取服务 URL"""
    urls = {
        "agent": AGENT_BASE_URL,
        "frontend": FRONTEND_BASE_URL,
        "backend": GO_BACKEND_BASE_URL,
    }
    return urls.get(service, AGENT_BASE_URL)


def get_test_user(role: str = "user") -> dict:
    """获取测试用户"""
    if role == "admin":
        return ADMIN_USER
    return TEST_USER
