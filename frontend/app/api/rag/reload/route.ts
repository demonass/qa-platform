import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export async function POST() {
  try {
    const response = await fetch(`${BACKEND_URL}/rag/reload`, {
      method: 'POST',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: '重新加载失败' }));
      return NextResponse.json({ error: errorData.detail || '重新加载失败' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: `重新加载失败: ${error instanceof Error ? error.message : '未知错误'}` }, { status: 500 });
  }
}