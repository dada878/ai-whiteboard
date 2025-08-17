import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

/**
 * API 端點：載入 Markdown prompts
 * 供客戶端使用（當 PromptService 在瀏覽器端執行時）
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const promptPath = searchParams.get('path');
    
    if (!promptPath) {
      return NextResponse.json(
        { error: 'Missing prompt path' },
        { status: 400 }
      );
    }

    // 安全檢查：防止路徑遍歷攻擊
    const normalizedPath = path.normalize(promptPath);
    if (normalizedPath.includes('..') || path.isAbsolute(normalizedPath)) {
      return NextResponse.json(
        { error: 'Invalid prompt path' },
        { status: 400 }
      );
    }

    // 讀取 prompt 檔案
    const promptsDir = path.join(process.cwd(), 'prompts');
    const fullPath = path.join(promptsDir, normalizedPath);
    
    // 確保路徑在 prompts 目錄內
    if (!fullPath.startsWith(promptsDir)) {
      return NextResponse.json(
        { error: 'Invalid prompt path' },
        { status: 400 }
      );
    }

    const content = await fs.readFile(fullPath, 'utf-8');
    
    // 處理 import 語句（簡單版本）
    const processedContent = await processImports(content, path.dirname(fullPath));
    
    return new NextResponse(processedContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // 快取 1 小時
      },
    });
  } catch (error) {
    console.error('Failed to load prompt:', error);
    return NextResponse.json(
      { error: 'Failed to load prompt' },
      { status: 500 }
    );
  }
}

/**
 * 處理 import 語句
 */
async function processImports(content: string, currentDir: string): Promise<string> {
  const importRegex = /\{\{import:([^}]+)\}\}/g;
  const matches = [...content.matchAll(importRegex)];
  
  for (const match of matches) {
    const importPath = match[1].trim();
    const resolvedPath = path.join(currentDir, importPath);
    
    try {
      const importedContent = await fs.readFile(resolvedPath, 'utf-8');
      content = content.replace(match[0], importedContent);
    } catch (error) {
      console.warn(`Failed to import: ${importPath}`, error);
      // 保留原始 import 語句作為 fallback
    }
  }
  
  return content;
}