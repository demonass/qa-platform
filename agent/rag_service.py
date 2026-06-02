import os
from typing import List, Dict, Optional
from pathlib import Path

try:
    from langchain.document_loaders import DirectoryLoader, TextLoader, UnstructuredMarkdownLoader
    from langchain.text_splitter import RecursiveCharacterTextSplitter
    from langchain.vectorstores import FAISS
    from langchain.chains import RetrievalQA
    from langchain_openai import ChatOpenAI
    LANGCHAIN_AVAILABLE = True
except ImportError:
    LANGCHAIN_AVAILABLE = False
    print("[WARN] langchain not available")

try:
    from transformers import AutoTokenizer, AutoModel
    import torch
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False
    print("[WARN] transformers not available")

from config import get_llm_config


class CustomEmbeddings:
    """自定义嵌入类，使用 transformers 加载本地模型"""
    
    def __init__(self, model_path: str):
        self.tokenizer = AutoTokenizer.from_pretrained(model_path)
        self.model = AutoModel.from_pretrained(model_path)
        self.model.eval()
    
    def __call__(self, text: str) -> List[float]:
        return self.embed_query(text)
    
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return [self.embed_query(text) for text in texts]
    
    def embed_query(self, text: str) -> List[float]:
        inputs = self.tokenizer(text, padding=True, truncation=True, return_tensors='pt')
        with torch.no_grad():
            outputs = self.model(**inputs)
        
        embeddings = outputs.last_hidden_state[:, 0, :]
        embeddings = torch.nn.functional.normalize(embeddings, p=2, dim=1)
        return embeddings[0].tolist()


