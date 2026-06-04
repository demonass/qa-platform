"""
网络搜索工具 - WebSearchTool

功能：
1. 使用 DuckDuckGo 进行网络搜索
2. 支持搜索结果摘要和链接
3. 支持简单的网页内容抓取
4. 用于处理时效性问题和获取最新信息
"""

from langchain.tools import BaseTool
from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Any
import requests
from bs4 import BeautifulSoup
import json
import re


class WebSearchInput(BaseModel):
    query: str = Field(description="搜索查询词")
    max_results: Optional[int] = Field(default=5, description="最大返回结果数")


class WebSearchTool(BaseTool):
    """网络搜索工具 - 使用 DuckDuckGo 搜索获取最新信息"""

    name: str = "web_search"
    description: str = "用于搜索互联网上的最新信息，适用于时效性问题、新闻查询、最新技术动态等场景。输入格式示例：{\"query\": \"2024年人工智能最新发展\", \"max_results\": 5}"
    args_schema: type = WebSearchInput

    def _duckduckgo_search(self, query: str, max_results: int = 5) -> List[Dict[str, str]]:
        """使用 DuckDuckGo 进行搜索"""
        try:
            url = "https://api.duckduckgo.com/"
            params = {
                "q": query,
                "format": "json",
                "no_redirect": "1",
                "no_html": "1",
                "skip_disambig": "1"
            }
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()
            
            results = []
            if "Results" in data:
                for result in data["Results"][:max_results]:
                    results.append({
                        "title": result.get("Text", ""),
                        "url": result.get("FirstURL", ""),
                        "summary": result.get("Description", "")
                    })
            
            # 如果 DuckDuckGo API 返回结果不足，尝试使用 HTML 搜索
            if not results:
                return self._html_search(query, max_results)
            
            return results
        except Exception as e:
            print(f"[WARN] DuckDuckGo API 搜索失败: {e}")
            return self._html_search(query, max_results)

    def _html_search(self, query: str, max_results: int = 5) -> List[Dict[str, str]]:
        """使用 DuckDuckGo HTML 搜索作为备用方案"""
        try:
            url = "https://html.duckduckgo.com/html/"
            params = {"q": query}
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
            response = requests.get(url, params=params, headers=headers, timeout=30)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, "html.parser")
            results = []
            
            # 提取搜索结果
            for result in soup.find_all("div", class_="result__body")[:max_results]:
                title_elem = result.find("a", class_="result__a")
                url_elem = result.find("a", class_="result__a")
                desc_elem = result.find("a", class_="result__snippet")
                
                if title_elem:
                    results.append({
                        "title": title_elem.get_text(strip=True),
                        "url": url_elem.get("href", "") if url_elem else "",
                        "summary": desc_elem.get_text(strip=True) if desc_elem else ""
                    })
            
            return results
        except Exception as e:
            print(f"[WARN] HTML 搜索失败: {e}")
            return []

    def _fetch_page_content(self, url: str, max_chars: int = 2000) -> str:
        """抓取网页内容（简单版本）"""
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, "html.parser")
            
            # 移除脚本和样式
            for script in soup(["script", "style"]):
                script.decompose()
            
            text = soup.get_text(separator="\n")
            # 清理多余空白
            text = re.sub(r'\s+', ' ', text).strip()
            
            return text[:max_chars]
        except Exception as e:
            print(f"[WARN] 抓取网页内容失败: {e}")
            return ""

    def _run(self, query: str = "", max_results: int = 5) -> str:
        """执行网络搜索"""
        if not query:
            return "搜索词不能为空"
        
        try:
            results = self._duckduckgo_search(query, max_results)
            
            if not results:
                return f"未找到与 '{query}' 相关的搜索结果"
            
            # 构建结果格式
            result_list = []
            for i, result in enumerate(results, 1):
                item = {
                    "序号": i,
                    "标题": result["title"],
                    "链接": result["url"],
                    "摘要": result["summary"]
                }
                result_list.append(item)
            
            # 添加使用说明
            usage_note = """\n\n💡 使用提示：
- 此工具用于获取时效性信息（如新闻、最新技术动态等）
- 如果问题涉及当前事件、最新数据或需要实时信息，请使用此工具
- 搜索结果仅供参考，请验证来源可靠性"""
            
            return json.dumps(result_list, ensure_ascii=False, indent=2) + usage_note
        
        except Exception as e:
            return f"网络搜索失败: {str(e)}"
