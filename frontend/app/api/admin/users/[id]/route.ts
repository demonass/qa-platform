import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8081'

// DELETE /api/admin/users/:id
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const auth = req.headers.get('authorization') || ''
    const response = await fetch(`${BACKEND_URL}/api/admin/users/${id}`, {
      method: 'DELETE',
      headers: { Authorization: auth },
    })
    
    // 如果是 401 认证过期，返回特殊错误让前端处理
    if (response.status === 401) {
      return NextResponse.json({ error: 'AUTH_EXPIRED:登录已过期，请重新登录' }, { status: 401 });
    }
    
    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: '删除失败' }))
      return NextResponse.json(data, { status: response.status })
    }
    return NextResponse.json({ status: 'success' })
  } catch {
    return NextResponse.json({ error: '删除用户失败' }, { status: 500 })
  }
}
