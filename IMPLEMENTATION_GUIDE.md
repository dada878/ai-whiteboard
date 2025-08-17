# 文件轉心智圖功能實作指南

## 概覽

本文件詳細說明如何在 AI Whiteboard 專案中實作文件轉心智圖功能。此功能允許用戶上傳 PDF 或 TXT 文件，通過 AI 分析後生成視覺化的心智圖或樹狀圖。

## 技術架構

### 系統整合圖
```
[用戶上傳] → [文件驗證] → [文件解析] → [AI 分析] → [結構化數據] → [視覺化渲染]
     ↓              ↓            ↓           ↓            ↓              ↓
[前端 UI]     [API 驗證]   [PDF/TXT 解析] [OpenAI API] [JSON 數據]    [白板組件]
```

### 核心依賴
- **前端**: React 19, TypeScript, Tailwind CSS
- **後端**: Next.js API Routes
- **AI**: OpenAI GPT-4 API
- **文件處理**: pdf-parse (PDF), 原生 File API (TXT)
- **存儲**: 現有 Firebase 整合

---

## Phase 1: 基礎架構 (3 天)

### 1.1 數據結構定義

#### 擴展 `app/types.ts`
```typescript
// 新增以下接口到現有 types.ts

/**
 * 文件心智圖節點 - 擴展 StickyNote
 */
export interface DocumentMapNode extends StickyNote {
  level: number;                    // 節點階層 (0=根節點, 1=主要分支...)
  nodeType: 'root' | 'main' | 'sub' | 'leaf';
  parentId?: string;                // 父節點 ID
  childIds: string[];               // 子節點 ID 列表
  documentId?: string;              // 源文件 ID
  originalIndex?: number;           // 在原文件中的順序
}

/**
 * 心智圖元數據
 */
export interface DocumentMap {
  id: string;
  documentId: string;
  title: string;
  mapType: 'mindmap' | 'tree';
  nodes: DocumentMapNode[];
  edges: Edge[];
  metadata: {
    sourceFile: string;
    fileSize: number;
    createdAt: Date;
    aiModel: string;
    processingTime: number;         // AI 處理耗時 (ms)
  };
}

/**
 * 上傳的文件
 */
export interface UploadedDocument {
  id: string;
  filename: string;
  content: string;
  type: 'pdf' | 'txt';
  size: number;
  uploadedAt: Date;
  userId?: string;                  // 上傳用戶 ID
}

/**
 * 處理進度狀態
 */
export type ProcessingStage = 
  | 'idle'          // 待機
  | 'uploading'     // 上傳中
  | 'parsing'       // 文件解析中
  | 'ai-processing' // AI 分析中
  | 'generating'    // 生成心智圖中
  | 'rendering'     // 渲染中
  | 'completed'     // 完成
  | 'error';        // 錯誤

export interface ProcessingProgress {
  stage: ProcessingStage;
  progress: number;                 // 0-100
  message: string;
  error?: string;
}

/**
 * 心智圖生成選項
 */
export interface MapGenerationOptions {
  mapType: 'mindmap' | 'tree';
  maxNodes: number;                 // 最大節點數量
  maxDepth: number;                 // 最大深度
  style: 'detailed' | 'concise';   // 詳細或簡潔
  language: 'zh-TW' | 'en';         // 輸出語言
}

/**
 * 擴展 WhiteboardData
 */
export interface WhiteboardData {
  notes: StickyNote[];
  edges: Edge[];
  groups: Group[];
  images?: ImageElement[];
  documentMaps?: DocumentMap[];     // 新增：文件心智圖
  viewport?: ViewportState;
}
```

### 1.2 UI 組件開發

