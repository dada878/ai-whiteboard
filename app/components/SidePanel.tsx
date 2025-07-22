'use client';

import React, { useState } from 'react';

interface SidePanelProps {
  aiResult: string;
}

const SidePanel: React.FC<SidePanelProps> = ({ aiResult }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(aiResult);
  };

  return (
    <div className={`bg-white border-l border-gray-300 transition-all duration-300 ${
      isCollapsed ? 'w-8' : 'w-80'
    }`}>
      {isCollapsed ? (
        <button
          onClick={() => setIsCollapsed(false)}
          className="w-full h-full flex items-center justify-center hover:bg-gray-100 transition-colors"
        >
          <span className="transform rotate-180">◀</span>
        </button>
      ) : (
        <div className="h-full flex flex-col">
          {/* 標題欄 */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">AI 結果</h3>
            <button
              onClick={() => setIsCollapsed(true)}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              ▶
            </button>
          </div>
          
          {/* 內容區域 */}
          <div className="flex-1 p-4 overflow-y-auto">
            {aiResult ? (
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans">
                    {aiResult}
                  </pre>
                </div>
                
                <button
                  onClick={copyToClipboard}
                  className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <span>📋</span>
                  複製結果
                </button>
              </div>
            ) : (
              <div className="text-center text-gray-500 mt-8">
                <div className="text-4xl mb-4">🤖</div>
                <p className="text-sm">
                  使用 AI 功能來分析你的白板內容
                </p>
                <div className="mt-6 space-y-2 text-xs text-gray-400">
                  <p>• 右鍵便利貼 → AI 發想</p>
                  <p>• 左側工具欄 → AI 分析</p>
                  <p>• 左側工具欄 → AI 總結</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SidePanel;