import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const filename = searchParams.get('filename');

    if (!filename) {
      return NextResponse.json({ error: '文件名不能为空' }, { status: 400 });
    }

    const documentDir = path.join(process.cwd(), '../../document');
    const filePath = path.join(documentDir, filename);

    // 安全检查：确保文件在 document 目录内
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith(path.normalize(documentDir))) {
      return NextResponse.json({ error: '无效的文件路径' }, { status: 400 });
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: '文件不存在' }, { status: 404 });
    }

    fs.unlinkSync(filePath);
    console.log(`[INFO] File deleted: ${filePath}`);

    return NextResponse.json({ success: true, message: '文件已删除' });
  } catch (error) {
    console.error('[ERROR] Failed to delete file:', error);
    return NextResponse.json({ error: `删除失败：${error instanceof Error ? error.message : '未知错误'}` }, { status: 500 });
  }
}