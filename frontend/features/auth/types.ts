import { z } from 'zod'

export interface AuthUser {
  id: string
  username: string
  role: 'admin' | 'user'
}

export const AuthUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  role: z.enum(['admin', 'user']),
})

export const LoginResponseSchema = z.object({
  token: z.string(),
  user: AuthUserSchema,
})
