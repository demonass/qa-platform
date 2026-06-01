import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { messages } = await req.json()
  
  // 获取最后一条用户消息
  const lastUserMessage = messages[messages.length - 1]
  const userMessage = lastUserMessage?.content || ''
  
  // 转发请求到 Go 后端
  const response = await fetch('http://localhost:8081/api/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: userMessage,
      session_id: 'test-session',
    }),
  })
  
  if (!response.ok) {
    return NextResponse.json(
      { error: 'Failed to connect to backend' },
      { status: response.status }
    )
  }
  
  // 直接返回流
  return new NextResponse(response.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  })
}