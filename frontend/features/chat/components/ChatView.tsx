'use client'

import { useEffect, useCallback } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useChatStore } from '../store'
import { useSessionManager, useChatAuthCheck } from '../hooks'
import { ChatHeader } from './ChatHeader'
import { ChatSidebar } from './ChatSidebar'
import { ChatMessages } from './ChatMessages'
import { ChatInput } from './ChatInput'
import { EmptyState } from './EmptyState'
import { EditorPanel } from './EditorPanel'
import { useMediaQuery } from '@/hooks/use-media-query'
import { Button } from '@/components/ui/button'
import { PanelLeft, PanelRight } from 'lucide-react'
import { QALogo } from '@/components/qa-logo'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { isAuthExpiredError, forceLogout } from '@/lib/auth-error'
import { toast } from 'sonner'

export function ChatView() {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const checkAuth = useChatAuthCheck()

  const sidebarCollapsed = useChatStore((s) => s.sidebarCollapsed)
  const editorOpen = useChatStore((s) => s.editorOpen)
  const webSearchMode = useChatStore((s) => s.webSearchMode)
  const mobileSheetOpen = useChatStore((s) => s.mobileSheetOpen)
  const editorFiles = useChatStore((s) => s.editorFiles)
  const activeFileId = useChatStore((s) => s.activeFileId)
  const setSidebarCollapsed = useChatStore((s) => s.setSidebarCollapsed)
  const setEditorOpen = useChatStore((s) => s.setEditorOpen)
  const setMobileSheetOpen = useChatStore((s) => s.setMobileSheetOpen)
  const setEditorFiles = useChatStore((s) => s.setEditorFiles)
  const setActiveFileId = useChatStore((s) => s.setActiveFileId)

  const {
    sessions, currentSessionId, loadSessions, handleNewChat, handleSelectSession,
    handleDeleteSession, handleRenameSession, handlePinSession,
    handleClearAllSessions, handleExportData, saveSessionMessages, loadSessionMessages,
  } = useSessionManager()

  useEffect(() => { loadSessions() }, [loadSessions])

  const { messages, sendMessage, status, setMessages, stop, error } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      headers: () => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('qa-token') : ''
        const h: Record<string, string> = {}
        if (token) h['Authorization'] = `Bearer ${token}`
        return h
      },
    }),
  })

  const isLoading = status === 'streaming' || status === 'submitted'

  useEffect(() => {
    if (error && isAuthExpiredError(error)) { forceLogout() }
  }, [error])

  const generateId = () => Math.random().toString(36).substring(2, 9)

  const handleSend = useCallback(async (text: string) => {
    const token = localStorage.getItem('qa-token')
    if (!token) { forceLogout(); return }

    let sid = currentSessionId
    if (!sid) {
      sid = generateId()
      useChatStore.getState().addSession({ id: sid, title: text.slice(0, 30), lastMessage: text, updatedAt: new Date() })
    } else {
      useChatStore.getState().updateSession(sid, { lastMessage: text, updatedAt: new Date() })
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: [{ content: text, metadata: { webSearchMode } }] }),
      })
      if (res.status === 401) { forceLogout(); return }
    } catch { /* continue */ }

    await sendMessage({ text, metadata: { webSearchMode } })
  }, [currentSessionId, sendMessage, webSearchMode])

  useEffect(() => {
    if (currentSessionId && messages.length > 0) { saveSessionMessages(currentSessionId, messages) }
  }, [messages, currentSessionId, saveSessionMessages])

  const onSelectSession = useCallback((id: string) => {
    if (currentSessionId && messages.length > 0) { saveSessionMessages(currentSessionId, messages) }
    if (isLoading) stop()
    handleSelectSession(id)
    const stored = loadSessionMessages(id)
    setMessages(stored)
    setMobileSheetOpen(false)
  }, [currentSessionId, messages, isLoading, stop, handleSelectSession, saveSessionMessages, loadSessionMessages, setMessages, setMobileSheetOpen])

  const onNewChat = useCallback(() => {
    if (isLoading) stop()
    if (currentSessionId && messages.length > 0) { saveSessionMessages(currentSessionId, messages) }
    setMessages([])
    handleNewChat()
    setMobileSheetOpen(false)
  }, [isLoading, stop, currentSessionId, messages, saveSessionMessages, setMessages, handleNewChat, setMobileSheetOpen])

  const onCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast.success('已复制到剪贴板'),
      () => toast.error('复制失败')
    )
  }, [])

  const sidebarContent = (
    <ChatSidebar
      sessions={sessions} currentSessionId={currentSessionId}
      onNewChat={onNewChat} onSelectSession={onSelectSession}
      onDeleteSession={handleDeleteSession} onRenameSession={handleRenameSession}
      onPinSession={handlePinSession} isCollapsed={!isMobile && sidebarCollapsed}
      onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      onClearAllSessions={handleClearAllSessions} onExportData={handleExportData}
    />
  )

  return (
    <div className="flex h-svh bg-background">
      {!isMobile && sidebarContent}

      <div className="flex flex-1 flex-col overflow-hidden">
        {isMobile && (
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/50 bg-background/80 px-4 backdrop-blur-xl">
            <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="size-9"><PanelLeft className="size-5" /></Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">{sidebarContent}</SheetContent>
            </Sheet>
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary"><QALogo size="sm" /></div>
              <span className="font-semibold tracking-tight">QA 智能助手</span>
            </div>
            <Button variant="ghost" size="icon" className="size-9" onClick={() => setEditorOpen(!editorOpen)}>
              <PanelRight className="size-5" />
            </Button>
          </header>
        )}

        {!isMobile && <ChatHeader editorOpen={editorOpen} onToggleEditor={() => setEditorOpen(!editorOpen)} />}

        <main className="flex flex-1 flex-col overflow-hidden">
          {messages.length === 0 ? (
            <EmptyState onSuggestionClick={(text) => handleSend(text)} />
          ) : (
            <ChatMessages messages={messages} isLoading={isLoading} onCopy={onCopy} onSend={handleSend} setMessages={setMessages} />
          )}
          <ChatInput onSend={handleSend} onStop={stop} isLoading={isLoading}
            webSearchMode={webSearchMode} onWebSearchToggle={() => useChatStore.getState().setWebSearchMode(!webSearchMode)} />
        </main>
      </div>

      {!isMobile && (
        <EditorPanel isOpen={editorOpen} onClose={() => setEditorOpen(false)}
          files={editorFiles} onFilesChange={setEditorFiles} activeFileId={activeFileId} onActiveFileChange={setActiveFileId} />
      )}
    </div>
  )
}
