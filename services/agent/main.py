from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse
import asyncio
import json
from agent_service import qa_agent, conversation_history, run_agent_with_history, rag_service
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
