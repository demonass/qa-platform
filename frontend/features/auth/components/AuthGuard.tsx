'use client'

import { useEffect, useState, createContext, useContext, type ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import type { AuthUser } from '../types'
import { useAuthStore } from '../store'
import { forceLogout } from '@/lib/auth-error'

interface AuthContextType {
  user: AuthUser | null
  token: string
  logout: () => void
}

export const AuthContext = createContext<AuthContextType>({
  user: null, token: '', logout: () => {},
})

export function useAuthContext() {
  return useContext(AuthContext)
}

const PUBLIC_PATHS = ['/login', '/register']

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checked, setChecked] = useState(false)
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    const storedToken = localStorage.getItem('qa-token')
    const storedUser = localStorage.getItem('qa-user')
    const isPublic = PUBLIC_PATHS.includes(pathname)

    if (isPublic) {
      if (storedToken && storedUser) { router.push('/'); return }
      setChecked(true)
      return
    }

    if (!storedToken) { router.push('/login'); return }

    if (!user && storedUser) {
      try {
        const parsed = JSON.parse(storedUser)
        useAuthStore.getState().setAuth(parsed, storedToken)
      } catch {
        localStorage.removeItem('qa-token')
        localStorage.removeItem('qa-user')
        router.push('/login')
        return
      }
    }

    setChecked(true)
  }, [router, pathname, user])

  const logout = () => {
    forceLogout()
    router.push('/login')
  }

  if (!checked) return null
  if (PUBLIC_PATHS.includes(pathname)) return <>{children}</>
  if (!token) return null

  return (
    <AuthContext.Provider value={{ user, token: token || '', logout }}>
      {children}
    </AuthContext.Provider>
  )
}
