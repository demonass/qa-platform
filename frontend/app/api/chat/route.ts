import { createUIMessageStream, createUIMessageStreamResponse } from 'ai'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8081'
const AUTH_TOKEN = process.env.AUTH_TOKEN || ''

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log('Full request body:', JSON.stringify(body, null, 2))

    let userMessage = ''

    if (body.messages && Array.isArray(body.messages)) {
      const lastMessage = body.messages[body.messages.length - 1]
      if (lastMessage) {
        if (typeof lastMessage.content === 'string') {
          userMessage = lastMessage.content
        } else if (lastMessage.parts) {
          userMessage = lastMessage.parts
            .filter((p: { type: string }) => p.type === 'text')
            .map((p: { text: string }) => p.text)
            .join('')
        }
      }
    } else if (body.message && typeof body.message === 'string') {
      userMessage = body.message
    }

    console.log('User message:', userMessage)

    if (!userMessage) {
      throw new Error('Empty message')
    }

    const reqHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    // Forward client JWT to Go backend
    const clientAuth = req.headers.get('authorization')
    if (clientAuth) {
      reqHeaders['Authorization'] = clientAuth
    } else if (AUTH_TOKEN) {
      reqHeaders['Authorization'] = `Bearer ${AUTH_TOKEN}`
    }

    const sessionId = body.id || body.chatId || body.session_id || 'default'
    const mode = body.mode || 'default'

    // 创建 AbortController，用于取消请求
    const abortController = new AbortController()
    
    // 监听客户端断开连接（通过 req.signal）
    req.signal?.addEventListener('abort', () => {
      console.log('Client aborted the request')
      abortController.abort()
    })

    const stream = createUIMessageStream({
      async execute({ writer }) {
        const response = await fetch(`${BACKEND_URL}/api/chat/stream`, {
          method: 'POST',
          headers: reqHeaders,
          body: JSON.stringify({
            message: userMessage,
            session_id: sessionId,
            mode: mode,
          }),
          signal: abortController.signal, // 将取消信号传递给fetch
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`Backend returned ${response.status}: ${errorText}`)
          throw new Error(
            response.status === 503
              ? 'QA 服务暂不可用，请确保 Agent 和 Backend 服务已启动'
              : `连接后端失败 (${response.status})`
          )
        }

        if (!response.body) {
          throw new Error('No response body')
        }

        // AI SDK v6 要求: text-start → text-delta(s) → text-end，同一 part 必须用同一个 id
        const partId = 'resp-' + Date.now()
        let started = false

        const reader = response.body.getReader()
        const decoder = new TextDecoder('utf-8')
        let buffer = ''

        try {
          while (true) {
            const { done: readerDone, value } = await reader.read()
            if (readerDone) break

            buffer += decoder.decode(value, { stream: true })

            while (buffer.includes('\n')) {
              const lineEnd = buffer.indexOf('\n')
              const line = buffer.slice(0, lineEnd).trim()
              buffer = buffer.slice(lineEnd + 1)

              if (!line) continue

              if (line.startsWith('data: ')) {
                try {
                  const dataStr = line.slice(6)
                  const data = JSON.parse(dataStr)

                  if (data.content && !data.done) {
                    if (!started) {
                      writer.write({ type: 'text-start', id: partId })
                      started = true
                    }
                    writer.write({ type: 'text-delta', id: partId, delta: data.content })
                  } else if (data.done) {
                    if (started) {
                      writer.write({ type: 'text-end', id: partId })
                    }
                    return
                  }
                } catch (e) {
                  console.error('Failed to parse SSE data:', e)
                }
              }
            }
          }
        } catch (error) {
          // 如果是取消错误，不抛出异常
          if (error instanceof Error && error.name === 'AbortError') {
            console.log('Stream was aborted by client')
            return
          }
          throw error
        }

        // 如果流结束但没有收到 done 信号，也发送 text-end
        if (started) {
          writer.write({ type: 'text-end', id: partId })
        }
      },
    })

    return createUIMessageStreamResponse({ stream })
  } catch (error) {
    console.error('API Chat Error:', error)
    const partId = 'error-' + Date.now()
    const errorStream = createUIMessageStream({
      async execute({ writer }) {
        writer.write({ type: 'text-start', id: partId })
        writer.write({
          type: 'text-delta',
          id: partId,
          delta: `❌ 错误: ${error instanceof Error ? error.message : 'Internal server error'}`,
        })
        writer.write({ type: 'text-end', id: partId })
      },
    })
    return createUIMessageStreamResponse({ stream: errorStream })
  }
}
