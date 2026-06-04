import os
import sqlite3
import asyncio
import threading
import uuid
import hashlib
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
from tools import get_all_tools, get_tools_with_web_search

# Redis 缓存服务
try:
    from redis_cache import cache_service
    print("[INFO] Redis 缓存服务导入成功")
except Exception as e:
    print(f"[WARN] Redis 缓存服务导入失败: {e}")
    cache_service = None

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
            # Users table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user')),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            # Messages table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
                    content TEXT NOT NULL,
                    user_id TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_session_id ON messages(session_id)
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_created_at ON messages(session_id, created_at)
            """)
            # Migration: add user_id column if missing (for existing DBs)
            try:
                conn.execute("ALTER TABLE messages ADD COLUMN user_id TEXT DEFAULT NULL")
            except sqlite3.OperationalError:
                pass  # column already exists
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_user_id ON messages(user_id)
            """)
            conn.commit()

        # Seed default admin if SEED_ADMIN env var is set (or no users exist in dev)
        seed_admin = os.getenv("SEED_ADMIN", "")
        if seed_admin and len(self.list_users()) == 0:
            parts = seed_admin.split(":")
            if len(parts) >= 2:
                self.add_user(parts[0], parts[1], parts[2] if len(parts) > 2 else "admin")
                print(f"[INFO] Seeded admin user: {parts[0]}")

    def _get_conn(self):
        """获取数据库连接（线程安全）"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    @staticmethod
    def _hash_password(password: str) -> str:
        """SHA-256 hash (simpler than bcrypt for internal tool, no extra dependency)"""
        return hashlib.sha256(password.encode()).hexdigest()

    def add_user(self, username: str, password: str, role: str = "user") -> dict:
        """创建用户，返回用户信息"""
        user_id = str(uuid.uuid4())
        with self._get_conn() as conn:
            conn.execute(
                "INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)",
                (user_id, username, self._hash_password(password), role)
            )
            conn.commit()
        return {"id": user_id, "username": username, "role": role}

    def verify_user(self, username: str, password: str) -> Optional[dict]:
        """验证用户凭据，成功返回用户信息，失败返回 None"""
        with self._get_conn() as conn:
            row = conn.execute(
                "SELECT id, username, password_hash, role FROM users WHERE username = ?",
                (username,)
            ).fetchone()
        if row and row["password_hash"] == self._hash_password(password):
            return {"id": row["id"], "username": row["username"], "role": row["role"]}
        return None

    def list_users(self) -> List[dict]:
        """列出所有用户"""
        with self._get_conn() as conn:
            rows = conn.execute(
                "SELECT id, username, role, created_at FROM users ORDER BY created_at ASC"
            ).fetchall()
        return [dict(row) for row in rows]

    def delete_user(self, user_id: str) -> bool:
        """删除用户，不能删除最后一个 admin"""
        with self._get_conn() as conn:
            # Check if this is the last admin
            admin_count = conn.execute(
                "SELECT COUNT(*) as cnt FROM users WHERE role = 'admin'"
            ).fetchone()["cnt"]
            target = conn.execute(
                "SELECT role FROM users WHERE id = ?", (user_id,)
            ).fetchone()
            if target and target["role"] == "admin" and admin_count <= 1:
                return False  # refuse to delete last admin
            conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
            conn.commit()
        return True

    def change_password(self, user_id: str, new_password: str):
        """修改用户密码"""
        with self._get_conn() as conn:
            conn.execute(
                "UPDATE users SET password_hash = ? WHERE id = ?",
                (self._hash_password(new_password), user_id)
            )
            conn.commit()

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

    def add_message(self, session_id: str, role: str, content: str, user_id: str = None):
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
                    "INSERT INTO messages (session_id, role, content, user_id) VALUES (?, ?, ?, ?)",
                    (session_id, role, content, user_id)
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

    def list_sessions(self, user_id: str = None, is_admin: bool = False) -> List[dict]:
        """列出会话。普通用户只看自己的，admin 看全部。无 user_id 的消息（旧数据）对所有已验证用户可见。"""
        with self._get_conn() as conn:
            if is_admin or not user_id:
                rows = conn.execute("""
                    SELECT session_id,
                           MIN(created_at) as created_at,
                           MAX(created_at) as updated_at,
                           COUNT(*) as message_count
                    FROM messages
                    GROUP BY session_id
                    ORDER BY updated_at DESC
                """).fetchall()
            else:
                rows = conn.execute("""
                    SELECT session_id,
                           MIN(created_at) as created_at,
                           MAX(created_at) as updated_at,
                           COUNT(*) as message_count
                    FROM messages
                    WHERE user_id = ? OR user_id IS NULL
                    GROUP BY session_id
                    ORDER BY updated_at DESC
                """, (user_id,)).fetchall()
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
    
    # 尝试从缓存获取答案
    cached_result = None
    if cache_service and cache_service.is_enabled():
        cached_result = cache_service.get(user_input, session_id)
    
    if cached_result:
        print(f"[DEBUG] 命中缓存，直接返回")
        conversation_history.add_message(session_id, "assistant", cached_result["answer"])
        return cached_result["answer"]
    
    history_text = conversation_history.format_history(session_id)
    
    if history_text and history_text != "（无历史对话）":
        user_input_with_history = f"历史对话：\n{history_text}\n\n当前请求：{user_input}"
    else:
        user_input_with_history = user_input
    
    prefix = INTENT_RESPONSES.get(intent)
    if prefix:
        result = handle_intent(intent, user_input_with_history)
        final_result = f"{prefix}\n\n{result}"
    else:
        result = handle_intent(intent, user_input_with_history)
        final_result = result
    
    # 将答案写入缓存
    if cache_service and cache_service.is_enabled():
        cache_service.set(user_input, final_result, session_id, intent.name)
    
    return final_result


# ==================== 流式输出 ====================

async def stream_chat_response(session_id: str, user_input: str, mode: str = "default", user_id: str = None, web_search_mode: bool = False) -> AsyncGenerator[str, None]:
    """
    真正的 token 级流式输出生成器

    - 意图明确的请求（TEST_CASE/TEST_PLAN/CHAT 等）：直接从 LLM 逐 token 流式输出
    - RAG 问答：先检索知识库，再流式输出结果
    - 代码分析（需工具调用）：先通过 AgentExecutor 执行工具，再分块输出结果
    - 支持 Redis 缓存：优先检查缓存，命中则直接返回
    - 支持网络搜索模式：通过 web_search_mode 参数控制是否启用网络搜索工具
    """
    print(f"[DEBUG] === stream_chat_response 参数 ===")
    print(f"[DEBUG] session_id: {session_id}")
    print(f"[DEBUG] user_input: {user_input}")
    print(f"[DEBUG] mode: {mode}")
    print(f"[DEBUG] user_id: {user_id}")
    print(f"[DEBUG] web_search_mode: {web_search_mode}")
    
    intent = detect_intent(user_input)
    print(f"[DEBUG] 检测到的意图: {intent}")
    
    # 尝试从缓存获取答案（流式模式下也支持缓存）
    if cache_service and cache_service.is_enabled():
        cached_result = cache_service.get(user_input, session_id)
        if cached_result:
            print(f"[DEBUG] 流式输出命中缓存，直接返回")
            conversation_history.add_message(session_id, "assistant", cached_result["answer"], user_id=user_id)
            yield cached_result["answer"]
            return
    
    llm = get_llm()

    # 如果 mode 为 "rag"，强制使用 RAG 模式
    if mode == "rag":
        intent = Intent.RAG_QA
        print(f"[DEBUG] 强制使用 RAG 模式")

    # 拼接历史对话上下文
    history_text = conversation_history.format_history(session_id)
    if history_text and history_text != "（无历史对话）":
        user_input_with_history = f"历史对话：\n{history_text}\n\n当前请求：{user_input}"
    else:
        user_input_with_history = user_input

    # ── RAG 问答：先检索再输出 ──
    if intent == Intent.RAG_QA:
        print(f"[DEBUG] 使用 RAG 模式")
        if rag_service:
            print(f"[DEBUG] RAG 服务可用，执行查询")
            rag_result = rag_service.query(user_input_with_history)
            print(f"[DEBUG] RAG 查询结果: {rag_result}")
            if rag_result["success"]:
                answer = rag_result["answer"]
                # 将答案写入缓存
                if cache_service and cache_service.is_enabled():
                    cache_service.set(user_input, answer, session_id, intent.name)
                conversation_history.add_message(session_id, "assistant", answer, user_id=user_id)
                yield answer
                return
        # RAG 不可用时回退到普通对话
        intent = Intent.CHAT
        print(f"[DEBUG] RAG 不可用，回退到普通对话")

    # ── 代码分析（需要工具）：先执行 AgentExecutor 再分块输出 ──
    if intent == Intent.CODE_ANALYSIS:
        prefix = INTENT_RESPONSES.get(intent)
        if prefix:
            yield prefix + "\n\n"
        result = run_agent_with_tools(session_id, user_input_with_history, web_search_mode=web_search_mode)
        # 将答案写入缓存
        if cache_service and cache_service.is_enabled():
            full_result = (prefix + "\n\n" if prefix else "") + result
            cache_service.set(user_input, full_result, session_id, intent.name)
        conversation_history.add_message(session_id, "assistant", result, user_id=user_id)
        # AgentExecutor 不支持流式，分块输出（chunk_size=3 接近 token 级别）
        for i in range(0, len(result), 3):
            yield result[i:i+3]
            await asyncio.sleep(0.01)
        return

    # ── 普通意图 + 测试用例/计划/执行：真正的 LLM 流式输出 ──
    # 如果启用了网络搜索模式，使用 AgentExecutor 处理所有请求
    if web_search_mode:
        print(f"[DEBUG] 网络搜索模式已开启，使用 AgentExecutor 处理")
        prefix = INTENT_RESPONSES.get(intent)
        if prefix:
            yield prefix + "\n\n"
        result = run_agent_with_tools(session_id, user_input_with_history, web_search_mode=True)
        # 将答案写入缓存
        if cache_service and cache_service.is_enabled():
            full_result = (prefix + "\n\n" if prefix else "") + result
            cache_service.set(user_input, full_result, session_id, intent.name)
        conversation_history.add_message(session_id, "assistant", result, user_id=user_id)
        # 分块输出
        for i in range(0, len(result), 3):
            yield result[i:i+3]
            await asyncio.sleep(0.01)
        return

    # 普通模式：直接调用 LLM
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

    # 添加前缀到完整响应
    if prefix:
        full_response = prefix + "\n\n" + full_response

    # 将答案写入缓存
    if cache_service and cache_service.is_enabled():
        cache_service.set(user_input, full_response, session_id, intent.name)

    conversation_history.add_message(session_id, "assistant", full_response, user_id=user_id)


# ==================== Agent Executor 工具调用 ====================


def run_agent_with_tools(session_id: str, user_input: str, web_search_mode: bool = False) -> str:
    """
    使用简单的工具调用机制，直接在提示中包含工具信息
    :param web_search_mode: 是否启用网络搜索模式
    """
    llm = get_llm()
    # 根据配置获取工具列表
    tools = get_tools_with_web_search(enable_web_search=web_search_mode)
    
    print(f"[DEBUG] 工具列表: {[tool.name for tool in tools]}")

    # 创建工具映射
    tool_map = {tool.name: tool for tool in tools}
    
    # 获取对话历史
    history_text = conversation_history.format_history(session_id)
    
    # 创建工具描述（转义描述中的花括号以避免 f-string 格式冲突）
    tools_description = "\n".join([f"- {tool.name}: {tool.description.replace('{', '{{').replace('}', '}}')}" for tool in tools])
    tool_names = ", ".join([tool.name for tool in tools])

    # 创建完整提示
    prompt_text = f"""你是一位拥有10年经验的资深QA测试工程师，精通软件测试理论和实践。

