#!/usr/bin/env python3
import sys
sys.path.insert(0, '/home/kevin/source_code/github/qa-platform/services/agent')

from intent_detector import INTENT_SAMPLES, Intent
from transformers import AutoTokenizer, AutoModel
import torch

model_path = "/home/kevin/source_code/github/qa-platform/embedding_models/all-MiniLM-L6-v2"
tokenizer = AutoTokenizer.from_pretrained(model_path)
model = AutoModel.from_pretrained(model_path)
model.eval()

def embed_text(text):
    inputs = tokenizer(text, padding=True, truncation=True, return_tensors='pt')
    with torch.no_grad():
        outputs = model(**inputs)
    embeddings = outputs.last_hidden_state[:, 0, :]
    embeddings = torch.nn.functional.normalize(embeddings, p=2, dim=1)
    return embeddings[0].tolist()

def cosine_similarity(vec1, vec2):
    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    norm1 = sum(a * a for a in vec1) ** 0.5
    norm2 = sum(b * b for b in vec2) ** 0.5
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return dot_product / (norm1 * norm2)

def test_intent(user_input):
    print(f"\n{'='*60}")
    print(f"测试输入: {user_input}")
    print('='*60)

    text_embedding = embed_text(user_input)

    intent_scores = {}
    for intent, samples in INTENT_SAMPLES.items():
        sample_scores = []
        for sample in samples:
            sample_embedding = embed_text(sample)
            score = cosine_similarity(text_embedding, sample_embedding)
            sample_scores.append((score, sample[:40]))

        max_score = max(sample_scores)
        intent_scores[intent] = max_score[0]
        print(f"\n{intent.name}:")
        print(f"  最高分: {max_score[0]:.4f} - {max_score[1]}")
        # 显示前3个样本
        sorted_samples = sorted(sample_scores, reverse=True)[:3]
        for score, sample in sorted_samples:
            print(f"    {score:.4f} - {sample}")

    sorted_intents = sorted(intent_scores.items(), key=lambda x: x[1], reverse=True)
    print(f"\n>>> 最终结果: {sorted_intents[0][0].name} (分数: {sorted_intents[0][1]:.4f})")
    return sorted_intents[0]

if __name__ == "__main__":
    test_cases = [
        "生成登录功能的测试用例",
        "帮我写测试用例",
        "制定测试计划",
        "代码审查",
        "Analyze this codebase",
        "Run pytest on the tests",
        "查询知识库",
        "你好",
        "12345",
        "abc",
    ]

    for case in test_cases:
        test_intent(case)