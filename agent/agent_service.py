import os
import sqlite3
import asyncio
import threading
from typing import Dict, List, Optional, AsyncGenerator
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_react_agent
from langchain.prompts import PromptTemplate
from langchain.tools import Tool
from langchain.chains import LLMChain
from langchain.memory import ConversationBufferMemory
from langchain.schema import messages_to_dict, messages_from_dict, HumanMessage, AIMessage, SystemMessage
from config import get_llm_config
from intent_detector import Intent, detect_intent, INTENT_RESPONSES
from tools import get_all_tools

for key in ["http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY",
            "all_proxy", "ALL_PROXY", "no_proxy", "NO_PROXY"]:
    os.environ.pop(key, None)

# SQLite 数据库路径
DB_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "data", "conversations.db"
)


class ConversationHistory:
    """会话历史管理，基于 SQLite 持久化存储，兼容 LangChain ConversationBufferMemory 接口"""

    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        self._lock = threading.Lock()
        self._memory_cache: Dict[str, ConversationBufferMemory] = {}
        self._init_db()

    def _init_db(self):
        """初始化数据库表"""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        with self._get_conn() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
                    content TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_session_id ON messages(session_id)
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_created_at ON messages(session_id, created_at)
            """)
            conn.commit()

    def _get_conn(self):
        """获取数据库连接（线程安全）"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _load_messages(self, session_id: str) -> List[dict]:
        """从数据库加载会话消息"""
        with self._get_conn() as conn:
            rows = conn.execute(
                "SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC",
                (session_id,)
            ).fetchall()
        return [{"role": row["role"], "content": row["content"]} for row in rows]

    def get_memory(self, session_id: str) -> ConversationBufferMemory:
        """获取会话的 ConversationBufferMemory（优先缓存，否则从 DB 重建）"""
        if session_id not in self._memory_cache:
            memory = ConversationBufferMemory(
                memory_key="chat_history",
                return_messages=True,
                max_token_limit=4096
            )
            # 从 DB 恢复历史消息
            for msg in self._load_messages(session_id):
                if msg["role"] == "user":
                    memory.chat_memory.add_user_message(msg["content"])
                else:
                    memory.chat_memory.add_ai_message(msg["content"])
            self._memory_cache[session_id] = memory
        return self._memory_cache[session_id]

    def add_message(self, session_id: str, role: str, content: str):
        """添加消息并持久化"""
        with self._lock:
            # 确保 memory 已加载
            self.get_memory(session_id)
            memory = self._memory_cache[session_id]
            if role == "user":
                memory.chat_memory.add_user_message(content)
            else:
                memory.chat_memory.add_ai_message(content)

            # 持久化到 SQLite
            with self._get_conn() as conn:
                conn.execute(
                    "INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)",
                    (session_id, role, content)
                )
                conn.commit()

    def get_history(self, session_id: str) -> List[dict]:
        """获取会话历史（优先缓存，否则从 DB 加载）"""
        if session_id in self._memory_cache:
            messages = self._memory_cache[session_id].chat_memory.messages
            return messages_to_dict(messages)

        # 从 DB 加载并格式化
        db_messages = self._load_messages(session_id)
        langchain_messages = []
        for msg in db_messages:
            if msg["role"] == "user":
                langchain_messages.append(HumanMessage(content=msg["content"]))
            else:
                langchain_messages.append(AIMessage(content=msg["content"]))
        return messages_to_dict(langchain_messages)

    def clear_history(self, session_id: str):
        """清除会话历史（内存 + DB）"""
        with self._lock:
            if session_id in self._memory_cache:
                del self._memory_cache[session_id]
            with self._get_conn() as conn:
                conn.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
                conn.commit()

    def format_history(self, session_id: str) -> str:
        """格式化最近 6 条历史消息"""
        history = self.get_history(session_id)
        if not history:
            return "（无历史对话）"
        formatted = []
        for msg in history[-6:]:
            role = "用户" if msg["type"] == "human" else "助手"
            formatted.append(f"{role}: {msg['data']['content']}")
        return "\n".join(formatted)

    def list_sessions(self) -> List[dict]:
        """列出所有会话（用于前端会话列表）"""
        with self._get_conn() as conn:
            rows = conn.execute("""
                SELECT session_id,
                       MIN(created_at) as created_at,
                       MAX(created_at) as updated_at,
                       COUNT(*) as message_count
                FROM messages
                GROUP BY session_id
                ORDER BY updated_at DESC
            """).fetchall()
        return [dict(row) for row in rows]


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


# ==================== 流式输出 ====================

