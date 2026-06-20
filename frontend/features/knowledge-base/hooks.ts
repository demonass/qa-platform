'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { DocumentFile, RagStatus } from './types'
import { api } from '@/lib/api'

export function useDocuments() {
  return useQuery({
    queryKey: ['documents'],
    queryFn: () => api.get<{ files: DocumentFile[]; count: number }>('/api/document/list'),
  })
}

export function useUploadDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (formData: FormData) => api.upload('/api/document/upload', formData),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['documents'] }) },
  })
}

export function useDeleteDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (filename: string) => api.delete(`/api/document/delete?filename=${encodeURIComponent(filename)}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['documents'] }) },
  })
}

export function useRagStatus() {
  return useQuery({
    queryKey: ['rag-status'],
    queryFn: () => api.get<{ status: string; message?: string }>('/api/document/upload'),
    select: (data) => data.status as RagStatus,
  })
}

export function useRagReload() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post('/api/rag/reload'),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rag-status'] }) },
  })
}
