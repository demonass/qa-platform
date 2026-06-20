import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8081'

export async function GET(req: Request) {
  try {
    const auth = req.headers.get('authorization') || ''
    const response = await fetch(`${BACKEND_URL}/api/admin/users`, { headers: { Authorization: auth } })
    if (response.status === 401) {
      return NextResponse.json({ error: 'AUTH_EXPIRED:登录已过期，请重新登录' }, { status: 401 })
    }
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json({ error: '获取用户列表失败' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const auth = req.headers.get('authorization') || ''
    const body = await req.json()
    const response = await fetch(`${BACKEND_URL}/api/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify(body),
    })
    if (response.status === 401) {
      return NextResponse.json({ error: 'AUTH_EXPIRED:登录已过期，请重新登录' }, { status: 401 })
    }
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json({ error: '创建用户失败' }, { status: 500 })
  }
}