工具使用策略：
- get_current_datetime（日期时间工具）：当用户询问当前日期、时间、星期几时使用，例如：
  - "今天是几号"
  - "现在几点了"
  - "今天星期几"
- web_search（网络搜索工具）：当遇到时效性问题、需要获取最新信息时使用，例如：
  - 新闻查询、时事热点
  - 最新技术动态、版本更新
  - 需要实时数据的问题（天气、汇率等）
  - 你的知识截止日期之后发生的事件

重要提醒：
- 当用户询问当前日期、时间、星期几时，必须使用 get_current_datetime 工具
- 当用户询问其他时效性问题时，使用 web_search 工具
- 不要使用你的内部知识回答时效性问题，必须通过工具获取最新信息

可用工具：
{tools_description}

工具名称列表：{tool_names}

历史对话：
{history_text}

用户请求：{user_input}

请按照以下格式回答：
1. 如果需要调用工具，输出：TOOL_CALL:<工具名称>:<JSON参数>
   例如：TOOL_CALL:get_current_datetime:{{}}  或  TOOL_CALL:web_search:{{{{"query": "人工智能最新发展"}}}}
2. 如果不需要调用工具，直接回答用户的问题

注意：
- 只有在需要获取外部信息时才调用工具
- 调用工具时，参数必须是有效的JSON格式（无参数时使用 {{}}）
- 如果调用工具，我会执行工具并返回结果，然后你可以基于结果进行回答"""

    # 获取 LLM 响应
    messages = [
        {"role": "system", "content": "你是一个智能助手，可以调用工具来回答问题"},
        {"role": "user", "content": prompt_text}
    ]
    
    response = llm.invoke(messages)
    response_text = response.content
    
    print(f"[DEBUG] LLM 响应: {response_text}")
    
    # 检查是否需要调用工具
    if response_text.startswith("TOOL_CALL:"):
        try:
            # 解析工具调用
            tool_call = response_text[10:]  # 去掉 "TOOL_CALL:"
            parts = tool_call.split(":", 1)
            tool_name = parts[0]
            tool_args = parts[1] if len(parts) > 1 else "{}"
            
            # 解析 JSON 参数
            import json
            args = json.loads(tool_args)
            
            # 调用工具
            if tool_name in tool_map:
                print(f"[DEBUG] 调用工具: {tool_name}, 参数: {args}")
                tool_result = tool_map[tool_name]._run(**args)
                print(f"[DEBUG] 工具返回结果: {tool_result[:100]}...")
                
                # 基于工具结果生成最终回答
                final_prompt = f"""基于以下工具执行结果，回答用户问题：

用户问题：{user_input}

工具执行结果：
{tool_result}

请用自然、友好的语言总结工具结果并回答用户问题。"""
                
                final_response = llm.invoke([{"role": "user", "content": final_prompt}])
                return final_response.content
            else:
                return f"未知工具: {tool_name}"
        except Exception as e:
            print(f"[WARN] 工具调用失败: {e}")
            return f"工具调用失败: {str(e)}"
    else:
        # 直接返回回答
        return response_text
