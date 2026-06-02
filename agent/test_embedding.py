#!/usr/bin/env python3
import sys
sys.path.insert(0, '/home/kevin/source_code/github/qa-platform/services/agent')

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

print("=== 测试 embedding 模型 ===\n")

test_pairs = [
    ("Write test cases for login", "Generate test cases for payment", "TEST_CASE vs TEST_CASE"),
    ("Write test cases for login", "Run pytest on tests", "TEST_CASE vs RUN_TESTS"),
    ("Write test cases for login", "Analyze the codebase", "TEST_CASE vs CODE_ANALYSIS"),
    ("query knowledge base", "search documents", "RAG vs RAG"),
    ("query knowledge base", "run tests", "RAG vs RUN_TESTS"),
    ("hello", "how are you", "CHAT vs CHAT"),
    ("hello", "write test cases", "CHAT vs TEST_CASE"),
]

for text1, text2, desc in test_pairs:
    emb1 = embed_text(text1)
    emb2 = embed_text(text2)
    sim = cosine_similarity(emb1, emb2)
    print(f"{desc}: {sim:.4f}")
    print(f"  '{text1}' vs '{text2}'")
    print()