"""
测试工具集合 - 统一导出

包含所有测试相关工具，方便注册到 LangChain Agent
"""

from .code_analyzer import CodeAnalyzerTool
from .test_case_generator import TestCaseGeneratorTool
from .bug_hunter import BugHunterTool
from .web_search import WebSearchTool
from .date_tool import DateTool

# 工具列表
TEST_TOOLS = [
    CodeAnalyzerTool(),
    TestCaseGeneratorTool(),
    BugHunterTool(),
    WebSearchTool(),
    DateTool(),
]

# 工具名称映射
TOOL_NAME_MAP = {
    "code_analyzer": "代码分析工具",
    "test_case_generator": "测试用例生成工具",
    "bug_hunter": "缺陷预测工具",
    "web_search": "网络搜索工具",
    "get_current_datetime": "日期时间工具",
}

def get_all_tools():
    """获取所有测试工具"""
    return TEST_TOOLS

def get_tool_by_name(name: str):
    """根据名称获取工具"""
    for tool in TEST_TOOLS:
        if tool.name == name:
            return tool
    return None

def get_tools_with_web_search(enable_web_search: bool = False):
    """根据配置获取工具列表，支持启用/禁用网络搜索"""
    if enable_web_search:
        return TEST_TOOLS
    # 不启用网络搜索时，返回其他工具
    return [tool for tool in TEST_TOOLS if tool.name != "web_search"]