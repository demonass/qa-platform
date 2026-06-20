import type { UIMessage } from 'ai'

export interface ChatSession {
  id: string
  title: string
  lastMessage: string
  updatedAt: Date
  pinned?: boolean
}

export interface StoredSession extends ChatSession {
  messages: UIMessage[]
}

export interface EditorFile {
  id: string
  name: string
  content: string
  language: 'text' | 'markdown' | 'javascript' | 'typescript' | 'python' | 'json' | 'html' | 'css'
}

export interface ChatSessionGroup {
  label: string
  sessions: ChatSession[]
}
