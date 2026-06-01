"""
测试用例生成工具 - TestCaseGeneratorTool

功能：
1. 输入需求文本，输出结构化的测试用例 JSON
2. 支持多种测试类型：功能测试、边界测试、异常测试
3. 生成完整的测试用例文档
"""

from langchain.tools import BaseTool
from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Any
from config import get_llm_config
from langchain_openai import ChatOpenAI
from langchain.prompts import PromptTemplate
from langchain.chains import LLMChain
import json


class TestCaseGeneratorTool(BaseTool):
    """生成结构化测试用例的工具"""
    
    name = "test_case_generator"
    description = "输入需求文本，生成结构化的测试用例 JSON，支持功能测试、边界测试、异常测试"
    
    class InputSchema(BaseModel):
        requirement: str = Field(description="需求描述文本")
        test_type: Optional[str] = Field(default="all", description="测试类型: all, functional, boundary, exception")
    
    def _run(self, requirement: str, test_type: str = "all") -> str:
        """执行测试用例生成"""
        try:
            llm_config = get_llm_config()
            llm = ChatOpenAI(
                model=llm_config["model"],
                temperature=0.3,
                openai_api_key=llm_config["api_key"],
                openai_api_base=llm_config["api_base"],
            )
            
            # 根据测试类型构建提示词
            test_type_desc = {
                "all": "功能测试、边界测试和异常测试",
                "functional": "功能测试",
                "boundary": "边界测试",
                "exception": "异常测试"
            }
            
            prompt = PromptTemplate.from_template("""
你是一个专业的测试工程师，请根据以下需求描述生成结构化的测试用例。

需求描述：
{requirement}

请生成 {test_type_desc} 类型的测试用例，按照以下 JSON 格式输出：

{{
  "requirement": "需求描述摘要",
  "test_cases": [
    {{
      "id": "TC001",
      "title": "测试用例标题",
      "type": "功能测试/边界测试/异常测试",
      "preconditions": ["前置条件1", "前置条件2"],
      "steps": ["步骤1", "步骤2", "步骤3"],
      "expected_result": "预期结果"
    }}
  ]
}}

要求：
1. 测试用例必须覆盖需求的核心功能
2. 每个测试用例步骤清晰、可执行
3. 预期结果明确、可验证
4. 输出格式必须是有效的 JSON
""")
            
            chain = LLMChain(llm=llm, prompt=prompt)
            result = chain.run(requirement=requirement, test_type_desc=test_type_desc.get(test_type, "功能测试"))
            
            # 尝试解析 JSON
            try:
                data = json.loads(result)
                return json.dumps(data, ensure_ascii=False, indent=2)
            except:
                # 如果不是有效 JSON，返回原始结果
                return f"生成结果（非 JSON 格式）：\n{result}"
                
        except Exception as e:
            return f"测试用例生成失败: {str(e)}"


# 测试工具
if __name__ == "__main__":
    tool = TestCaseGeneratorTool()
    result = tool.run({
        "requirement": "用户登录功能：用户名长度为3-20个字符，密码长度为6-16个字符，支持手机号登录",
        "test_type": "all"
    })
    print(result)