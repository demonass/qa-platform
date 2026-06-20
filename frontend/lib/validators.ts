import { z } from 'zod'

// ── Auth ──

export const AuthUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  role: z.enum(['admin', 'user']),
})

export const LoginResponseSchema = z.object({
  token: z.string(),
  user: AuthUserSchema,
})

export const RegisterResponseSchema = z.object({
  status: z.string(),
  message: z.string().optional(),
})

// ── Chat ──

export const ChatSessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  lastMessage: z.string(),
  updatedAt: z.coerce.date(),
  pinned: z.boolean().optional(),
})

export const AgentConfigSchema = z.object({
  provider: z.string(),
  model: z.string(),
  api_base: z.string(),
  version: z.string().optional(),
  cache: z.object({
    enabled: z.boolean(),
    ttl_seconds: z.number(),
    host: z.string(),
    port: z.number(),
  }).optional(),
})

// ── Admin / Users ──

export const UserSchema = z.object({
  id: z.string(),
  username: z.string(),
  role: z.string(),
  created_at: z.string().optional(),
})

export const AdminUsersResponseSchema = z.object({
  users: z.array(UserSchema).optional(),
})

// ── Documents ──

export const DocumentFileSchema = z.object({
  name: z.string(),
  size: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const DocumentListResponseSchema = z.object({
  files: z.array(DocumentFileSchema),
  count: z.number(),
})

export const DocumentUploadResponseSchema = z.object({
  status: z.string(),
  filename: z.string(),
  file_size: z.number(),
  module_count: z.number(),
  modules: z.array(z.object({
    topic: z.string(),
    content: z.string(),
  })).optional(),
  warning: z.string().optional(),
})

// ── RAG ──

export const RagStatusSchema = z.object({
  status: z.enum(['available', 'not_available']),
  message: z.string().optional(),
})

export const RagReloadSchema = z.object({
  status: z.string(),
  message: z.string().optional(),
})
