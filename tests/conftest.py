"""
企业级测试夹具配置

包含所有测试共享的 fixtures 和工具函数
"""
import pytest
import requests
import os
import sys
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

# 添加项目目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tests.config.test_config import (
    AGENT_BASE_URL,
    FRONTEND_BASE_URL,
    API_TIMEOUT,
    SELENIUM_TIMEOUT,
    CHROME_HEADLESS,
)


@pytest.fixture(scope="session")
def agent_base_url():
    """Agent 服务基础 URL"""
    yield AGENT_BASE_URL


@pytest.fixture(scope="session")
def frontend_base_url():
    """前端服务基础 URL"""
    yield FRONTEND_BASE_URL


@pytest.fixture(scope="session")
def wait_for_agent_service(agent_base_url):
    """等待 Agent 服务启动"""
    import time
    
    max_wait = API_TIMEOUT
    start_time = time.time()
    
    while time.time() - start_time < max_wait:
        try:
            response = requests.get(f"{agent_base_url}/health", timeout=5)
            if response.status_code == 200:
                print(f"✓ Agent 服务已就绪 ({agent_base_url})")
                return
        except Exception:
            pass
        time.sleep(2)
    
    raise RuntimeError(f"Agent 服务在 {max_wait} 秒内未启动")


@pytest.fixture(scope="session")
def wait_for_frontend_service(frontend_base_url):
    """等待前端服务启动"""
    import time
    
    max_wait = API_TIMEOUT
    start_time = time.time()
    
    while time.time() - start_time < max_wait:
        try:
            response = requests.get(frontend_base_url, timeout=5)
            if response.status_code in [200, 404]:
                print(f"✓ 前端服务已就绪 ({frontend_base_url})")
                return
        except Exception:
            pass
        time.sleep(2)
    
    raise RuntimeError(f"前端服务在 {max_wait} 秒内未启动")


@pytest.fixture(scope="class")
def api_client():
    """API 测试客户端"""
    session = requests.Session()
    session.timeout = API_TIMEOUT
    yield session
    session.close()


@pytest.fixture(scope="class")
def selenium_driver():
    """Selenium WebDriver 实例"""
    chrome_options = Options()
    
    if CHROME_HEADLESS:
        chrome_options.add_argument("--headless")
    
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--window-size=1920,1080")
    
    driver = webdriver.Chrome(options=chrome_options)
    driver.implicitly_wait(SELENIUM_TIMEOUT)
    
    yield driver
    
    driver.quit()


@pytest.fixture(scope="function")
def cleanup_test_user():
    """清理测试用户的夹具"""
    users_to_cleanup = []
    
    def add_user(username: str):
        users_to_cleanup.append(username)
    
    yield add_user
    
    # 清理测试用户
    for username in users_to_cleanup:
        try:
            requests.delete(
                f"{AGENT_BASE_URL}/auth/users/{username}",
                headers={"X-User-Role": "admin"},
                timeout=5
            )
        except Exception:
            pass


@pytest.fixture(scope="function")
def create_test_user(agent_base_url, api_client):
    """创建测试用户的夹具"""
    user_id = None
    
    def _create_user(username: str, password: str = "test_password") -> str:
        nonlocal user_id
        payload = {
            "username": username,
            "password": password,
            "role": "user"
        }
        response = api_client.post(f"{agent_base_url}/auth/register", json=payload)
        assert response.status_code == 200
        user_id = response.json()["user"]["id"]
        return user_id
    
    yield _create_user
    
    # 清理
    if user_id:
        try:
            api_client.delete(
                f"{agent_base_url}/auth/users/{user_id}",
                headers={"X-User-Role": "admin"}
            )
        except Exception:
            pass


@pytest.fixture(scope="function")
def authenticated_session(agent_base_url, api_client):
    """获取已认证的会话"""
    # 注册并登录用户
    username = f"test_session_{os.urandom(4).hex()}"
    payload = {
        "username": username,
        "password": "test_password"
    }
    
    # 注册
    api_client.post(f"{agent_base_url}/auth/register", json=payload)
    
    # 登录
    response = api_client.post(f"{agent_base_url}/auth/login", json=payload)
    assert response.status_code == 200
    
    # 设置认证头
    user_id = response.json()["user"]["id"]
    api_client.headers["X-User-Id"] = user_id
    
    yield api_client
    
    # 清理
    try:
        api_client.delete(
            f"{agent_base_url}/auth/users/{user_id}",
            headers={"X-User-Role": "admin"}
        )
    except Exception:
        pass


@pytest.fixture(scope="module")
def test_data_dir():
    """测试数据目录路径"""
    return os.path.join(os.path.dirname(__file__), "data")
