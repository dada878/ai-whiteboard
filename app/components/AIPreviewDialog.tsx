'use client';

import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

export interface AIPreviewData {
  type: 'group' | 'generate' | 'connect' | 'organize' | 'converge';
  title: string;
  description: string;
  preview: {
    groups?: Array<{
      name: string;
      color: string;
      noteIds: string[];
    }>;
    notes?: Array<{
      id: string;
      content: string;
      x: number;
      y: number;
      width: number;
      height: number;
      shape: string;
      color?: string;
    }>;
    connections?: Array<{
      from: string;
      to: string;
      label?: string;
      type?: string;
    }>;
    patterns?: Array<{
      name: string;
      description: string;
      noteIds: string[];
    }>;
    themes?: Array<{
      theme: string;
      points: string[];
      noteIds: string[];
    }>;
    ungrouped?: string[];
    reason?: string;
    edges?: Array<{
      from: string;
      to: string;
      label?: string;
      type?: string;
      weight?: number;
      fromNote?: { content: string };
      toNote?: { content: string };
    }>;
    layout?: Array<{ id: string; x: number; y: number }>;
    newGroups?: Array<{
      name: string;
      description: string;
      noteIds: string[];
      reason: string;
    }>;
    removeSuggestions?: Array<{ id: string; content: string; reason: string }>;
    analysis?: string;
    originalCount?: number;
    keepCount?: number;
    mergeCount?: number;
    removeCount?: number;
    keepNodes?: Array<{
      content: string;
      importance: number;
      reason: string;
    }>;
    removeNodes?: Array<{
      content: string;
      reason: string;
    }>;
    mergeNodes?: Array<{
      from: string[];
      to: string;
      reason: string;
    }>;
    targetNote?: string;
  };
  onApply: () => void;
  onReject: () => void;
  onRegenerate: () => void;
}

interface AIPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  previewData: AIPreviewData | null;
}

