'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  BookOpen,
  Plus,
  Upload,
  FileText,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'

interface DocumentFile {
  name: string
  size: number
  createdAt: string
  updatedAt: string
}

interface UploadResult {
  status: string
  filename: string
  file_size: number
  module_count: number
  modules?: Array<{ topic: string; content: string }>
  error?: string
  warning?: string
}

export function KnowledgeBaseManager() {
  const [files, setFiles] = useState<DocumentFile[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [ragStatus, setRagStatus] = useState<'available' | 'not_available' | 'loading' | 'error'>('loading')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) return '今天'
    if (days === 1) return '昨天'
    if (days < 7) return `${days} 天前`
    return date.toLocaleDateString('zh-CN')
  }

  const fetchDocuments = async () => {
    try {
      const response = await fetch('/api/document/list')
      const data = await response.json()
      setFiles(data.files || [])
    } catch (error) {
      console.error('Failed to fetch documents:', error)
    }
  }

  const fetchRagStatus = async () => {
    setRagStatus('loading')
    try {
      const response = await fetch('/api/document/upload')
      const data = await response.json()
      setRagStatus(data.status === 'available' ? 'available' : 'not_available')
    } catch (error) {
      setRagStatus('not_available')
    }
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const allowedExtensions = ['.txt', '.md', '.docx', '.pdf']
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
    
    if (!allowedExtensions.includes(fileExtension)) {
      toast({
        title: '不支持的文件格式',
        description: '请上传 txt、md、docx 或 pdf 格式的文件',
        variant: 'destructive',
      })
      return
    }

    setUploading(true)
    setUploadProgress(0)

    // 模拟上传进度
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) return prev
        return prev + 10
      })
    }, 200)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('strategy', 'semantic')
      formData.append('target_chunks', '5')

      console.log('Uploading file:', file.name)
      console.log('File size:', file.size)

      const response = await fetch('/api/document/upload', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      console.log('Upload response status:', response.status)

      const data: UploadResult = await response.json()

      console.log('Upload response data:', data)

      if (response.ok && data.status === 'success') {
        if (data.warning) {
          toast({
            title: '上传成功',
            description: `${data.filename} 已保存，但${data.warning}`,
            variant: 'default',
          })
        } else {
          toast({
            title: '上传成功',
            description: `${data.filename} 已成功处理，生成了 ${data.module_count} 个模块`,
            variant: 'default',
          })
        }
        await fetchDocuments()
        
        // 自动调用 RAG 服务构建向量索引
        setRagStatus('loading')
        const loadingToast = toast({
          title: '正在构建索引',
          description: '正在为新上传的文档构建向量索引...',
          variant: 'default',
        })
        
        try {
          const ragResponse = await fetch('/api/rag/reload', {
            method: 'POST',
          })
          
          if (ragResponse.ok) {
            const ragData = await ragResponse.json()
            toast({
              title: '索引构建完成',
              description: ragData.message || 'RAG 索引已成功更新',
              variant: 'default',
            })
            setRagStatus('available')
          } else {
            const ragData = await ragResponse.json().catch(() => ({ detail: '索引构建失败' }))
            toast({
              title: '索引构建失败',
              description: ragData.detail || ragData.message || '无法更新 RAG 索引',
              variant: 'destructive',
            })
            setRagStatus('error')
          }
        } catch (error) {
          toast({
            title: '索引构建失败',
            description: error instanceof Error ? error.message : '网络错误',
            variant: 'destructive',
          })
          setRagStatus('error')
        } finally {
          loadingToast.dismiss()
        }
      } else {
        toast({
          title: '上传失败',
          description: data.status || data.error || '文件处理失败',
          variant: 'destructive',
        })
      }
    } catch (error) {
      clearInterval(progressInterval)
      console.error('Upload error:', error)
      toast({
        title: '上传失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      })
    } finally {
      setTimeout(() => {
        setUploading(false)
        setUploadProgress(0)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }, 500)
    }
  }

  const deleteDocument = async (filename: string) => {
    try {
      const response = await fetch(`/api/document/delete?filename=${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast({
          title: '删除成功',
          description: `${filename} 已删除`,
          variant: 'default',
        })
        await fetchDocuments()
        await reloadRagIndex()
      } else {
        const data = await response.json().catch(() => ({ error: '删除失败' }))
        toast({
          title: '删除失败',
          description: data.error || '文件删除失败',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: '删除失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      })
    }
  }

  const reloadRagIndex = async () => {
    setRagStatus('loading')
    try {
      const response = await fetch('/api/rag/reload', {
        method: 'POST',
      })

      if (response.ok) {
        const data = await response.json()
        toast({
          title: '索引已更新',
          description: data.message || 'RAG 索引重新加载成功',
          variant: 'default',
        })
        setRagStatus('available')
      } else {
        const data = await response.json().catch(() => ({ detail: '重新加载失败' }))
        toast({
          title: '重新加载失败',
          description: data.detail || 'RAG 索引重新加载失败',
          variant: 'destructive',
        })
        setRagStatus('not_available')
      }
    } catch (error) {
      toast({
        title: '重新加载失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      })
      setRagStatus('not_available')
    }
  }

  useEffect(() => {
    fetchDocuments()
    fetchRagStatus()
  }, [])

  return (
    <div className="border-t border-border/50 p-3">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <BookOpen className="size-3.5" />
          知识库
        </div>
        <div className="flex items-center gap-1">
          {ragStatus === 'loading' ? (
            <Loader2 className="size-3.5 text-muted-foreground animate-spin" />
          ) : ragStatus === 'available' ? (
            <CheckCircle2 className="size-3.5 text-green-500" />
          ) : (
            <AlertCircle className="size-3.5 text-yellow-500" />
          )}
          <span className="text-xs text-muted-foreground">
            {ragStatus === 'loading' ? '加载中' : ragStatus === 'available' ? '就绪' : '未就绪'}
          </span>
        </div>
      </div>

      {/* Upload Area */}
      <div
        className={cn(
          'rounded-lg border-2 border-dashed border-border/50 p-3 text-center transition-colors cursor-pointer',
          uploading && 'opacity-50'
        )}
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          if (uploading) return
          const file = e.dataTransfer.files?.[0]
          if (file) {
            const input = fileInputRef.current
            if (input) {
              const dataTransfer = new DataTransfer()
              dataTransfer.items.add(file)
              input.files = dataTransfer.files
              handleFileChange({ target: input } as React.ChangeEvent<HTMLInputElement>)
            }
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.docx,.pdf"
          onChange={handleFileChange}
          className="hidden"
        />
        
        {uploading ? (
          <>
            <Loader2 className="mx-auto size-6 text-muted-foreground/50 animate-spin" />
            <p className="mt-1.5 text-sm font-medium text-foreground">上传中...</p>
            <div className="mt-2 h-1 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </>
        ) : (
          <>
            <Upload className="mx-auto size-6 text-muted-foreground/50" />
            <p className="mt-1.5 text-sm font-medium text-foreground">上传文档</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              支持 txt、md、docx、pdf 格式
            </p>
          </>
        )}
      </div>

      {/* Document List */}
      {files.length > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">已上传文件 ({files.length})</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={reloadRagIndex}
              className="size-6"
              disabled={ragStatus === 'loading'}
            >
              <RefreshCw className={cn('size-3', ragStatus === 'loading' && 'animate-spin')} />
            </Button>
          </div>
          
          <ScrollArea className="max-h-32">
            <div className="space-y-1">
              {files.map((file) => (
                <div
                  key={file.name}
                  className="flex items-center justify-between rounded px-2 py-1.5 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="size-3.5 text-muted-foreground" />
                    <span className="truncate">{file.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-5 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteDocument(file.name)}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Status Info */}
      {ragStatus === 'not_available' && files.length > 0 && (
        <div className="mt-3 rounded bg-yellow-50/50 p-2 text-xs text-yellow-700">
          RAG 服务未就绪，请点击刷新按钮重新加载索引
        </div>
      )}

      {files.length === 0 && (
        <div className="mt-3 rounded bg-muted/50 p-2 text-center text-xs text-muted-foreground">
          暂无文档，上传文档后 AI 可以更好地理解您的业务
        </div>
      )}
    </div>
  )
}