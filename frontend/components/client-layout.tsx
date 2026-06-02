'use client'

import type { ReactNode } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'

export function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider>
      <AuthGuard>
        {children}
      </AuthGuard>
      <Toaster />
    </TooltipProvider>
  )
}
