import { cn } from '@/lib/utils'

interface QALogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function QALogo({ className, size = 'md' }: QALogoProps) {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-2xl',
  }

  return (
    <div className={cn('relative font-bold select-none', sizeClasses[size], className)}>
      <span className="relative z-10 text-primary-foreground">Q</span>
      <span className="relative -ml-[0.35em] text-primary-foreground/90">A</span>
    </div>
  )
}
