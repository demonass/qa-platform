'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore, loginUser, registerUser } from './store'
import { forceLogout } from '@/lib/auth-error'

export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const logout = useAuthStore((s) => s.logout)
  const isAuthenticated = token !== null && user !== null
  const isAdmin = user?.role === 'admin'
  return { user, token, isAuthenticated, isAdmin, logout }
}

export function useLogin() {
  const router = useRouter()
  const login = useCallback(async (username: string, password: string) => {
    await loginUser(username, password)
    router.push('/')
  }, [router])
  return { login }
}

export function useRegister() {
  const router = useRouter()
  const register = useCallback(async (username: string, password: string) => {
    await registerUser(username, password)
    router.push('/login')
  }, [router])
  return { register }
}

export function useLogout() {
  const router = useRouter()
  return useCallback(() => {
    forceLogout()
    router.push('/login')
  }, [router])
}