const AIPreviewDialog: React.FC<AIPreviewDialogProps> = ({
  isOpen,
  onClose,
  previewData
}) => {
  const { isDarkMode } = useTheme();

  if (!isOpen || !previewData) return null;

  const renderPreview = () => {
    switch (previewData.type) {
      case 'group':
        return (
          <div className="space-y-3">
            {previewData.preview.groups?.map((group, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${
                  isDarkMode ? 'bg-dark-bg-tertiary border-gray-700' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className={`font-medium flex items-center gap-2 ${
                    isDarkMode ? 'text-dark-text' : 'text-gray-800'
                  }`}>
                    <span
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: group.color }}
                    />
                    {group.name}
                  </h4>
                  <span className={`text-sm ${
                    isDarkMode ? 'text-dark-text-secondary' : 'text-gray-600'
                  }`}>
                    {group.noteIds.length} 個項目
                  </span>
                </div>
                <p className={`text-sm ${
                  isDarkMode ? 'text-dark-text-secondary' : 'text-gray-600'
                }`}>
                  {(group as { reason?: string }).reason}
                </p>
              </div>
            ))}
            {previewData.preview.ungrouped && previewData.preview.ungrouped.length > 0 && (
              <div className={`text-sm ${
                isDarkMode ? 'text-dark-text-secondary' : 'text-gray-600'
              }`}>
                未分組項目: {previewData.preview.ungrouped.length} 個
              </div>
            )}
          </div>
        );

      case 'generate':
        return (
          <div className="space-y-4">
            {/* 便利貼預覽區域 */}
            <div className={`p-6 rounded-lg ${
              isDarkMode ? 'bg-dark-bg-tertiary' : 'bg-gray-100'
            }`}>
              <h4 className={`text-sm font-medium mb-4 ${
                isDarkMode ? 'text-dark-text-secondary' : 'text-gray-600'
              }`}>
                便利貼預覽
              </h4>
              <div className="flex flex-wrap gap-4">
                {previewData.preview.notes?.map((note, index) => (
                  <div
                    key={index}
                    className="relative"
                    style={{
                      width: '200px',
                      height: '150px',
                      backgroundColor: note.color,
                      borderRadius: '12px',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                      padding: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <div className="text-center">
                      <p className="text-gray-800 font-medium text-sm" style={{
                        maxHeight: '100px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 4,
                        WebkitBoxOrient: 'vertical'
                      }}>
                        {note.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* 生成理由說明 */}
            <div className="space-y-2">
              <h4 className={`text-sm font-medium ${
                isDarkMode ? 'text-dark-text' : 'text-gray-700'
              }`}>
                生成理由
              </h4>
              {previewData.preview.notes?.map((note, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg text-sm ${
                    isDarkMode ? 'bg-dark-bg-tertiary text-dark-text-secondary' : 'bg-gray-50 text-gray-600'
                  }`}
                >
                  <span className="font-medium">{note.content}：</span>
                  <span className="ml-2">{(note as { reason?: string }).reason}</span>
                </div>
              ))}
            </div>
          </div>
        );

      case 'connect':
        return (
          <div className="space-y-4">
            {/* 視覺化預覽 */}
            <div className={`p-6 rounded-lg ${
              isDarkMode ? 'bg-dark-bg-tertiary' : 'bg-gray-100'
            }`}>
              <h4 className={`text-sm font-medium mb-4 ${
                isDarkMode ? 'text-dark-text-secondary' : 'text-gray-600'
              }`}>
                連線預覽
              </h4>
              <div className="relative" style={{ minHeight: '200px' }}>
                {/* 簡化的視覺化表示 */}
                <div className="flex flex-wrap gap-8 justify-center items-center">
                  {previewData.preview.edges?.slice(0, 3).map((edge, index) => (
                    <div key={index} className="flex items-center gap-4">
                      <div
                        className="px-4 py-2 rounded-lg text-sm font-medium shadow-sm"
                        style={{
                          backgroundColor: '#FFF9C4',
                          color: '#333'
                        }}
                      >
                        {(edge as { fromContent?: string }).fromContent}
                      </div>
                      <svg width="40" height="20" className="flex-shrink-0">
                        <defs>
                          <marker
                            id={`arrowhead-${index}`}
                            markerWidth="10"
                            markerHeight="10"
                            refX="9"
                            refY="3"
                            orient="auto"
                          >
                            <polygon
                              points="0 0, 10 3, 0 6"
                              fill={isDarkMode ? '#9CA3AF' : '#6B7280'}
                            />
                          </marker>
                        </defs>
                        <line
                          x1="0"
                          y1="10"
                          x2="40"
                          y2="10"
                          stroke={isDarkMode ? '#9CA3AF' : '#6B7280'}
                          strokeWidth="2"
                          markerEnd={`url(#arrowhead-${index})`}
                        />
                      </svg>
                      <div
                        className="px-4 py-2 rounded-lg text-sm font-medium shadow-sm"
                        style={{
                          backgroundColor: '#E8F5E9',
                          color: '#333'
                        }}
                      >
                        {(edge as { toContent?: string }).toContent}
                      </div>
                    </div>
                  ))}
                </div>
                {previewData.preview.edges && previewData.preview.edges.length > 3 && (
                  <p className={`text-center mt-4 text-sm ${
                    isDarkMode ? 'text-dark-text-secondary' : 'text-gray-600'
                  }`}>
                    ...還有 {previewData.preview.edges.length - 3} 條連線
                  </p>
                )}
              </div>
            </div>
            
            {/* 連線詳情列表 */}
            <div className="space-y-3">
              <h4 className={`text-sm font-medium ${
                isDarkMode ? 'text-dark-text' : 'text-gray-700'
              }`}>
                連線詳情
              </h4>
              {previewData.preview.edges?.map((edge, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${
                    isDarkMode ? 'bg-dark-bg-tertiary border-gray-700' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className={`flex items-center gap-2 mb-1 text-sm ${
                    isDarkMode ? 'text-dark-text' : 'text-gray-800'
                  }`}>
                    <span className="font-medium">{(edge as { fromContent?: string }).fromContent || edge.fromNote?.content || edge.from}</span>
                    <span>→</span>
                    <span className="font-medium">{(edge as { toContent?: string }).toContent || edge.toNote?.content || edge.to}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className={`text-xs ${
                      isDarkMode ? 'text-dark-text-secondary' : 'text-gray-600'
                    }`}>
                      {(edge as { reason?: string }).reason || edge.label || 'Connection'}
                    </p>
                    {(edge as { confidence?: number }).confidence && (
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        (edge as { confidence?: number }).confidence! > 0.8
                          ? isDarkMode
                            ? 'bg-green-900/30 text-green-400'
                            : 'bg-green-100 text-green-700'
                          : (edge as { confidence?: number }).confidence! > 0.6
                          ? isDarkMode
                            ? 'bg-yellow-900/30 text-yellow-400'
                            : 'bg-yellow-100 text-yellow-700'
                          : isDarkMode
                          ? 'bg-red-900/30 text-red-400'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {Math.round((edge as { confidence?: number }).confidence! * 100)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'organize':
        return (
          <div className="space-y-4">
            {/* 整理方案說明 */}
            <div className={`p-4 rounded-lg ${
              isDarkMode ? 'bg-dark-bg-tertiary' : 'bg-gray-50'
            }`}>
              <h4 className={`font-medium mb-2 ${
                isDarkMode ? 'text-dark-text' : 'text-gray-800'
              }`}>
                整理方案
              </h4>
              <p className={`text-sm ${
                isDarkMode ? 'text-dark-text-secondary' : 'text-gray-600'
              }`}>
                {previewData.preview.reason}
              </p>
            </div>

            {/* 統計概覽 */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className={`p-3 rounded-lg ${
                isDarkMode ? 'bg-dark-bg-tertiary' : 'bg-gray-50'
              }`}>
                <div className={`text-2xl font-bold ${
                  isDarkMode ? 'text-blue-400' : 'text-blue-600'
                }`}>
                  {previewData.preview.layout?.length || 0}
                </div>
                <div className={`text-sm ${
                  isDarkMode ? 'text-dark-text-secondary' : 'text-gray-600'
                }`}>
                  位置調整
                </div>
              </div>
              <div className={`p-3 rounded-lg ${
                isDarkMode ? 'bg-dark-bg-tertiary' : 'bg-gray-50'
              }`}>
                <div className={`text-2xl font-bold ${
                  isDarkMode ? 'text-green-400' : 'text-green-600'
                }`}>
                  {previewData.preview.newGroups?.length || 0}
                </div>
                <div className={`text-sm ${
                  isDarkMode ? 'text-dark-text-secondary' : 'text-gray-600'
                }`}>
                  新群組
                </div>
              </div>
              <div className={`p-3 rounded-lg ${
                isDarkMode ? 'bg-dark-bg-tertiary' : 'bg-gray-50'
              }`}>
                <div className={`text-2xl font-bold ${
                  isDarkMode ? 'text-red-400' : 'text-red-600'
                }`}>
                  {previewData.preview.removeSuggestions?.length || 0}
                </div>
                <div className={`text-sm ${
                  isDarkMode ? 'text-dark-text-secondary' : 'text-gray-600'
                }`}>
                  建議移除
                </div>
              </div>
            </div>

            {/* 新群組詳情 */}
            {previewData.preview.newGroups && previewData.preview.newGroups.length > 0 && (
              <div className="space-y-2">
                <h5 className={`text-sm font-medium ${
                  isDarkMode ? 'text-dark-text' : 'text-gray-700'
                }`}>
                  新群組建議
                </h5>
                {previewData.preview.newGroups.map((group, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border ${
                      isDarkMode ? 'bg-dark-bg-tertiary border-gray-700' : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: (group as { color?: string }).color }}
                      />
                      <span className={`font-medium text-sm ${
                        isDarkMode ? 'text-dark-text' : 'text-gray-800'
                      }`}>
                        {group.name}
                      </span>
                    </div>
                    <p className={`text-xs ${
                      isDarkMode ? 'text-dark-text-secondary' : 'text-gray-600'
                    }`}>
                      包含 {group.noteIds.length} 個項目
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* 移除建議 */}
            {previewData.preview.removeSuggestions && previewData.preview.removeSuggestions.length > 0 && (
              <div className={`p-3 rounded-lg border-2 border-red-200 ${
                isDarkMode ? 'bg-red-900/20' : 'bg-red-50'
              }`}>
                <p className={`text-sm font-medium mb-1 ${
                  isDarkMode ? 'text-red-400' : 'text-red-700'
                }`}>
                  ⚠️ 建議移除的冗餘項目
                </p>
                <p className={`text-xs ${
                  isDarkMode ? 'text-red-300' : 'text-red-600'
                }`}>
                  AI 偵測到 {previewData.preview.removeSuggestions.length} 個可能重複或冗餘的便利貼
                </p>
              </div>
            )}
          </div>
        );

      case 'converge':
        return (
          <div className="space-y-4">
            {/* 分析總結 */}
            <div className={`p-4 rounded-lg ${
              isDarkMode ? 'bg-dark-bg-tertiary' : 'bg-gray-50'
            }`}>
              <h4 className={`font-medium mb-2 ${
                isDarkMode ? 'text-dark-text' : 'text-gray-800'
              }`}>
                收斂分析
              </h4>
              <p className={`text-sm ${
                isDarkMode ? 'text-dark-text-secondary' : 'text-gray-600'
              }`}>
                {previewData.preview.analysis}
              </p>
            </div>

            {/* 統計概覽 */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className={`p-3 rounded-lg ${
                isDarkMode ? 'bg-dark-bg-tertiary' : 'bg-gray-50'
              }`}>
                <div className={`text-2xl font-bold ${
                  isDarkMode ? 'text-blue-400' : 'text-blue-600'
                }`}>
                  {previewData.preview.originalCount}
                </div>
                <div className={`text-sm ${
                  isDarkMode ? 'text-dark-text-secondary' : 'text-gray-600'
                }`}>
                  原始項目
                </div>
              </div>
              <div className={`p-3 rounded-lg ${
                isDarkMode ? 'bg-dark-bg-tertiary' : 'bg-gray-50'
              }`}>
                <div className={`text-2xl font-bold ${
                  isDarkMode ? 'text-green-400' : 'text-green-600'
                }`}>
                  {previewData.preview.keepCount}
                </div>
                <div className={`text-sm ${
                  isDarkMode ? 'text-dark-text-secondary' : 'text-gray-600'
                }`}>
                  保留核心
                </div>
              </div>
              <div className={`p-3 rounded-lg ${
                isDarkMode ? 'bg-dark-bg-tertiary' : 'bg-gray-50'
              }`}>
                <div className={`text-2xl font-bold ${
                  isDarkMode ? 'text-red-400' : 'text-red-600'
                }`}>
                  {previewData.preview.removeCount}
                </div>
                <div className={`text-sm ${
                  isDarkMode ? 'text-dark-text-secondary' : 'text-gray-600'
                }`}>
                  建議移除
                </div>
              </div>
            </div>

            {/* 保留的核心項目 */}
            <div className="space-y-3">
              <h5 className={`text-sm font-medium ${
                isDarkMode ? 'text-dark-text' : 'text-gray-700'
              }`}>
                ✅ 保留的核心項目
              </h5>
              {previewData.preview.keepNodes?.map((node, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border-2 ${
                    isDarkMode 
                      ? 'bg-green-900/20 border-green-700 text-green-300' 
                      : 'bg-green-50 border-green-200 text-green-800'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h6 className="font-medium">{node.content}</h6>
                    <span className={`text-xs px-2 py-1 rounded ${
                      isDarkMode
                        ? 'bg-green-800 text-green-200'
                        : 'bg-green-200 text-green-800'
                    }`}>
                      重要性: {Math.round(node.importance * 100)}%
                    </span>
                  </div>
                  <p className={`text-xs ${
                    isDarkMode ? 'text-green-200' : 'text-green-700'
                  }`}>
                    {node.reason}
                  </p>
                </div>
              ))}
            </div>

            {/* 建議移除的項目 */}
            {previewData.preview.removeNodes && previewData.preview.removeNodes.length > 0 && (
              <div className="space-y-3">
                <h5 className={`text-sm font-medium ${
                  isDarkMode ? 'text-dark-text' : 'text-gray-700'
                }`}>
                  ❌ 建議移除的項目
                </h5>
                {previewData.preview.removeNodes.map((node, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border ${
                      isDarkMode 
                        ? 'bg-red-900/20 border-red-700 text-red-300' 
                        : 'bg-red-50 border-red-200 text-red-800'
                    }`}
                  >
                    <h6 className="font-medium mb-1">{node.content}</h6>
                    <p className={`text-xs ${
                      isDarkMode ? 'text-red-200' : 'text-red-700'
                    }`}>
                      {node.reason}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* 警告提示 */}
            <div className={`p-3 rounded-lg border-2 border-orange-300 ${
              isDarkMode ? 'bg-orange-900/20' : 'bg-orange-50'
            }`}>
              <p className={`text-sm font-medium ${
                isDarkMode ? 'text-orange-400' : 'text-orange-700'
              }`}>
                ⚠️ 注意：套用收斂將永久刪除選中的項目及其相關連線
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div className={`rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col ${
        isDarkMode ? 'bg-dark-bg-secondary' : 'bg-white'
      }`}>
        {/* Header */}
        <div className={`px-6 py-4 border-b ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <h3 className={`text-lg font-semibold ${
            isDarkMode ? 'text-dark-text' : 'text-gray-800'
          }`}>
            {previewData.title}
          </h3>
          <p className={`text-sm mt-1 ${
            isDarkMode ? 'text-dark-text-secondary' : 'text-gray-600'
          }`}>
            {previewData.description}
          </p>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {renderPreview()}
        </div>

        {/* Actions */}
        <div className={`px-6 py-4 border-t flex gap-3 ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <button
            onClick={() => {
              previewData.onApply();
              onClose();
            }}
            className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-colors ${
              isDarkMode
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-green-500 text-white hover:bg-green-600'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              套用
            </span>
          </button>
          
          <button
            onClick={() => {
              previewData.onRegenerate();
            }}
            className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-colors ${
              isDarkMode
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              重新生成
            </span>
          </button>
          
          <button
            onClick={() => {
              previewData.onReject();
              onClose();
            }}
            className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-colors ${
              isDarkMode
                ? 'bg-dark-bg-tertiary text-dark-text hover:bg-dark-bg'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              拒絕
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIPreviewDialog;