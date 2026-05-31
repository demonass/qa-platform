import os
from dotenv import load_dotenv

load_dotenv()

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "qwen")

LOCAL_API_KEY = "no-key"
LOCAL_API_BASE = os.getenv("LOCAL_API_BASE", "http://localhost:8080/v1")
LOCAL_MODEL = os.getenv("LOCAL_MODEL", "qwen")

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_API_BASE = os.getenv("DEEPSEEK_API_BASE", "https://api.deepseek.com/v1")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")

QWEN_API_KEY = os.getenv("QWEN_API_KEY", "")
QWEN_API_BASE = os.getenv("QWEN_API_BASE", "https://dashscope.aliyuncs.com/compatible-mode/v1")
QWEN_MODEL = os.getenv("QWEN_MODEL", "qwen-plus")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_API_BASE = os.getenv("OPENAI_API_BASE", "https://api.openai.com/v1")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


def get_llm_config():
    if LLM_PROVIDER == "deepseek":
        return {
            "api_key": DEEPSEEK_API_KEY,
            "api_base": DEEPSEEK_API_BASE,
            "model": DEEPSEEK_MODEL,
        }
    elif LLM_PROVIDER == "qwen":
        return {
            "api_key": QWEN_API_KEY,
            "api_base": QWEN_API_BASE,
            "model": QWEN_MODEL,
        }
    elif LLM_PROVIDER == "openai":
        return {
            "api_key": OPENAI_API_KEY,
            "api_base": OPENAI_API_BASE,
            "model": OPENAI_MODEL,
        }
    else:
        return {
            "api_key": LOCAL_API_KEY,
            "api_base": LOCAL_API_BASE,
            "model": LOCAL_MODEL,
        }