async def stream_chat_response(session_id: str, user_input: str) -> AsyncGenerator[str, None]:
    """
    真正的 token 级流式输出生成器

    - 意图明确的请求（TEST_CASE/TEST_PLAN/CHAT 等）：直接从 LLM 逐 token 流式输出
    - RAG 问答：先检索知识库，再流式输出结果
    - 代码分析（需工具调用）：先通过 AgentExecutor 执行工具，再分块输出结果
    """
    intent = detect_intent(user_input)
    llm = get_llm()

    # 拼接历史对话上下文
    history_text = conversation_history.format_history(session_id)
    if history_text and history_text != "（无历史对话）":
        user_input_with_history = f"历史对话：\n{history_text}\n\n当前请求：{user_input}"
    else:
        user_input_with_history = user_input

    # ── RAG 问答：先检索再输出 ──
    if intent == Intent.RAG_QA:
        if rag_service:
            rag_result = rag_service.query(user_input_with_history)
            if rag_result["success"]:
                answer = rag_result["answer"]
                conversation_history.add_message(session_id, "assistant", answer)
                yield answer
                return
        # RAG 不可用时回退到普通对话
        intent = Intent.CHAT

    # ── 代码分析（需要工具）：先执行 AgentExecutor 再分块输出 ──
    if intent == Intent.CODE_ANALYSIS:
        prefix = INTENT_RESPONSES.get(intent)
        if prefix:
            yield prefix + "\n\n"
        result = run_agent_with_tools(session_id, user_input_with_history)
        conversation_history.add_message(session_id, "assistant", result)
        # AgentExecutor 不支持流式，分块输出（chunk_size=3 接近 token 级别）
        for i in range(0, len(result), 3):
            yield result[i:i+3]
            await asyncio.sleep(0.01)
        return

    # ── 普通意图 + 测试用例/计划/执行：真正的 LLM 流式输出 ──
    prefix = INTENT_RESPONSES.get(intent)
    if prefix:
        yield prefix + "\n\n"

    # 选择对应的 Prompt 模板
    prompt_map = {
        Intent.TEST_CASE: TEST_CASE_PROMPT,
        Intent.TEST_PLAN: TEST_PLAN_PROMPT,
        Intent.RUN_TESTS: RUN_TESTS_PROMPT,
        Intent.CHAT: CHAT_PROMPT,
        Intent.CODE_ANALYSIS: CODE_ANALYSIS_PROMPT,
    }
    prompt_template = prompt_map.get(intent, CHAT_PROMPT)

    # 构建消息（SystemMessage + 用户请求）
    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=prompt_template.format(user_input=user_input_with_history))
    ]

    # 真正的 token 级流式输出
    full_response = ""
    try:
        async for chunk in llm.astream(messages):
            if chunk.content:
                yield chunk.content
                full_response += chunk.content
    except Exception as e:
        error_msg = f"\n\n[流式生成中断: {e}]"
        yield error_msg
        full_response += error_msg

    conversation_history.add_message(session_id, "assistant", full_response)


# ==================== Agent Executor 工具调用 ====================

REACT_SYSTEM_PROMPT = """你是一位拥有10年经验的资深QA测试工程师，精通软件测试理论和实践。

你的专长：
1. 熟练掌握IEEE 829测试文档标准
2. 擅长编写各类测试用例（功能测试、边界测试、异常测试、性能测试）
3. 熟悉常见的测试方法和策略（等价类划分、边界值分析、决策表测试、状态转换测试）
4. 了解Agile、Scrum等敏捷开发模式中的测试实践

你有以下工具可以调用：
{tools}

工具名称：{tool_names}

使用工具时，请严格遵循以下格式：
Question: 用户的请求
Thought: 分析用户请求，判断是否需要调用工具
Action: 工具名称（必须是 [{tool_names}] 中的一个）
Action Input: 工具参数，必须是合法的 JSON 格式
Observation: 工具返回的结果
... (Thought/Action/Action Input/Observation 可重复)
Thought: 我已获得足够信息来回答
Final Answer: 最终回答

注意：
- Action Input 必须是单行 JSON，例如：{{"commit_id": "abc123"}}
- 如果不需要调用工具，直接给出 Final Answer
- 回答使用中文，专业、清晰

开始！

{chat_history}

Question: {input}
{agent_scratchpad}"""


def run_agent_with_tools(session_id: str, user_input: str) -> str:
    """
    使用 LangChain AgentExecutor 执行工具增强的 Agent
    通过 create_react_agent 实现结构化的工具调用，
    替换了之前脆弱的正则解析方式
    """
    llm = get_llm()
    tools = get_all_tools()

    # 获取对话历史
    memory = conversation_history.get_memory(session_id)

    # 使用 LangChain 的 create_react_agent 创建 ReAct Agent
    prompt = PromptTemplate.from_template(REACT_SYSTEM_PROMPT)
    agent = create_react_agent(llm=llm, tools=tools, prompt=prompt)

    agent_executor = AgentExecutor(
        agent=agent,
        tools=tools,
        memory=memory,
        verbose=True,
        handle_parsing_errors=True,
        max_iterations=5,
    )

    try:
        result = agent_executor.invoke({"input": user_input})
        return result.get("output", "Agent 未能生成有效输出")
    except Exception as e:
        print(f"[WARN] AgentExecutor 执行失败，回退到意图模式: {e}")
        return run_agent_with_history(session_id, user_input)
