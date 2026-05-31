from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse
import asyncio
import json
from agent_service import qa_agent

app = FastAPI(title="QA Agent Service", version="1.0.0")

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


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "qa-agent"}


@app.post("/chat")
async def chat(request: ChatRequest):
    try:
        result = qa_agent.invoke({"input": request.message})
        return ChatResponse(
            response=result["output"],
            status="success"
        )
    except Exception as e:
        return ChatResponse(
            response=f"Error: {str(e)}",
            status="error"
        )


@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    async def event_generator():
        try:
            result = qa_agent.invoke({"input": request.message})
            output = result["output"]
            
            chunk_size = 10
            for i in range(0, len(output), chunk_size):
                chunk = output[i:i+chunk_size]
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
