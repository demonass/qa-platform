'use client'

import type { UIMessage } from 'ai'
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
} from '@/components/ai-elements/message'
import { User, Copy, RotateCcw, X } from 'lucide-react'
import { QALogo } from '@/components/qa-logo'
import { cn } from '@/lib/utils'

interface ChatMessagesProps {
  messages: UIMessage[]
  isLoading: boolean
  onCopy?: (text: string) => void
  onRetry?: (userMessage: UIMessage, aiMessageId: string) => void
  onDelete?: (userMessageId: string, aiMessageId: string) => void
}

const getMessageText = (message: UIMessage): string =>
  message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");

export function ChatMessages({ messages, isLoading, onCopy, onRetry, onDelete }: ChatMessagesProps) {
  return (
    <Conversation className="flex-1">
      <ConversationContent className="mx-auto max-w-3xl gap-6 px-4 py-6">
        {messages.map((message, index) => {
          const isUser = message.role === 'user'
          const isLast = index === messages.length - 1
          const isStreaming = isLoading && isLast && !isUser
          const prevMessage = index > 0 ? messages[index - 1] : null
          const isPrevUserMessage = prevMessage?.role === 'user'

          return (
            <div
              key={message.id}
              className={cn(
                'flex gap-3',
                'flex-row'
              )}
            >
              {/* 用户头像在左边 */}
              {isUser && (
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                  <User className="size-4" />
                </div>
              )}
              
              {/* AI头像在左边 */}
              {!isUser && (
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <QALogo size="sm" />
                </div>
              )}
              
              <Message from={message.role} className="max-w-[85%]">
                <MessageContent>
                  {message.parts.map((part, i) => {
                    if (part.type === 'text') {
                      return (
                        <MessageResponse
                          key={`${message.id}-${i}`}
                          isAnimating={isStreaming}
                        >
                          {part.text}
                        </MessageResponse>
                      )
                    }
                    return null
                  })}
                </MessageContent>
                {!isUser && prevMessage && isPrevUserMessage && (
                  <MessageActions>
                    <MessageAction
                      tooltip="复制用户消息"
                      onClick={() => onCopy?.(getMessageText(prevMessage))}
                    >
                      <Copy className="size-4" />
                    </MessageAction>
                    <MessageAction
                      tooltip="重新对话"
                      onClick={() => onRetry?.(prevMessage, message.id)}
                    >
                      <RotateCcw className="size-4" />
                    </MessageAction>
                    <MessageAction
                      tooltip="删除对话"
                      onClick={() => onDelete?.(prevMessage.id, message.id)}
                    >
                      <X className="size-4" />
                    </MessageAction>
                  </MessageActions>
                )}
              </Message>
            </div>
          )
        })}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  )
}