#### 創建 `app/components/FileUploadDialog.tsx`
```typescript
'use client';

import React, { useState, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { MapGenerationOptions, ProcessingProgress } from '../types';

interface FileUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (documentId: string) => void;
  onError: (error: string) => void;
}

const FileUploadDialog: React.FC<FileUploadDialogProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
  onError
}) => {
  const { isDarkMode } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 狀態管理
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mapOptions, setMapOptions] = useState<MapGenerationOptions>({
    mapType: 'mindmap',
    maxNodes: 20,
    maxDepth: 3,
    style: 'detailed',
    language: 'zh-TW'
  });
  const [progress, setProgress] = useState<ProcessingProgress>({
    stage: 'idle',
    progress: 0,
    message: ''
  });

  // 文件選擇處理
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 文件驗證
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['application/pdf', 'text/plain'];

    if (file.size > maxSize) {
      onError('文件大小不能超過 10MB');
      return;
    }

    if (!allowedTypes.includes(file.type)) {
      onError('僅支援 PDF 和 TXT 文件格式');
      return;
    }

    setSelectedFile(file);
  };

  // 上傳和處理
  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      setProgress({
        stage: 'uploading',
        progress: 0,
        message: '正在上傳文件...'
      });

      // 創建 FormData
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('options', JSON.stringify(mapOptions));

      // 模擬上傳進度
      const uploadInterval = setInterval(() => {
        setProgress(prev => ({
          ...prev,
          progress: Math.min(prev.progress + 10, 90)
        }));
      }, 200);

      // 上傳文件
      const response = await fetch('/api/document-to-map', {
        method: 'POST',
        body: formData
      });

      clearInterval(uploadInterval);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '上傳失敗');
      }

      const result = await response.json();
      
      setProgress({
        stage: 'completed',
        progress: 100,
        message: '文件處理完成！'
      });

      // 延遲關閉對話框
      setTimeout(() => {
        onUploadSuccess(result.documentId);
        onClose();
        resetState();
      }, 1000);

    } catch (error) {
      setProgress({
        stage: 'error',
        progress: 0,
        message: '',
        error: error instanceof Error ? error.message : '未知錯誤'
      });
    }
  };

  // 重置狀態
  const resetState = () => {
    setSelectedFile(null);
    setProgress({
      stage: 'idle',
      progress: 0,
      message: ''
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 進度條組件
  const ProgressBar = () => (
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div 
        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
        style={{ width: `${progress.progress}%` }}
      />
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className={`max-w-md w-full mx-4 rounded-lg shadow-xl ${
        isDarkMode ? 'bg-dark-bg-secondary' : 'bg-white'
      }`}>
        {/* 標題欄 */}
        <div className={`flex items-center justify-between p-6 border-b ${
          isDarkMode ? 'border-gray-600' : 'border-gray-200'
        }`}>
          <h3 className={`text-lg font-medium ${
            isDarkMode ? 'text-dark-text' : 'text-gray-900'
          }`}>
            上傳文件生成心智圖
          </h3>
          <button
            onClick={onClose}
            className={`text-gray-400 hover:text-gray-600 ${
              isDarkMode ? 'hover:text-gray-300' : ''
            }`}
          >
            ✕
          </button>
        </div>

        {/* 內容區域 */}
        <div className="p-6">
          {progress.stage === 'idle' && (
            <>
              {/* 文件選擇 */}
              <div className="mb-6">
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-dark-text' : 'text-gray-700'
                }`}>
                  選擇文件
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt"
                  onChange={handleFileSelect}
                  className={`w-full p-3 border rounded-lg ${
                    isDarkMode 
                      ? 'bg-dark-bg-primary border-gray-600 text-dark-text' 
                      : 'bg-white border-gray-300'
                  }`}
                />
                <p className={`text-xs mt-1 ${
                  isDarkMode ? 'text-dark-text-secondary' : 'text-gray-500'
                }`}>
                  支援 PDF 和 TXT 文件，最大 10MB
                </p>
              </div>

              {/* 選項設定 */}
              <div className="space-y-4 mb-6">
                {/* 圖表類型 */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    isDarkMode ? 'text-dark-text' : 'text-gray-700'
                  }`}>
                    圖表類型
                  </label>
                  <div className="flex space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="mindmap"
                        checked={mapOptions.mapType === 'mindmap'}
                        onChange={(e) => setMapOptions(prev => ({
                          ...prev,
                          mapType: e.target.value as 'mindmap' | 'tree'
                        }))}
                        className="mr-2"
                      />
                      <span className={isDarkMode ? 'text-dark-text' : 'text-gray-700'}>
                        心智圖
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="tree"
                        checked={mapOptions.mapType === 'tree'}
                        onChange={(e) => setMapOptions(prev => ({
                          ...prev,
                          mapType: e.target.value as 'mindmap' | 'tree'
                        }))}
                        className="mr-2"
                      />
                      <span className={isDarkMode ? 'text-dark-text' : 'text-gray-700'}>
                        樹狀圖
                      </span>
                    </label>
                  </div>
                </div>

                {/* 詳細程度 */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    isDarkMode ? 'text-dark-text' : 'text-gray-700'
                  }`}>
                    詳細程度
                  </label>
                  <select
                    value={mapOptions.style}
                    onChange={(e) => setMapOptions(prev => ({
                      ...prev,
                      style: e.target.value as 'detailed' | 'concise'
                    }))}
                    className={`w-full p-2 border rounded ${
                      isDarkMode 
                        ? 'bg-dark-bg-primary border-gray-600 text-dark-text' 
                        : 'bg-white border-gray-300'
                    }`}
                  >
                    <option value="concise">簡潔</option>
                    <option value="detailed">詳細</option>
                  </select>
                </div>

                {/* 最大節點數 */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    isDarkMode ? 'text-dark-text' : 'text-gray-700'
                  }`}>
                    最大節點數: {mapOptions.maxNodes}
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="50"
                    value={mapOptions.maxNodes}
                    onChange={(e) => setMapOptions(prev => ({
                      ...prev,
                      maxNodes: parseInt(e.target.value)
                    }))}
                    className="w-full"
                  />
                </div>
              </div>

              {/* 按鈕 */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={onClose}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    isDarkMode 
                      ? 'bg-dark-bg-tertiary hover:bg-dark-bg-primary text-dark-text' 
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }`}
                >
                  取消
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!selectedFile}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    selectedFile
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  }`}
                >
                  開始處理
                </button>
              </div>
            </>
          )}

          {/* 處理進度 */}
          {progress.stage !== 'idle' && progress.stage !== 'error' && (
            <div className="text-center">
              <div className="mb-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              </div>
              <p className={`text-sm mb-2 ${
                isDarkMode ? 'text-dark-text' : 'text-gray-700'
              }`}>
                {progress.message}
              </p>
              <ProgressBar />
              <p className={`text-xs mt-2 ${
                isDarkMode ? 'text-dark-text-secondary' : 'text-gray-500'
              }`}>
                {progress.progress}% 完成
              </p>
            </div>
          )}

          {/* 錯誤顯示 */}
          {progress.stage === 'error' && (
            <div className="text-center">
              <div className="text-red-500 text-4xl mb-4">⚠️</div>
              <p className={`text-sm mb-4 ${
                isDarkMode ? 'text-dark-text' : 'text-gray-700'
              }`}>
                處理失敗
              </p>
              <p className="text-red-500 text-sm mb-4">
                {progress.error}
              </p>
              <button
                onClick={resetState}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                重試
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileUploadDialog;
```

#### 修改 `app/components/Toolbar.tsx`
```typescript
// 在現有 Toolbar 組件中添加文件上傳按鈕

interface ToolbarProps {
  onAnalyze: () => void;
  onSummarize: () => void;
  onClear?: () => void;
  onImageUpload?: (file: File) => void;
  onDocumentUpload?: () => void;  // 新增
}

const Toolbar: React.FC<ToolbarProps> = ({ 
  onAnalyze, 
  onSummarize, 
  onClear, 
  onImageUpload,
  onDocumentUpload  // 新增
}) => {
  // ... 現有代碼

  return (
    <div className="w-16 bg-gray-800 text-white flex flex-col items-center py-4 space-y-4">
      {/* 現有按鈕... */}
      
      {/* 新增：文件上傳按鈕 */}
      {onDocumentUpload && (
        <button
          onClick={onDocumentUpload}
          className="w-12 h-12 bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center justify-center transition-colors"
          title="上傳文件生成心智圖"
        >
          <span className="text-xl">📄</span>
        </button>
      )}
      
      {/* 分隔線 */}
      <div className="w-8 h-px bg-gray-600" />
      
      {/* 現有按鈕... */}
    </div>
  );
};
```

### 1.3 基礎 API 創建

#### 創建 `app/api/document/upload/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['application/pdf', 'text/plain'];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: '未提供文件' },
        { status: 400 }
      );
    }

    // 驗證文件大小
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: '文件大小不能超過 10MB' },
        { status: 400 }
      );
    }

    // 驗證文件類型
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: '僅支援 PDF 和 TXT 文件' },
        { status: 400 }
      );
    }

    // 生成文件 ID
    const documentId = uuidv4();
    
    // 讀取文件內容
    const buffer = await file.arrayBuffer();
    const content = await extractTextContent(buffer, file.type);

    // 創建文件記錄
    const document = {
      id: documentId,
      filename: file.name,
      content,
      type: file.type === 'application/pdf' ? 'pdf' : 'txt',
      size: file.size,
      uploadedAt: new Date(),
    };

    // 這裡可以存儲到數據庫或臨時存儲
    // 暫時存儲在內存中或使用 Redis
    
    return NextResponse.json({
      documentId,
      filename: file.name,
      size: file.size,
      type: document.type,
      contentLength: content.length
    });

  } catch (error) {
    console.error('文件上傳錯誤:', error);
    return NextResponse.json(
      { error: '文件上傳失敗' },
      { status: 500 }
    );
  }
}

