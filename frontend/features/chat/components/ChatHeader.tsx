'use client'

import { Button } from '@/components/ui/button'
import { PanelRight } from 'lucide-react'

interface ChatHeaderProps {
  editorOpen: boolean
  onToggleEditor: () => void
}

export function ChatHeader({ editorOpen, onToggleEditor }: ChatHeaderProps) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-end border-b border-border/50 bg-background/80 px-4 backdrop-blur-xl">
      <Button variant="ghost" size="sm" className="gap-2" onClick={onToggleEditor}>
        <PanelRight className="size-4" />
        <span className="text-sm">{editorOpen ? '关闭编辑器' : '打开编辑器'}</span>
      </Button>
    </header>
  )
}
