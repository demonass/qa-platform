"""
缺陷预测工具 - BugHunterTool

功能：
1. 输入历史缺陷日志，分析缺陷模式
2. 预测本次上线的高风险模块
3. 提供风险评估和优化建议
"""

from langchain.tools import BaseTool
from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Any
from config import get_llm_config
from langchain_openai import ChatOpenAI
from langchain.prompts import PromptTemplate
from langchain.chains import LLMChain
import json


class BugHunterInput(BaseModel):
    defect_logs: str = Field(description="历史缺陷日志，JSON 格式或文本描述")
    current_changes: Optional[str] = Field(default="", description="本次上线的代码变更描述")


class BugHunterTool(BaseTool):
    """预测高风险模块的工具"""

    name: str = "bug_hunter"
    description: str = "输入历史缺陷日志和当前代码变更，预测本次上线的高风险模块，提供风险评估报告。输入格式示例：{\"defect_logs\": \"历史缺陷数据...\", \"current_changes\": \"本次变更...\"}"
    args_schema: type = BugHunterInput

    def _run(self, defect_logs: str = "", current_changes: str = "") -> str:
        """执行缺陷分析和风险预测"""
        try:
            llm_config = get_llm_config()
            llm = ChatOpenAI(
                model=llm_config["model"],
                temperature=0.3,
                openai_api_key=llm_config["api_key"],
                openai_api_base=llm_config["api_base"],
            )
            
            prompt = PromptTemplate.from_template("""
你是一个专业的软件质量分析师，请分析以下历史缺陷日志，并预测本次上线的高风险模块。

历史缺陷日志：
{defect_logs}

本次上线变更：
{current_changes}

请按照以下 JSON 格式输出风险评估报告：

{{
  "summary": "风险评估摘要",
  "high_risk_modules": [
    {{
      "module": "模块名称",
      "risk_level": "高/中/低",
      "reason": "风险原因",
      "suggestion": "测试建议"
    }}
  ],
  "defect_patterns": ["缺陷模式1", "缺陷模式2"],
  "overall_risk_level": "高/中/低",
  "recommendations": ["建议1", "建议2"]
}}

要求：
1. 分析缺陷发生的频率和分布
2. 识别容易出现问题的模块
3. 结合本次变更预测潜在风险
4. 输出格式必须是有效的 JSON
""")
            
            chain = LLMChain(llm=llm, prompt=prompt)
            result = chain.run(defect_logs=defect_logs, current_changes=current_changes)
            
            try:
                data = json.loads(result)
                return json.dumps(data, ensure_ascii=False, indent=2)
            except:
                return f"生成结果（非 JSON 格式）：\n{result}"
                
        except Exception as e:
            return f"缺陷分析失败: {str(e)}"