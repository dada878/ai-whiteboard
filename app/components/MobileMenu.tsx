'use client';

import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface MobileMenuProps {
  onNewNote?: () => void;
  onTemplate?: () => void;
  onNotes?: () => void;
  onSearch?: () => void;
  onExport?: (format: 'png' | 'pdf' | 'json') => void;
  onClear?: () => void;
  onAnalyze?: () => void;
  onSummarize?: () => void;
  selectedCount?: number;
}

const MobileMenu: React.FC<MobileMenuProps> = ({
  onNewNote,
  onTemplate,
  onNotes,
  onSearch,
  onExport,
  onClear,
  onAnalyze,
  onSummarize,
  selectedCount = 0
}) => {
  const { isDarkMode, toggleDarkMode } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* 懸浮選單按鈕 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg z-50 flex items-center justify-center transition-all ${
          isDarkMode 
            ? 'bg-purple-600 hover:bg-purple-700 text-white' 
            : 'bg-purple-500 hover:bg-purple-600 text-white'
        }`}
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* 選單面板 */}
      <div className={`fixed inset-0 z-40 transition-all duration-300 ${
        isOpen ? 'pointer-events-auto' : 'pointer-events-none'
      }`}>
        {/* 背景遮罩 */}
        <div 
          className={`absolute inset-0 bg-black transition-opacity duration-300 ${
            isOpen ? 'opacity-50' : 'opacity-0'
          }`}
          onClick={() => setIsOpen(false)}
        />

        {/* 選單內容 */}
        <div className={`absolute bottom-0 left-0 right-0 transition-transform duration-300 ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}>
          <div className={`rounded-t-3xl shadow-2xl px-6 pb-6 pt-4 max-h-[70vh] overflow-y-auto ${
            isDarkMode 
              ? 'bg-dark-bg-secondary text-gray-200' 
              : 'bg-white text-gray-800'
          }`}>
            {/* 拖曳指示器 */}
            <div className="flex justify-center mb-4">
              <div className={`w-12 h-1 rounded-full ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-300'
              }`} />
            </div>

            {/* 快速操作 */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <button
                onClick={() => {
                  onNewNote?.();
                  setIsOpen(false);
                }}
                className={`flex flex-col items-center justify-center p-4 rounded-xl transition-colors ${
                  isDarkMode 
                    ? 'bg-dark-bg-tertiary hover:bg-gray-700' 
                    : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-xs">新增</span>
              </button>

              <button
                onClick={() => {
                  onSearch?.();
                  setIsOpen(false);
                }}
                className={`flex flex-col items-center justify-center p-4 rounded-xl transition-colors ${
                  isDarkMode 
                    ? 'bg-dark-bg-tertiary hover:bg-gray-700' 
                    : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="text-xs">搜尋</span>
              </button>

              <button
                onClick={() => {
                  onTemplate?.();
                  setIsOpen(false);
                }}
                className={`flex flex-col items-center justify-center p-4 rounded-xl transition-colors ${
                  isDarkMode 
                    ? 'bg-dark-bg-tertiary hover:bg-gray-700' 
                    : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
                <span className="text-xs">範本</span>
              </button>

              <button
                onClick={toggleDarkMode}
                className={`flex flex-col items-center justify-center p-4 rounded-xl transition-colors ${
                  isDarkMode 
                    ? 'bg-dark-bg-tertiary hover:bg-gray-700' 
                    : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                {isDarkMode ? (
                  <>
                    <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <span className="text-xs">淺色</span>
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                    <span className="text-xs">深色</span>
                  </>
                )}
              </button>
            </div>

            {/* AI 功能 */}
            <div className="space-y-2 mb-6">
              <h3 className="text-sm font-semibold mb-2">AI 功能</h3>
              
              <button
                onClick={() => {
                  onAnalyze?.();
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  isDarkMode 
                    ? 'bg-blue-900/30 hover:bg-blue-900/50 text-blue-400' 
                    : 'bg-blue-50 hover:bg-blue-100 text-blue-600'
                }`}
              >
                <span className="text-lg">🤖</span>
                <span className="text-sm font-medium">AI 分析畫布</span>
              </button>

              <button
                onClick={() => {
                  onSummarize?.();
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  isDarkMode 
                    ? 'bg-green-900/30 hover:bg-green-900/50 text-green-400' 
                    : 'bg-green-50 hover:bg-green-100 text-green-600'
                }`}
              >
                <span className="text-lg">📝</span>
                <span className="text-sm font-medium">AI 總結</span>
              </button>
            </div>

            {/* 其他功能 */}
            <div className="space-y-2">
              <button
                onClick={() => {
                  onNotes?.();
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  isDarkMode 
                    ? 'hover:bg-dark-bg-tertiary' 
                    : 'hover:bg-gray-50'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span className="text-sm">筆記本</span>
              </button>

              <button
                onClick={() => {
                  onExport?.('png');
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  isDarkMode 
                    ? 'hover:bg-dark-bg-tertiary' 
                    : 'hover:bg-gray-50'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-sm">匯出</span>
              </button>

              <button
                onClick={() => {
                  if (confirm('確定要清除所有內容嗎？')) {
                    onClear?.();
                    setIsOpen(false);
                  }
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  isDarkMode 
                    ? 'hover:bg-red-900/30 text-red-400' 
                    : 'hover:bg-red-50 text-red-600'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span className="text-sm">清除畫布</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MobileMenu;