// 提取文件文本內容
async function extractTextContent(buffer: ArrayBuffer, mimeType: string): Promise<string> {
  if (mimeType === 'text/plain') {
    // 處理 TXT 文件
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(buffer);
  } else if (mimeType === 'application/pdf') {
    // 處理 PDF 文件
    // 注意：需要安裝 pdf-parse: npm install pdf-parse
    const pdf = await import('pdf-parse');
    const data = await pdf.default(Buffer.from(buffer));
    return data.text;
  }
  
  throw new Error('不支援的文件類型');
}
```

---

## Phase 2: 文件處理 (2 天)

### 2.1 高級文件解析

#### 創建 `app/utils/documentParser.ts`
```typescript
import pdf from 'pdf-parse';

export interface ParsedDocument {
  content: string;
  metadata: {
    pageCount?: number;
    title?: string;
    author?: string;
    wordCount: number;
    charCount: number;
  };
}

export class DocumentParser {
  /**
   * 解析 PDF 文件
   */
  static async parsePDF(buffer: ArrayBuffer): Promise<ParsedDocument> {
    try {
      const data = await pdf(Buffer.from(buffer));
      
      return {
        content: this.cleanText(data.text),
        metadata: {
          pageCount: data.numpages,
          title: data.info?.Title,
          author: data.info?.Author,
          wordCount: this.countWords(data.text),
          charCount: data.text.length
        }
      };
    } catch (error) {
      throw new Error(`PDF 解析失敗: ${error.message}`);
    }
  }

  /**
   * 解析 TXT 文件
   */
  static async parseTXT(buffer: ArrayBuffer): Promise<ParsedDocument> {
    try {
      const decoder = new TextDecoder('utf-8');
      const content = decoder.decode(buffer);
      const cleanContent = this.cleanText(content);
      
      return {
        content: cleanContent,
        metadata: {
          wordCount: this.countWords(cleanContent),
          charCount: cleanContent.length
        }
      };
    } catch (error) {
      throw new Error(`TXT 解析失敗: ${error.message}`);
    }
  }

  /**
   * 清理文本內容
   */
  private static cleanText(text: string): string {
    return text
      // 移除多餘的空白字符
      .replace(/\s+/g, ' ')
      // 移除特殊字符（保留中英文、數字、基本標點）
      .replace(/[^\u4e00-\u9fa5\w\s.,!?;:()\-"']/g, '')
      // 移除多餘的換行
      .replace(/\n\s*\n/g, '\n')
      // 去除首尾空白
      .trim();
  }

  /**
   * 計算字數
   */
  private static countWords(text: string): number {
    // 中文字符計數
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    
    // 英文單詞計數
    const englishWords = text
      .replace(/[\u4e00-\u9fa5]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 0).length;
    
    return chineseChars + englishWords;
  }

  /**
   * 驗證文件內容
   */
  static validateContent(content: string): { isValid: boolean; error?: string } {
    if (!content || content.trim().length === 0) {
      return { isValid: false, error: '文件內容為空' };
    }

    if (content.length < 50) {
      return { isValid: false, error: '文件內容過短，無法生成有意義的心智圖' };
    }

    if (content.length > 50000) {
      return { isValid: false, error: '文件內容過長，請上傳較小的文件' };
    }

    return { isValid: true };
  }

  /**
   * 提取文件摘要（用於預覽）
   */
  static extractSummary(content: string, maxLength: number = 200): string {
    const sentences = content.split(/[。！？.!?]/);
    let summary = '';
    
    for (const sentence of sentences) {
      if ((summary + sentence).length > maxLength) {
        break;
      }
      summary += sentence + '。';
    }
    
    return summary || content.substring(0, maxLength) + '...';
  }
}
```

### 2.2 錯誤處理和驗證

#### 創建 `app/utils/fileValidator.ts`
```typescript
export interface ValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
}

export class FileValidator {
  private static readonly MAX_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly MIN_SIZE = 100; // 100 bytes
  private static readonly ALLOWED_MIME_TYPES = [
    'application/pdf',
    'text/plain'
  ];
  private static readonly ALLOWED_EXTENSIONS = ['.pdf', '.txt'];

  /**
   * 驗證文件基本屬性
   */
  static validateFile(file: File): ValidationResult {
    const warnings: string[] = [];

    // 檢查文件大小
    if (file.size > this.MAX_SIZE) {
      return {
        isValid: false,
        error: `文件大小 ${this.formatFileSize(file.size)} 超過限制 ${this.formatFileSize(this.MAX_SIZE)}`
      };
    }

    if (file.size < this.MIN_SIZE) {
      return {
        isValid: false,
        error: '文件過小，可能不包含有效內容'
      };
    }

    // 檢查文件類型
    if (!this.ALLOWED_MIME_TYPES.includes(file.type)) {
      return {
        isValid: false,
        error: `不支援的文件類型: ${file.type}。僅支援 PDF 和 TXT 文件`
      };
    }

    // 檢查文件擴展名
    const extension = this.getFileExtension(file.name);
    if (!this.ALLOWED_EXTENSIONS.includes(extension)) {
      warnings.push(`文件擴展名 ${extension} 可能不正確`);
    }

    // 檢查文件名
    if (file.name.length > 255) {
      warnings.push('文件名過長');
    }

    // 大文件警告
    if (file.size > 5 * 1024 * 1024) { // 5MB
      warnings.push('文件較大，處理時間可能較長');
    }

    return {
      isValid: true,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * 驗證文件內容安全性
   */
  static validateSecurity(content: string): ValidationResult {
    const warnings: string[] = [];

    // 檢查敏感信息模式
    const sensitivePatterns = [
      /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // 信用卡號
      /\b\d{3}-\d{2}-\d{4}\b/g, // 社會安全號碼
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // 電子郵件
      /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, // IP 地址
    ];

    let haseSensitiveInfo = false;
    for (const pattern of sensitivePatterns) {
      if (pattern.test(content)) {
        haseSensitiveInfo = true;
        break;
      }
    }

    if (haseSensitiveInfo) {
      warnings.push('檢測到可能的敏感信息，請確認是否適合處理');
    }

    // 檢查內容品質
    const wordCount = content.split(/\s+/).length;
    if (wordCount < 50) {
      return {
        isValid: false,
        error: '文件內容過少，無法生成有意義的心智圖'
      };
    }

    return {
      isValid: true,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * 格式化文件大小
   */
  private static formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * 獲取文件擴展名
   */
  private static getFileExtension(filename: string): string {
    return filename.toLowerCase().substring(filename.lastIndexOf('.'));
  }
}
```

---

## Phase 3: AI 整合 (3 天)

### 3.1 AI Prompt 設計

#### 創建 `app/utils/aiPrompts.ts`
```typescript
import { MapGenerationOptions } from '../types';

export class AIPromptGenerator {
  /**
   * 生成心智圖 Prompt
   */
  static generateMindmapPrompt(content: string, options: MapGenerationOptions): string {
    const { maxNodes, maxDepth, style, language } = options;
    
    return `
你是一個專業的心智圖生成助手。請分析以下文件內容，生成結構化的心智圖數據。

文件內容：
"""
${content}
"""

要求：
1. 語言：${language === 'zh-TW' ? '繁體中文' : 'English'}
2. 最大節點數：${maxNodes}
3. 最大深度：${maxDepth} 層
4. 風格：${style === 'detailed' ? '詳細完整' : '簡潔明確'}
5. 心智圖應該以主題為中心，向外輻射展開

回應格式（嚴格遵守 JSON 格式）：
{
  "title": "主題標題",
  "nodes": [
    {
      "id": "node_1",
      "content": "節點內容",
      "level": 0,
      "nodeType": "root",
      "parentId": null,
      "position": {
        "x": 400,
        "y": 300
      },
      "color": "#FEF3C7"
    }
  ],
  "connections": [
    {
      "from": "node_1",
      "to": "node_2"
    }
  ]
}

節點規則：
- level 0: 根節點（主題）
- level 1: 主要分支（3-6個）
- level 2: 次要分支
- level 3: 詳細內容
- nodeType: "root", "main", "sub", "leaf"
- 位置採用放射狀分布，中心為 (400, 300)
- 顏色使用現有調色板：#FEF3C7, #FCE7F3, #DBEAFE, #D1FAE5, #EDE9FE

請確保回應是有效的 JSON 格式。
`;
  }

  /**
   * 生成樹狀圖 Prompt
   */
  static generateTreePrompt(content: string, options: MapGenerationOptions): string {
    const { maxNodes, maxDepth, style, language } = options;
    
    return `
你是一個專業的樹狀圖生成助手。請分析以下文件內容，生成層級化的樹狀圖數據。

文件內容：
"""
${content}
"""

要求：
1. 語言：${language === 'zh-TW' ? '繁體中文' : 'English'}
2. 最大節點數：${maxNodes}
3. 最大深度：${maxDepth} 層
4. 風格：${style === 'detailed' ? '詳細完整' : '簡潔明確'}
5. 樹狀圖應該從上到下或從左到右展開

回應格式（嚴格遵守 JSON 格式）：
{
  "title": "主題標題",
  "nodes": [
    {
      "id": "node_1",
      "content": "節點內容",
      "level": 0,
      "nodeType": "root",
      "parentId": null,
      "position": {
        "x": 400,
        "y": 100
      },
      "color": "#FEF3C7"
    }
  ],
  "connections": [
    {
      "from": "node_1",
      "to": "node_2"
    }
  ]
}

節點規則：
- level 0: 根節點（主題），位置 (400, 100)
- level 1: 第一層分支，垂直間距 200px
- level 2: 第二層分支，垂直間距 150px
- level 3: 第三層分支，垂直間距 120px
- nodeType: "root", "main", "sub", "leaf"
- 同層節點水平排列，間距 250px
- 顏色使用現有調色板：#FEF3C7, #FCE7F3, #DBEAFE, #D1FAE5, #EDE9FE

請確保回應是有效的 JSON 格式。
`;
  }

  /**
   * 驗證和修復 Prompt
   */
  static validatePrompt(prompt: string): { isValid: boolean; error?: string } {
    if (prompt.length > 8000) {
      return { isValid: false, error: 'Prompt 過長，請縮短文件內容' };
    }

    if (prompt.length < 100) {
      return { isValid: false, error: 'Prompt 過短，無法生成有效結果' };
    }

    return { isValid: true };
  }
}
```

### 3.2 AI 服務整合

#### 創建 `app/services/aiMapService.ts`
```typescript
import OpenAI from 'openai';
import { AIPromptGenerator } from '../utils/aiPrompts';
import { MapGenerationOptions, DocumentMapNode, Edge } from '../types';

export interface AIGenerationResult {
  title: string;
  nodes: DocumentMapNode[];
  edges: Edge[];
  processingTime: number;
}

export class AIMapService {
  private static openai: OpenAI | null = null;

  /**
   * 初始化 OpenAI 客戶端
   */
  private static getOpenAI(): OpenAI {
    if (!this.openai) {
      const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OpenAI API Key 未設置');
      }
      this.openai = new OpenAI({ apiKey });
    }
    return this.openai;
  }

  /**
   * 生成心智圖或樹狀圖
   */
  static async generateMap(
    content: string,
    options: MapGenerationOptions,
    documentId: string
  ): Promise<AIGenerationResult> {
    const startTime = Date.now();
    
    try {
      // 生成 Prompt
      const prompt = options.mapType === 'mindmap'
        ? AIPromptGenerator.generateMindmapPrompt(content, options)
        : AIPromptGenerator.generateTreePrompt(content, options);

      // 驗證 Prompt
      const validation = AIPromptGenerator.validatePrompt(prompt);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      // 調用 OpenAI API
      const openai = this.getOpenAI();
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: '你是一個專業的心智圖和樹狀圖生成助手。請嚴格按照 JSON 格式回應。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: 'json_object' }
      });

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error('AI 回應為空');
      }

      // 解析 AI 回應
      const parsedResult = this.parseAIResponse(result, documentId, options.mapType);
      
      const processingTime = Date.now() - startTime;
      
      return {
        ...parsedResult,
        processingTime
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error('AI 生成失敗:', error);
      
      // 提供更友好的錯誤信息
      if (error.message.includes('rate limit')) {
        throw new Error('AI 服務繁忙，請稍後重試');
      } else if (error.message.includes('API key')) {
        throw new Error('AI 服務配置錯誤');
      } else {
        throw new Error(`AI 生成失敗: ${error.message}`);
      }
    }
  }

  /**
   * 解析 AI 回應
   */
  private static parseAIResponse(
    response: string, 
    documentId: string, 
    mapType: 'mindmap' | 'tree'
  ): Omit<AIGenerationResult, 'processingTime'> {
    try {
      const data = JSON.parse(response);
      
      // 驗證必要字段
      if (!data.title || !data.nodes || !data.connections) {
        throw new Error('AI 回應格式不完整');
      }

      // 轉換節點格式
      const nodes: DocumentMapNode[] = data.nodes.map((node: any, index: number) => ({
        id: node.id || `node_${index}`,
        x: node.position?.x || 0,
        y: node.position?.y || 0,
        width: this.calculateNodeWidth(node.content),
        height: this.calculateNodeHeight(node.content),
        content: node.content || '',
        color: node.color || this.getDefaultColor(node.level || 0),
        level: node.level || 0,
        nodeType: node.nodeType || 'leaf',
        parentId: node.parentId,
        childIds: [],
        documentId
      }));

      // 建立父子關係
      nodes.forEach(node => {
        const children = nodes.filter(n => n.parentId === node.id);
        node.childIds = children.map(child => child.id);
      });

      // 轉換連接格式
      const edges: Edge[] = data.connections.map((conn: any, index: number) => ({
        id: `edge_${index}`,
        from: conn.from,
        to: conn.to
      }));

      // 驗證節點和連接的一致性
      this.validateNodesAndEdges(nodes, edges);

      return {
        title: data.title,
        nodes,
        edges
      };

    } catch (error) {
      console.error('解析 AI 回應失敗:', error);
      throw new Error('AI 回應格式錯誤，請重試');
    }
  }

  /**
   * 計算節點寬度
   */
  private static calculateNodeWidth(content: string): number {
    const baseWidth = 120;
    const charWidth = 12;
    const maxWidth = 300;
    
    return Math.min(baseWidth + content.length * charWidth, maxWidth);
  }

  /**
   * 計算節點高度
   */
  private static calculateNodeHeight(content: string): number {
    const baseHeight = 80;
    const lineHeight = 20;
    const charsPerLine = 15;
    
    const lines = Math.ceil(content.length / charsPerLine);
    return Math.max(baseHeight, baseHeight + (lines - 1) * lineHeight);
  }

  /**
   * 獲取默認顏色
   */
  private static getDefaultColor(level: number): string {
    const colors = ['#FEF3C7', '#FCE7F3', '#DBEAFE', '#D1FAE5', '#EDE9FE'];
    return colors[level % colors.length];
  }

  /**
   * 驗證節點和連接
   */
  private static validateNodesAndEdges(nodes: DocumentMapNode[], edges: Edge[]): void {
    const nodeIds = new Set(nodes.map(n => n.id));
    
    // 檢查連接的節點是否存在
    for (const edge of edges) {
      if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
        throw new Error('連接指向不存在的節點');
      }
    }

    // 檢查是否有根節點
    const rootNodes = nodes.filter(n => n.level === 0);
    if (rootNodes.length === 0) {
      throw new Error('缺少根節點');
    }
  }
}
```

---

## Phase 4: 渲染和互動 (2 天)

### 4.1 心智圖渲染邏輯

#### 修改 `app/components/Whiteboard.tsx`
```typescript
// 在現有 Whiteboard 組件中添加文件心智圖功能

interface WhiteboardProps {
  // 現有 props...
}

const Whiteboard: React.FC<WhiteboardProps> = ({ /* 現有 props */ }) => {
  // 現有狀態...
  
  // 新增狀態
  const [showFileUploadDialog, setShowFileUploadDialog] = useState(false);
  const [documentMaps, setDocumentMaps] = useState<DocumentMap[]>([]);
  const [processingProgress, setProcessingProgress] = useState<ProcessingProgress>({
    stage: 'idle',
    progress: 0,
    message: ''
  });

  // 處理文件上傳
  const handleDocumentUpload = useCallback(() => {
    // 檢查用戶是否登入
    if (!user) {
      setAiResult('請先登入以使用文件生成功能');
      return;
    }
    
    setShowFileUploadDialog(true);
  }, [user]);

  // 處理上傳成功
  const handleUploadSuccess = useCallback(async (documentId: string) => {
    try {
      setProcessingProgress({
        stage: 'ai-processing',
        progress: 50,
        message: 'AI 正在分析文件內容...'
      });

      // 獲取生成的心智圖數據
      const response = await fetch(`/api/document-to-map/${documentId}`);
      if (!response.ok) {
        throw new Error('獲取生成結果失敗');
      }

      const mapData: DocumentMap = await response.json();
      
      setProcessingProgress({
        stage: 'rendering',
        progress: 80,
        message: '正在渲染心智圖...'
      });

      // 將心智圖節點添加到白板
      await renderDocumentMap(mapData);
      
      setProcessingProgress({
        stage: 'completed',
        progress: 100,
        message: '心智圖生成完成！'
      });

      // 更新文檔映射列表
      setDocumentMaps(prev => [...prev, mapData]);
      
      // 清除進度狀態
      setTimeout(() => {
        setProcessingProgress({
          stage: 'idle',
          progress: 0,
          message: ''
        });
      }, 2000);

    } catch (error) {
      setProcessingProgress({
        stage: 'error',
        progress: 0,
        message: '',
        error: error instanceof Error ? error.message : '生成失敗'
      });
    }
  }, []);

  // 渲染文件心智圖到白板
  const renderDocumentMap = useCallback(async (mapData: DocumentMap) => {
    saveToHistory(whiteboardData); // 保存歷史

    // 轉換心智圖節點為便利貼
    const newNotes: StickyNote[] = mapData.nodes.map(node => ({
      id: node.id,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      content: node.content,
      color: node.color
    }));

    // 轉換連接
    const newEdges: Edge[] = mapData.edges.map(edge => ({
      id: edge.id,
      from: edge.from,
      to: edge.to
    }));

    // 更新白板數據
    updateWhiteboardData(prev => ({
      ...prev,
      notes: [...prev.notes, ...newNotes],
      edges: [...prev.edges, ...newEdges],
      documentMaps: [...(prev.documentMaps || []), mapData]
    }));

    // 自動調整視窗以顯示新內容
    adjustViewportToContent(newNotes);
    
  }, [whiteboardData, saveToHistory, updateWhiteboardData]);

  // 調整視窗以顯示內容
  const adjustViewportToContent = useCallback((notes: StickyNote[]) => {
    if (notes.length === 0) return;

    const padding = 100;
    const minX = Math.min(...notes.map(n => n.x)) - padding;
    const minY = Math.min(...notes.map(n => n.y)) - padding;
    const maxX = Math.max(...notes.map(n => n.x + n.width)) + padding;
    const maxY = Math.max(...notes.map(n => n.y + n.height)) + padding;

    // 計算適合的縮放級別
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const containerWidth = window.innerWidth;
    const containerHeight = window.innerHeight;

    const scaleX = containerWidth / contentWidth;
    const scaleY = containerHeight / contentHeight;
    const newZoom = Math.min(scaleX, scaleY, 1) * 0.9; // 留 10% 邊距

    // 計算居中位置
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const newPanX = containerWidth / 2 - centerX * newZoom;
    const newPanY = containerHeight / 2 - centerY * newZoom;

    // 平滑動畫過渡
    const duration = 1000; // 1秒
    const startZoom = zoomLevel;
    const startPanX = panOffset.x;
    const startPanY = panOffset.y;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // 使用緩動函數
      const easeInOut = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      const easedProgress = easeInOut(progress);

      const currentZoom = startZoom + (newZoom - startZoom) * easedProgress;
      const currentPanX = startPanX + (newPanX - startPanX) * easedProgress;
      const currentPanY = startPanY + (newPanY - startPanY) * easedProgress;

      setZoomLevel(currentZoom);
      setPanOffset({ x: currentPanX, y: currentPanY });

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [zoomLevel, panOffset]);

  // 在渲染中添加文件上傳對話框
  return (
    <div className="relative w-full h-full">
      {/* 現有內容... */}
      
      {/* 文件上傳對話框 */}
      <FileUploadDialog
        isOpen={showFileUploadDialog}
        onClose={() => setShowFileUploadDialog(false)}
        onUploadSuccess={handleUploadSuccess}
        onError={(error) => {
          setAiResult(`❌ ${error}`);
          setShowFileUploadDialog(false);
        }}
      />

      {/* 處理進度顯示 */}
      {processingProgress.stage !== 'idle' && (
        <ProcessingProgressOverlay progress={processingProgress} />
      )}
    </div>
  );
};
```

#### 創建 `app/components/ProcessingProgressOverlay.tsx`
```typescript
'use client';

import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { ProcessingProgress } from '../types';

interface ProcessingProgressOverlayProps {
  progress: ProcessingProgress;
}

const ProcessingProgressOverlay: React.FC<ProcessingProgressOverlayProps> = ({ progress }) => {
  const { isDarkMode } = useTheme();

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'uploading': return '📤';
      case 'parsing': return '📖';
      case 'ai-processing': return '🤖';
      case 'generating': return '🎨';
      case 'rendering': return '✨';
      case 'completed': return '✅';
      case 'error': return '❌';
      default: return '⏳';
    }
  };

