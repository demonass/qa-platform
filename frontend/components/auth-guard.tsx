'use client'

import { useEffect, useState, createContext, useContext, type ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface AuthUser {
  id: string
  username: string
  role: string
}

interface AuthContextType {
  user: AuthUser | null
  token: string
  logout: () => void
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  token: '',
  logout: () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState('')
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const storedToken = localStorage.getItem('qa-token')
    const storedUser = localStorage.getItem('qa-user')

    // Login page is public
    if (pathname === '/login') {
      if (storedToken) {
        router.push('/')
        return
      }
      setChecked(true)
      return
    }

    // Protected routes
    if (!storedToken) {
      router.push('/login')
      return
    }

    try {
      setUser(storedUser ? JSON.parse(storedUser) : null)
      setToken(storedToken || '')
    } catch {
      localStorage.removeItem('qa-token')
      localStorage.removeItem('qa-user')
      router.push('/login')
    }
    setChecked(true)
  }, [router, pathname])

  const logout = () => {
    localStorage.removeItem('qa-token')
    localStorage.removeItem('qa-user')
    setUser(null)
    setToken('')
    router.push('/login')
  }

  if (!checked) {
    return null
  }

  if (pathname === '/login') {
    return <>{children}</>
  }

  if (!token) {
    return null
  }

  return (
    <AuthContext.Provider value={{ user, token, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
