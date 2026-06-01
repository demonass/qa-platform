'use client'

import { Lightbulb, Database, FileSearch, ClipboardList, TestTube, Code } from 'lucide-react'
import { cn } from '@/lib/utils'
import { QALogo } from '@/components/qa-logo'

interface EmptyStateProps {
  onSuggestionClick: (text: string) => void
}

const suggestions = [
  {
    icon: Lightbulb,
    title: '头脑风暴',
    prompt: '我想开发一个效率工具，请帮我进行头脑风暴，列出一些创新的功能点',
  },
  {
    icon: Database,
    title: '知识库问答',
    prompt: '请根据知识库中的内容，回答我的问题',
  },
  {
    icon: FileSearch,
    title: '分析文档',
    prompt: '请帮我分析以下文档的主要内容和关键信息',
  },
  {
    icon: ClipboardList,
    title: '测试计划',
    prompt: '请帮我制定一份详细的软件测试计划，包括测试范围、策略和时间安排',
  },
  {
    icon: TestTube,
    title: '测试用例',
    prompt: '请帮我编写测试用例，覆盖功能测试、边界测试和异常测试场景',
  },
  {
    icon: Code,
    title: '分析代码',
    prompt: '请帮我分析以下代码，找出潜在的问题和优化建议',
  },
]

export function EmptyState({ onSuggestionClick }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary">
          <QALogo size="lg" />
        </div>
        <h1 className="mb-2 text-2xl font-semibold tracking-tight text-foreground">
          欢迎使用 QA 智能助手
        </h1>
        <p className="max-w-md text-balance text-muted-foreground">
          我是你的智能助手，可以帮你回答问题、写代码、头脑风暴等。试试下面的建议开始对话吧！
        </p>
      </div>
      
      <div className="grid w-full max-w-2xl gap-2 grid-cols-2 sm:grid-cols-3">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.title}
            onClick={() => onSuggestionClick(suggestion.prompt)}
            className={cn(
              'group flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-all',
              'hover:border-primary/30 hover:bg-accent/50 hover:shadow-sm'
            )}
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
              <suggestion.icon className="size-4" />
            </div>
            <span className="text-sm font-medium text-foreground">{suggestion.title}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
