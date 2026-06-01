import os
from typing import Dict, List, Optional
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_react_agent
from langchain.prompts import PromptTemplate
from langchain.tools import Tool
from langchain.chains import LLMChain
from langchain.memory import ConversationBufferMemory
from langchain.schema import messages_to_dict, messages_from_dict
from config import get_llm_config
from intent_detector import Intent, detect_intent, INTENT_RESPONSES

for key in ["http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY",
            "all_proxy", "ALL_PROXY", "no_proxy", "NO_PROXY"]:
    os.environ.pop(key, None)


class ConversationHistory:
    def __init__(self):
        self.sessions: Dict[str, ConversationBufferMemory] = {}

    def get_memory(self, session_id: str) -> ConversationBufferMemory:
        if session_id not in self.sessions:
            self.sessions[session_id] = ConversationBufferMemory(
                memory_key="chat_history",
                return_messages=True,
                max_token_limit=4096
            )
        return self.sessions[session_id]

    def add_message(self, session_id: str, role: str, content: str):
        memory = self.get_memory(session_id)
        if role == "user":
            memory.chat_memory.add_user_message(content)
        else:
            memory.chat_memory.add_ai_message(content)

    def get_history(self, session_id: str) -> List[dict]:
        if session_id not in self.sessions:
            return []
        messages = self.sessions[session_id].chat_memory.messages
        return messages_to_dict(messages)

    def clear_history(self, session_id: str):
        if session_id in self.sessions:
            del self.sessions[session_id]

    def format_history(self, session_id: str) -> str:
        history = self.get_history(session_id)
        if not history:
            return "（无历史对话）"
        formatted = []
        for msg in history[-6:]:
            role = "用户" if msg["type"] == "human" else "助手"
            formatted.append(f"{role}: {msg['data']['content']}")
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


TEST_CASE_PROMPT = """你是一位专业的测试工程师，请根据以下用户需求生成详细的测试用例：

用户需求：{user_input}

请按照以下格式输出测试用例：
| 用例编号 | 用例名称 | 前置条件 | 操作步骤 | 预期结果 | 优先级 |
|---------|---------|---------|---------|---------|--------|
| TC_001 | ... | ... | ... | ... | P0/P1/P2 |

请确保覆盖：
1. 正常业务流程测试
2. 边界条件测试
3. 异常场景测试
4. 数据完整性测试

测试用例数量建议：5-15条。"""


TEST_PLAN_PROMPT = """你是一位资深测试经理，请根据以下项目信息制定完整的测试计划：

项目信息：{user_input}

测试计划应包含以下部分：
1. 测试范围与目标
2. 测试策略（功能测试、性能测试、安全测试等）
3. 测试资源与环境
4. 测试进度与里程碑
5. 风险评估与应对措施
6. 测试交付物

请输出结构化的测试计划文档。"""


CODE_ANALYSIS_PROMPT = """你是一位代码质量专家，请对以下代码进行全面分析：

代码内容：{user_input}

分析维度：
1. 代码结构与可读性
2. 潜在缺陷与安全漏洞
3. 性能优化建议
4. 代码复杂度评估
5. 编码规范合规性

请输出详细的分析报告和改进建议。"""


RAG_QA_PROMPT = """请根据知识库内容回答用户问题：

用户问题：{user_input}

知识库内容：
{context}

请基于知识库内容进行回答，如果知识库中没有相关信息，请明确说明。"""


RUN_TESTS_PROMPT = """请执行以下测试用例并返回执行结果：

测试用例：{user_input}

输出格式：
| 用例编号 | 执行状态 | 实际结果 | 备注 |
|---------|---------|---------|------|
| TC_001 | 通过/失败/阻塞 | ... | ... |"""


CHAT_PROMPT = """请友好地回答用户问题：

用户问题：{user_input}

回答要求：
1. 友好、自然
2. 信息准确
3. 如有必要，提供详细解释"""


def get_llm():
    llm_config = get_llm_config()
    return ChatOpenAI(
        model=llm_config["model"],
        temperature=0.7,
        openai_api_key=llm_config["api_key"],
        openai_api_base=llm_config["api_base"],
        request_timeout=300
    )


def run_simple_llm(prompt_template: str, user_input: str, context: Optional[str] = None) -> str:
    llm = get_llm()
    prompt = PromptTemplate.from_template(prompt_template)
    chain = LLMChain(llm=llm, prompt=prompt)
    
    if context:
        result = chain.run(user_input=user_input, context=context)
    else:
        result = chain.run(user_input=user_input)
    
    return result


rag_service = None

try:
    from rag_service import rag_service
    rag_service.initialize()
    print("[INFO] RAG 服务初始化成功")
except Exception as e:
    print(f"[WARN] RAG 服务初始化失败: {e}")


def handle_intent(intent: Intent, user_input: str) -> str:
    if intent == Intent.TEST_CASE:
        return run_simple_llm(TEST_CASE_PROMPT, user_input)
    
    elif intent == Intent.TEST_PLAN:
        return run_simple_llm(TEST_PLAN_PROMPT, user_input)
    
    elif intent == Intent.CODE_ANALYSIS:
        return run_simple_llm(CODE_ANALYSIS_PROMPT, user_input)
    
    elif intent == Intent.RAG_QA:
        if rag_service:
            rag_result = rag_service.query(user_input)
            if rag_result["success"]:
                return rag_result["answer"]
            else:
                return f"RAG 查询失败: {rag_result['answer']}"
        else:
            return "RAG 服务未初始化，请先添加文档到 document 目录"
    
    elif intent == Intent.RUN_TESTS:
        return run_simple_llm(RUN_TESTS_PROMPT, user_input)
    
    else:
        return run_simple_llm(CHAT_PROMPT, user_input)


def run_agent_with_history(session_id: str, user_input: str) -> str:
    intent = detect_intent(user_input)
    
    history_text = conversation_history.format_history(session_id)
    
    if history_text and history_text != "（无历史对话）":
        user_input_with_history = f"历史对话：\n{history_text}\n\n当前请求：{user_input}"
    else:
        user_input_with_history = user_input
    
    prefix = INTENT_RESPONSES.get(intent)
    if prefix:
        result = handle_intent(intent, user_input_with_history)
        return f"{prefix}\n\n{result}"
    
    return handle_intent(intent, user_input_with_history)
