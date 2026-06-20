/**
 * 认证错误处理工具
 */

// 清除所有用户相关的本地存储数据
export function clearUserAuth() {
  // 清除认证 token
  localStorage.removeItem('qa-token')
  // 清除用户信息
  localStorage.removeItem('qa-user')
  // 清除聊天会话（按用户隔离的会话也会被清除）
  const keys = Object.keys(localStorage)
  keys.forEach(key => {
    if (key.startsWith('chat-sessions')) {
      localStorage.removeItem(key)
    }
  })
}

// 强制退出登录并跳转到登录页面
export function forceLogout() {
  clearUserAuth()
  // 使用 window.location.href 强制跳转
  window.location.href = '/login'
}

// 检查错误是否是认证过期错误
export function isAuthExpiredError(error: unknown): boolean {
  if (!error) return false
  
  // 检查是否是带有 status 属性的错误对象（HTTP 错误）
  if (typeof error === 'object' && error !== null) {
    const errorObj = error as Record<string, unknown>
    
    // 检查 HTTP 状态码是否为 401
    if (errorObj.status === 401) {
      return true
    }
    
    // 检查错误消息中是否包含认证过期的关键词
    if (errorObj.message) {
      const message = String(errorObj.message)
      if (message.includes('AUTH_EXPIRED') || message.includes('登录已过期')) {
        return true
      }
    }
  }
  
  // 检查普通错误消息
  const errorMessage = error instanceof Error ? error.message : String(error)
  return errorMessage.includes('AUTH_EXPIRED') || errorMessage.includes('登录已过期')
}

// 处理认证过期的统一函数
export function handleAuthExpired() {
  forceLogout()
}
