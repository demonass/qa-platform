'use client'

import { useCallback } from 'react'
import type { UIMessage } from 'ai'
import { useChatStore } from './store'
import type { ChatSession, StoredSession } from './types'
import { toast } from 'sonner'
import { forceLogout, isAuthExpiredError } from '@/lib/auth-error'

function getSessionsKey(): string {
  if (typeof window === 'undefined') return 'chat-sessions'
  try {
    const user = JSON.parse(localStorage.getItem('qa-user') || '{}')
    return user.id ? `chat-sessions:${user.id}` : 'chat-sessions'
  } catch { return 'chat-sessions' }
}

const extractTitle = (text: string, maxLength = 30): string => {
  const cleaned = text.replace(/\n/g, ' ').trim()
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) + '...' : cleaned
}

export function useSessionManager() {
  const {
    sessions, currentSessionId, loadSessions, setCurrentSessionId,
    addSession, updateSession, deleteSession, clearAllSessions,
  } = useChatStore()

  const handleNewChat = useCallback(() => { setCurrentSessionId(null) }, [setCurrentSessionId])

  const handleSelectSession = useCallback((id: string) => { setCurrentSessionId(id) }, [setCurrentSessionId])

  const saveSessionMessages = useCallback(
    (sessionId: string, messages: UIMessage[]) => {
      const stored = localStorage.getItem(getSessionsKey())
      if (!stored) return
      try {
        const data: StoredSession[] = JSON.parse(stored)
        const index = data.findIndex((s) => s.id === sessionId)
        const firstUserMsg = messages.find((m) => m.role === 'user')
        const title = firstUserMsg
          ? extractTitle(firstUserMsg.parts.filter((p) => p.type === 'text').map((p) => p.text).join('') || '新对话')
          : '新对话'
        const lastMsg = messages.length > 0
          ? messages[messages.length - 1].parts.filter((p) => p.type === 'text').map((p) => p.text).join('')
          : '新对话'
        const session: StoredSession = { id: sessionId, title, lastMessage: lastMsg, updatedAt: new Date(), messages }
        if (index >= 0) { data[index] = { ...data[index], ...session } }
        else { data.unshift(session) }
        localStorage.setItem(getSessionsKey(), JSON.stringify(data))
      } catch { /* ignore */ }
    }, []
  )

  const loadSessionMessages = useCallback((sessionId: string): UIMessage[] => {
    const stored = localStorage.getItem(getSessionsKey())
    if (!stored) return []
    try {
      const data: StoredSession[] = JSON.parse(stored)
      return data.find((s) => s.id === sessionId)?.messages || []
    } catch { return [] }
  }, [])

  const handleRenameSession = useCallback((id: string, title: string) => {
    updateSession(id, { title })
    const stored = localStorage.getItem(getSessionsKey())
    if (stored) {
      try {
        const data: StoredSession[] = JSON.parse(stored)
        localStorage.setItem(getSessionsKey(), JSON.stringify(data.map((s) => s.id === id ? { ...s, title } : s)))
      } catch { /* ignore */ }
    }
  }, [updateSession])

  const handlePinSession = useCallback((id: string) => {
    const session = sessions.find((s) => s.id === id)
    if (!session) return
    updateSession(id, { pinned: !session.pinned })
    const stored = localStorage.getItem(getSessionsKey())
    if (stored) {
      try {
        const data: StoredSession[] = JSON.parse(stored)
        localStorage.setItem(getSessionsKey(), JSON.stringify(data.map((s) => s.id === id ? { ...s, pinned: !(s as StoredSession).pinned } : s)))
      } catch { /* ignore */ }
    }
  }, [sessions, updateSession])

  const handleDeleteSession = useCallback((id: string) => {
    deleteSession(id)
    const stored = localStorage.getItem(getSessionsKey())
    if (stored) {
      try {
        const data: StoredSession[] = JSON.parse(stored)
        localStorage.setItem(getSessionsKey(), JSON.stringify(data.filter((s) => s.id !== id)))
      } catch { /* ignore */ }
    }
  }, [deleteSession])

  const handleExportData = useCallback(() => {
    const stored = localStorage.getItem(getSessionsKey())
    if (!stored) { toast.warning('没有可导出的数据'); return }
    const blob = new Blob([stored], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `qa-chat-data-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('数据导出成功')
  }, [])

  return {
    sessions, currentSessionId, loadSessions,
    handleNewChat, handleSelectSession, handleDeleteSession,
    handleRenameSession, handlePinSession,
    handleClearAllSessions: clearAllSessions, handleExportData,
    saveSessionMessages, loadSessionMessages,
  }
}

export function useChatAuthCheck() {
  return useCallback(async (error: unknown) => {
    if (isAuthExpiredError(error)) { forceLogout(); return true }
    return false
  }, [])
}
