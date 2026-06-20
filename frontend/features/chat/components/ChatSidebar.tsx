'use client'

import { Button } from '@/components/ui/button'
import { PanelLeft, Plus, MessageSquare, Settings, Download, Trash2, Info, Shield } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { QALogo } from '@/components/qa-logo'
import { KnowledgeBasePanel } from '@/features/knowledge-base/components/KnowledgeBasePanel'
import { ChatSessionList } from './ChatSessionList'
import { useAuth } from '@/features/auth/hooks'
import { useLogout } from '@/features/auth/hooks'
import type { ChatSession } from '../types'

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

export function ChatSidebar({ sessions, currentSessionId, onNewChat, onSelectSession, onDeleteSession, onRenameSession, onPinSession, isCollapsed, onToggleCollapse, onClearAllSessions, onExportData }: ChatSidebarProps) {
  const { isAdmin } = useAuth()
  const logout = useLogout()

  if (isCollapsed) {
    return (
      <aside className="flex w-16 flex-col border-r border-border/50 bg-sidebar">
        <div className="flex h-14 items-center justify-center border-b border-border/50">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onToggleCollapse} className="size-10"><PanelLeft className="size-5" /></Button>
            </TooltipTrigger>
            <TooltipContent side="right">展开菜单</TooltipContent>
          </Tooltip>
        </div>
        <div className="flex flex-1 flex-col items-center gap-2 p-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onNewChat} className="size-10"><Plus className="size-5" /></Button>
            </TooltipTrigger>
            <TooltipContent side="right">新对话</TooltipContent>
          </Tooltip>
        </div>
        <div className="border-t border-border/50 p-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-10" onClick={logout}><Settings className="size-5" /></Button>
            </TooltipTrigger>
            <TooltipContent side="right">退出</TooltipContent>
          </Tooltip>
        </div>
      </aside>
    )
  }

  return (
    <aside className="flex w-88 flex-col border-r border-border/50 bg-sidebar">
      <div className="flex h-14 items-center justify-between border-b border-border/50 px-4">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary"><QALogo size="sm" /></div>
          <span className="font-semibold tracking-tight">QA Platform</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onToggleCollapse} className="size-8"><PanelLeft className="size-4" /></Button>
      </div>
      <div className="p-3">
        <Button onClick={onNewChat} variant="outline" className="w-full justify-start gap-2 border-dashed"><Plus className="size-4" />新对话</Button>
      </div>
      <div className="flex-1 overflow-y-auto pl-3 pr-5">
        <div className="space-y-4 pb-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground"><MessageSquare className="size-3.5" />对话记录</div>
            <ChatSessionList sessions={sessions} currentSessionId={currentSessionId} onSelectSession={onSelectSession} onDeleteSession={onDeleteSession} onRenameSession={onRenameSession} onPinSession={onPinSession} />
          </div>
        </div>
      </div>
      <KnowledgeBasePanel />
      <div className="border-t border-border/50 p-3 space-y-2">
        {isAdmin && (
          <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground" onClick={() => window.location.href = '/admin'}>
            <Shield className="size-4" />用户管理
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground"><Settings className="size-4" />设置与帮助</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onClearAllSessions}><Trash2 className="mr-2 size-4" />清空所有对话</DropdownMenuItem>
            <DropdownMenuItem onClick={onExportData}><Download className="mr-2 size-4" />导出对话数据</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}><Info className="mr-2 size-4" />退出登录</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
