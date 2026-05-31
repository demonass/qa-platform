import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './App.css'

function App() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState(() => {
    return localStorage.getItem('qa_session_id') || ''
  })
  const [copiedId, setCopiedId] = useState(null)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (sessionId) {
      localStorage.setItem('qa_session_id', sessionId)
    }
  }, [sessionId])

  const generateSessionId = () => {
    const newId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    setSessionId(newId)
    localStorage.setItem('qa_session_id', newId)
    setMessages([])
  }

  const copyToClipboard = async (text, msgId) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(msgId)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const exportConversation = async (format = 'markdown') => {
    if (!sessionId) {
      alert('请先生成会话ID')
      return
    }

    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, format })
      })

      const data = await response.json()

      if (data.content) {
        const blob = new Blob([data.content], { type: 'text/markdown;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `qa-conversation-${Date.now()}.md`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  const sendMessageStream = async (e) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    if (!sessionId) {
      generateSessionId()
    }

    const userMessage = { role: 'user', content: input, id: Date.now() }
    const assistantMessage = { role: 'assistant', content: '', id: Date.now() + 1 }

    setMessages(prev => [...prev, userMessage, assistantMessage])
    const currentInput = input
    setInput('')
    setIsLoading(true)

    let assistantContent = ''
    let currentSessionId = sessionId

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: currentInput, session_id: currentSessionId })
      })

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.content) {
                assistantContent += data.content
                setMessages(prev => {
                  const newMessages = [...prev]
                  newMessages[newMessages.length - 1] = {
                    role: 'assistant',
                    content: assistantContent,
                    id: currentSessionId
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
      setMessages(prev => {
        const newMessages = [...prev]
        newMessages[newMessages.length - 1] = {
          role: 'assistant',
          content: `错误: ${error.message}`,
          id: Date.now()
        }
        return newMessages
      })
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
          <div className="session-info">
            <span className="session-label">会话ID:</span>
            <span className="session-id">{sessionId || '未创建'}</span>
            <button className="btn-small" onClick={generateSessionId}>新建会话</button>
            <button className="btn-small" onClick={() => exportConversation('markdown')} disabled={!sessionId}>导出</button>
          </div>
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
              <div className="content-wrapper">
                <div className="content">
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
                {msg.role === 'assistant' && msg.content && (
                  <button
                    className={`copy-btn ${copiedId === msg.id ? 'copied' : ''}`}
                    onClick={() => copyToClipboard(msg.content, msg.id)}
                  >
                    {copiedId === msg.id ? '✓ 已复制' : '📋 复制'}
                  </button>
                )}
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <div className="message assistant">
              <div className="avatar">🤖</div>
              <div className="content">
                <div className="loading">
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="dot"></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form className="input-area" onSubmit={sendMessageStream}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入你的测试需求..."
            rows="3"
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessageStream(e)
              }
            }}
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
