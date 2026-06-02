'use client'

import { useState, useCallback, KeyboardEvent, useRef, forwardRef, useImperativeHandle } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ArrowUp, Square } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ChatInputHandle {
  setInput: (text: string) => void
  focus: () => void
}

interface ChatInputProps {
  onSend: (text: string) => void
  onStop?: () => void
  isLoading: boolean
}

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(
  function ChatInput({ onSend, onStop, isLoading }, ref) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useImperativeHandle(ref, () => ({
    setInput: (text: string) => setInput(text),
    focus: () => textareaRef.current?.focus(),
  }))
  const handleSubmit = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return
    onSend(trimmed)
    setInput('')
  }, [input, isLoading, onSend])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  return (
    <div className="sticky bottom-0 border-t border-border/50 bg-background/80 p-4 backdrop-blur-xl">
      <div className="mx-auto max-w-3xl">
        <div className="relative flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm transition-shadow focus-within:shadow-md focus-within:ring-1 focus-within:ring-ring/20">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            className={cn(
              'min-h-[44px] max-h-[200px] flex-1 resize-none border-0 bg-transparent px-3 py-3',
              'placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0'
            )}
            rows={1}
          />
          
          <Button
            onClick={isLoading ? onStop : handleSubmit}
            disabled={!input.trim() && !isLoading}
            size="icon"
            className={cn(
              'size-10 shrink-0 rounded-xl transition-all',
              isLoading
                ? 'bg-red-500 text-white hover:bg-red-600'
                : input.trim()
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {isLoading ? (
              <Square className="size-4 fill-current" />
            ) : (
              <ArrowUp className="size-4" />
            )}
            <span className="sr-only">{isLoading ? '停止' : '发送'}</span>
          </Button>
        </div>
        
        <p className="mt-2 text-center text-xs text-muted-foreground">
          AI 可能会产生不准确的信息。请验证重要内容。
        </p>
      </div>
    </div>
  )
})
