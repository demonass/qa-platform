'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { QALogo } from '@/components/qa-logo'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) {
      setError('请输入用户名和密码')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '登录失败')
        return
      }

      localStorage.removeItem('chat-sessions')
      localStorage.setItem('qa-token', data.token)
      localStorage.setItem('qa-user', JSON.stringify(data.user))
      toast.success(`欢迎回来，${data.user.username}！`)
      router.push('/')
    } catch {
      setError('网络错误，请检查服务状态')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-svh items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 px-4">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary">
            <QALogo size="lg" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">QA Platform</h1>
          <p className="mt-1 text-sm text-muted-foreground">登录以继续使用</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">用户名</Label>
            <Input
              id="username"
              type="text"
              placeholder="请输入用户名"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError('') }}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              type="password"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError('') }}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '登录中...' : '登录'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          还没有账号？{' '}
          <a href="/register" className="font-medium text-primary hover:underline">
            立即注册
          </a>
        </p>
      </div>
    </div>
  )
}
