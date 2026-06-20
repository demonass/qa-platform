'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useCreateUser } from '../hooks'

export function CreateUserForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'user' | 'admin'>('user')
  const { mutateAsync: createUser, isPending } = useCreateUser()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) { toast.error('用户名和密码不能为空'); return }
    if (password.length < 6) { toast.error('密码至少6位'); return }
    try {
      await createUser({ username: username.trim(), password, role })
      toast.success(`用户 ${username} 创建成功`)
      setUsername(''); setPassword(''); setRole('user')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建失败')
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="mb-4 text-lg font-semibold flex items-center gap-2"><Plus className="size-5" />创建新用户</h2>
      <form onSubmit={handleSubmit} className="flex gap-4 items-end flex-wrap">
        <div className="space-y-1.5">
          <Label htmlFor="new-username">用户名</Label>
          <Input id="new-username" placeholder="用户名" value={username} onChange={(e) => setUsername(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-password">密码</Label>
          <Input id="new-password" type="password" placeholder="至少6位" value={password} onChange={(e) => setPassword(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-role">角色</Label>
          <select id="new-role" value={role} onChange={(e) => setRole(e.target.value as 'user' | 'admin')}
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            <option value="user">普通用户</option>
            <option value="admin">管理员</option>
          </select>
        </div>
        <Button type="submit" disabled={isPending}>{isPending ? '创建中...' : '创建用户'}</Button>
      </form>
    </div>
  )
}
