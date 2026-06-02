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

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorFiles, setEditorFiles] = useState<EditorFile[]>([])
  const [activeFileId, setActiveFileId] = useState<string | null>(null)
  const isMobile = useMediaQuery('(max-width: 768px)')

  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  })

  const isLoading = status === 'streaming' || status === 'submitted'

  // 开始新对话
  const handleNewChat = useCallback(() => {
    // 如果当前有消息，保存当前会话
    if (messages.length > 0 && currentSessionId) {
      const firstUserMessage = messages.find(m => m.role === 'user')
      const title = firstUserMessage 
        ? extractTitle(firstUserMessage.parts?.filter(p => p.type === 'text').map(p => (p as { type: 'text'; text: string }).text).join('') || '新对话')
        : '新对话'
      
      setSessions(prev => 
        prev.map(s => 
          s.id === currentSessionId 
            ? { ...s, title, lastMessage: title, updatedAt: new Date() }
            : s
        )
      )
    }
    
    // 重置消息
    setMessages([])
    setCurrentSessionId(null)
    setMobileSheetOpen(false)
  }, [messages, currentSessionId, setMessages])

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
    // 简化版：暂时只切换 ID，实际需要持久化
    setCurrentSessionId(id)
    setMessages([])
    setMobileSheetOpen(false)
  }, [setMessages])

  // 删除会话
  const handleDeleteSession = useCallback((id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id))
    if (currentSessionId === id) {
      setCurrentSessionId(null)
      setMessages([])
    }
  }, [currentSessionId, setMessages])

  // 重命名会话
  const handleRenameSession = useCallback((id: string, title: string) => {
    setSessions(prev =>
      prev.map(s => (s.id === id ? { ...s, title } : s))
    )
  }, [])

  // 复制消息
  const handleCopyMessage = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('已复制到剪贴板')
    }).catch(() => {
      toast.error('复制失败')
    })
  }, [])

  // 重新对话（先删除AI回复，再重新发送用户消息）
  const handleRetryMessage = useCallback((userMessage: UIMessage, aiMessageId: string) => {
    // 先删除AI回复消息
    setMessages(prev => prev.filter(m => m.id !== aiMessageId))
    
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
    setMessages(prev => prev.filter(m => m.id !== userMessageId && m.id !== aiMessageId))
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
