/**
 * Unified auth error detection and force-logout utilities.
 */

import { ApiError } from './api'

const AUTH_EXPIRED_PREFIX = 'AUTH_EXPIRED'

/** Clear all auth and session data from localStorage. */
export function clearUserAuth(): void {
  localStorage.removeItem('qa-token')
  localStorage.removeItem('qa-user')
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('chat-sessions')) {
      localStorage.removeItem(key)
    }
  }
}

/** Force redirect to login page. */
export function forceLogout(): void {
  clearUserAuth()
  window.location.href = '/login'
}

/** Check if an error indicates auth expiry. */
export function isAuthExpiredError(error: unknown): boolean {
  if (!error) return false
  if (error instanceof ApiError) return error.isAuthExpired
  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>
    if (obj.status === 401) return true
    const msg = String(obj.message || '')
    if (msg.includes(AUTH_EXPIRED_PREFIX) || msg.includes('登录已过期')) return true
  }
  const msg = error instanceof Error ? error.message : String(error)
  return msg.includes(AUTH_EXPIRED_PREFIX) || msg.includes('登录已过期')
}
