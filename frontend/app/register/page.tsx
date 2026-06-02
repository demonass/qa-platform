'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { QALogo } from '@/components/qa-logo'
import { toast } from 'sonner'

export default function RegisterPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!username.trim() || !password) {
      setError('请填写所有字段')
      return
    }
    if (username.trim().length < 2) {
      setError('用户名至少2个字符')
      return
    }
    if (password.length < 6) {
      setError('密码至少6位')
      return
    }
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '注册失败')
        return
      }

      toast.success('注册成功！请登录')
      router.push('/login')
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
          <h1 className="text-xl font-semibold tracking-tight">创建账号</h1>
          <p className="mt-1 text-sm text-muted-foreground">注册一个新的 QA Platform 账号</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">用户名</Label>
            <Input
              id="username"
              type="text"
              placeholder="至少2个字符"
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
              placeholder="至少6位"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError('') }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">确认密码</Label>
            <Input
              id="confirm"
              type="password"
              placeholder="再次输入密码"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setError('') }}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '注册中...' : '注册'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          已有账号？{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            立即登录
          </Link>
        </p>
      </div>
    </div>
  )
}
