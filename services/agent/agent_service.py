import os
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_react_agent
from langchain.prompts import PromptTemplate
from langchain.tools import Tool
from config import OPENAI_API_KEY, OPENAI_API_BASE, MODEL_NAME

os.environ.pop("http_proxy", None)
os.environ.pop("https_proxy", None)
os.environ.pop("HTTP_PROXY", None)
os.environ.pop("HTTPS_PROXY", None)


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
    llm = ChatOpenAI(
        model=MODEL_NAME,
        temperature=0.7,
        openai_api_key=OPENAI_API_KEY,
        openai_api_base=OPENAI_API_BASE
    )
    
    tools = get_qa_tools()
    
    prompt = PromptTemplate.from_template(
        """你是一个专业的 QA 测试工程师，擅长编写测试用例和分析测试需求。

你可以使用以下工具：
{tools}

使用以下格式：

Question: 用户的问题
Thought: 你应该思考做什么
Action: 要使用的工具名称（必须是 [{tool_names}] 之一）
Action Input: 工具的输入
Observation: 工具的输出
... (这个 Thought/Action/Action Input/Observation 可以重复 N 次)
Thought: 我现在知道最终答案了
Final Answer: 对用户问题的最终回答

开始！

Question: {input}
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
