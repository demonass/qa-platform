import { useState } from 'react'
import './App.css'

function App() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input })
      })

      const data = await response.json()
      
      const assistantMessage = {
        role: 'assistant',
        content: data.response || '抱歉，发生了错误'
      }
      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `错误: ${error.message}`
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const sendMessageStream = async (e) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    const currentInput = input
    setInput('')
    setIsLoading(true)

    const assistantMessage = { role: 'assistant', content: '' }
    setMessages(prev => [...prev, assistantMessage])

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: currentInput })
      })

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.content) {
                setMessages(prev => {
                  const newMessages = [...prev]
                  const lastMessage = newMessages[newMessages.length - 1]
                  if (lastMessage.role === 'assistant') {
                    lastMessage.content += data.content
                  }
                  return newMessages
                })
              }
            } catch (e) {
              // Ignore parsing errors
            }
          }
        }
      }
    } catch (error) {
      setMessages(prev => [...prev.slice(0, -1), {
        role: 'assistant',
        content: `错误: ${error.message}`
      }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="app">
      <div className="chat-container">
        <div className="header">
          <h1>🤖 AI 测试平台</h1>
          <p>智能生成测试用例 · 分析测试需求</p>
        </div>

        <div className="messages">
          {messages.length === 0 && (
            <div className="welcome">
              <p>👋 你好！我是 AI 测试助手</p>
              <p>请输入你的测试需求，例如：</p>
              <ul>
                <li>"为用户登录功能生成测试用例"</li>
                <li>"分析注册流程的测试要点"</li>
                <li>"为购物车功能编写边界测试"</li>
              </ul>
            </div>
          )}
          {messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.role}`}>
              <div className="avatar">
                {msg.role === 'user' ? '👤' : '🤖'}
              </div>
              <div className="content">
                <pre>{msg.content}</pre>
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <div className="message assistant">
              <div className="avatar">🤖</div>
              <div className="content">
                <div className="typing">思考中...</div>
              </div>
            </div>
          )}
        </div>

        <form className="input-area" onSubmit={sendMessageStream}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入你的测试需求..."
            rows="3"
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading || !input.trim()}>
            {isLoading ? '处理中...' : '发送'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default App
