import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const documentDir = path.join(process.cwd(), '../../document');
    
    if (!fs.existsSync(documentDir)) {
      return NextResponse.json({ files: [], count: 0 });
    }

    const files = fs.readdirSync(documentDir);
    const documentFiles = files.filter(file => 
      file.endsWith('.md') || file.endsWith('.txt')
    ).map(file => {
      const filePath = path.join(documentDir, file);
      const stats = fs.statSync(filePath);
      return {
        name: file,
        size: stats.size,
        createdAt: stats.birthtime,
        updatedAt: stats.mtime,
      };
    });

    return NextResponse.json({ files: documentFiles, count: documentFiles.length });
  } catch (error) {
    return NextResponse.json({ files: [], count: 0, error: error instanceof Error ? error.message : '未知错误' });
  }
}