'use client'

import { create } from 'zustand'
import type { ChatSession, EditorFile } from './types'

function getSessionsKey(): string {
  if (typeof window === 'undefined') return 'chat-sessions'
  try {
    const user = JSON.parse(localStorage.getItem('qa-user') || '{}')
    return user.id ? `chat-sessions:${user.id}` : 'chat-sessions'
  } catch { return 'chat-sessions' }
}

function loadSessions(): ChatSession[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(getSessionsKey())
    if (!stored) return []
    const data = JSON.parse(stored)
    return data.map((s: Record<string, unknown>) => ({ ...s, updatedAt: new Date(s.updatedAt as string) }))
  } catch { return [] }
}

function persistSessions(sessions: ChatSession[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(getSessionsKey(), JSON.stringify(sessions))
}

interface ChatUIState {
  sessions: ChatSession[]
  currentSessionId: string | null
  sidebarCollapsed: boolean
  editorOpen: boolean
  webSearchMode: boolean
  mobileSheetOpen: boolean
  editorFiles: EditorFile[]
  activeFileId: string | null
  loadSessions: () => void
  setCurrentSessionId: (id: string | null) => void
  addSession: (session: ChatSession) => void
  updateSession: (id: string, updates: Partial<ChatSession>) => void
  deleteSession: (id: string) => void
  clearAllSessions: () => void
  setSidebarCollapsed: (v: boolean) => void
  setEditorOpen: (v: boolean) => void
  setWebSearchMode: (v: boolean) => void
  setMobileSheetOpen: (v: boolean) => void
  setEditorFiles: (files: EditorFile[]) => void
  setActiveFileId: (id: string | null) => void
}

export const useChatStore = create<ChatUIState>()((set, get) => ({
  sessions: [],
  currentSessionId: null,
  sidebarCollapsed: false,
  editorOpen: false,
  webSearchMode: false,
  mobileSheetOpen: false,
  editorFiles: [],
  activeFileId: null,

  loadSessions: () => set({ sessions: loadSessions() }),

  setCurrentSessionId: (id) => set({ currentSessionId: id }),

  addSession: (session) => {
    const sessions = [session, ...get().sessions]
    persistSessions(sessions)
    set({ sessions, currentSessionId: session.id })
  },

  updateSession: (id, updates) => {
    const sessions = get().sessions.map((s) => s.id === id ? { ...s, ...updates } : s)
    persistSessions(sessions)
    set({ sessions })
  },

  deleteSession: (id) => {
    const sessions = get().sessions.filter((s) => s.id !== id)
    persistSessions(sessions)
    set({ sessions, currentSessionId: get().currentSessionId === id ? null : get().currentSessionId })
  },

  clearAllSessions: () => {
    localStorage.removeItem(getSessionsKey())
    set({ sessions: [], currentSessionId: null })
  },

  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  setEditorOpen: (v) => set({ editorOpen: v }),
  setWebSearchMode: (v) => set({ webSearchMode: v }),
  setMobileSheetOpen: (v) => set({ mobileSheetOpen: v }),
  setEditorFiles: (files) => set({ editorFiles: files }),
  setActiveFileId: (id) => set({ activeFileId: id }),
}))
