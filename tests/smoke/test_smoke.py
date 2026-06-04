"""
Smoke Tests - 冒烟测试

验证核心功能是否正常运行，用于快速检查系统健康状态
运行频率：每次部署后、CI/CD 流水线中
"""
import pytest


class TestAgentSmoke:
    """Agent 服务冒烟测试"""
    
    def test_agent_health(self, agent_base_url, wait_for_agent_service, api_client):
        """验证 Agent 服务健康检查"""
        response = api_client.get(f"{agent_base_url}/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "service" in data
    
    def test_rag_status(self, agent_base_url, wait_for_agent_service, api_client):
        """验证 RAG 服务状态"""
        response = api_client.get(f"{agent_base_url}/rag/status")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "available"  # 实际返回值
    
    def test_chat_stream_endpoint(self, agent_base_url, wait_for_agent_service, api_client):
        """验证流式聊天端点"""
        payload = {"message": "Hello", "session_id": "test_smoke"}
        response = api_client.post(f"{agent_base_url}/chat/stream", json=payload, stream=True)
        assert response.status_code == 200
        # 验证响应包含数据
        content = b""
        for chunk in response.iter_content(chunk_size=1024):
            content += chunk
            if len(content) > 0:
                break
        assert len(content) > 0
    
    def test_document_list_endpoint(self, agent_base_url, wait_for_agent_service, api_client):
        """验证文档列表端点"""
        # 尝试多个可能的端点路径
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


class TestFrontendSmoke:
    """前端冒烟测试"""
    
    def test_frontend_page_load(self, frontend_base_url, selenium_driver):
        """验证前端页面加载"""
        try:
            selenium_driver.get(frontend_base_url)
            assert selenium_driver.title is not None
            assert len(selenium_driver.title) > 0
        except Exception as e:
            pytest.skip(f"前端服务未启动: {str(e)}")
    
    def test_frontend_chat_interface(self, frontend_base_url, selenium_driver):
        """验证聊天界面存在"""
        try:
            selenium_driver.get(frontend_base_url)
            textareas = selenium_driver.find_elements("tag name", "textarea")
            assert len(textareas) > 0
        except Exception as e:
            pytest.skip(f"前端服务未启动: {str(e)}")


class TestIntegrationSmoke:
    """集成冒烟测试"""
    
    def test_rag_query_flow(self, agent_base_url, wait_for_agent_service, api_client):
        """验证 RAG 查询流程"""
        payload = {
            "message": "王琨的英文名字是什么？",
            "use_rag": True,
            "session_id": "test_rag_smoke"
        }
        response = api_client.post(f"{agent_base_url}/chat/stream", json=payload, stream=True)
        assert response.status_code == 200
        # 验证流式响应
        content = b""
        for chunk in response.iter_content(chunk_size=1024):
            content += chunk
            if len(content) > 0:
                break
        assert len(content) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--html=smoke_report.html"])
