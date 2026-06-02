'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  PanelLeft,
  Plus,
  MessageSquare,
  BookOpen,
  Settings,
  MoreVertical,
  Trash2,
  Edit3,
  Download,
  HelpCircle,
  Info,
  Pin,
  Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { QALogo } from '@/components/qa-logo'
import { KnowledgeBaseManager } from '@/components/knowledge-base-manager'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export interface ChatSession {
  id: string
  title: string
  lastMessage: string
  updatedAt: Date
  pinned?: boolean
}

interface ChatSidebarProps {
  sessions: ChatSession[]
  currentSessionId: string | null
  onNewChat: () => void
  onSelectSession: (id: string) => void
  onDeleteSession: (id: string) => void
  onRenameSession: (id: string, title: string) => void
  onPinSession: (id: string) => void
  isCollapsed: boolean
  onToggleCollapse: () => void
  onClearAllSessions?: () => void
  onExportData?: () => void
}

export function ChatSidebar({
  sessions,
  currentSessionId,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
  onPinSession,
  isCollapsed,
  onToggleCollapse,
  onClearAllSessions,
  onExportData,
}: ChatSidebarProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem('qa-user') || '{}')
      setIsAdmin(user.role === 'admin')
    } catch { setIsAdmin(false) }
  }, [])

  // 按日期分组会话（置顶的排在前面）
  const groupSessionsByDate = (sessions: ChatSession[]) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const lastWeek = new Date(today)
    lastWeek.setDate(lastWeek.getDate() - 7)

    const pinnedSessions = sessions.filter(s => s.pinned)
    const unpinnedSessions = sessions.filter(s => !s.pinned)

    const groups: { label: string; sessions: ChatSession[] }[] = []

    // 置顶分组
    if (pinnedSessions.length > 0) {
      groups.push({ label: '置顶', sessions: pinnedSessions })
    }

    // 按日期分组（仅非置顶）
    const dateGroups: { label: string; sessions: ChatSession[] }[] = [
      { label: '今天', sessions: [] },
      { label: '昨天', sessions: [] },
      { label: '最近 7 天', sessions: [] },
      { label: '更早', sessions: [] },
    ]

    unpinnedSessions.forEach((session) => {
      const date = new Date(session.updatedAt)
      date.setHours(0, 0, 0, 0)

      if (date.getTime() === today.getTime()) {
        dateGroups[0].sessions.push(session)
      } else if (date.getTime() === yesterday.getTime()) {
        dateGroups[1].sessions.push(session)
      } else if (date >= lastWeek) {
        dateGroups[2].sessions.push(session)
      } else {
        dateGroups[3].sessions.push(session)
      }
    })

    dateGroups.filter(g => g.sessions.length > 0).forEach(g => groups.push(g))

    return groups
  }

  const groupedSessions = groupSessionsByDate(sessions)

  if (isCollapsed) {
    return (
      <aside className="flex w-16 flex-col border-r border-border/50 bg-sidebar">
        <div className="flex h-14 items-center justify-center border-b border-border/50">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleCollapse}
                className="size-10"
              >
                <PanelLeft className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">展开菜单</TooltipContent>
          </Tooltip>
        </div>

        <div className="flex flex-1 flex-col items-center gap-2 p-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onNewChat}
                className="size-10"
              >
                <Plus className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">新对话</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-10">
                <BookOpen className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">知识库</TooltipContent>
          </Tooltip>
        </div>

        <div className="border-t border-border/50 p-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-10">
                <Settings className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">设置</TooltipContent>
          </Tooltip>
        </div>
      </aside>
    )
  }

  return (
    <aside className="flex w-88 flex-col border-r border-border/50 bg-sidebar">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border/50 px-4">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
            <QALogo size="sm" />
          </div>
          <span className="font-semibold tracking-tight">QA Platform</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="size-8"
        >
          <PanelLeft className="size-4" />
        </Button>
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <Button
          onClick={onNewChat}
          variant="outline"
          className="w-full justify-start gap-2 border-dashed"
        >
          <Plus className="size-4" />
          新对话
        </Button>
      </div>

      {/* Sessions List — plain div, no ScrollArea clipping */}
      <div className="flex-1 overflow-y-auto pl-3 pr-5">
        <div className="space-y-4 pb-4">
          {/* Chats Section */}
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <MessageSquare className="size-3.5" />
              对话记录
            </div>
            
            {groupedSessions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/50 p-3 text-center">
                <p className="text-sm font-medium text-foreground">暂无对话记录</p>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                  开始新对话后，您的历史记录将显示在这里
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {groupedSessions.map((group) => (
                  <div key={group.label}>
                    <p className="mb-1 text-xs text-muted-foreground">{group.label}</p>
                    <div className="space-y-0.5">
                      {group.sessions.map((session) => (
                        <div
                          key={session.id}
                          className={cn(
                            'group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 transition-colors',
                            currentSessionId === session.id
                              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                              : 'hover:bg-sidebar-accent/50'
                          )}
                          onClick={() => onSelectSession(session.id)}
                        >
                          {session.pinned ? (
                            <Pin className="size-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
                          )}

                          {renamingId === session.id ? (
                            <input
                              className="min-w-0 flex-1 rounded border border-border bg-background px-1.5 py-0.5 text-sm outline-none focus:border-primary"
                              value={renameValue}
                              autoFocus
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  if (renameValue.trim()) {
                                    onRenameSession(session.id, renameValue.trim())
                                  }
                                  setRenamingId(null)
                                } else if (e.key === 'Escape') {
                                  setRenamingId(null)
                                }
                              }}
                              onBlur={() => {
                                if (renameValue.trim()) {
                                  onRenameSession(session.id, renameValue.trim())
                                }
                                setRenamingId(null)
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span className="min-w-0 flex-1 truncate text-sm">{session.title}</span>
                          )}

                          <DropdownMenu
                            onOpenChange={(open) => {
                              if (open) {
                                setOpenMenuId(session.id)
                              } else {
                                setOpenMenuId(null)
                              }
                            }}
                          >
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 shrink-0 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreVertical className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onPinSession(session.id)
                                  }}
                                >
                                  <Pin className="mr-2 size-4" />
                                  {session.pinned ? '取消置顶' : '置顶'}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setRenamingId(session.id)
                                    setRenameValue(session.title)
                                  }}
                                >
                                  <Edit3 className="mr-2 size-4" />
                                  重命名
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onDeleteSession(session.id)
                                  }}
                                >
                                  <Trash2 className="mr-2 size-4" />
                                  删除
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Knowledge Base Section */}
      <KnowledgeBaseManager />

      {/* Footer */}
      <div className="border-t border-border/50 p-3 space-y-2">
        {/* Admin link */}
        {isAdmin && (
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-muted-foreground"
            onClick={() => window.location.href = '/admin'}
          >
            <Shield className="size-4" />
            用户管理
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground">
              <Settings className="size-4" />
              设置与帮助
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onClearAllSessions}>
              <Trash2 className="mr-2 size-4" />
              清空所有对话
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExportData}>
              <Download className="mr-2 size-4" />
              导出对话数据
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => {
              localStorage.removeItem('qa-token')
              localStorage.removeItem('qa-user')
              window.location.href = '/login'
            }}>
              <Info className="mr-2 size-4" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
