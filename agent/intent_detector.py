import os
from typing import Dict, List, Optional
from enum import Enum
import numpy as np

try:
    from transformers import AutoTokenizer, AutoModel
    USE_TRANSFORMERS = True
except ImportError:
    USE_TRANSFORMERS = False
    print("[WARN] transformers not installed, using keyword matching only")


class Intent(Enum):
    CHAT = "CHAT"
    TEST_CASE = "TEST_CASE"
    TEST_PLAN = "TEST_PLAN"
    CODE_ANALYSIS = "CODE_ANALYSIS"
    RAG_QA = "RAG_QA"
    RUN_TESTS = "RUN_TESTS"


INTENT_PATTERNS = {
    Intent.TEST_CASE: [
        "生成测试用例",
        "编写测试用例",
        "测试用例",
        "test case",
        "tc_",
        "用例编号",
        "前置条件",
        "操作步骤",
        "预期结果",
        "边界测试",
        "等价类",
        "设计测试用例",
        "测试场景",
        "设计测试",
        "设计一些测试",
        "测试设计",
        "测试方案",
        "测试点",
        "测试覆盖",
        "功能测试",
        "单元测试",
        "集成测试",
    ],
    Intent.TEST_PLAN: [
        "测试计划",
        "test plan",
        "测试策略",
        "测试范围",
        "测试进度",
        "风险评估",
        "资源计划",
        "测试里程碑",
        "测试方案",
    ],
    Intent.CODE_ANALYSIS: [
        "代码分析",
        "code analysis",
        "代码审查",
        "code review",
        "静态分析",
        "代码质量",
        "代码缺陷",
        "圈复杂度",
        "代码覆盖率",
        "分析这段代码",
    ],
    Intent.RAG_QA: [
        "知识库问答",
        "rag",
        "检索问答",
        "文档问答",
        "基于文档",
        "参考文档",
        "根据文档",
        "根据知识库",
        "查找知识库",
        "常见问题",
        "FAQ",
        "知识库中的内容",
        "基于知识库",
        "从知识库",
        # Natural document-query patterns (personnel/org info)
        "职位",
        "岗位",
        "部门",
        "简历",
        "员工",
        "同事",
        "入职",
        # Document lookup patterns
        "查一下",
        "查一查",
        "帮我查",
        "帮我找",
        "资料",
        "知识库",
    ],
    Intent.RUN_TESTS: [
        "执行测试",
        "运行测试",
        "run test",
        "测试执行",
        "自动化测试",
        "批量执行",
        "测试运行",
        "开始测试",
    ],
    Intent.CHAT: [
        "聊聊天",
        "你好",
        "天气",
        "解释一下",
        "什么是",
        "为什么",
        "怎么实现",
        "介绍一下",
        "问题",
    ],
}

MODEL_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "embedding_models",
    "all-MiniLM-L6-v2"
)

_tokenizer = None
_model = None
_model_load_failed = False


def get_model():
    global _tokenizer, _model, _model_load_failed

    if _model_load_failed:
        return None, None

    if _model is None and USE_TRANSFORMERS:
        try:
            _tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
            _model = AutoModel.from_pretrained(MODEL_PATH)
            print(f"[INFO] Loaded local embedding model from {MODEL_PATH}")
        except Exception as e:
            print(f"[WARN] Failed to load local model: {e}")
            _model_load_failed = True
            return None, None
    return _tokenizer, _model


import torch

def mean_pooling(model_output, attention_mask):
    token_embeddings = model_output[0]
    input_mask = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
    return torch.sum(token_embeddings * input_mask, 1) / torch.clamp(input_mask.sum(1), min=1e-9)


def cosine_similarity(a: List[float], b: List[float]) -> float:
    a = np.array(a)
    b = np.array(b)
    if np.linalg.norm(a) == 0 or np.linalg.norm(b) == 0:
        return 0.0
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


def get_embedding(text: str) -> Optional[List[float]]:
    tokenizer, model = get_model()
    if tokenizer and model:
        try:
            import torch
            encoded_input = tokenizer(text, padding=True, truncation=True, return_tensors='pt')
            with torch.no_grad():
                model_output = model(**encoded_input)
            embeddings = mean_pooling(model_output, encoded_input['attention_mask'])
            embeddings = torch.nn.functional.normalize(embeddings, p=2, dim=1)
            return embeddings[0].tolist()
        except Exception as e:
            print(f"[WARN] Embedding encoding error: {e}")

    seed = sum(ord(c) for c in text)
    np.random.seed(seed)
    return np.random.randn(384).tolist()


def detect_intent_keyword(user_input: str) -> Intent:
    user_input_lower = user_input.lower()

    scores = {}
    for intent, patterns in INTENT_PATTERNS.items():
        score = 0
        for pattern in patterns:
            if pattern.lower() in user_input_lower:
                score += 1
        scores[intent] = score

    if max(scores.values()) > 0:
        return max(scores, key=scores.get)

    return Intent.CHAT


def detect_intent_embedding(user_input: str) -> Intent:
    tokenizer, model = get_model()
    if not tokenizer or not model:
        return Intent.CHAT

    user_emb = get_embedding(user_input)

    best_intent = Intent.CHAT
    best_score = -1.0

    for intent, patterns in INTENT_PATTERNS.items():
        pattern_embs = [get_embedding(p) for p in patterns[:5]]
        similarities = [cosine_similarity(user_emb, p_emb) for p_emb in pattern_embs]
        avg_sim = sum(similarities) / len(similarities) if similarities else 0

        if avg_sim > best_score:
            best_score = avg_sim
            best_intent = intent

    if best_score < 0.3:
        return Intent.CHAT

    return best_intent


def detect_intent(user_input: str, use_embedding: bool = True) -> Intent:
    keyword_result = detect_intent_keyword(user_input)

    if keyword_result != Intent.CHAT:
        return keyword_result

    if use_embedding:
        embedding_result = detect_intent_embedding(user_input)
        if embedding_result != Intent.CHAT:
            return embedding_result

    return Intent.CHAT


INTENT_RESPONSES = {
    Intent.TEST_CASE: "好的，我将为您生成专业的测试用例。让我分析需求并按照IEEE 829标准输出...",
    Intent.TEST_PLAN: "了解，我将为您制定完整的测试计划，包括测试范围、策略、资源和时间表...",
    Intent.CODE_ANALYSIS: "我将对代码进行静态分析和质量评估...",
    Intent.RAG_QA: "我将基于知识库检索来回答您的问题...",
    Intent.RUN_TESTS: "我将执行自动化测试并汇报结果...",
    Intent.CHAT: None,
}
