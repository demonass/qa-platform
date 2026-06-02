"""
测试工具集合 - 统一导出

包含所有测试相关工具，方便注册到 LangChain Agent
"""

from .code_analyzer import CodeAnalyzerTool
from .test_case_generator import TestCaseGeneratorTool
from .bug_hunter import BugHunterTool

# 工具列表
TEST_TOOLS = [
    CodeAnalyzerTool(),
    TestCaseGeneratorTool(),
    BugHunterTool(),
]

# 工具名称映射
TOOL_NAME_MAP = {
    "code_analyzer": "代码分析工具",
    "test_case_generator": "测试用例生成工具",
    "bug_hunter": "缺陷预测工具",
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