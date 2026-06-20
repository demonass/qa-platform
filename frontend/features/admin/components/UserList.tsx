'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Trash2, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useUsers, useDeleteUser } from '../hooks'
import { useAuth } from '@/features/auth/hooks'

export function UserList() {
  const router = useRouter()
  const { user: authUser, isAdmin } = useAuth()
  const { data: users = [], isLoading, error } = useUsers()
  const { mutateAsync: deleteUser, isPending: deleting } = useDeleteUser()

  useEffect(() => { if (!isAdmin) { router.push('/') } }, [isAdmin, router])

  const handleDelete = async (userId: string, username: string) => {
    if (!confirm(`确定要删除用户 "${username}" 吗？此操作不可撤销。`)) return
    try {
      await deleteUser(userId)
      toast.success(`用户 ${username} 已删除`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败')
    }
  }

  if (isLoading) return <div className="flex items-center justify-center py-8"><p className="text-muted-foreground">加载中...</p></div>
  if (error) return <p className="text-sm text-destructive">加载用户列表失败</p>

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="mb-4 text-lg font-semibold">用户列表 ({users.length})</h2>
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
                <td className="py-3"><span className="font-medium">{user.username}</span></td>
                <td className="py-3">
                  <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                    user.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                    {user.role === 'admin' && <Shield className="size-3" />}
                    {user.role === 'admin' ? '管理员' : '普通用户'}
                  </span>
                </td>
                <td className="py-3 text-muted-foreground">{new Date(user.created_at).toLocaleDateString('zh-CN')}</td>
                <td className="py-3 text-right">
                  {user.username !== authUser?.username && (
                    <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(user.id, user.username)} disabled={deleting}>
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">暂无用户</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