class RAGService:
    def __init__(self):
        self.vector_store = None
        self.retriever = None
        self.qa_chain = None
        # 使用更可靠的路径计算方式
        current_file_dir = os.path.dirname(os.path.abspath(__file__))
        self.document_dir = os.path.join(
            current_file_dir,
            "..", "..", "document"
        )
        self.document_dir = os.path.normpath(self.document_dir)
        
        self.embedding_model_path = os.path.join(
            current_file_dir,
            "..", "..", "embedding_models", "all-MiniLM-L6-v2"
        )
        self.embedding_model_path = os.path.normpath(self.embedding_model_path)

    def load_documents(self) -> List:
        """加载 document 目录下的所有文档"""
        documents = []
        
        try:
            print(f"[DEBUG] 文档目录: {self.document_dir}")
            if os.path.exists(self.document_dir):
                print(f"[DEBUG] 文档目录存在")
                md_files = list(Path(self.document_dir).rglob("*.md"))
                txt_files = list(Path(self.document_dir).rglob("*.txt"))
                pdf_files = list(Path(self.document_dir).rglob("*.pdf"))
                docx_files = list(Path(self.document_dir).rglob("*.docx"))
                
                print(f"[DEBUG] 找到 {len(md_files)} 个 md 文件")
                print(f"[DEBUG] 找到 {len(txt_files)} 个 txt 文件")
                print(f"[DEBUG] 找到 {len(pdf_files)} 个 pdf 文件")
                print(f"[DEBUG] 找到 {len(docx_files)} 个 docx 文件")
                
                for file_path in md_files:
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                            documents.append({
                                "page_content": content,
                                "metadata": {"source": str(file_path)}
                            })
                    except Exception as e:
                        print(f"[WARN] 加载 {file_path} 失败: {e}")
                
                for file_path in txt_files:
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                            documents.append({
                                "page_content": content,
                                "metadata": {"source": str(file_path)}
                            })
                    except Exception as e:
                        print(f"[WARN] 加载 {file_path} 失败: {e}")
                
                for file_path in pdf_files:
                    try:
                        from PyPDF2 import PdfReader
                        reader = PdfReader(str(file_path))
                        content = "\n".join([page.extract_text() for page in reader.pages])
                        if content.strip():
                            documents.append({
                                "page_content": content,
                                "metadata": {"source": str(file_path)}
                            })
                        else:
                            print(f"[WARN] PDF 文件 {file_path} 内容为空")
                    except ImportError:
                        print(f"[WARN] PyPDF2 未安装，无法加载 {file_path}")
                    except Exception as e:
                        print(f"[WARN] 加载 {file_path} 失败: {e}")
                
                for file_path in docx_files:
                    try:
                        content = ""
                        
                        # 优先使用 docx2txt（更可靠）
                        try:
                            import docx2txt
                            content = docx2txt.process(str(file_path))
                            print(f"[INFO] 使用 docx2txt 提取了 {len(content)} 字符")
                        except ImportError:
                            print(f"[WARN] docx2txt 未安装，尝试 python-docx")
                        except Exception as e:
                            print(f"[WARN] docx2txt 失败: {e}")
                        
                        # 如果 docx2txt 失败，尝试 python-docx
                        if not content.strip():
                            try:
                                from docx import Document
                                doc = Document(str(file_path))
                                content = "\n".join([para.text for para in doc.paragraphs if para.text.strip()])
                                print(f"[INFO] 使用 python-docx 提取了 {len(content)} 字符")
                            except ImportError:
                                print(f"[WARN] python-docx 未安装")
                            except Exception as e:
                                print(f"[WARN] python-docx 失败: {e}")
                        
                        if content.strip():
                            documents.append({
                                "page_content": content,
                                "metadata": {"source": str(file_path)}
                            })
                        else:
                            print(f"[WARN] DOCX 文件 {file_path} 内容为空")
                    except Exception as e:
                        print(f"[WARN] 加载 {file_path} 失败: {e}")
                
                print(f"[INFO] 加载了 {len(documents)} 个文档")
        except Exception as e:
            print(f"[WARN] 加载文档失败: {e}")
        
        return documents

    def split_documents(self, documents: List) -> List:
        """将文档分割成小块"""
        chunks = []
        
        for doc in documents:
            content = doc["page_content"]
            metadata = doc["metadata"]
            
            chunk_size = 500
            chunk_overlap = 50
            
            for i in range(0, len(content), chunk_size - chunk_overlap):
                chunk_content = content[i:i+chunk_size]
                chunks.append({
                    "page_content": chunk_content,
                    "metadata": metadata
                })
        
        print(f"[INFO] 分割成 {len(chunks)} 个块")
        return chunks

    def create_vector_store(self, chunks: List):
        """创建向量存储"""
        try:
            if not TRANSFORMERS_AVAILABLE:
                print("[WARN] transformers 不可用")
                return
            
            embeddings = CustomEmbeddings(self.embedding_model_path)
            print(f"[INFO] 加载嵌入模型: {self.embedding_model_path}")
            
            texts = [chunk["page_content"] for chunk in chunks]
            metadatas = [chunk["metadata"] for chunk in chunks]
            
            self.vector_store = FAISS.from_texts(texts, embeddings, metadatas=metadatas)
            self.retriever = self.vector_store.as_retriever(
                search_kwargs={"k": 3}
            )
            print("[INFO] 向量存储创建成功")
        except Exception as e:
            print(f"[WARN] 创建向量存储失败: {e}")

    def init_qa_chain(self):
        """初始化 QA 链"""
        if not self.retriever:
            print("[WARN] 请先创建向量存储")
            return
        
        llm_config = get_llm_config()
        llm = ChatOpenAI(
            model=llm_config["model"],
            openai_api_base=llm_config["api_base"],
            openai_api_key=llm_config["api_key"],
            temperature=0
        )
        
        self.qa_chain = RetrievalQA.from_chain_type(
            llm=llm,
            chain_type="stuff",
            retriever=self.retriever,
            return_source_documents=True
        )
        print("[INFO] QA 链初始化成功")

    def initialize(self):
        """初始化 RAG 服务"""
        if not LANGCHAIN_AVAILABLE:
            print("[WARN] langchain 不可用，RAG 功能已禁用")
            return
        
        documents = self.load_documents()
        if not documents:
            print("[WARN] 未找到任何文档")
            return
        
        chunks = self.split_documents(documents)
        self.create_vector_store(chunks)
        self.init_qa_chain()

    def query(self, question: str) -> Dict:
        """执行 RAG 查询"""
        if not self.qa_chain:
            return {
                "answer": "RAG 服务未初始化，请先添加文档并重启服务",
                "sources": [],
                "success": False
            }
        
        try:
            result = self.qa_chain({"query": question})
            
            sources = []
            if "source_documents" in result:
                for doc in result["source_documents"]:
                    page_content = doc.page_content if hasattr(doc, 'page_content') else str(doc)
                    metadata = doc.metadata if hasattr(doc, 'metadata') else {}
                    source = {
                        "page_content": page_content[:200] + "..." if len(page_content) > 200 else page_content,
                        "metadata": metadata
                    }
                    sources.append(source)
            
            answer = result.get("result", "") if isinstance(result, dict) else str(result)
            
            return {
                "answer": answer,
                "sources": sources,
                "success": True
            }
        except Exception as e:
            return {
                "answer": f"RAG 查询失败: {str(e)}",
                "sources": [],
                "success": False
            }


rag_service = RAGService()
