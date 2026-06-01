import os
from typing import Dict, List
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_react_agent
from langchain.prompts import PromptTemplate
from langchain.tools import Tool
from config import get_llm_config
from intent_detector import Intent, detect_intent, INTENT_RESPONSES

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

TEST_PLAN_PROMPT = """你是一位拥有10年经验的资深QA测试经理，精通测试计划制定和测试管理。

你的专长：
1. 制定完整的测试计划（Test Plan）
2. 定义测试范围、策略和方法
3. 规划测试资源、进度和里程碑
4. 识别测试风险并制定应对策略
5. 协调测试团队工作

输出规范：
1. 测试计划应包含：测试范围、测试目标、测试策略、资源计划、进度安排、风险评估
2. 使用Markdown格式输出，层次清晰
3. 包含具体的里程碑和时间节点

请根据用户需求制定专业的测试计划。"""

CODE_ANALYSIS_PROMPT = """你是一位代码质量专家，精通静态代码分析和代码审查。

你的专长：
1. 静态代码分析（代码异味检测）
2. 代码可维护性评估
3. 潜在缺陷和漏洞识别
4. 代码复杂度分析
5. 编码规范合规性检查

输出规范：
1. 分析结果应包含：代码质量评分、问题列表、改进建议
2. 按严重程度分类（Critical/Major/Minor）
3. 提供具体的代码示例和改进方案

请提供待分析的代码，我将进行专业审查。"""

RAG_QA_PROMPT = """你是一个基于知识库的智能问答助手。

你的职责：
1. 基于给定的文档/知识库内容回答用户问题
2. 如果知识库中没有相关信息，明确告知用户
3. 引用相关文档片段来支撑你的回答

请提供您的问题和相关的知识库内容。"""

RUN_TESTS_PROMPT = """你是一个测试执行引擎，负责协调和执行测试用例。

你的职责：
1. 接收测试用例列表
2. 模拟执行测试用例
3. 记录测试结果（通过/失败/阻塞）
4. 生成测试执行报告

输入格式：
- 测试用例列表（通常是多条TC_开头的用例）
- 每个用例应包含：用例编号、操作步骤、预期结果

输出格式：
| 用例编号 | 执行状态 | 实际结果 | 备注 |
|---------|---------|---------|------|
| TC_001 | 通过/失败/阻塞 | 实际观察到的结果 | 失败原因等 |

请提供要执行的测试用例。"""

CHAT_PROMPT = """你是一个友好的AI助手，可以回答各种问题并与用户进行日常对话。

你的特点：
1. 回答友好、耐心
2. 善于解释复杂的概念
3. 可以讨论技术、生活、学习等话题

请与用户进行自然的对话。"""


def get_llm(temperature: float = 0.7):
    llm_config = get_llm_config()
    return ChatOpenAI(
        model=llm_config["model"],
        temperature=temperature,
        openai_api_key=llm_config["api_key"],
        openai_api_base=llm_config["api_base"],
        request_timeout=300
    )


def run_qa_agent(user_input: str) -> str:
    llm = get_llm(0.7)

    tools = [
        Tool(
            name="generate_test_cases",
            func=lambda x: f"已收到测试需求：{x}。正在生成测试用例...",
            description="根据功能描述生成测试用例"
        ),
        Tool(
            name="analyze_requirements",
            func=lambda x: f"已收到需求文档：{x}。正在分析测试要点...",
            description="分析需求文档，提取测试要点"
        )
    ]

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

    result = agent_executor.invoke({
        "input": user_input,
        "system_prompt": SYSTEM_PROMPT
    })
    return result["output"]


def run_simple_llm(prompt: str, user_input: str, temperature: float = 0.7) -> str:
    llm = get_llm(temperature)
    full_prompt = f"{prompt}\n\n用户问题：{user_input}"
    response = llm.invoke(full_prompt)
    return response.content


def handle_intent(intent: Intent, user_input: str) -> str:
    if intent == Intent.TEST_CASE:
        return run_qa_agent(user_input)

    elif intent == Intent.TEST_PLAN:
        return run_simple_llm(TEST_PLAN_PROMPT, user_input)

    elif intent == Intent.CODE_ANALYSIS:
        return run_simple_llm(CODE_ANALYSIS_PROMPT, user_input)

    elif intent == Intent.RAG_QA:
        return run_simple_llm(RAG_QA_PROMPT, user_input)

    elif intent == Intent.RUN_TESTS:
        return run_simple_llm(RUN_TESTS_PROMPT, user_input)

    else:
        return run_simple_llm(CHAT_PROMPT, user_input)


def run_agent_with_history(session_id: str, user_input: str) -> str:
    intent = detect_intent(user_input)

    prefix = INTENT_RESPONSES.get(intent)
    if prefix:
        result = handle_intent(intent, user_input)
        return f"{prefix}\n\n{result}"

    return handle_intent(intent, user_input)
