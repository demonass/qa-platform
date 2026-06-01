'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  X,
  FileText,
  Code,
  Copy,
  Check,
  Download,
  PanelRightClose,
  Plus,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export interface EditorFile {
  id: string
  name: string
  content: string
  language: 'text' | 'markdown' | 'javascript' | 'typescript' | 'python' | 'json' | 'html' | 'css'
}

interface EditorPanelProps {
  isOpen: boolean
  onClose: () => void
  files: EditorFile[]
  onFilesChange: (files: EditorFile[]) => void
  activeFileId: string | null
  onActiveFileChange: (id: string | null) => void
}

const languageLabels: Record<EditorFile['language'], string> = {
  text: '纯文本',
  markdown: 'Markdown',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python',
  json: 'JSON',
  html: 'HTML',
  css: 'CSS',
}

export function EditorPanel({
  isOpen,
  onClose,
  files,
  onFilesChange,
  activeFileId,
  onActiveFileChange,
}: EditorPanelProps) {
  const [copied, setCopied] = useState(false)
  
  const activeFile = files.find(f => f.id === activeFileId)

  const handleCopy = async () => {
    if (!activeFile) return
    await navigator.clipboard.writeText(activeFile.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    if (!activeFile) return
    const blob = new Blob([activeFile.content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = activeFile.name
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleNewFile = () => {
    const newFile: EditorFile = {
      id: Math.random().toString(36).substring(2, 9),
      name: `untitled-${files.length + 1}.txt`,
      content: '',
      language: 'text',
    }
    onFilesChange([...files, newFile])
    onActiveFileChange(newFile.id)
  }

  const handleCloseFile = (id: string) => {
    const newFiles = files.filter(f => f.id !== id)
    onFilesChange(newFiles)
    if (activeFileId === id) {
      onActiveFileChange(newFiles.length > 0 ? newFiles[newFiles.length - 1].id : null)
    }
  }

  const handleContentChange = (content: string) => {
    if (!activeFileId) return
    onFilesChange(files.map(f => f.id === activeFileId ? { ...f, content } : f))
  }

  const handleLanguageChange = (language: EditorFile['language']) => {
    if (!activeFileId) return
    onFilesChange(files.map(f => f.id === activeFileId ? { ...f, language } : f))
  }

  const handleRename = (id: string, name: string) => {
    onFilesChange(files.map(f => f.id === id ? { ...f, name } : f))
  }

  if (!isOpen) return null

  return (
    <div className="flex h-full w-80 flex-col border-l border-border bg-card lg:w-96">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">文档编辑器</span>
        </div>
        <Button variant="ghost" size="icon" className="size-8" onClick={onClose}>
          <PanelRightClose className="size-4" />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-muted/30 px-2 py-1">
        {files.map(file => (
          <div
            key={file.id}
            className={cn(
              'group flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors cursor-pointer',
              activeFileId === file.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
            )}
            onClick={() => onActiveFileChange(file.id)}
          >
            <Code className="size-3.5" />
            <span className="max-w-24 truncate">{file.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleCloseFile(file.id)
              }}
              className="ml-0.5 rounded p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={handleNewFile}
        >
          <Plus className="size-3.5" />
        </Button>
      </div>

      {/* Editor Area */}
      {activeFile ? (
        <>
          {/* Toolbar */}
          <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
                  {languageLabels[activeFile.language]}
                  <ChevronDown className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {Object.entries(languageLabels).map(([key, label]) => (
                  <DropdownMenuItem
                    key={key}
                    onClick={() => handleLanguageChange(key as EditorFile['language'])}
                  >
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={handleCopy}
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={handleDownload}
              >
                <Download className="size-3.5" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            <textarea
              value={activeFile.content}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder="在此输入或粘贴内容..."
              className={cn(
                'size-full resize-none bg-transparent p-4 text-sm leading-relaxed outline-none',
                activeFile.language !== 'text' && activeFile.language !== 'markdown'
                  ? 'font-mono text-xs'
                  : ''
              )}
              spellCheck={false}
            />
          </div>

          {/* Footer */}
          <div className="flex shrink-0 items-center justify-between border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
            <input
              type="text"
              value={activeFile.name}
              onChange={(e) => handleRename(activeFile.id, e.target.value)}
              className="bg-transparent outline-none hover:text-foreground focus:text-foreground"
            />
            <span>{activeFile.content.length} 字符</span>
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
            <FileText className="size-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-foreground">暂无打开的文件</p>
            <p className="mt-1 text-sm text-muted-foreground">
              点击上方 + 按钮创建新文件
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleNewFile}>
            <Plus className="mr-1.5 size-4" />
            新建文件
          </Button>
        </div>
      )}
    </div>
  )
}
