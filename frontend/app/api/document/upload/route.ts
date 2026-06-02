import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: '请选择文件' }, { status: 400 });
    }

    const backendFormData = new FormData();
    backendFormData.append('file', file);
    backendFormData.append('strategy', 'semantic');
    backendFormData.append('target_chunks', '5');

    const response = await fetch(`${BACKEND_URL}/document/upload`, {
      method: 'POST',
      body: backendFormData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: '上传失败' }));
      return NextResponse.json({ error: errorData.detail || '上传失败' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: `上传失败: ${error instanceof Error ? error.message : '未知错误'}` }, { status: 500 });
  }
}

export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/rag/status`);
    
    if (!response.ok) {
      return NextResponse.json({ status: 'not_available', message: '无法连接到后端' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ status: 'not_available', message: '无法连接到后端' }, { status: 500 });
  }
}