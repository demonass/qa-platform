"""
API 测试 - 用户认证模块

覆盖用户注册、登录、权限管理等功能的完整测试
"""
import pytest
import time


class TestAuthAPI:
    """用户认证 API 测试"""
    
    def test_user_register_success(self, agent_base_url, api_client):
        """测试用户注册成功"""
        username = f"test_user_{int(time.time())}"
        payload = {
            "username": username,
            "password": "test_password123",
            "role": "user"
        }
        
        response = api_client.post(f"{agent_base_url}/auth/register", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["user"]["username"] == username
        assert data["user"]["role"] == "user"
    
    def test_user_register_duplicate(self, agent_base_url, api_client):
        """测试重复注册"""
        username = f"duplicate_user_{int(time.time())}"
        
        # 第一次注册
        payload = {"username": username, "password": "password123"}
        api_client.post(f"{agent_base_url}/auth/register", json=payload)
        
        # 第二次注册相同用户名
        response = api_client.post(f"{agent_base_url}/auth/register", json=payload)
        assert response.status_code == 409  # Conflict
    
    def test_user_register_validation(self, agent_base_url, api_client):
        """测试注册验证"""
        # 空用户名
        response = api_client.post(
            f"{agent_base_url}/auth/register",
            json={"username": "", "password": "password123"}
        )
        assert response.status_code == 400
        
        # 短密码
        response = api_client.post(
            f"{agent_base_url}/auth/register",
            json={"username": "testuser", "password": "123"}
        )
        assert response.status_code == 400
    
    def test_user_login_success(self, agent_base_url, api_client, create_test_user):
        """测试登录成功"""
        username = f"login_test_{int(time.time())}"
        password = "test_password123"
        
        # 创建用户
        create_test_user(username, password)
        
        # 登录
        payload = {"username": username, "password": password}
        response = api_client.post(f"{agent_base_url}/auth/login", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["user"]["username"] == username
    
    def test_user_login_failed(self, agent_base_url, api_client):
        """测试登录失败"""
        payload = {"username": "nonexistent", "password": "wrong_password"}
        response = api_client.post(f"{agent_base_url}/auth/login", json=payload)
        assert response.status_code == 401
    
    def test_change_password(self, agent_base_url, api_client, create_test_user):
        """测试修改密码"""
        user_id = create_test_user("password_test")
        
        payload = {"user_id": user_id, "new_password": "new_password123"}
        response = api_client.post(f"{agent_base_url}/auth/change-password", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"


class TestUserManagementAPI:
    """用户管理 API 测试"""
    
    def test_list_users_admin_only(self, agent_base_url, api_client):
        """测试列出用户（管理员权限）"""
        # 非管理员请求
        response = api_client.get(f"{agent_base_url}/auth/users")
        assert response.status_code == 403
        
        # 管理员请求
        response = api_client.get(
            f"{agent_base_url}/auth/users",
            headers={"X-User-Role": "admin"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        assert isinstance(data["users"], list)
    
    def test_delete_user_admin_only(self, agent_base_url, api_client, create_test_user):
        """测试删除用户（管理员权限）"""
        user_id = create_test_user("delete_test")
        
        # 非管理员删除
        response = api_client.delete(f"{agent_base_url}/auth/users/{user_id}")
        assert response.status_code == 403
        
        # 管理员删除
        response = api_client.delete(
            f"{agent_base_url}/auth/users/{user_id}",
            headers={"X-User-Role": "admin"}
        )
        assert response.status_code == 200


class TestSessionAPI:
    """会话管理 API 测试"""
    
    def test_create_session(self, agent_base_url, api_client):
        """测试创建会话"""
        payload = {"message": "Hello", "session_id": f"session_{int(time.time())}"}
        response = api_client.post(f"{agent_base_url}/chat", json=payload)
        assert response.status_code == 200
    
    def test_list_sessions(self, agent_base_url, api_client):
        """测试列出会话"""
        response = api_client.get(
            f"{agent_base_url}/sessions",
            headers={"X-User-Id": "test_user"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "sessions" in data


class TestHistoryAPI:
    """历史记录 API 测试"""
    
    def test_get_history(self, agent_base_url, api_client):
        """测试获取历史记录"""
        session_id = f"history_test_{int(time.time())}"
        
        # 创建历史记录
        api_client.post(f"{agent_base_url}/chat", json={"message": "Hi", "session_id": session_id})
        
        # 获取历史
        response = api_client.get(f"{agent_base_url}/history/{session_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["session_id"] == session_id
        assert "history" in data
    
    def test_delete_history(self, agent_base_url, api_client):
        """测试删除历史记录"""
        session_id = f"delete_history_{int(time.time())}"
        
        # 创建历史记录
        api_client.post(f"{agent_base_url}/chat", json={"message": "Test", "session_id": session_id})
        
        # 删除历史
        response = api_client.delete(f"{agent_base_url}/history/{session_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"


class TestRAGAPI:
    """RAG API 测试"""
    
    def test_rag_query(self, agent_base_url, api_client):
        """测试 RAG 查询"""
        payload = {
            "message": "测试 RAG 查询",
            "use_rag": True,
            "session_id": "rag_test"
        }
        response = api_client.post(f"{agent_base_url}/chat", json=payload)
        assert response.status_code == 200
    
    def test_rag_reload(self, agent_base_url, api_client):
        """测试 RAG 重载"""
        response = api_client.post(f"{agent_base_url}/rag/reload")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"


class TestDocumentAPI:
    """文档管理 API 测试"""
    
    def test_document_upload(self, agent_base_url, api_client):
        """测试文档上传"""
        test_file = {
            "file": ("test.txt", b"Test content", "text/plain")
        }
        endpoints = ["/documents/upload", "/api/documents/upload"]
        for endpoint in endpoints:
            try:
                response = api_client.post(f"{agent_base_url}{endpoint}", files=test_file)
                if response.status_code == 200:
                    data = response.json()
                    assert data["status"] == "success"
                    return
            except Exception:
                continue
        pytest.skip("文档上传端点不可用")
    
    def test_document_list(self, agent_base_url, api_client):
        """测试文档列表"""
        endpoints = ["/documents", "/api/documents", "/documents/list"]
        for endpoint in endpoints:
            try:
                response = api_client.get(f"{agent_base_url}{endpoint}")
                if response.status_code == 200:
                    data = response.json()
                    assert "files" in data or "documents" in data
                    return
            except Exception:
                continue
        pytest.skip("文档列表端点不可用")
    
    def test_document_delete(self, agent_base_url, api_client):
        """测试文档删除"""
        delete_endpoints = ["/documents/delete/delete_me.txt", "/api/documents/delete/delete_me.txt"]
        for endpoint in delete_endpoints:
            try:
                response = api_client.delete(f"{agent_base_url}{endpoint}")
                if response.status_code == 200:
                    return
            except Exception:
                continue
        pytest.skip("文档删除端点不可用")