  const getStageText = (stage: string) => {
    switch (stage) {
      case 'uploading': return '上傳文件中';
      case 'parsing': return '解析文件內容';
      case 'ai-processing': return 'AI 分析中';
      case 'generating': return '生成心智圖';
      case 'rendering': return '渲染到畫布';
      case 'completed': return '完成';
      case 'error': return '處理失敗';
      default: return '處理中';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className={`max-w-sm w-full mx-4 p-6 rounded-lg shadow-xl ${
        isDarkMode ? 'bg-dark-bg-secondary' : 'bg-white'
      }`}>
        {/* 圖標和標題 */}
        <div className="text-center mb-4">
          <div className="text-4xl mb-2">
            {getStageIcon(progress.stage)}
          </div>
          <h3 className={`text-lg font-medium ${
            isDarkMode ? 'text-dark-text' : 'text-gray-900'
          }`}>
            {getStageText(progress.stage)}
          </h3>
        </div>

        {/* 進度條 */}
        {progress.stage !== 'error' && progress.stage !== 'completed' && (
          <div className="mb-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress.progress}%` }}
              />
            </div>
            <p className={`text-sm mt-2 text-center ${
              isDarkMode ? 'text-dark-text-secondary' : 'text-gray-600'
            }`}>
              {progress.progress}% 完成
            </p>
          </div>
        )}

        {/* 訊息 */}
        {progress.message && (
          <p className={`text-sm text-center ${
            isDarkMode ? 'text-dark-text' : 'text-gray-700'
          }`}>
            {progress.message}
          </p>
        )}

        {/* 錯誤訊息 */}
        {progress.error && (
          <p className="text-sm text-center text-red-500 mt-2">
            {progress.error}
          </p>
        )}

        {/* 完成時的自動關閉提示 */}
        {progress.stage === 'completed' && (
          <p className={`text-xs text-center mt-2 ${
            isDarkMode ? 'text-dark-text-secondary' : 'text-gray-500'
          }`}>
            即將自動關閉...
          </p>
        )}
      </div>
    </div>
  );
};

export default ProcessingProgressOverlay;
```

### 4.2 節點樣式和互動

#### 擴展 `app/components/StickyNote.tsx`
```typescript
// 在現有 StickyNote 組件中添加文件心智圖節點樣式

interface StickyNoteComponentProps {
  // 現有 props...
  isDocumentMapNode?: boolean;    // 新增：是否為文件心智圖節點
  nodeLevel?: number;             // 新增：節點層級
  nodeType?: 'root' | 'main' | 'sub' | 'leaf'; // 新增：節點類型
}

const StickyNoteComponent: React.FC<StickyNoteComponentProps> = ({
  // 現有 props...
  isDocumentMapNode = false,
  nodeLevel = 0,
  nodeType = 'leaf'
}) => {
  // 獲取文件心智圖節點的特殊樣式
  const getDocumentNodeStyle = () => {
    if (!isDocumentMapNode) return {};

    const baseStyle = {
      borderRadius: '12px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    };

    switch (nodeType) {
      case 'root':
        return {
          ...baseStyle,
          borderWidth: '3px',
          borderStyle: 'solid',
          borderColor: '#3B82F6',
          boxShadow: '0 8px 25px rgba(59, 130, 246, 0.3)',
        };
      case 'main':
        return {
          ...baseStyle,
          borderWidth: '2px',
          borderStyle: 'solid',
          borderColor: '#10B981',
        };
      case 'sub':
        return {
          ...baseStyle,
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: '#8B5CF6',
        };
      default:
        return baseStyle;
    }
  };

  const getNodeFontSize = () => {
    if (!isDocumentMapNode) return getAdaptiveFontSize();

    switch (nodeType) {
      case 'root': return Math.max(getAdaptiveFontSize() * 1.2, 18);
      case 'main': return Math.max(getAdaptiveFontSize() * 1.1, 16);
      case 'sub': return Math.max(getAdaptiveFontSize(), 14);
      default: return Math.max(getAdaptiveFontSize() * 0.9, 12);
    }
  };

  const getNodeIcon = () => {
    if (!isDocumentMapNode) return null;

    const iconMap = {
      root: '🎯',
      main: '🔸',
      sub: '▪️',
      leaf: '•'
    };

    return iconMap[nodeType];
  };

  return (
    <div
      // 現有屬性...
      style={{
        // 現有樣式...
        ...getDocumentNodeStyle()
      }}
    >
      <div
        className={`w-full h-full rounded-lg shadow-lg border-2 transition-all ${
          // 現有類名...
        }`}
        style={{
          // 現有樣式...
          backgroundColor: isDarkMode 
            ? note.color + 'CC'
            : note.color,
        }}
      >
        {/* 內容區域 */}
        <div className="w-full h-full p-3">
          {isEditing ? (
            // 現有編輯模式...
          ) : (
            <div className="w-full h-full flex items-center justify-center text-center">
              {/* 文件心智圖節點圖標 */}
              {isDocumentMapNode && (
                <span className="mr-1 text-sm opacity-70">
                  {getNodeIcon()}
                </span>
              )}
              
              {/* 內容 */}
              <span
                style={{
                  fontSize: `${getNodeFontSize()}px`,
                  fontWeight: nodeType === 'root' ? 'bold' : 'normal',
                  color: isDarkMode ? '#F3F4F6' : '#1F2937'
                }}
              >
                {note.content || (
                  <span className="text-gray-500 text-2xl">點擊編輯...</span>
                )}
              </span>
            </div>
          )}
        </div>

        {/* 文件心智圖節點的層級指示器 */}
        {isDocumentMapNode && nodeLevel > 0 && (
          <div 
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-bold"
            title={`第 ${nodeLevel} 層`}
          >
            {nodeLevel}
          </div>
        )}
      </div>
    </div>
  );
};
```

### 4.3 佈局算法

#### 創建 `app/utils/layoutAlgorithms.ts`
```typescript
import { DocumentMapNode } from '../types';

export interface LayoutOptions {
  centerX: number;
  centerY: number;
  levelSpacing: number;
  nodeSpacing: number;
  style: 'radial' | 'tree' | 'force';
}

export class LayoutAlgorithms {
  /**
   * 放射狀佈局（心智圖）
   */
  static radialLayout(nodes: DocumentMapNode[], options: LayoutOptions): DocumentMapNode[] {
    const { centerX, centerY, levelSpacing } = options;
    const layoutNodes = [...nodes];
    
    // 按層級分組
    const nodesByLevel: { [level: number]: DocumentMapNode[] } = {};
    layoutNodes.forEach(node => {
      if (!nodesByLevel[node.level]) {
        nodesByLevel[node.level] = [];
      }
      nodesByLevel[node.level].push(node);
    });

    // 處理根節點
    const rootNodes = nodesByLevel[0] || [];
    if (rootNodes.length > 0) {
      rootNodes[0].x = centerX - rootNodes[0].width / 2;
      rootNodes[0].y = centerY - rootNodes[0].height / 2;
    }

    // 處理其他層級
    for (let level = 1; level <= Math.max(...Object.keys(nodesByLevel).map(Number)); level++) {
      const currentLevelNodes = nodesByLevel[level] || [];
      const radius = levelSpacing * level;
      
      currentLevelNodes.forEach((node, index) => {
        const angle = (2 * Math.PI * index) / currentLevelNodes.length;
        node.x = centerX + Math.cos(angle) * radius - node.width / 2;
        node.y = centerY + Math.sin(angle) * radius - node.height / 2;
      });
    }

    return layoutNodes;
  }

  /**
   * 樹狀佈局
   */
  static treeLayout(nodes: DocumentMapNode[], options: LayoutOptions): DocumentMapNode[] {
    const { centerX, centerY, levelSpacing, nodeSpacing } = options;
    const layoutNodes = [...nodes];
    
    // 建立層級結構
    const nodesByLevel: { [level: number]: DocumentMapNode[] } = {};
    layoutNodes.forEach(node => {
      if (!nodesByLevel[node.level]) {
        nodesByLevel[node.level] = [];
      }
      nodesByLevel[node.level].push(node);
    });

    // 計算每層的 Y 位置
    const maxLevel = Math.max(...Object.keys(nodesByLevel).map(Number));
    
    // 處理每一層
    for (let level = 0; level <= maxLevel; level++) {
      const currentLevelNodes = nodesByLevel[level] || [];
      const y = centerY + level * levelSpacing;
      
      // 計算總寬度
      const totalWidth = currentLevelNodes.reduce((sum, node, index) => {
        return sum + node.width + (index > 0 ? nodeSpacing : 0);
      }, 0);
      
      // 從左到右排列節點
      let currentX = centerX - totalWidth / 2;
      currentLevelNodes.forEach(node => {
        node.x = currentX;
        node.y = y - node.height / 2;
        currentX += node.width + nodeSpacing;
      });
    }

    return layoutNodes;
  }

  /**
   * 力導向佈局（適用於複雜關係）
   */
  static forceLayout(
    nodes: DocumentMapNode[], 
    edges: { from: string; to: string }[],
    options: LayoutOptions
  ): DocumentMapNode[] {
    const layoutNodes = [...nodes];
    const iterations = 50;
    const repulsionForce = 10000;
    const attractionForce = 0.1;
    const damping = 0.9;

    // 初始化速度
    const velocities = new Map<string, { vx: number; vy: number }>();
    layoutNodes.forEach(node => {
      velocities.set(node.id, { vx: 0, vy: 0 });
    });

    // 迭代計算
    for (let i = 0; i < iterations; i++) {
      // 計算排斥力
      for (let j = 0; j < layoutNodes.length; j++) {
        const nodeA = layoutNodes[j];
        const velocityA = velocities.get(nodeA.id)!;
        
        for (let k = j + 1; k < layoutNodes.length; k++) {
          const nodeB = layoutNodes[k];
          const velocityB = velocities.get(nodeB.id)!;
          
          const dx = nodeB.x - nodeA.x;
          const dy = nodeB.y - nodeA.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          
          const force = repulsionForce / (distance * distance);
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;
          
          velocityA.vx -= fx;
          velocityA.vy -= fy;
          velocityB.vx += fx;
          velocityB.vy += fy;
        }
      }

      // 計算吸引力（基於連接）
      edges.forEach(edge => {
        const nodeA = layoutNodes.find(n => n.id === edge.from);
        const nodeB = layoutNodes.find(n => n.id === edge.to);
        
        if (nodeA && nodeB) {
          const velocityA = velocities.get(nodeA.id)!;
          const velocityB = velocities.get(nodeB.id)!;
          
          const dx = nodeB.x - nodeA.x;
          const dy = nodeB.y - nodeA.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          
          const force = attractionForce * distance;
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;
          
          velocityA.vx += fx;
          velocityA.vy += fy;
          velocityB.vx -= fx;
          velocityB.vy -= fy;
        }
      });

      // 更新位置
      layoutNodes.forEach(node => {
        const velocity = velocities.get(node.id)!;
        node.x += velocity.vx;
        node.y += velocity.vy;
        
        // 應用阻尼
        velocity.vx *= damping;
        velocity.vy *= damping;
      });
    }

    return layoutNodes;
  }

  /**
   * 自動選擇最佳佈局
   */
  static autoLayout(
    nodes: DocumentMapNode[], 
    edges: { from: string; to: string }[],
    options: LayoutOptions
  ): DocumentMapNode[] {
    const nodeCount = nodes.length;
    const maxLevel = Math.max(...nodes.map(n => n.level));
    
    // 根據節點數量和層級深度選擇佈局
    if (maxLevel <= 2 && nodeCount <= 10) {
      return this.radialLayout(nodes, options);
    } else if (maxLevel > 2) {
      return this.treeLayout(nodes, options);
    } else {
      return this.forceLayout(nodes, edges, options);
    }
  }

  /**
   * 調整佈局以避免重疊
   */
  static adjustForOverlaps(nodes: DocumentMapNode[], padding: number = 20): DocumentMapNode[] {
    const layoutNodes = [...nodes];
    const maxIterations = 10;
    
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      let hasOverlap = false;
      
      for (let i = 0; i < layoutNodes.length; i++) {
        const nodeA = layoutNodes[i];
        
        for (let j = i + 1; j < layoutNodes.length; j++) {
          const nodeB = layoutNodes[j];
          
          // 檢查重疊
          const overlapX = (nodeA.width + nodeB.width) / 2 + padding - Math.abs(nodeA.x - nodeB.x);
          const overlapY = (nodeA.height + nodeB.height) / 2 + padding - Math.abs(nodeA.y - nodeB.y);
          
          if (overlapX > 0 && overlapY > 0) {
            hasOverlap = true;
            
            // 計算分離方向
            const dx = nodeB.x - nodeA.x;
            const dy = nodeB.y - nodeA.y;
            const distance = Math.sqrt(dx * dx + dy * dy) || 1;
            
            // 移動較小的重疊量
            const moveDistance = Math.min(overlapX, overlapY) / 2;
            const moveX = (dx / distance) * moveDistance;
            const moveY = (dy / distance) * moveDistance;
            
            nodeA.x -= moveX;
            nodeA.y -= moveY;
            nodeB.x += moveX;
            nodeB.y += moveY;
          }
        }
      }
      
      if (!hasOverlap) break;
    }
    
    return layoutNodes;
  }
}
```

---

## 技術規範和最佳實踐

### 5.1 性能優化

#### 文件處理優化
```typescript
// 大文件分塊處理
export class ChunkedFileProcessor {
  static async processLargeFile(content: string, maxChunkSize: number = 8000): Promise<string[]> {
    const chunks: string[] = [];
    let currentChunk = '';
    const sentences = content.split(/[。！？.!?]/);
    
    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > maxChunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = sentence;
        } else {
          // 單個句子過長，強制分割
          chunks.push(sentence.substring(0, maxChunkSize));
          currentChunk = sentence.substring(maxChunkSize);
        }
      } else {
        currentChunk += sentence + '。';
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }
}
```

#### 渲染優化
```typescript
// 虛擬化大量節點
export const VirtualizedNodeRenderer = React.memo<{
  nodes: DocumentMapNode[];
  viewport: { x: number; y: number; width: number; height: number; zoom: number };
}>((  { nodes, viewport }) => {
  const visibleNodes = useMemo(() => {
    return nodes.filter(node => {
      const nodeX = node.x * viewport.zoom + viewport.x;
      const nodeY = node.y * viewport.zoom + viewport.y;
      const nodeWidth = node.width * viewport.zoom;
      const nodeHeight = node.height * viewport.zoom;
      
      return (
        nodeX + nodeWidth >= 0 &&
        nodeY + nodeHeight >= 0 &&
        nodeX <= viewport.width &&
        nodeY <= viewport.height
      );
    });
  }, [nodes, viewport]);

  return (
    <>
      {visibleNodes.map(node => (
        <StickyNoteComponent key={node.id} note={node} />
      ))}
    </>
  );
});
```

### 5.2 錯誤處理策略

#### 全局錯誤邊界
```typescript
// app/components/DocumentMapErrorBoundary.tsx
class DocumentMapErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('文件心智圖錯誤:', error, errorInfo);
    
    // 發送錯誤報告
    if (typeof window !== 'undefined') {
      // 可以集成錯誤報告服務
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-red-800 font-medium mb-2">生成心智圖時發生錯誤</h3>
          <p className="text-red-600 text-sm mb-4">
            {this.state.error?.message || '未知錯誤'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            重試
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### 5.3 安全性考量

#### API 速率限制
```typescript
// app/utils/rateLimiter.ts
export class RateLimiter {
  private static requests = new Map<string, number[]>();
  
  static checkLimit(userId: string, maxRequests: number = 5, timeWindow: number = 60000): boolean {
    const now = Date.now();
    const userRequests = this.requests.get(userId) || [];
    
    // 清除過期請求
    const validRequests = userRequests.filter(time => now - time < timeWindow);
    
    if (validRequests.length >= maxRequests) {
      return false;
    }
    
    validRequests.push(now);
    this.requests.set(userId, validRequests);
    return true;
  }
}
```

#### 內容過濾
```typescript
// app/utils/contentFilter.ts
export class ContentFilter {
  private static sensitivePatterns = [
    /password/i,
    /secret/i,
    /confidential/i,
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/, // 信用卡號
  ];

  static filterSensitiveContent(content: string): { filtered: string; warnings: string[] } {
    let filtered = content;
    const warnings: string[] = [];

    this.sensitivePatterns.forEach(pattern => {
      if (pattern.test(content)) {
        warnings.push('檢測到可能的敏感信息');
        filtered = filtered.replace(pattern, '[已隱藏]');
      }
    });

    return { filtered, warnings };
  }
}
```

### 5.4 測試策略

#### 單元測試範例
```typescript
// __tests__/documentParser.test.ts
import { DocumentParser } from '../app/utils/documentParser';

describe('DocumentParser', () => {
  test('應該正確解析 TXT 內容', async () => {
    const content = '這是測試內容。包含多個句子。';
    const buffer = new TextEncoder().encode(content).buffer;
    
    const result = await DocumentParser.parseTXT(buffer);
    
    expect(result.content).toBe(content);
    expect(result.metadata.wordCount).toBeGreaterThan(0);
  });

  test('應該驗證內容長度', () => {
    const shortContent = '短';
    const longContent = 'a'.repeat(60000);
    
    expect(DocumentParser.validateContent(shortContent).isValid).toBe(false);
    expect(DocumentParser.validateContent(longContent).isValid).toBe(false);
  });
});
```

#### 集成測試
```typescript
// __tests__/documentToMap.integration.test.ts
import { NextRequest } from 'next/server';
import { POST } from '../app/api/document-to-map/route';

describe('Document to Map API', () => {
  test('應該成功處理文件上傳', async () => {
    const formData = new FormData();
    const testFile = new File(['測試內容'], 'test.txt', { type: 'text/plain' });
    formData.append('file', testFile);
    formData.append('options', JSON.stringify({
      mapType: 'mindmap',
      maxNodes: 10,
      maxDepth: 2,
      style: 'concise',
      language: 'zh-TW'
    }));

    const request = new NextRequest('http://localhost/api/document-to-map', {
      method: 'POST',
      body: formData
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.documentId).toBeDefined();
  });
});
```

### 5.5 部署檢查清單

#### 環境變數檢查
```bash
# .env.local 必需變數
NEXT_PUBLIC_OPENAI_API_KEY=your-openai-api-key
NEXTAUTH_URL=your-app-url
NEXTAUTH_SECRET=your-secret
# Firebase 配置...
```

#### 依賴安裝
```bash
npm install pdf-parse
npm install @types/pdf-parse --save-dev
```

#### 構建檢查
```bash
npm run lint
npm run build
npm test
```

---

## 總結

本實作指南提供了完整的文件轉心智圖功能實作方案，包括：

1. **Phase 1**: 基礎架構和數據結構定義
2. **Phase 2**: 文件處理和驗證機制
3. **Phase 3**: AI 整合和 Prompt 設計
4. **Phase 4**: 渲染邏輯和用戶互動

### 關鍵特性
- 支援 PDF 和 TXT 文件上傳
- AI 驅動的智能心智圖生成
- 多種佈局算法支援
- 完整的錯誤處理和驗證
- 性能優化和安全性考量
- 與現有系統無縫整合

### 預期工作量
- **總計**: 10 人天
- **Phase 1**: 3 天 (基礎架構)
- **Phase 2**: 2 天 (文件處理)
- **Phase 3**: 3 天 (AI 整合)
- **Phase 4**: 2 天 (渲染互動)

此實作方案確保了功能的完整性、系統的穩定性和良好的用戶體驗。