from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse
import asyncio
import json
from agent_service import conversation_history, run_agent_with_history, rag_service
from config import LLM_PROVIDER, get_llm_config

app = FastAPI(title="QA Agent Service", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"

class ChatResponse(BaseModel):
    response: str
    status: str

class ExportRequest(BaseModel):
    session_id: str = "default"
    format: str = "markdown"

class IntentRequest(BaseModel):
    message: str


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "qa-agent"}


@app.get("/config")
async def get_config():
    llm_config = get_llm_config()
    return {
        "provider": LLM_PROVIDER,
        "model": llm_config["model"],
        "api_base": llm_config["api_base"],
        "version": "2.0.0"
    }


@app.post("/intent")
async def detect_intent(request: IntentRequest):
    from agent_service import Intent, detect_intent
    from intent_detector import DETECTION_METHOD, DETECTION_METHOD_DESCRIPTION, intent_classifier
    
    try:
        intent = detect_intent(request.message)
        intent_name = intent.name if isinstance(intent, Intent) else str(intent)
        
        intent_descriptions = {
            "TEST_CASE": "测试用例生成",
            "TEST_PLAN": "测试计划制定",
            "CODE_ANALYSIS": "代码分析",
            "RAG_QA": "知识库问答",
            "RUN_TESTS": "测试执行",
            "DEFAULT": "默认回答"
        }
        
        description = intent_descriptions.get(intent_name, "未知意图")
        
        from intent_detector import INTENT_SAMPLES
        
        result = {
            "intent": intent_name,
            "description": description,
            "detection_method": DETECTION_METHOD,
            "detection_method_description": DETECTION_METHOD_DESCRIPTION,
            "message": f"输入已识别为「{description}」意图"
        }
        
        if intent_classifier is not None:
            text_embedding = intent_classifier.embed_text(request.message)
            max_sim = 0
            target_intent = Intent[intent_name] if intent_name in Intent.__members__ else None
            if target_intent and target_intent in INTENT_SAMPLES:
                for sample in INTENT_SAMPLES[target_intent]:
                    sample_embedding = intent_classifier.embed_text(sample)
                    sim = intent_classifier.cosine_similarity(text_embedding, sample_embedding)
                    if sim > max_sim:
                        max_sim = sim
            result["confidence"] = round(max_sim, 4)
            result["model_used"] = "bge-base-zh-v1.5"
        
        return result
    except Exception as e:
        return {
            "intent": "UNKNOWN",
            "description": "未知意图",
            "detection_method": DETECTION_METHOD,
            "detection_method_description": DETECTION_METHOD_DESCRIPTION,
            "message": f"意图检测失败: {str(e)}"
        }


@app.post("/chat")
async def chat(request: ChatRequest):
    try:
        conversation_history.add_message(request.session_id, "user", request.message)

        result = run_agent_with_history(request.session_id, request.message)

        conversation_history.add_message(request.session_id, "assistant", result)

        return ChatResponse(
            response=result,
            status="success"
        )
    except Exception as e:
        return ChatResponse(
            response=f"Error: {str(e)}",
            status="error"
        )


@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    conversation_history.add_message(request.session_id, "user", request.message)

    async def event_generator():
        try:
            result = run_agent_with_history(request.session_id, request.message)

            conversation_history.add_message(request.session_id, "assistant", result)

            chunk_size = 10
            for i in range(0, len(result), chunk_size):
                chunk = result[i:i+chunk_size]
                yield {
                    "event": "message",
                    "data": json.dumps({"content": chunk, "done": False})
                }
                await asyncio.sleep(0.05)

            yield {
                "event": "message",
                "data": json.dumps({"content": "", "done": True})
            }
        except Exception as e:
            yield {
                "event": "error",
                "data": json.dumps({"error": str(e)})
            }

    return EventSourceResponse(event_generator())


@app.get("/history/{session_id}")
async def get_history(session_id: str):
    history = conversation_history.get_history(session_id)
    return {"session_id": session_id, "history": history}


@app.delete("/history/{session_id}")
async def clear_history(session_id: str):
    conversation_history.clear_history(session_id)
    return {"status": "success", "message": f"History cleared for session: {session_id}"}


@app.post("/export")
async def export_conversation(request: ExportRequest):
    history = conversation_history.get_history(request.session_id)

    if not history:
        raise HTTPException(status_code=404, detail="No conversation history found")

    if request.format == "markdown":
        md_content = "# 对话记录导出\n\n"
        for msg in history:
            role = "👤 用户" if msg["role"] == "user" else "🤖 AI 助手"
            md_content += f"## {role}\n\n{msg['content']}\n\n---\n\n"
        return {"format": "markdown", "content": md_content}

    elif request.format == "text":
        text_content = "对话记录导出\n" + "=" * 50 + "\n\n"
        for msg in history:
            role = "用户" if msg["role"] == "user" else "AI助手"
            text_content += f"[{role}]\n{msg['content']}\n\n"
        return {"format": "text", "content": text_content}

    else:
        raise HTTPException(status_code=400, detail="Unsupported format. Use 'markdown' or 'text'")


class RAGQueryRequest(BaseModel):
    question: str


@app.post("/rag/query")
async def rag_query(request: RAGQueryRequest):
    if not rag_service:
        raise HTTPException(status_code=503, detail="RAG service not available")
    
    result = rag_service.query(request.question)
    if result["success"]:
        return {
            "answer": result["answer"],
            "sources": result["sources"],
            "status": "success"
        }
    else:
        raise HTTPException(status_code=500, detail=result["answer"])


@app.post("/rag/reload")
async def rag_reload():
    if not rag_service:
        raise HTTPException(status_code=503, detail="RAG service not available")
    
    try:
        rag_service.initialize()
        return {"status": "success", "message": "RAG index reloaded"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reload RAG index: {str(e)}")


@app.get("/rag/status")
async def rag_status():
    if not rag_service:
        return {"status": "not_available", "message": "RAG service not initialized"}
    
    return {"status": "available", "message": "RAG service is ready"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
