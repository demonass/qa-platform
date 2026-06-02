'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  PanelLeft, 
  Plus, 
  MessageSquare, 
  BookOpen, 
  Settings,
  MoreHorizontal,
  Trash2,
  Edit3,
  Download,
  HelpCircle,
  Info
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { QALogo } from '@/components/qa-logo'
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
}

interface ChatSidebarProps {
  sessions: ChatSession[]
  currentSessionId: string | null
  onNewChat: () => void
  onSelectSession: (id: string) => void
  onDeleteSession: (id: string) => void
  onRenameSession: (id: string, title: string) => void
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
  isCollapsed,
  onToggleCollapse,
  onClearAllSessions,
  onExportData,
}: ChatSidebarProps) {
  const [hoveredSession, setHoveredSession] = useState<string | null>(null)

  // 按日期分组会话
  const groupSessionsByDate = (sessions: ChatSession[]) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const lastWeek = new Date(today)
    lastWeek.setDate(lastWeek.getDate() - 7)

    const groups: { label: string; sessions: ChatSession[] }[] = [
      { label: '今天', sessions: [] },
      { label: '昨天', sessions: [] },
      { label: '最近 7 天', sessions: [] },
      { label: '更早', sessions: [] },
    ]

    sessions.forEach((session) => {
      const date = new Date(session.updatedAt)
      date.setHours(0, 0, 0, 0)
      
      if (date.getTime() === today.getTime()) {
        groups[0].sessions.push(session)
      } else if (date.getTime() === yesterday.getTime()) {
        groups[1].sessions.push(session)
      } else if (date >= lastWeek) {
        groups[2].sessions.push(session)
      } else {
        groups[3].sessions.push(session)
      }
    })

    return groups.filter((g) => g.sessions.length > 0)
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

      {/* Sessions List */}
      <ScrollArea className="flex-1 px-3 pr-4">
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
                            'group relative flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 transition-colors',
                            currentSessionId === session.id
                              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                              : 'hover:bg-sidebar-accent/50'
                          )}
                          onClick={() => onSelectSession(session.id)}
                          onMouseEnter={() => setHoveredSession(session.id)}
                          onMouseLeave={() => setHoveredSession(null)}
                        >
                          <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
                          <span className="flex-1 truncate text-sm">{session.title}</span>
                          
                          {(hoveredSession === session.id || currentSessionId === session.id) && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-6 shrink-0 opacity-0 group-hover:opacity-100"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal className="size-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem>
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
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Knowledge Base Section - moved outside scroll area */}
      <div className="border-t border-border/50 p-3">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <BookOpen className="size-3.5" />
          知识库
        </div>
        <div className="mt-2 rounded-lg border border-dashed border-border/50 p-3 text-center">
          <BookOpen className="mx-auto size-6 text-muted-foreground/50" />
          <p className="mt-1.5 text-sm font-medium text-foreground">添加知识库</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            上传文档让 AI 更了解您的业务
          </p>
          <Button variant="outline" size="sm" className="mt-2 w-full">
            <Plus className="mr-1 size-3" />
            上传文档
          </Button>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border/50 p-3">
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
            <DropdownMenuItem>
              <HelpCircle className="mr-2 size-4" />
              使用帮助
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Info className="mr-2 size-4" />
              关于我们
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
