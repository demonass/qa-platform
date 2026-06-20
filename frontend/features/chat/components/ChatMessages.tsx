'use client'

import type { UIMessage } from 'ai'
import { Conversation, ConversationContent } from '@/components/ai-elements/conversation'
import { Message, MessageContent, MessageResponse, MessageActions, MessageAction } from '@/components/ai-elements/message'
import { User, Copy, RotateCcw, X } from 'lucide-react'
import { QALogo } from '@/components/qa-logo'
import { toast } from 'sonner'

interface ChatMessagesProps {
  messages: UIMessage[]
  isLoading: boolean
  onCopy?: (text: string) => void
  onSend: (text: string) => void
  setMessages: (messages: UIMessage[] | ((prev: UIMessage[]) => UIMessage[])) => void
}

const getMessageText = (message: UIMessage): string =>
  message.parts.filter((part) => part.type === 'text').map((part) => part.text).join('')

export function ChatMessages({ messages, isLoading, onCopy, onSend, setMessages }: ChatMessagesProps) {
  const handleRetry = (userMessage: UIMessage, aiMessageId: string) => {
    setMessages((prev: UIMessage[]) => prev.filter((m) => m.id !== userMessage.id && m.id !== aiMessageId))
    const text = getMessageText(userMessage)
    if (text) onSend(text)
  }

  const handleDelete = (userMessageId: string, aiMessageId: string) => {
    if (!userMessageId || !aiMessageId) { toast.error('消息ID无效'); return }
    setMessages((prev: UIMessage[]) => prev.filter((m) => m.id !== userMessageId && m.id !== aiMessageId))
    toast.success('对话已删除')
  }

  return (
    <Conversation className="flex-1">
      <ConversationContent className="mx-auto max-w-3xl gap-6 px-4 py-6">
        {messages.map((message, index) => {
          const isUser = message.role === 'user'
          const isLast = index === messages.length - 1
          const isStreaming = isLoading && isLast && !isUser
          const prevMessage = index > 0 ? messages[index - 1] : null

          return (
            <div key={message.id} className="flex gap-3 flex-row">
              {isUser ? (
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground"><User className="size-4" /></div>
              ) : (
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10"><QALogo size="sm" /></div>
              )}
              <Message from={message.role} className="max-w-[85%]">
                <MessageContent>
                  {message.parts.map((part, i) => {
                    if (part.type === 'text') {
                      return <MessageResponse key={`${message.id}-${i}`} isAnimating={isStreaming}>{part.text}</MessageResponse>
                    }
                    return null
                  })}
                </MessageContent>
                {!isUser && !isStreaming && (
                  <MessageActions>
                    <MessageAction tooltip="复制消息" onClick={() => { onCopy?.(getMessageText(message)) }}><Copy className="size-4" /></MessageAction>
                    <MessageAction tooltip="重新对话" onClick={() => { if (prevMessage) { handleRetry(prevMessage, message.id) } }}><RotateCcw className="size-4" /></MessageAction>
                    <MessageAction tooltip="删除对话" onClick={() => { if (prevMessage) { handleDelete(prevMessage.id, message.id) } }}><X className="size-4" /></MessageAction>
                  </MessageActions>
                )}
              </Message>
            </div>
          )
        })}
      </ConversationContent>
    </Conversation>
  )
}
