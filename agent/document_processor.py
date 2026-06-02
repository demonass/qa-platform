"""
文档智能切分处理器

功能：
1. 使用 Max-Min Semantic Chunking 算法进行语义感知切分
2. 支持多种文本切分策略
3. 自动识别文档中的功能模块边界

算法说明：
Max-Min Semantic Chunking:
- 首先将文本按固定大小分割成小块
- 计算每个块与前后块的语义相似度
- 在相似度最低的地方进行切分
- 确保每个 chunk 内部语义连贯，chunk 之间语义差异较大
"""

import os
import re
from typing import List, Dict, Optional, Tuple
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import ChatOpenAI
from langchain.prompts import PromptTemplate
from langchain.chains import LLMChain
from config import get_llm_config
import numpy as np

try:
    from transformers import AutoTokenizer, AutoModel
    USE_TRANSFORMERS = True
except ImportError:
    USE_TRANSFORMERS = False

# 全局 embedding 模型
tokenizer = None
model = None


def init_embedding_model(model_path: str = None):
    """初始化 embedding 模型"""
    global tokenizer, model
    if USE_TRANSFORMERS and tokenizer is None:
        if model_path is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
            model_path = os.path.join(base_dir, "embedding_models", "bge-base-zh-v1.5")
        
        tokenizer = AutoTokenizer.from_pretrained(model_path)
        model = AutoModel.from_pretrained(model_path)
        model.eval()
        print("[INFO] Embedding model initialized for document processing")


def embed_text(text: str) -> List[float]:
    """获取文本的 embedding"""
    if not USE_TRANSFORMERS or tokenizer is None or model is None:
        init_embedding_model()
    
    inputs = tokenizer(text, padding=True, truncation=True, max_length=512, return_tensors='pt')
    import torch
    with torch.no_grad():
        outputs = model(**inputs)
    embeddings = outputs.last_hidden_state[:, 0, :]
    embeddings = torch.nn.functional.normalize(embeddings, p=2, dim=1)
    return embeddings[0].tolist()


def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """计算余弦相似度"""
    if not vec1 or not vec2:
        return 0.0
    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    norm1 = sum(a * a for a in vec1) ** 0.5
    norm2 = sum(b * b for b in vec2) ** 0.5
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return dot_product / (norm1 * norm2)


class DocumentProcessor:
    """文档智能切分处理器"""
    
    def __init__(self, chunk_size: int = 500, chunk_overlap: int = 50):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        
    def split_by_recursive_char(self, text: str) -> List[str]:
        """使用递归字符切分器"""
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
            length_function=len,
            separators=["\n\n", "\n", "。", "！", "？", ".", "!", "?"],
        )
        return text_splitter.split_text(text)
    
    def split_by_max_min_semantic(self, text: str, target_chunks: int = 5) -> List[str]:
        """
        Max-Min Semantic Chunking 算法
        
        步骤：
        1. 将文本初步分割成小片段
        2. 计算相邻片段的语义相似度
        3. 在相似度最低的位置进行切分
        4. 重复直到达到目标切分数量
        """
        # 第一步：初步分割成小片段
        sentences = self._split_into_sentences(text)
        
        if len(sentences) <= target_chunks:
            return ["\n".join(sentences[i * len(sentences) // target_chunks : (i + 1) * len(sentences) // target_chunks]) 
                    for i in range(target_chunks)]
        
        # 第二步：计算每个句子的 embedding
        embeddings = [embed_text(sentence) for sentence in sentences]
        
        # 第三步：计算相邻句子的相似度
        similarities = []
        for i in range(len(embeddings) - 1):
            sim = cosine_similarity(embeddings[i], embeddings[i + 1])
            similarities.append((i, sim))
        
        # 第四步：选择相似度最低的位置作为切分点
        similarities.sort(key=lambda x: x[1])
        cut_points = sorted([p[0] + 1 for p in similarities[:target_chunks - 1]])
        
        # 第五步：根据切分点分割文本
        chunks = []
        start = 0
        for cut_point in cut_points:
            chunks.append("\n".join(sentences[start:cut_point]))
            start = cut_point
        chunks.append("\n".join(sentences[start:]))
        
        return chunks
    
    def _split_into_sentences(self, text: str) -> List[str]:
        """将文本分割成句子"""
        # 中文和英文句子分割
        pattern = r'(?<=[。！？\.!?])\s+'
        sentences = re.split(pattern, text)
        sentences = [s.strip() for s in sentences if s.strip()]
        return sentences
    
    def split_by_topic(self, text: str) -> List[Dict[str, str]]:
        """
        使用大模型进行主题识别和切分
        
        返回格式：[{"topic": "主题名称", "content": "内容"}, ...]
        """
        llm_config = get_llm_config()
        llm = ChatOpenAI(
            model=llm_config["model"],
            temperature=0.3,
            openai_api_key=llm_config["api_key"],
            openai_api_base=llm_config["api_base"],
        )
        
        prompt = PromptTemplate.from_template("""
请分析以下需求文档，将其切分成多个功能模块，并为每个模块命名。

需求文档内容：
{document}

输出格式要求：
请按照 JSON 格式输出，包含一个 "modules" 数组，每个元素包含 "topic" 和 "content" 字段：
{{
  "modules": [
    {{"topic": "模块名称1", "content": "模块1的内容"}},
    {{"topic": "模块名称2", "content": "模块2的内容"}}
  ]
}}

注意：
1. 每个模块应该是一个完整的功能单元
2. 模块名称要简洁明了，能够概括模块内容
3. 内容要完整，不要遗漏关键信息
""")
        
        chain = LLMChain(llm=llm, prompt=prompt)
        result = chain.run(document=text)
        
        try:
            import json
            data = json.loads(result)
            return data.get("modules", [])
        except:
            # 如果解析失败，使用简单切分
            chunks = self.split_by_max_min_semantic(text, target_chunks=3)
            return [{"topic": f"功能模块{i+1}", "content": chunk} for i, chunk in enumerate(chunks)]
    
    def process_document(self, text: str, strategy: str = "semantic", target_chunks: int = 5) -> List[Dict[str, str]]:
        """
        处理文档，根据策略进行切分
        
        Args:
            text: 文档内容
            strategy: 切分策略
                - "recursive": 递归字符切分
                - "semantic": Max-Min 语义切分（默认）
                - "topic": 大模型主题识别切分
            target_chunks: 目标切分数量（仅对 semantic 策略有效）
        
        Returns:
            切分后的模块列表，每个模块包含 topic 和 content
        """
        if strategy == "recursive":
            chunks = self.split_by_recursive_char(text)
            return [{"topic": f"章节{i+1}", "content": chunk} for i, chunk in enumerate(chunks)]
        
        elif strategy == "topic":
            return self.split_by_topic(text)
        
        else:  # semantic
            chunks = self.split_by_max_min_semantic(text, target_chunks)
            return [{"topic": f"功能模块{i+1}", "content": chunk} for i, chunk in enumerate(chunks)]


# 全局处理器实例
document_processor = DocumentProcessor()


def process_document(text: str, strategy: str = "semantic", target_chunks: int = 5) -> List[Dict[str, str]]:
    """便捷函数：处理文档"""
    return document_processor.process_document(text, strategy, target_chunks)