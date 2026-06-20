'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { MessageSquare, Pin, MoreVertical, Edit3, Trash2 } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { ChatSession } from '../types'

interface ChatSessionItemProps {
  session: ChatSession
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
  onRename: (title: string) => void
  onPin: () => void
}

export function ChatSessionItem({ session, isActive, onSelect, onDelete, onRename, onPin }: ChatSessionItemProps) {
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(session.title)

  const commitRename = () => {
    const trimmed = renameValue.trim()
    if (trimmed) onRename(trimmed)
    setRenaming(false)
  }

  return (
    <div
      className={cn(
        'group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 transition-colors',
        isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'hover:bg-sidebar-accent/50'
      )}
      onClick={onSelect}
    >
      {session.pinned ? <Pin className="size-4 shrink-0 text-muted-foreground" /> : <MessageSquare className="size-4 shrink-0 text-muted-foreground" />}
      {renaming ? (
        <input
          className="min-w-0 flex-1 rounded border border-border bg-background px-1.5 py-0.5 text-sm outline-none focus:border-primary"
          value={renameValue} autoFocus onFocus={(e) => e.target.select()}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitRename() } if (e.key === 'Escape') setRenaming(false) }}
          onBlur={commitRename} onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="min-w-0 flex-1 truncate text-sm">{session.title}</span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-7 shrink-0 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100" onClick={(e) => e.stopPropagation()}>
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onPin() }}><Pin className="mr-2 size-4" />{session.pinned ? '取消置顶' : '置顶'}</DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setRenameValue(session.title); setRenaming(true) }}><Edit3 className="mr-2 size-4" />重命名</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete() }}><Trash2 className="mr-2 size-4" />删除</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
