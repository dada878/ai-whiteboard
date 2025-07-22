'use client';

import React, { useState } from 'react';

interface FloatingToolbarProps {
  onAnalyze: () => void;
  onSummarize: () => void;
  onClear?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onExport?: (format: 'png' | 'pdf' | 'json') => void;
  onSearch?: () => void;
  onTemplate?: () => void;
  onNotes?: () => void;
  selectedCount?: number;
}

const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  onAnalyze,
  onSummarize,
  onClear,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onExport,
  onSearch,
  onTemplate,
  onNotes,
  selectedCount = 0
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);

  return (
    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-40">
      <div className="bg-white/90 backdrop-blur-lg rounded-2xl shadow-2xl border border-gray-200/50 px-4 py-3">
        <div className="flex items-center space-x-1">
          
          {/* 選擇狀態指示器 */}
          {selectedCount > 0 && (
            <>
              <div className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium">
                已選擇 {selectedCount} 個項目
              </div>
              <div className="w-px h-8 bg-gray-300 mx-2" />
            </>
          )}

          {/* 撤銷/重做 */}
          <div className="flex items-center space-x-1 mr-2">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={`p-2.5 rounded-lg transition-all ${
                canUndo 
                  ? 'hover:bg-gray-100 text-gray-700 hover:shadow-sm' 
                  : 'text-gray-300 cursor-not-allowed'
              }`}
              title="撤銷 (Ctrl+Z)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className={`p-2.5 rounded-lg transition-all ${
                canRedo 
                  ? 'hover:bg-gray-100 text-gray-700 hover:shadow-sm' 
                  : 'text-gray-300 cursor-not-allowed'
              }`}
              title="重做 (Ctrl+Y)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
              </svg>
            </button>
          </div>

          <div className="w-px h-8 bg-gray-300" />

          {/* 主要功能 */}
          <button
            onClick={onTemplate}
            className="px-3 py-2.5 hover:bg-purple-50 hover:text-purple-600 rounded-lg transition-all text-gray-700 hover:shadow-sm flex items-center space-x-2"
            title="範本庫"
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
            <span className="text-sm font-medium">範本</span>
          </button>

          <button
            onClick={onNotes}
            className="px-3 py-2.5 hover:bg-yellow-50 hover:text-yellow-600 rounded-lg transition-all text-gray-700 hover:shadow-sm flex items-center space-x-2"
            title="備忘錄"
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span className="text-sm font-medium">筆記</span>
          </button>

          <button
            onClick={onSearch}
            className="p-2.5 hover:bg-gray-100 rounded-lg transition-all text-gray-700 hover:shadow-sm"
            title="搜尋 (Ctrl+F)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          <div className="w-px h-8 bg-gray-300" />

          {/* AI 功能 */}
          <button
            onClick={onAnalyze}
            className="px-3 py-2.5 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-all text-gray-700 hover:shadow-sm flex items-center space-x-2"
            title="AI 分析畫布"
          >
            <span className="text-lg">🧠</span>
            <span className="text-sm font-medium">AI 分析</span>
          </button>
          
          <button
            onClick={onSummarize}
            className="px-3 py-2.5 hover:bg-green-50 hover:text-green-600 rounded-lg transition-all text-gray-700 hover:shadow-sm flex items-center space-x-2"
            title="AI 總結"
          >
            <span className="text-lg">✨</span>
            <span className="text-sm font-medium">AI 總結</span>
          </button>

          <div className="w-px h-8 bg-gray-300" />

          {/* 匯出功能 */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="p-2.5 hover:bg-gray-100 rounded-lg transition-all text-gray-700 hover:shadow-sm"
              title="匯出"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>

            {showExportMenu && (
              <div className="absolute bottom-full mb-2 right-0 bg-white rounded-lg shadow-xl border border-gray-200 py-2 min-w-32">
                <button
                  onClick={() => {
                    onExport?.('png');
                    setShowExportMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 text-sm"
                >
                  匯出為 PNG
                </button>
                <button
                  onClick={() => {
                    onExport?.('pdf');
                    setShowExportMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 text-sm"
                >
                  匯出為 PDF
                </button>
                <button
                  onClick={() => {
                    onExport?.('json');
                    setShowExportMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 text-sm"
                >
                  匯出為 JSON
                </button>
              </div>
            )}
          </div>

          <div className="w-px h-8 bg-gray-300" />
          
          {/* 清除畫布 */}
          {onClear && (
            <button
              onClick={onClear}
              className="p-2.5 hover:bg-red-50 hover:text-red-600 rounded-lg transition-all text-gray-700 hover:shadow-sm"
              title="清除畫布"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* 快捷提示 */}
      <div className="mt-3 text-center text-xs text-gray-500">
        <span className="inline-flex items-center space-x-4">
          <span>右鍵新增便利貼</span>
          <span>•</span>
          <span>Ctrl+G 建立群組</span>
          <span>•</span>
          <span>按住空白處拖曳畫布</span>
        </span>
      </div>
    </div>
  );
};

export default FloatingToolbar;