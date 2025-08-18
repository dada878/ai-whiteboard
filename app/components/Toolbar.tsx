'use client';

import React from 'react';
import Link from 'next/link';

interface ToolbarProps {
  onAnalyze: () => void;
  onSummarize: () => void;
  onClear?: () => void;
  onImageUpload?: (file: File) => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ onAnalyze, onSummarize, onClear, onImageUpload }) => {
  const handleImageClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/jpg,image/gif,image/webp';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file && onImageUpload) {
        onImageUpload(file);
      }
    };
    input.click();
  };
  return (
    <div className="w-16 bg-gray-800 text-white flex flex-col items-center py-4 space-y-4">
      {/* Logo */}
      <div className="text-2xl mb-4">🧠</div>
      
      {/* 工具按鈕 */}
      <button
        onClick={onAnalyze}
        className="w-12 h-12 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center justify-center transition-colors tooltip"
        title="AI 分析畫布"
      >
        <span className="text-xl">📊</span>
      </button>
      
      <button
        onClick={onSummarize}
        className="w-12 h-12 bg-green-600 hover:bg-green-700 rounded-lg flex items-center justify-center transition-colors"
        title="AI 總結"
      >
        <span className="text-xl">📝</span>
      </button>
      
      {/* 分隔線 */}
      <div className="w-8 h-px bg-gray-600" />
      
      {/* 圖片上傳 */}
      {onImageUpload && (
        <button
          onClick={handleImageClick}
          className="w-12 h-12 bg-purple-600 hover:bg-purple-700 rounded-lg flex items-center justify-center transition-colors"
          title="上傳圖片"
        >
          <span className="text-xl">🖼️</span>
        </button>
      )}
      
      {/* 分隔線 */}
      <div className="w-8 h-px bg-gray-600" />
      
      {/* 清除畫布 */}
      {onClear && (
        <button
          onClick={onClear}
          className="w-12 h-12 bg-red-600 hover:bg-red-700 rounded-lg flex items-center justify-center transition-colors"
          title="清除畫布"
        >
          <span className="text-xl">🗑️</span>
        </button>
      )}
      
      {/* 說明文字 */}
      <div className="flex-1" />
      <div className="text-xs text-gray-400 text-center">
        <p className="mb-2">滑鼠右鍵</p>
        <p>新增便利貼</p>
        {/* 暫時隱藏升級 Plus 按鈕 */}
        {/* <div className="mt-3">
          <Link href="/plus" className="inline-block px-2 py-1 rounded bg-yellow-200 text-yellow-900">升級 Plus</Link>
        </div> */}
      </div>
    </div>
  );
};

export default Toolbar;