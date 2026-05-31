import os
from typing import Dict, List
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_react_agent
from langchain.prompts import PromptTemplate
from langchain.tools import Tool
from config import get_llm_config

for key in ["http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY",
            "all_proxy", "ALL_PROXY", "no_proxy", "NO_PROXY"]:
    os.environ.pop(key, None)


class ConversationHistory:
    def __init__(self):
        self.sessions: Dict[str, List[dict]] = {}

    def get_history(self, session_id: str) -> List[dict]:
        return self.sessions.get(session_id, [])

    def add_message(self, session_id: str, role: str, content: str):
        if session_id not in self.sessions:
            self.sessions[session_id] = []
        self.sessions[session_id].append({"role": role, "content": content})

    def clear_history(self, session_id: str):
        if session_id in self.sessions:
            self.sessions[session_id] = []

    def format_history(self, session_id: str) -> str:
        history = self.get_history(session_id)
        if not history:
            return "（无历史对话）"
        formatted = []
        for msg in history[-6:]:
            role = "用户" if msg["role"] == "user" else "助手"
            formatted.append(f"{role}: {msg['content']}")
        return "\n".join(formatted)


conversation_history = ConversationHistory()


SYSTEM_PROMPT = """你是一位拥有10年经验的资深QA测试工程师，精通软件测试理论和实践。

你的专长：
1. 熟练掌握IEEE 829测试文档标准
2. 擅长编写各类测试用例（功能测试、边界测试、异常测试、性能测试）
3. 熟悉常见的测试方法和策略（等价类划分、边界值分析、决策表测试、状态转换测试）
4. 了解Agile、Scrum等敏捷开发模式中的测试实践

输出规范：
1. 测试用例必须包含：用例编号、前置条件、操作步骤、预期结果、优先级
2. 使用Markdown表格格式输出，清晰易读
3. 对于关键功能，补充异常场景和边界条件测试
4. 根据功能复杂度，提供5-15条测试用例

示例输出格式：
| 用例编号 | 用例名称 | 前置条件 | 操作步骤 | 预期结果 | 优先级 |
|---------|---------|---------|---------|---------|--------|
| TC_001 | 正常登录成功 | 用户已注册 | 1. 输入正确账号密码... | 登录成功，进入主页 | P0 |

请根据用户的需求生成专业的测试用例。"""


def get_qa_tools():
    def generate_test_cases(input_str: str) -> str:
        return f"已收到测试需求：{input_str}。正在生成测试用例..."

    def analyze_requirements(input_str: str) -> str:
        return f"已收到需求文档：{input_str}。正在分析测试要点..."

    tools = [
        Tool(
            name="generate_test_cases",
            func=generate_test_cases,
            description="根据功能描述生成测试用例。输入：功能描述；输出：测试用例列表"
        ),
        Tool(
            name="analyze_requirements",
            func=analyze_requirements,
            description="分析需求文档，提取测试要点。输入：需求文档；输出：测试要点列表"
        )
    ]
    return tools


def create_qa_agent():
    llm_config = get_llm_config()

    llm = ChatOpenAI(
        model=llm_config["model"],
        temperature=0.7,
        openai_api_key=llm_config["api_key"],
        openai_api_base=llm_config["api_base"],
        request_timeout=300
    )

    tools = get_qa_tools()

    prompt = PromptTemplate.from_template(
        """你是一个专业的 QA 测试工程师，擅长编写测试用例和分析测试需求。

{system_prompt}

当前问题：{input}

你可以使用以下工具：
{tools}

使用以下格式：

Thought: 你应该思考做什么
Action: 要使用的工具名称（必须是 [{tool_names}] 之一）
Action Input: 工具的输入
Observation: 工具的输出
... (这个 Thought/Action/Action Input/Observation 可以重复 N 次)
Thought: 我现在知道最终答案了
Final Answer: 对用户问题的最终回答

开始！

Thought: {agent_scratchpad}"""
    )

    agent = create_react_agent(llm, tools, prompt)
    agent_executor = AgentExecutor(
        agent=agent,
        tools=tools,
        verbose=True,
        handle_parsing_errors=True,
        max_iterations=3
    )

    return agent_executor


qa_agent = create_qa_agent()


def run_agent_with_history(session_id: str, user_input: str) -> str:
    result = qa_agent.invoke({
        "input": user_input,
        "system_prompt": SYSTEM_PROMPT
    })

    return result["output"]
