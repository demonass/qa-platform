'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthUser } from './types'
import { LoginResponseSchema } from './types'
import { clearUserAuth } from '@/lib/auth-error'

interface AuthState {
  user: AuthUser | null
  token: string | null
  setAuth: (user: AuthUser, token: string) => void
  logout: () => void
  hydrate: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => set({ user, token }),
      logout: () => {
        clearUserAuth()
        set({ user: null, token: null })
      },
      hydrate: () => {
        if (typeof window === 'undefined') return
        const token = localStorage.getItem('qa-token')
        const userStr = localStorage.getItem('qa-user')
        if (token && userStr) {
          try {
            const user = JSON.parse(userStr)
            set({ user, token })
          } catch {
            set({ user: null, token: null })
          }
        }
      },
    }),
    {
      name: 'qa-auth',
      partialize: (state) => ({ user: state.user, token: state.token }),
      onRehydrateStorage: () => (state) => { state?.hydrate() },
    }
  )
)

export function useIsAuthenticated(): boolean {
  return useAuthStore((s) => s.token !== null && s.user !== null)
}

export function useIsAdmin(): boolean {
  return useAuthStore((s) => s.user?.role === 'admin')
}

export async function loginUser(username: string, password: string): Promise<void> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username.trim(), password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '登录失败')
  const parsed = LoginResponseSchema.parse(data)
  localStorage.setItem('qa-token', parsed.token)
  localStorage.setItem('qa-user', JSON.stringify(parsed.user))
  useAuthStore.getState().setAuth(parsed.user, parsed.token)
}

export async function registerUser(username: string, password: string): Promise<void> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username.trim(), password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '注册失败')
}
