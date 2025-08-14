'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import Tooltip from './Tooltip';

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
  onAIAnalyzeSelection?: () => void;
  onAISuggestImprovements?: () => void;
  onAIRestructure?: () => void;
  onAISWOT?: () => void;
  onAIMindMap?: () => void;
  onAICriticalPath?: () => void;
  onAIAutoGroup?: () => void;
  onAIAutoGenerate?: () => void;
  onAIAutoConnect?: () => void;
  onAISmartOrganize?: () => void;
  onAIAskSelection?: () => void;
  onAIConvergeNodes?: () => void;
  // AI loading 狀態
  aiLoadingStates?: {
    analyze: boolean;
    summarize: boolean;
    brainstorm: boolean;
    askAI: boolean;
    // Chain of thought 思考步驟
    thinkingSteps?: string[];
    currentStep?: number;
  };
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
  selectedCount = 0,
  onAIAnalyzeSelection,
  onAISuggestImprovements,
  onAIRestructure,
  onAISWOT,
  onAIMindMap,
  onAICriticalPath,
  onAIAutoGroup,
  onAIAutoGenerate,
  onAIAutoConnect,
  onAISmartOrganize,
  onAIAskSelection,
  onAIConvergeNodes,
  aiLoadingStates
}) => {
  const { isDarkMode, toggleDarkMode } = useTheme();
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showAISelectionMenu, setShowAISelectionMenu] = useState(false);
  const [showAIAutoMenu, setShowAIAutoMenu] = useState(false);

  // 當選取狀態改變時，自動關閉所有下拉選單
  useEffect(() => {
    setShowExportMenu(false);
    setShowAISelectionMenu(false);
    setShowAIAutoMenu(false);
  }, [selectedCount]);

  // 點擊外部時關閉下拉選單
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // 如果點擊的不是工具欄內的元素，關閉所有下拉選單
      if (!target.closest('.floating-toolbar')) {
        setShowExportMenu(false);
        setShowAISelectionMenu(false);
        setShowAIAutoMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-40 floating-toolbar">
      <div className={`backdrop-blur-lg rounded-2xl shadow-2xl border px-4 py-3 ${
        isDarkMode 
          ? 'bg-dark-bg-secondary/90 border-gray-800/30' 
          : 'bg-white/90 border-gray-200/50'
      }`}>
        <div className="flex items-center space-x-1">
          
          {/* 選擇狀態指示器 */}
          {selectedCount > 0 && (
            <>
              <div className={`px-3 py-2 rounded-lg text-sm font-medium ${
                isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600'
              }`}>
                已選擇 {selectedCount} 個項目
              </div>
              <div className={`w-px h-8 mx-2 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'}`} />
            </>
          )}

          {/* 撤銷/重做 */}
          <div className="flex items-center space-x-1 mr-2">
            <Tooltip content="撤銷 (Ctrl+Z)">
              <button
                onClick={onUndo}
                disabled={!canUndo}
                className={`p-2.5 rounded-lg transition-all ${
                  canUndo 
                    ? `hover:shadow-sm ${
                        isDarkMode 
                          ? 'hover:bg-dark-bg-tertiary text-gray-300' 
                          : 'hover:bg-gray-100 text-gray-700'
                      }` 
                    : `cursor-not-allowed ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </button>
            </Tooltip>
            <Tooltip content="重做 (Ctrl+Y)">
              <button
                onClick={onRedo}
                disabled={!canRedo}
                className={`p-2.5 rounded-lg transition-all ${
                  canRedo 
                    ? `hover:shadow-sm ${
                        isDarkMode 
                          ? 'hover:bg-dark-bg-tertiary text-gray-300' 
                          : 'hover:bg-gray-100 text-gray-700'
                      }` 
                    : `cursor-not-allowed ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                </svg>
              </button>
            </Tooltip>
          </div>

          <div className={`w-px h-8 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'}`} />

          {/* 主要功能 */}
          <Tooltip content="範本庫">
            <button
              onClick={onTemplate}
              className={`p-2.5 rounded-lg transition-all hover:shadow-sm ${
                isDarkMode 
                  ? 'hover:bg-purple-900/30 hover:text-purple-400 text-gray-300' 
                  : 'hover:bg-purple-50 hover:text-purple-600 text-gray-700'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
            </button>
          </Tooltip>

          <Tooltip content="筆記本">
            <button
              onClick={onNotes}
              className={`p-2.5 rounded-lg transition-all hover:shadow-sm ${
                isDarkMode 
                  ? 'hover:bg-yellow-900/30 hover:text-yellow-400 text-gray-300' 
                  : 'hover:bg-yellow-50 hover:text-yellow-600 text-gray-700'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          </Tooltip>

          <Tooltip content="搜尋 (Ctrl+F)">
            <button
              onClick={onSearch}
              className={`p-2.5 rounded-lg transition-all hover:shadow-sm ${
                isDarkMode 
                  ? 'hover:bg-dark-bg-tertiary text-gray-300' 
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </Tooltip>

          <div className={`w-px h-8 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'}`} />

          {/* AI 功能 */}
          {selectedCount > 0 ? (
            // 當有選取項目時，顯示 AI 選取功能選單
            <div className="relative">
              <Tooltip content="AI 選取功能">
                <button
                  onClick={() => setShowAISelectionMenu(!showAISelectionMenu)}
                  className={`p-2.5 rounded-lg transition-all hover:shadow-sm flex items-center gap-1 ${
                isDarkMode 
                  ? 'hover:bg-purple-900/30 hover:text-purple-400 text-gray-300' 
                  : 'hover:bg-purple-50 hover:text-purple-600 text-gray-700'
              }`}
                >
                  <span className="text-lg">🤖</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </Tooltip>

              {showAISelectionMenu && (
                <div className={`absolute bottom-full mb-2 left-0 rounded-lg shadow-xl border py-2 min-w-48 ${
                  isDarkMode 
                    ? 'bg-dark-bg-secondary border-gray-600' 
                    : 'bg-white border-gray-200'
                }`}>
                  <button
                    onClick={() => {
                      onAIAnalyzeSelection?.();
                      setShowAISelectionMenu(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 font-medium ${
                      isDarkMode 
                        ? 'hover:bg-blue-900/30 hover:text-blue-400 text-gray-300' 
                        : 'hover:bg-blue-50 hover:text-blue-700 text-gray-700'
                    }`}
                  >
                    <span>🔍</span>
                    <span>分析選取區域</span>
                    <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${
                      isDarkMode ? 'bg-yellow-900/50 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                    } font-semibold`}>BETA</span>
                  </button>
                  <button
                    onClick={() => {
                      onAISuggestImprovements?.();
                      setShowAISelectionMenu(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 font-medium ${
                      isDarkMode 
                        ? 'hover:bg-green-900/30 hover:text-green-400 text-gray-300' 
                        : 'hover:bg-green-50 hover:text-green-700 text-gray-700'
                    }`}
                  >
                    <span>✨</span>
                    <span>改進建議</span>
                    <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${
                      isDarkMode ? 'bg-yellow-900/50 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                    } font-semibold`}>BETA</span>
                  </button>
                  <button
                    onClick={() => {
                      onAIRestructure?.();
                      setShowAISelectionMenu(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 font-medium ${
                      isDarkMode 
                        ? 'hover:bg-purple-900/30 hover:text-purple-400 text-gray-300' 
                        : 'hover:bg-purple-50 hover:text-purple-700 text-gray-700'
                    }`}
                  >
                    <span>🔄</span>
                    <span>內容重構</span>
                    <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${
                      isDarkMode ? 'bg-yellow-900/50 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                    } font-semibold`}>BETA</span>
                  </button>
                  <button
                    onClick={() => {
                      onAISWOT?.();
                      setShowAISelectionMenu(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 font-medium ${
                      isDarkMode 
                        ? 'hover:bg-orange-900/30 hover:text-orange-400 text-gray-300' 
                        : 'hover:bg-orange-50 hover:text-orange-700 text-gray-700'
                    }`}
                  >
                    <span>📊</span>
                    <span>SWOT 分析</span>
                    <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${
                      isDarkMode ? 'bg-yellow-900/50 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                    } font-semibold`}>BETA</span>
                  </button>
                  <button
                    onClick={() => {
                      onAIMindMap?.();
                      setShowAISelectionMenu(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 font-medium ${
                      isDarkMode 
                        ? 'hover:bg-indigo-900/30 hover:text-indigo-400 text-gray-300' 
                        : 'hover:bg-indigo-50 hover:text-indigo-700 text-gray-700'
                    }`}
                  >
                    <span>🧩</span>
                    <span>生成心智圖</span>
                    <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${
                      isDarkMode ? 'bg-yellow-900/50 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                    } font-semibold`}>BETA</span>
                  </button>
                  <button
                    onClick={() => {
                      onAICriticalPath?.();
                      setShowAISelectionMenu(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 font-medium ${
                      isDarkMode 
                        ? 'hover:bg-red-900/30 hover:text-red-400 text-gray-300' 
                        : 'hover:bg-red-50 hover:text-red-700 text-gray-700'
                    }`}
                  >
                    <span>🛤️</span>
                    <span>關鍵路徑分析</span>
                    <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${
                      isDarkMode ? 'bg-yellow-900/50 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                    } font-semibold`}>BETA</span>
                  </button>
                  <button
                    onClick={() => {
                      onAIConvergeNodes?.();
                      setShowAISelectionMenu(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 font-medium ${
                      isDarkMode 
                        ? 'hover:bg-red-900/30 hover:text-red-400 text-gray-300' 
                        : 'hover:bg-red-50 hover:text-red-700 text-gray-700'
                    }`}
                  >
                    <span>🎯</span>
                    <span>收斂節點</span>
                    <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${
                      isDarkMode ? 'bg-yellow-900/50 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                    } font-semibold`}>BETA</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            // 沒有選取項目時，顯示原本的全局 AI 功能
            <>
              <Tooltip content={aiLoadingStates?.analyze ? "AI 正在分析..." : "AI 分析畫布"}>
                <button
                  onClick={aiLoadingStates?.analyze ? undefined : onAnalyze}
                  disabled={aiLoadingStates?.analyze}
                  className={`p-2.5 rounded-lg transition-all hover:shadow-sm ${
                    aiLoadingStates?.analyze
                      ? isDarkMode 
                        ? 'bg-blue-900/30 text-blue-400 cursor-not-allowed' 
                        : 'bg-blue-50 text-blue-600 cursor-not-allowed'
                      : isDarkMode 
                        ? 'hover:bg-blue-900/30 hover:text-blue-400 text-gray-300' 
                        : 'hover:bg-blue-50 hover:text-blue-600 text-gray-700'
                  }`}
                >
                  {aiLoadingStates?.analyze ? (
                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  )}
                </button>
              </Tooltip>
              
              <Tooltip content={aiLoadingStates?.summarize ? "AI 正在總結..." : "AI 總結"}>
                <button
                  onClick={aiLoadingStates?.summarize ? undefined : onSummarize}
                  disabled={aiLoadingStates?.summarize}
                  className={`p-2.5 rounded-lg transition-all hover:shadow-sm ${
                    aiLoadingStates?.summarize
                      ? isDarkMode 
                        ? 'bg-green-900/30 text-green-400 cursor-not-allowed' 
                        : 'bg-green-50 text-green-600 cursor-not-allowed'
                      : isDarkMode 
                        ? 'hover:bg-green-900/30 hover:text-green-400 text-gray-300' 
                        : 'hover:bg-green-50 hover:text-green-600 text-gray-700'
                  }`}
                >
                  {aiLoadingStates?.summarize ? (
                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                </button>
              </Tooltip>

              {/* AI 自動化功能 */}
              <div className="relative">
                <Tooltip content="AI 自動化功能">
                  <button
                    onClick={() => setShowAIAutoMenu(!showAIAutoMenu)}
                    className={`p-2.5 rounded-lg transition-all hover:shadow-sm flex items-center gap-1 ${
                      isDarkMode 
                        ? 'hover:bg-purple-900/30 hover:text-purple-400 text-gray-300' 
                        : 'hover:bg-purple-50 hover:text-purple-600 text-gray-700'
                    }`}
                  >
                    <span className="text-lg">🚀</span>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </Tooltip>

                {showAIAutoMenu && (
                  <div className={`absolute bottom-full mb-2 left-0 rounded-lg shadow-xl border py-2 min-w-48 ${
                    isDarkMode 
                      ? 'bg-dark-bg-secondary border-gray-600' 
                      : 'bg-white border-gray-200'
                  }`}>
                    <button
                      onClick={() => {
                        onAIAutoGroup?.();
                        setShowAIAutoMenu(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 font-medium ${
                        isDarkMode 
                          ? 'hover:bg-blue-900/30 hover:text-blue-400 text-gray-300' 
                          : 'hover:bg-blue-50 hover:text-blue-700 text-gray-700'
                      }`}
                    >
                      <span>📁</span>
                      <span>AI 自動分組</span>
                      <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${
                        isDarkMode ? 'bg-yellow-900/50 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                      } font-semibold`}>BETA</span>
                    </button>
                    <button
                      onClick={() => {
                        onAIAutoGenerate?.();
                        setShowAIAutoMenu(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 font-medium ${
                        isDarkMode 
                          ? 'hover:bg-green-900/30 hover:text-green-400 text-gray-300' 
                          : 'hover:bg-green-50 hover:text-green-700 text-gray-700'
                      }`}
                    >
                      <span>✨</span>
                      <span>AI 生成便利貼</span>
                      <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${
                        isDarkMode ? 'bg-yellow-900/50 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                      } font-semibold`}>BETA</span>
                    </button>
                    <button
                      onClick={() => {
                        onAIAutoConnect?.();
                        setShowAIAutoMenu(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 font-medium ${
                        isDarkMode 
                          ? 'hover:bg-purple-900/30 hover:text-purple-400 text-gray-300' 
                          : 'hover:bg-purple-50 hover:text-purple-700 text-gray-700'
                      }`}
                    >
                      <span>🔗</span>
                      <span>AI 自動連線</span>
                      <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${
                        isDarkMode ? 'bg-yellow-900/50 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                      } font-semibold`}>BETA</span>
                    </button>
                    <button
                      onClick={() => {
                        onAISmartOrganize?.();
                        setShowAIAutoMenu(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 font-medium ${
                        isDarkMode 
                          ? 'hover:bg-orange-900/30 hover:text-orange-400 text-gray-300' 
                          : 'hover:bg-orange-50 hover:text-orange-700 text-gray-700'
                      }`}
                    >
                      <span>🎯</span>
                      <span>AI 智能整理</span>
                      <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${
                        isDarkMode ? 'bg-yellow-900/50 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                      } font-semibold`}>BETA</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          <div className={`w-px h-8 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'}`} />

          {/* 匯出功能 */}
          <div className="relative">
            <Tooltip content="匯出">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className={`p-2.5 rounded-lg transition-all hover:shadow-sm ${
                isDarkMode 
                  ? 'hover:bg-dark-bg-tertiary text-gray-300' 
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>
            </Tooltip>

            {showExportMenu && (
              <div className={`absolute bottom-full mb-2 right-0 rounded-lg shadow-xl border py-2 min-w-32 ${
                isDarkMode 
                  ? 'bg-dark-bg-secondary border-gray-600' 
                  : 'bg-white border-gray-200'
              }`}>
                <button
                  onClick={() => {
                    onExport?.('png');
                    setShowExportMenu(false);
                  }}
                  className={`w-full px-4 py-2 text-left text-sm ${
                    isDarkMode 
                      ? 'hover:bg-dark-bg-tertiary text-gray-300' 
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  匯出為 PNG
                </button>
                <button
                  onClick={() => {
                    onExport?.('pdf');
                    setShowExportMenu(false);
                  }}
                  className={`w-full px-4 py-2 text-left text-sm ${
                    isDarkMode 
                      ? 'hover:bg-dark-bg-tertiary text-gray-300' 
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  匯出為 PDF
                </button>
                <button
                  onClick={() => {
                    onExport?.('json');
                    setShowExportMenu(false);
                  }}
                  className={`w-full px-4 py-2 text-left text-sm ${
                    isDarkMode 
                      ? 'hover:bg-dark-bg-tertiary text-gray-300' 
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  匯出為 JSON
                </button>
              </div>
            )}
          </div>

          <div className={`w-px h-8 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'}`} />
          
          {/* 清除畫布 */}
          {onClear && (
            <Tooltip content="清除畫布">
              <button
                onClick={onClear}
                className={`p-2.5 rounded-lg transition-all hover:shadow-sm ${
                  isDarkMode 
                    ? 'hover:bg-red-900/30 hover:text-red-400 text-gray-300' 
                    : 'hover:bg-red-50 hover:text-red-600 text-gray-700'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </Tooltip>
          )}

          <div className={`w-px h-8 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'}`} />

          {/* Dark Mode 切換 */}
          <Tooltip content={isDarkMode ? "切換至淺色模式" : "切換至深色模式"}>
            <button
              onClick={toggleDarkMode}
              className={`p-2.5 rounded-lg transition-all hover:shadow-sm ${
                isDarkMode 
                  ? 'hover:bg-dark-bg-tertiary text-gray-300' 
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              {isDarkMode ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </Tooltip>
        </div>
      </div>

    </div>
  );
};

export default FloatingToolbar;