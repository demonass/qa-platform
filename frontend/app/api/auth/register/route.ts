import { NextResponse } from 'next/server'

const AGENT_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:8000'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const response = await fetch(`${AGENT_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json({ error: '注册服务异常' }, { status: 500 })
  }
}
