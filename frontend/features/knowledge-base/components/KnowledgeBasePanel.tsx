'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { BookOpen, Upload, FileText, RefreshCw, Trash2, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useDocuments, useUploadDocument, useDeleteDocument, useRagStatus, useRagReload } from '../hooks'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const ALLOWED_EXTENSIONS = ['.txt', '.md', '.docx', '.pdf']

export function KnowledgeBasePanel() {
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: docData, isLoading: docsLoading } = useDocuments()
  const { data: ragStatus } = useRagStatus()
  const uploadMutation = useUploadDocument()
  const deleteMutation = useDeleteDocument()
  const reloadMutation = useRagReload()

  const files = docData?.files || []

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      toast({ title: '不支持的文件格式', description: '请上传 txt、md、docx 或 pdf 格式的文件', variant: 'destructive' })
      return
    }

    setUploading(true)
    setUploadProgress(0)
    const interval = setInterval(() => { setUploadProgress((p) => (p >= 90 ? p : p + 10)) }, 200)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('strategy', 'semantic')
      formData.append('target_chunks', '5')
      const data = await uploadMutation.mutateAsync(formData)
      clearInterval(interval)
      setUploadProgress(100)
      if (data.warning) {
        toast({ title: '上传成功', description: `${data.filename} 已保存，但${data.warning}` })
      } else {
        toast({ title: '上传成功', description: `${data.filename} 已成功处理，生成了 ${data.module_count} 个模块` })
      }
      try {
        await reloadMutation.mutateAsync()
        toast({ title: '索引构建完成', description: 'RAG 索引已成功更新' })
      } catch {
        toast({ title: '索引构建失败', description: '无法更新 RAG 索引', variant: 'destructive' })
      }
    } catch (err) {
      clearInterval(interval)
      toast({ title: '上传失败', description: err instanceof Error ? err.message : '未知错误', variant: 'destructive' })
    } finally {
      setTimeout(() => { setUploading(false); setUploadProgress(0); if (fileInputRef.current) fileInputRef.current.value = '' }, 500)
    }
  }

  const handleDelete = async (filename: string) => {
    try {
      await deleteMutation.mutateAsync(filename)
      toast({ title: '删除成功', description: `${filename} 已删除` })
      await reloadMutation.mutateAsync()
    } catch {
      toast({ title: '删除失败', description: '文件删除失败', variant: 'destructive' })
    }
  }

  const handleReload = async () => {
    try {
      await reloadMutation.mutateAsync()
      toast({ title: '索引已更新', description: 'RAG 索引重新加载成功' })
    } catch {
      toast({ title: '重新加载失败', description: 'RAG 索引重新加载失败', variant: 'destructive' })
    }
  }

  const status = ragStatus || 'not_available'
  const isReloading = reloadMutation.isPending

  return (
    <div className="border-t border-border/50 p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <BookOpen className="size-3.5" />知识库
        </div>
        <div className="flex items-center gap-1">
          {isReloading ? <Loader2 className="size-3.5 text-muted-foreground animate-spin" />
            : status === 'available' ? <CheckCircle2 className="size-3.5 text-green-500" />
            : <AlertCircle className="size-3.5 text-yellow-500" />}
          <span className="text-xs text-muted-foreground">
            {isReloading ? '加载中' : status === 'available' ? '就绪' : '未就绪'}
          </span>
        </div>
      </div>

      <div className={cn('rounded-lg border-2 border-dashed border-border/50 p-3 text-center transition-colors cursor-pointer', uploading && 'opacity-50')}
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (uploading) return; const file = e.dataTransfer.files?.[0]; if (file && fileInputRef.current) { const dt = new DataTransfer(); dt.items.add(file); fileInputRef.current.files = dt.files; handleFileChange({ target: fileInputRef.current } as React.ChangeEvent<HTMLInputElement>) } }}>
        <input ref={fileInputRef} type="file" accept={ALLOWED_EXTENSIONS.join(',')} onChange={handleFileChange} className="hidden" />
        {uploading ? (
          <>
            <Loader2 className="mx-auto size-6 text-muted-foreground/50 animate-spin" />
            <p className="mt-1.5 text-sm font-medium text-foreground">上传中...</p>
            <div className="mt-2 h-1 w-full rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
            </div>
          </>
        ) : (
          <>
            <Upload className="mx-auto size-6 text-muted-foreground/50" />
            <p className="mt-1.5 text-sm font-medium text-foreground">上传文档</p>
            <p className="mt-0.5 text-xs text-muted-foreground">支持 txt、md、docx、pdf 格式</p>
          </>
        )}
      </div>

      {files.length > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">已上传文件 ({files.length})</span>
            <Button variant="ghost" size="icon" onClick={handleReload} className="size-6" disabled={isReloading}>
              <RefreshCw className={cn('size-3', isReloading && 'animate-spin')} />
            </Button>
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {files.map((file) => (
              <div key={file.name} className="flex items-center justify-between rounded px-2 py-1.5 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{file.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
                  <Button variant="ghost" size="icon" className="size-5 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(file.name)} disabled={deleteMutation.isPending}>
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {status === 'not_available' && files.length > 0 && (
        <div className="mt-3 rounded bg-yellow-50/50 p-2 text-xs text-yellow-700">RAG 服务未就绪，请点击刷新按钮重新加载索引</div>
      )}

      {files.length === 0 && (
        <div className="mt-3 rounded bg-muted/50 p-2 text-center text-xs text-muted-foreground">暂无文档，上传文档后 AI 可以更好地理解您的业务</div>
      )}
    </div>
  )
}
