'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Project } from '../types';
import { SyncStatus } from '../services/syncService';
import { ProjectService } from '../services/projectService';
import EditProjectDialog from './EditProjectDialog';

interface SidePanelProps {
  currentProject?: Project | null;
  syncStatus?: SyncStatus;
  onProjectSelect?: (projectId: string) => void;
  onProjectCreate?: (name: string, description: string) => void;
  onProjectDelete?: (projectId: string) => void;
  cloudSyncEnabled?: boolean;
  onToggleCloudSync?: (enabled: boolean) => void;
}

const SidePanel: React.FC<SidePanelProps> = ({ 
  currentProject,
  syncStatus,
  onProjectSelect,
  onProjectCreate,
  onProjectDelete,
  cloudSyncEnabled = false
}) => {
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // 載入專案列表
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      if (user?.id) {
        // 設定當前使用者 ID
        ProjectService.setUserId(user.id);
        // 從 Firebase 載入專案
        const firebaseProjects = await ProjectService.getAllProjects();
        setProjects(firebaseProjects);
      } else {
        // 未登入時清空專案列表
        setProjects([]);
      }
    } catch (error) {
      console.error('載入專案失敗:', error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;

    try {
      const newProject = await ProjectService.createProject(newProjectName, newProjectDescription);
      setProjects([...projects, newProject]);
      setShowNewProjectForm(false);
      setNewProjectName('');
      setNewProjectDescription('');
      
      // 如果有回調函數，呼叫它
      if (onProjectCreate) {
        onProjectCreate(newProject.name, newProject.description || '');
      }
      
      // 自動選擇新創建的專案
      if (onProjectSelect) {
        onProjectSelect(newProject.id);
      }
    } catch (error) {
      console.error('創建專案失敗:', error);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('確定要刪除這個專案嗎？此操作無法復原。')) return;

    try {
      ProjectService.deleteProject(projectId);
      setProjects(projects.filter(p => p.id !== projectId));
      
      if (onProjectDelete) {
        onProjectDelete(projectId);
      }
      
      // 如果刪除的是當前專案，切換到第一個專案
      if (projectId === currentProject?.id && projects.length > 1) {
        const remainingProjects = projects.filter(p => p.id !== projectId);
        if (remainingProjects.length > 0 && onProjectSelect) {
          onProjectSelect(remainingProjects[0].id);
        }
      }
    } catch (error) {
      console.error('刪除專案失敗:', error);
    }
  };

  const handleEditProject = (name: string, description: string) => {
    if (!editingProject) return;

    try {
      ProjectService.updateProject(editingProject.id, {
        name,
        description
      });

      // 更新本地狀態
      setProjects(projects.map(p => 
        p.id === editingProject.id 
          ? { ...p, name, description, updatedAt: new Date() }
          : p
      ));

      // 如果是當前專案，更新父組件
      if (editingProject.id === currentProject?.id && onProjectCreate) {
        onProjectCreate(name, description);
      }

      setEditingProject(null);
    } catch (error) {
      console.error('更新專案失敗:', error);
    }
  };

  return (
    <>
    {/* 桌面版側邊欄 */}
    <div className={`hidden md:flex flex-col border-l transition-all duration-300 h-full overflow-hidden ${
      isCollapsed ? 'w-8' : 'w-80'
    } ${
      isDarkMode 
        ? 'bg-dark-bg-secondary border-gray-600' 
        : 'bg-white border-gray-300'
    }`}>
      {isCollapsed ? (
        <button
          onClick={() => setIsCollapsed(false)}
          className={`w-full h-full flex items-center justify-center transition-colors ${
            isDarkMode ? 'hover:bg-dark-bg-tertiary' : 'hover:bg-gray-100'
          }`}
        >
          <span className="transform rotate-180">◀</span>
        </button>
      ) : (
        <div className="h-full flex flex-col overflow-hidden">
          {/* 頂部標題 + 收合按鈕 */}
          <div className={`border-b flex-shrink-0 ${
            isDarkMode ? 'border-gray-600' : 'border-gray-200'
          }`}>
            <div className="flex items-center justify-between px-4 py-3">
              <h2 className={`text-lg font-semibold ${
                isDarkMode ? 'text-dark-text' : 'text-gray-900'
              }`}>
                專案管理
              </h2>
              <button
                onClick={() => setIsCollapsed(true)}
                className={`px-2 py-2 rounded transition-colors ${
                  isDarkMode 
                    ? 'text-gray-400 hover:text-gray-200 hover:bg-dark-bg-tertiary' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
                title="收合側欄"
              >
                ▶
              </button>
            </div>
          </div>
          
          {/* 內容區域 */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            <div className="p-4">
              {/* 專案列表視圖 */}
              <div className="space-y-4">
                {loading ? (
                  <div className="text-center py-8">
                    <div className={`animate-spin rounded-full h-8 w-8 border-b-2 mx-auto ${
                      isDarkMode ? 'border-blue-800' : 'border-blue-500'
                    }`}></div>
                    <p className={`mt-4 text-sm ${
                      isDarkMode ? 'text-dark-text-secondary' : 'text-gray-600'
                    }`}>載入中...</p>
                  </div>
                ) : (
                  <>
                    {/* 新增專案按鈕或表單 */}
                    {!showNewProjectForm ? (
                      <button
                        onClick={() => setShowNewProjectForm(true)}
                        className={`w-full p-4 rounded-lg border-2 border-dashed transition-colors ${
                          isDarkMode 
                            ? 'border-gray-500 hover:border-blue-900 hover:bg-dark-bg-tertiary' 
                            : 'border-gray-300 hover:border-blue-500 hover:bg-gray-50'
                        }`}
                      >
                        <span className="text-2xl">+</span>
                        <p className={`text-sm mt-1 ${
                          isDarkMode ? 'text-dark-text-secondary' : 'text-gray-600'
                        }`}>創建新專案</p>
                      </button>
                    ) : (
                      <div className={`p-4 rounded-lg ${
                        isDarkMode ? 'bg-dark-bg-tertiary' : 'bg-gray-50'
                      }`}>
                        <input
                          type="text"
                          placeholder="專案名稱"
                          value={newProjectName}
                          onChange={(e) => setNewProjectName(e.target.value)}
                          className={`w-full px-3 py-2 rounded border mb-3 ${
                            isDarkMode 
                              ? 'bg-dark-bg-primary border-gray-500 text-dark-text' 
                              : 'bg-white border-gray-300 text-gray-900'
                          } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                          autoFocus
                        />
                        <textarea
                          placeholder="專案描述（選填）"
                          value={newProjectDescription}
                          onChange={(e) => setNewProjectDescription(e.target.value)}
                          className={`w-full px-3 py-2 rounded border mb-3 h-20 ${
                            isDarkMode 
                              ? 'bg-dark-bg-primary border-gray-500 text-dark-text' 
                              : 'bg-white border-gray-300 text-gray-900'
                          } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleCreateProject}
                            className={`px-4 py-2 rounded font-medium transition-colors ${
                              isDarkMode 
                                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                                : 'bg-blue-500 hover:bg-blue-600 text-white'
                            }`}
                          >
                            創建
                          </button>
                          <button
                            onClick={() => {
                              setShowNewProjectForm(false);
                              setNewProjectName('');
                              setNewProjectDescription('');
                            }}
                            className={`px-4 py-2 rounded transition-colors ${
                              isDarkMode 
                                ? 'bg-dark-bg-secondary hover:bg-dark-bg-primary text-dark-text' 
                                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                            }`}
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 專案列表 */}
                    <div className="space-y-2">
                      {projects.map((project) => (
                        <div
                          key={project.id}
                          className={`p-3 rounded-lg transition-colors cursor-pointer ${
                            project.id === currentProject?.id
                              ? isDarkMode 
                                ? 'bg-blue-950/30 border border-blue-900' 
                                : 'bg-blue-50 border border-blue-500'
                              : isDarkMode 
                                ? 'bg-dark-bg-tertiary hover:bg-dark-bg-primary border border-transparent' 
                                : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                          }`}
                          onClick={() => onProjectSelect?.(project.id)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className={`font-medium ${
                                isDarkMode ? 'text-dark-text' : 'text-gray-900'
                              }`}>
                                {project.name}
                                {project.id === currentProject?.id && (
                                  <span className="ml-2 text-xs text-blue-500">（當前）</span>
                                )}
                              </h3>
                              {project.description && (
                                <p className={`text-xs mt-1 ${
                                  isDarkMode ? 'text-dark-text-secondary' : 'text-gray-600'
                                }`}>
                                  {project.description}
                                </p>
                              )}
                              <div className={`flex items-center gap-3 mt-1 text-xs ${
                                isDarkMode ? 'text-dark-text-secondary' : 'text-gray-500'
                              }`}>
                                <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
                                {project.thumbnail && (
                                  <span className="text-blue-500">
                                    {(() => {
                                      const thumb = JSON.parse(project.thumbnail);
                                      return `${thumb.noteCount} 便利貼`;
                                    })()}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingProject(project);
                                }}
                                className={`p-1.5 rounded transition-colors ${
                                  isDarkMode 
                                    ? 'hover:bg-blue-900/30 text-blue-400' 
                                    : 'hover:bg-blue-50 text-blue-600'
                                }`}
                                title="編輯專案"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              {projects.length > 1 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteProject(project.id);
                                  }}
                                  className={`p-1.5 rounded transition-colors ${
                                    isDarkMode 
                                      ? 'hover:bg-red-900/30 text-red-400' 
                                      : 'hover:bg-red-50 text-red-600'
                                  }`}
                                  title="刪除專案"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* 雲端同步狀態 */}
                    {user && (
                      <div className={`mt-6 p-3 rounded-lg ${
                        isDarkMode ? 'bg-dark-bg-tertiary' : 'bg-gray-50'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-medium ${
                            isDarkMode ? 'text-dark-text' : 'text-gray-700'
                          }`}>
                            <span className="mr-2">☁️</span>
                            雲端同步
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            isDarkMode 
                              ? 'bg-green-900/30 text-green-400' 
                              : 'bg-green-100 text-green-700'
                          }`}>
                            已啟用
                          </span>
                        </div>
                        
                        {syncStatus && (
                          <div className={`mt-2 text-xs ${
                            isDarkMode ? 'text-dark-text-secondary' : 'text-gray-600'
                          }`}>
                            {syncStatus.isSyncing ? (
                              <div className="flex items-center gap-2">
                                <div className={`animate-spin rounded-full h-3 w-3 border-b-2 ${
                                  isDarkMode ? 'border-blue-800' : 'border-blue-500'
                                }`}></div>
                                同步中...
                              </div>
                            ) : syncStatus.lastSyncTime ? (
                              <div>
                                上次同步: {new Date(syncStatus.lastSyncTime).toLocaleTimeString()}
                              </div>
                            ) : (
                              <div>尚未同步</div>
                            )}
                            {syncStatus.error && (
                              <div className="text-red-500 mt-1">{syncStatus.error}</div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 編輯專案對話框 */}
      {editingProject && (
        <EditProjectDialog
          isOpen={!!editingProject}
          projectName={editingProject.name}
          projectDescription={editingProject.description}
          onClose={() => setEditingProject(null)}
          onSave={handleEditProject}
        />
      )}
    </div>

    {/* 行動版模態框 */}
    <div className={`md:hidden fixed inset-0 z-50 transition-all duration-300 ${
      !isCollapsed ? 'pointer-events-auto' : 'pointer-events-none'
    }`}>
      {/* 背景遮罩 */}
      <div 
        className={`absolute inset-0 bg-black transition-opacity duration-300 ${
          !isCollapsed ? 'opacity-50' : 'opacity-0'
        }`}
        onClick={() => setIsCollapsed(true)}
      />
      
      {/* 內容面板 */}
      <div className={`absolute right-0 top-0 bottom-0 w-full max-w-sm transition-transform duration-300 ${
        !isCollapsed ? 'translate-x-0' : 'translate-x-full'
      } ${
        isDarkMode 
          ? 'bg-dark-bg-secondary' 
          : 'bg-white'
      }`}>
        <div className="flex flex-col h-full">
          {/* 標題欄 */}
          <div className={`flex items-center justify-between px-4 py-3 border-b ${
            isDarkMode ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <h2 className={`text-lg font-semibold ${
              isDarkMode ? 'text-gray-200' : 'text-gray-800'
            }`}>
              專案管理
            </h2>
            <button
              onClick={() => setIsCollapsed(true)}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode 
                  ? 'hover:bg-gray-700 text-gray-400' 
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* 內容區域 */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className={`text-center mt-8 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`}>
              <div className="text-4xl mb-4">📁</div>
              <p className="text-sm">
                專案管理功能僅在桌面版提供完整支援
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* 行動版浮動按鈕 - 用於打開側邊欄 */}
    <button
      onClick={() => setIsCollapsed(false)}
      className={`md:hidden fixed top-20 right-4 z-40 p-3 rounded-full shadow-lg transition-all ${
        isCollapsed ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full pointer-events-none'
      } ${
        isDarkMode 
          ? 'bg-purple-600 hover:bg-purple-700 text-white' 
          : 'bg-purple-500 hover:bg-purple-600 text-white'
      }`}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    </button>
    </>
  );
};

export default SidePanel;