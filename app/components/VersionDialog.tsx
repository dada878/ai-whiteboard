'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Clock, User, FileText, Trash2, RotateCcw, Save, ChevronDown } from 'lucide-react';
import { Version, VersionService, VersionData } from '../services/versionService';
import { WhiteboardData } from '../types';
import { format, formatDistanceToNow } from 'date-fns';
import { zhTW } from 'date-fns/locale';

interface VersionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string | null;
  currentData: WhiteboardData;
  onRestore: (data: WhiteboardData) => void;
}

const VersionDialog: React.FC<VersionDialogProps> = ({
  isOpen,
  onClose,
  projectId,
  currentData,
  onRestore
}) => {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<VersionData | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newVersionName, setNewVersionName] = useState('');
  const [newVersionDescription, setNewVersionDescription] = useState('');
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());

  // 載入版本列表
  const loadVersions = useCallback(async () => {
    if (!projectId) return;
    
    setLoading(true);
    try {
      const versionList = await VersionService.getVersions(projectId);
      setVersions(versionList);
    } catch (error) {
      console.error('Failed to load versions:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isOpen && projectId) {
      loadVersions();
    }
  }, [isOpen, projectId, loadVersions]);

  // 創建手動備份
  const handleCreateManualBackup = async () => {
    if (!projectId || !newVersionName.trim()) return;

    try {
      await VersionService.createManualBackup(
        projectId,
        currentData,
        newVersionName.trim(),
        newVersionDescription.trim()
      );
      
      // 重新載入版本列表
      await loadVersions();
      
      // 重置表單
      setNewVersionName('');
      setNewVersionDescription('');
      setShowCreateDialog(false);
    } catch (error) {
      console.error('Failed to create backup:', error);
    }
  };

  // 載入版本詳細資料
  const handlePreviewVersion = async (versionId: string) => {
    if (!projectId) return;
    
    try {
      const versionData = await VersionService.loadVersion(projectId, versionId);
      setPreviewData(versionData);
      setSelectedVersion(versionId);
    } catch (error) {
      console.error('Failed to load version data:', error);
    }
  };

  // 還原版本
  const handleRestoreVersion = async () => {
    if (!projectId || !selectedVersion || !previewData) return;
    
    try {
      const restoredData = await VersionService.restoreVersion(projectId, selectedVersion);
      onRestore(restoredData);
      onClose();
    } catch (error) {
      console.error('Failed to restore version:', error);
    }
  };

  // 刪除版本
  const handleDeleteVersion = async (versionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!projectId) return;
    
    if (!confirm('確定要刪除此版本嗎？此操作無法復原。')) return;
    
    try {
      await VersionService.deleteVersion(projectId, versionId);
      await loadVersions();
      
      if (selectedVersion === versionId) {
        setSelectedVersion(null);
        setPreviewData(null);
      }
    } catch (error) {
      console.error('Failed to delete version:', error);
    }
  };

  // 切換版本詳情展開
  const toggleVersionExpansion = (versionId: string) => {
    const newExpanded = new Set(expandedVersions);
    if (newExpanded.has(versionId)) {
      newExpanded.delete(versionId);
    } else {
      newExpanded.add(versionId);
    }
    setExpandedVersions(newExpanded);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center" 
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            版本記錄
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* 左側：版本列表 */}
          <div className="w-1/2 border-r border-gray-200 overflow-y-auto">
            <div className="p-4">
              <button
                onClick={() => setShowCreateDialog(!showCreateDialog)}
                className="w-full mb-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                建立手動備份
              </button>

              {showCreateDialog && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <input
                    type="text"
                    placeholder="版本名稱"
                    value={newVersionName}
                    onChange={(e) => setNewVersionName(e.target.value)}
                    className="w-full mb-2 px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900"
                  />
                  <textarea
                    placeholder="版本說明（選填）"
                    value={newVersionDescription}
                    onChange={(e) => setNewVersionDescription(e.target.value)}
                    className="w-full mb-2 px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 h-20 resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateManualBackup}
                      disabled={!newVersionName.trim()}
                      className="flex-1 px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      儲存
                    </button>
                    <button
                      onClick={() => {
                        setShowCreateDialog(false);
                        setNewVersionName('');
                        setNewVersionDescription('');
                      }}
                      className="flex-1 px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="text-center py-8 text-gray-500">
                  載入中...
                </div>
              ) : versions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  尚無版本記錄
                </div>
              ) : (
                <div className="space-y-2">
                  {versions.map((version) => {
                    const isExpanded = expandedVersions.has(version.id);
                    const isSelected = selectedVersion === version.id;
                    
                    return (
                      <div
                        key={version.id}
                        className={`border rounded-lg cursor-pointer transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div
                          onClick={() => handlePreviewVersion(version.id)}
                          className="p-3"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                {version.type === 'auto' ? (
                                  <Clock className="w-4 h-4 text-gray-400" />
                                ) : (
                                  <User className="w-4 h-4 text-blue-500" />
                                )}
                                <span className="font-medium text-gray-900">
                                  {version.name}
                                </span>
                                {version.type === 'auto' && (
                                  <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded">
                                    自動
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-500">
                                {formatDistanceToNow(new Date(version.createdAt), {
                                  addSuffix: true,
                                  locale: zhTW
                                })}
                              </div>
                              <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                                <span>{version.stats.notes} 便利貼</span>
                                <span>{version.stats.edges} 連線</span>
                                <span>{version.stats.groups} 群組</span>
                                {version.stats.images > 0 && (
                                  <span>{version.stats.images} 圖片</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleVersionExpansion(version.id);
                                }}
                                className="p-1 hover:bg-gray-100 rounded transition-colors"
                              >
                                <ChevronDown
                                  className={`w-4 h-4 text-gray-400 transition-transform ${
                                    isExpanded ? 'rotate-180' : ''
                                  }`}
                                />
                              </button>
                              {version.type === 'manual' && (
                                <button
                                  onClick={(e) => handleDeleteVersion(version.id, e)}
                                  className="p-1 hover:bg-red-100 rounded transition-colors"
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </button>
                              )}
                            </div>
                          </div>
                          {isExpanded && version.description && (
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <p className="text-sm text-gray-600">
                                {version.description}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 右側：版本預覽 */}
          <div className="w-1/2 p-4 overflow-y-auto">
            {previewData ? (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  版本詳情
                </h3>
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        建立時間
                      </span>
                      <span className="text-sm text-gray-600">
                        {format(new Date(previewData.createdAt), 'yyyy/MM/dd HH:mm:ss', {
                          locale: zhTW
                        })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        版本類型
                      </span>
                      <span className="text-sm text-gray-600">
                        {previewData.type === 'auto' ? '自動備份' : '手動備份'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">
                      內容統計
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-500" />
                        <span className="text-sm text-gray-600">
                          {previewData.stats.notes} 個便利貼
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">
                          {previewData.stats.edges} 條連線
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">
                          {previewData.stats.groups} 個群組
                        </span>
                      </div>
                      {previewData.stats.images > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">
                            {previewData.stats.images} 張圖片
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {previewData.description && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        版本說明
                      </h4>
                      <p className="text-sm text-gray-600">
                        {previewData.description}
                      </p>
                    </div>
                  )}

                  <div className="pt-4 flex gap-2">
                    <button
                      onClick={handleRestoreVersion}
                      className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      還原此版本
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                選擇一個版本以查看詳情
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VersionDialog;