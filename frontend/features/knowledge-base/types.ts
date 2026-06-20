export interface DocumentFile {
  name: string
  size: number
  createdAt: string
  updatedAt: string
}

export type RagStatus = 'available' | 'not_available' | 'loading' | 'error'
