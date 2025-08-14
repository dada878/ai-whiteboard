'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface PlusWelcomeDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PlusWelcomeDialog({ isOpen, onClose }: PlusWelcomeDialogProps) {
  const { isDarkMode } = useTheme();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // 等待動畫結束
  };

  if (!isOpen && !isVisible) return null;

  const plusFeatures = [
    {
      icon: '🚀',
      title: '無限制 AI 功能',
      description: '享受所有 AI 功能，包括智能整理、腦力激盪、SWOT 分析等'
    },
    {
      icon: '☁️',
      title: '雲端同步',
      description: '自動儲存您的白板到雲端，隨時隨地存取'
    },
    {
      icon: '🎨',
      title: '進階自訂功能',
      description: '更多顏色選項、自訂主題和進階排版工具'
    },
    {
      icon: '📊',
      title: '專業匯出',
      description: '匯出高解析度圖片、PDF 和其他專業格式'
    },
    {
      icon: '⚡',
      title: '優先支援',
      description: '獲得優先技術支援和新功能搶先體驗'
    },
    {
      icon: '♾️',
      title: '無限專案',
      description: '創建和管理無限數量的白板專案'
    }
  ];

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
      onClick={handleClose}
    >
      <div 
        className={`relative w-full max-w-2xl mx-4 rounded-2xl shadow-2xl transition-all duration-300 transform ${
          isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
        } ${isDarkMode ? 'bg-dark-bg-secondary' : 'bg-white'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 關閉按鈕 */}
        <button
          onClick={handleClose}
          className={`absolute top-4 right-4 p-2 rounded-lg transition-colors ${
            isDarkMode 
              ? 'hover:bg-dark-bg-tertiary text-dark-text' 
              : 'hover:bg-gray-100 text-gray-600'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* 頂部裝飾 */}
        <div className="relative h-32 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-t-2xl overflow-hidden">
          <div className="absolute inset-0 bg-black bg-opacity-10"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-2">🎉</div>
              <div className="text-white text-2xl font-bold drop-shadow-lg">歡迎成為 Plus 會員！</div>
            </div>
          </div>
          <div className="absolute -bottom-1 left-0 right-0 h-8 bg-gradient-to-t from-white/20 to-transparent"></div>
        </div>

        {/* 內容區域 */}
        <div className="p-8">
          {/* 感謝訊息 */}
          <div className={`text-center mb-8 ${isDarkMode ? 'text-dark-text' : 'text-gray-800'}`}>
            <h2 className="text-2xl font-bold mb-3">感謝您的支持！</h2>
            <p className="text-lg opacity-80">
              您現在可以享受 ThinkBoard 的所有進階功能
            </p>
          </div>

          {/* Plus 功能列表 */}
          <div className="mb-8">
            <h3 className={`text-lg font-semibold mb-4 ${
              isDarkMode ? 'text-dark-text' : 'text-gray-800'
            }`}>
              🌟 您的 Plus 會員權益
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {plusFeatures.map((feature, index) => (
                <div 
                  key={index}
                  className={`flex items-start space-x-3 p-3 rounded-lg transition-colors ${
                    isDarkMode 
                      ? 'hover:bg-dark-bg-tertiary' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="text-2xl flex-shrink-0">{feature.icon}</div>
                  <div className="flex-1">
                    <div className={`font-medium mb-1 ${
                      isDarkMode ? 'text-dark-text' : 'text-gray-800'
                    }`}>
                      {feature.title}
                    </div>
                    <div className={`text-sm ${
                      isDarkMode ? 'text-dark-text-secondary' : 'text-gray-600'
                    }`}>
                      {feature.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 快速開始提示 */}
          <div className={`p-4 rounded-lg border ${
            isDarkMode 
              ? 'bg-blue-900/20 border-blue-800 text-blue-300' 
              : 'bg-blue-50 border-blue-200 text-blue-700'
          }`}>
            <div className="flex items-start space-x-2">
              <span className="text-lg">💡</span>
              <div className="flex-1">
                <div className="font-medium mb-1">快速開始提示</div>
                <div className="text-sm opacity-90">
                  試試在白板上選擇多個便利貼，然後使用「AI 智能整理」功能來自動組織您的想法！
                </div>
              </div>
            </div>
          </div>

          {/* 行動按鈕 */}
          <div className="flex justify-center mt-8 space-x-4">
            <button
              onClick={handleClose}
              className={`px-6 py-3 rounded-lg font-medium transition-all transform hover:scale-105 ${
                isDarkMode 
                  ? 'bg-yellow-600 hover:bg-yellow-700 text-white shadow-lg shadow-yellow-600/30' 
                  : 'bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white shadow-lg shadow-orange-500/30'
              }`}
            >
              開始使用 Plus 功能
            </button>
            <a
              href="https://docs.anthropic.com/ai-whiteboard/plus"
              target="_blank"
              rel="noopener noreferrer"
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                isDarkMode 
                  ? 'bg-dark-bg-tertiary hover:bg-gray-700 text-dark-text' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              了解更多
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}