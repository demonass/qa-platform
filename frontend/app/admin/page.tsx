'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { QALogo } from '@/components/qa-logo'
import { ArrowLeft, Plus, Trash2, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface User {
  id: string
  username: string
  role: string
  created_at: string
}

export default function AdminPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user')
  const [creating, setCreating] = useState(false)

  const authUser = typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('qa-user') || '{}')
    : {}

  const token = typeof window !== 'undefined'
    ? localStorage.getItem('qa-token') || ''
    : ''

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 403) {
        router.push('/')
        return
      }
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setUsers(data.users || [])
      setError('')
    } catch {
      setError('加载用户列表失败')
    } finally {
      setLoading(false)
    }
  }, [token, router])

  useEffect(() => {
    if (!token || authUser.role !== 'admin') {
      router.push('/')
      return
    }
    fetchUsers()
  }, [token, authUser.role, router, fetchUsers])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUsername.trim() || !newPassword) {
      toast.error('用户名和密码不能为空')
      return
    }
    if (newPassword.length < 6) {
      toast.error('密码至少6位')
      return
    }

    setCreating(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username: newUsername.trim(), password: newPassword, role: newRole }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || data.detail || '创建失败')
        return
      }
      toast.success(`用户 ${newUsername} 创建成功`)
      setNewUsername('')
      setNewPassword('')
      setNewRole('user')
      fetchUsers()
    } catch {
      toast.error('网络错误')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (userId: string, username: string) => {
    if (!confirm(`确定要删除用户 "${username}" 吗？此操作不可撤销。`)) return

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || data.detail || '删除失败')
        return
      }
      toast.success(`用户 ${username} 已删除`)
      fetchUsers()
    } catch {
      toast.error('网络错误')
    }
  }

  if (loading) {
    return (
      <div className="flex h-svh items-center justify-center bg-background">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    )
  }

  return (
    <div className="flex h-svh flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border/50 px-6">
        <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
          <ArrowLeft className="size-5" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
            <QALogo size="sm" />
          </div>
          <span className="font-semibold tracking-tight">用户管理</span>
        </div>
        {authUser.username && (
          <span className="ml-auto text-sm text-muted-foreground">
            登录为：{authUser.username}（管理员）
          </span>
        )}
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-4xl space-y-8">

          {/* Create user form */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
              <Plus className="size-5" />
              创建新用户
            </h2>
            <form onSubmit={handleCreate} className="flex gap-4 items-end flex-wrap">
              <div className="space-y-1.5">
                <Label htmlFor="new-username">用户名</Label>
                <Input
                  id="new-username"
                  placeholder="用户名"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-password">密码</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="至少6位"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-role">角色</Label>
                <select
                  id="new-role"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'user' | 'admin')}
                  className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="user">普通用户</option>
                  <option value="admin">管理员</option>
                </select>
              </div>
              <Button type="submit" disabled={creating}>
                {creating ? '创建中...' : '创建用户'}
              </Button>
            </form>
          </div>

          {/* User list table */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold">用户列表 ({users.length})</h2>

            {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-3 font-medium">用户名</th>
                    <th className="py-3 font-medium">角色</th>
                    <th className="py-3 font-medium">创建时间</th>
                    <th className="py-3 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-border/50 last:border-0">
                      <td className="py-3">
                        <span className="font-medium">{user.username}</span>
                      </td>
                      <td className="py-3">
                        <span className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                          user.role === 'admin'
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground'
                        )}>
                          {user.role === 'admin' && <Shield className="size-3" />}
                          {user.role === 'admin' ? '管理员' : '普通用户'}
                        </span>
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString('zh-CN')}
                      </td>
                      <td className="py-3 text-right">
                        {user.username !== authUser.username && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(user.id, user.username)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-muted-foreground">
                        暂无用户
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
