'use client'

import type { ChatSession, ChatSessionGroup } from '../types'
import { ChatSessionItem } from './ChatSessionItem'

interface ChatSessionListProps {
  sessions: ChatSession[]
  currentSessionId: string | null
  onSelectSession: (id: string) => void
  onDeleteSession: (id: string) => void
  onRenameSession: (id: string, title: string) => void
  onPinSession: (id: string) => void
}

function groupSessions(sessions: ChatSession[]): ChatSessionGroup[] {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const lastWeek = new Date(today.getTime() - 7 * 86400000)

  const pinned = sessions.filter((s) => s.pinned)
  const unpinned = sessions.filter((s) => !s.pinned)

  const groups: ChatSessionGroup[] = []
  if (pinned.length > 0) groups.push({ label: '置顶', sessions: pinned })

  const dateGroups: ChatSessionGroup[] = [
    { label: '今天', sessions: [] },
    { label: '昨天', sessions: [] },
    { label: '最近 7 天', sessions: [] },
    { label: '更早', sessions: [] },
  ]

  for (const s of unpinned) {
    const d = new Date(s.updatedAt)
    d.setHours(0, 0, 0, 0)
    if (d.getTime() === today.getTime()) dateGroups[0].sessions.push(s)
    else if (d.getTime() === yesterday.getTime()) dateGroups[1].sessions.push(s)
    else if (d >= lastWeek) dateGroups[2].sessions.push(s)
    else dateGroups[3].sessions.push(s)
  }

  for (const g of dateGroups) { if (g.sessions.length > 0) groups.push(g) }
  return groups
}

export function ChatSessionList({ sessions, currentSessionId, onSelectSession, onDeleteSession, onRenameSession, onPinSession }: ChatSessionListProps) {
  const grouped = groupSessions(sessions)

  if (grouped.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/50 p-3 text-center">
        <p className="text-sm font-medium text-foreground">暂无对话记录</p>
        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">开始新对话后，您的历史记录将显示在这里</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {grouped.map((group) => (
        <div key={group.label}>
          <p className="mb-1 text-xs text-muted-foreground">{group.label}</p>
          <div className="space-y-0.5">
            {group.sessions.map((session) => (
              <ChatSessionItem key={session.id} session={session} isActive={currentSessionId === session.id}
                onSelect={() => onSelectSession(session.id)} onDelete={() => onDeleteSession(session.id)}
                onRename={(title) => onRenameSession(session.id, title)} onPin={() => onPinSession(session.id)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
