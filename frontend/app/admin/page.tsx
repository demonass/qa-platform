'use client'

import { Button } from '@/components/ui/button'
import { QALogo } from '@/components/qa-logo'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/features/auth/hooks'
import { CreateUserForm } from '@/features/admin/components/CreateUserForm'
import { UserList } from '@/features/admin/components/UserList'

export default function AdminPage() {
  const router = useRouter()
  const { user: authUser } = useAuth()

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
        {authUser?.username && (
          <span className="ml-auto text-sm text-muted-foreground">
            登录为：{authUser.username}（管理员）
          </span>
        )}
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-4xl space-y-8">
          <CreateUserForm />
          <UserList />
        </div>
      </div>
    </div>
  )
}
