'use client'

import { useState, useCallback } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { ChatSidebar, ChatSession } from '@/components/chat-sidebar'
import { ChatMessages } from '@/components/chat-messages'
import { ChatInput } from '@/components/chat-input'
import { EmptyState } from '@/components/empty-state'
import { EditorPanel, EditorFile } from '@/components/editor-panel'
import { useMediaQuery } from '@/hooks/use-media-query'
import { Button } from '@/components/ui/button'
import { PanelLeft, PanelRight } from 'lucide-react'
import { QALogo } from '@/components/qa-logo'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet'
import type { UIMessage } from 'ai'
import { toast } from 'sonner'

// 生成唯一 ID
const generateId = () => Math.random().toString(36).substring(2, 9)

// 从消息中提取标题
const extractTitle = (text: string) => {
  const maxLength = 30
  const cleaned = text.replace(/\n/g, ' ').trim()
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) + '...' : cleaned
}

export interface ChatSession {
  id: string
  title: string
  lastMessage: string
  updatedAt: Date
}

interface StoredSession extends ChatSession {
  messages: any[]
}

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorFiles, setEditorFiles] = useState<EditorFile[]>([])
  const [activeFileId, setActiveFileId] = useState<string | null>(null)
  const isMobile = useMediaQuery('(max-width: 768px)')

  const { messages, sendMessage, status, setMessages, stop } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  })

  const isLoading = status === 'streaming' || status === 'submitted'

  // 从 localStorage 加载会话
  const loadSessions = useCallback(() => {
    const stored = localStorage.getItem('chat-sessions')
    if (stored) {
      try {
        const data = JSON.parse(stored)
        return data.map((s: any) => ({
          ...s,
          updatedAt: new Date(s.updatedAt),
        }))
      } catch (e) {
        console.error('Failed to load sessions:', e)
        return []
      }
    }
    return []
  }, [])

  // 保存会话到 localStorage
  const saveSession = useCallback((sessionId: string, sessionMessages: any[]) => {
    const stored = localStorage.getItem('chat-sessions')
    let sessionsData: StoredSession[] = stored ? JSON.parse(stored) : []
    
    const existingIndex = sessionsData.findIndex(s => s.id === sessionId)
    const firstUserMessage = sessionMessages.find((m: any) => m.role === 'user')
    const title = firstUserMessage 
      ? extractTitle(firstUserMessage.parts?.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('') || '新对话')
      : '新对话'
    const lastMessage = sessionMessages.length > 0 
      ? (() => {
          const lastMsg = sessionMessages[sessionMessages.length - 1]
          if (lastMsg.parts) {
            return lastMsg.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('')
          }
          return '新消息'
        })()
      : '新对话'

    if (existingIndex >= 0) {
      sessionsData[existingIndex] = {
        ...sessionsData[existingIndex],
        title,
        lastMessage,
        updatedAt: new Date(),
        messages: sessionMessages,
      }
    } else {
      sessionsData.unshift({
        id: sessionId,
        title,
        lastMessage,
        updatedAt: new Date(),
        messages: sessionMessages,
      })
    }

    localStorage.setItem('chat-sessions', JSON.stringify(sessionsData))
  }, [])

  // 从 localStorage 加载单个会话的消息
  const loadSessionMessages = useCallback((sessionId: string) => {
    const stored = localStorage.getItem('chat-sessions')
    if (stored) {
      try {
        const sessionsData: StoredSession[] = JSON.parse(stored)
        const session = sessionsData.find(s => s.id === sessionId)
        if (session && session.messages) {
          return session.messages
        }
      } catch (e) {
        console.error('Failed to load session messages:', e)
      }
    }
    return []
  }, [])

  // 初始化加载会话列表
  useEffect(() => {
    const loadedSessions = loadSessions()
    setSessions(loadedSessions.map(s => ({
      id: s.id,
      title: s.title,
      lastMessage: s.lastMessage,
      updatedAt: s.updatedAt,
    })))
  }, [loadSessions])

  // 自动保存当前会话的消息
  useEffect(() => {
    if (currentSessionId && messages.length > 0) {
      saveSession(currentSessionId, messages)
    }
  }, [messages, currentSessionId, saveSession])

  // 开始新对话
  const handleNewChat = useCallback(() => {
    // 如果当前有消息，保存当前会话
    if (messages.length > 0 && currentSessionId) {
      saveSession(currentSessionId, messages)
    }
    
    // 重置消息
    setMessages([])
    setCurrentSessionId(null)
    setMobileSheetOpen(false)
  }, [messages, currentSessionId, setMessages, saveSession])

  // 发送消息
  const handleSend = useCallback((text: string) => {
    // 如果是新对话，创建会话
    if (!currentSessionId) {
      const newId = generateId()
      const newSession: ChatSession = {
        id: newId,
        title: extractTitle(text),
        lastMessage: text,
        updatedAt: new Date(),
      }
      setSessions(prev => [newSession, ...prev])
      setCurrentSessionId(newId)
    } else {
      // 更新现有会话
      setSessions(prev =>
        prev.map(s =>
          s.id === currentSessionId
            ? { ...s, lastMessage: text, updatedAt: new Date() }
            : s
        )
      )
    }
    
    sendMessage({ text })
  }, [currentSessionId, sendMessage])

  // 选择会话
  const handleSelectSession = useCallback((id: string) => {
    setCurrentSessionId(id)
    // 从 localStorage 加载历史消息
    const storedMessages = loadSessionMessages(id)
    setMessages(storedMessages)
    setMobileSheetOpen(false)
  }, [setMessages, loadSessionMessages])

  // 删除会话
  const handleDeleteSession = useCallback((id: string) => {
    // 从内存中删除
    setSessions(prev => prev.filter(s => s.id !== id))
    
    // 从 localStorage 中删除
    const stored = localStorage.getItem('chat-sessions')
    if (stored) {
      try {
        const sessionsData: StoredSession[] = JSON.parse(stored)
        const filtered = sessionsData.filter(s => s.id !== id)
        localStorage.setItem('chat-sessions', JSON.stringify(filtered))
      } catch (e) {
        console.error('Failed to delete session:', e)
      }
    }
    
    if (currentSessionId === id) {
      setCurrentSessionId(null)
      setMessages([])
    }
  }, [currentSessionId, setMessages])

  // 重命名会话
  const handleRenameSession = useCallback((id: string, title: string) => {
    // 更新内存中的会话
    setSessions(prev =>
      prev.map(s => (s.id === id ? { ...s, title } : s))
    )
    
    // 更新 localStorage 中的会话
    const stored = localStorage.getItem('chat-sessions')
    if (stored) {
      try {
        const sessionsData: StoredSession[] = JSON.parse(stored)
        const updated = sessionsData.map(s => 
          s.id === id ? { ...s, title } : s
        )
        localStorage.setItem('chat-sessions', JSON.stringify(updated))
      } catch (e) {
        console.error('Failed to rename session:', e)
      }
    }
  }, [])

  // 复制消息
  const handleCopyMessage = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('已复制到剪贴板')
    }).catch(() => {
      toast.error('复制失败')
    })
  }, [])

  // 重新对话（先删除用户消息和AI回复，再重新发送用户消息）
  const handleRetryMessage = useCallback((userMessage: UIMessage, aiMessageId: string) => {
    // 先删除用户消息和AI回复
    setMessages(prev => prev.filter(m => m.id !== userMessage.id && m.id !== aiMessageId))
    
    // 提取用户消息文本并重新发送
    const text = userMessage.parts
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map(p => p.text)
      .join('')
    
    if (userMessage.role === 'user' && text) {
      sendMessage({ text })
    }
  }, [sendMessage, setMessages])

  // 删除消息（同时删除用户消息和AI回复）
  const handleDeleteMessage = useCallback((userMessageId: string, aiMessageId: string) => {
    console.log('Deleting messages:', { userMessageId, aiMessageId })
    if (!userMessageId || !aiMessageId) {
      toast.error('消息ID无效')
      return
    }
    setMessages(prev => {
      const beforeCount = prev.length
      const after = prev.filter(m => m.id !== userMessageId && m.id !== aiMessageId)
      const afterCount = after.length
      console.log(`Messages: ${beforeCount} -> ${afterCount}`)
      return after
    })
    toast.success('对话已删除')
  }, [setMessages])

  // 侧边栏内容
  const sidebarContent = (
    <ChatSidebar
      sessions={sessions}
      currentSessionId={currentSessionId}
      onNewChat={handleNewChat}
      onSelectSession={handleSelectSession}
      onDeleteSession={handleDeleteSession}
      onRenameSession={handleRenameSession}
      isCollapsed={!isMobile && sidebarCollapsed}
      onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
    />
  )

  return (
    <div className="flex h-svh bg-background">
      {/* Desktop Sidebar */}
      {!isMobile && sidebarContent}

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile Header */}
        {isMobile && (
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/50 bg-background/80 px-4 backdrop-blur-xl">
            <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="size-9">
                  <PanelLeft className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <ChatSidebar
                  sessions={sessions}
                  currentSessionId={currentSessionId}
                  onNewChat={handleNewChat}
                  onSelectSession={handleSelectSession}
                  onDeleteSession={handleDeleteSession}
                  onRenameSession={handleRenameSession}
                  isCollapsed={false}
                  onToggleCollapse={() => setMobileSheetOpen(false)}
                />
              </SheetContent>
            </Sheet>

            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
                <QALogo size="sm" />
              </div>
              <span className="font-semibold tracking-tight">QA 智能助手</span>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="size-9"
              onClick={() => setEditorOpen(!editorOpen)}
            >
              <PanelRight className="size-5" />
            </Button>
          </header>
        )}

        {/* Desktop Header with Editor Toggle */}
        {!isMobile && (
          <header className="flex h-12 shrink-0 items-center justify-end border-b border-border/50 bg-background/80 px-4 backdrop-blur-xl">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={() => setEditorOpen(!editorOpen)}
            >
              <PanelRight className="size-4" />
              <span className="text-sm">{editorOpen ? '关闭编辑器' : '打开编辑器'}</span>
            </Button>
          </header>
        )}

        {/* Chat Area */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {messages.length === 0 ? (
            <EmptyState onSuggestionClick={handleSend} />
          ) : (
            <ChatMessages 
              messages={messages} 
              isLoading={isLoading}
              onCopy={handleCopyMessage}
              onRetry={handleRetryMessage}
              onDelete={handleDeleteMessage}
            />
          )}
          
          <ChatInput
            onSend={handleSend}
            onStop={stop}
            isLoading={isLoading}
          />
        </main>
      </div>

      {/* Editor Panel */}
      {!isMobile && (
        <EditorPanel
          isOpen={editorOpen}
          onClose={() => setEditorOpen(false)}
          files={editorFiles}
          onFilesChange={setEditorFiles}
          activeFileId={activeFileId}
          onActiveFileChange={setActiveFileId}
        />
      )}
    </div>
  )
}
