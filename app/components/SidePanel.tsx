'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Project } from '../types';
import { SyncStatus } from '../services/syncService';
import { ProjectService } from '../services/projectService';
import EditProjectDialog from './EditProjectDialog';

interface SidePanelProps {
  aiResult: string;
  currentProject?: Project | null;
  syncStatus?: SyncStatus;
  onProjectSelect?: (projectId: string) => void;
  onProjectCreate?: (name: string, description: string) => void;
  onProjectDelete?: (projectId: string) => void;
  cloudSyncEnabled?: boolean;
  onToggleCloudSync?: (enabled: boolean) => void;
  // AI loading 狀態
  aiLoadingStates?: {
    analyze: boolean;
    summarize: boolean;
    brainstorm: boolean;
    askAI: boolean;
    // Chain of thought 思考步驟
    thinkingSteps?: string[];
    currentStep?: number;
    // 每個步驟的詳細結果
    stepResults?: { [stepIndex: number]: string };
  };
}

const SidePanel: React.FC<SidePanelProps> = ({ 
  aiResult,
  currentProject,
  syncStatus,
  onProjectSelect,
  onProjectCreate,
  onProjectDelete,
  cloudSyncEnabled = false,
  onToggleCloudSync,
  aiLoadingStates
}) => {
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'ai' | 'project'>('ai');
  const [projects, setProjects] = useState<Project[]>([]);
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(aiResult);
  };

  // 當 AI loading 狀態變化時重置展開狀態
  useEffect(() => {
    if (aiLoadingStates?.brainstorm && aiLoadingStates?.thinkingSteps) {
      setExpandedSteps(new Set());
    }
  }, [aiLoadingStates?.brainstorm, aiLoadingStates?.thinkingSteps]);

  // 載入專案列表
  useEffect(() => {
    if (activeTab === 'project') {
      loadProjects();
    }
  }, [activeTab]);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const localProjects = ProjectService.getAllProjects();
      setProjects(localProjects);
    } catch (error) {
      console.error('載入專案失敗:', error);
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
    <div className={`hidden md:block border-l transition-all duration-300 ${
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
        <div className="h-full flex flex-col">
          {/* 頂部標題 + 分頁 + 收合，合併為單一列 */}
          <div className={`border-b ${
            isDarkMode ? 'border-gray-600' : 'border-gray-200'
          }`}>
            <div className="flex items-center justify-between px-3">
              {/* 分頁標籤 */}
              <div className="flex flex-1">
                <button
                  onClick={() => setActiveTab('project')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === 'project'
                      ? isDarkMode
                        ? 'text-blue-500 border-blue-900'
                        : 'text-blue-600 border-blue-600'
                      : isDarkMode
                        ? 'text-dark-text-secondary border-transparent hover:text-dark-text'
                        : 'text-gray-500 border-transparent hover:text-gray-700'
                  }`}
                >
                  專案
                </button>
                <button
                  onClick={() => setActiveTab('ai')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === 'ai'
                      ? isDarkMode
                        ? 'text-blue-500 border-blue-900'
                        : 'text-blue-600 border-blue-600'
                      : isDarkMode
                        ? 'text-dark-text-secondary border-transparent hover:text-dark-text'
                        : 'text-gray-500 border-transparent hover:text-gray-700'
                  }`}
                >
                  AI 結果
                </button>
              </div>
              <button
                onClick={() => setIsCollapsed(true)}
                className={`ml-2 px-2 py-2 rounded transition-colors ${
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
          <div className="flex-1 p-4 overflow-y-auto">
            {activeTab === 'project' ? (
              // 專案列表視圖
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
            ) : (aiLoadingStates?.analyze || aiLoadingStates?.summarize || aiLoadingStates?.brainstorm || aiLoadingStates?.askAI || aiLoadingStates?.stepResults) ? (
              // AI Loading 狀態
              <div className="space-y-4">
                <div className={`p-6 rounded-lg ${
                  isDarkMode ? 'bg-dark-bg-tertiary' : 'bg-gray-50'
                }`}>
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <div className={`relative w-12 h-12 ${
                      isDarkMode ? 'text-blue-400' : 'text-blue-600'
                    }`}>
                      <div className="absolute inset-0 border-4 border-current border-t-transparent rounded-full animate-spin"></div>
                      <div className="absolute inset-2 border-2 border-current border-b-transparent rounded-full animate-spin-reverse"></div>
                    </div>
                    <div className="text-center w-full">
                      <p className={`text-sm font-medium ${
                        isDarkMode ? 'text-gray-200' : 'text-gray-800'
                      }`}>
                        {aiLoadingStates?.brainstorm ? '🧠 AI 正在發想創意...' :
                         aiLoadingStates?.analyze ? '📊 AI 正在分析結構...' :
                         aiLoadingStates?.summarize ? '📝 AI 正在生成摘要...' :
                         aiLoadingStates?.askAI ? '💬 AI 正在思考回答...' : 
                         'AI 正在處理中...'}
                      </p>
                      
                      {/* Chain of thought 思考步驟顯示 */}
                      {aiLoadingStates?.brainstorm && aiLoadingStates?.thinkingSteps && (
                        <div className="mt-4 w-full">
                          <div className={`text-xs mb-3 ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-600'
                          }`}>
                            思考過程：
                          </div>
                          <div className="space-y-2">
                            {aiLoadingStates.thinkingSteps.map((step, index) => {
                              const isCurrent = aiLoadingStates.currentStep === index;
                              const isCompleted = (aiLoadingStates.currentStep ?? -1) > index;
                              const hasResult = aiLoadingStates.stepResults?.[index];
                              
                              return (
                                <div
                                  key={index}
                                  className={`rounded-lg transition-all duration-500 ${
                                    isCurrent
                                      ? isDarkMode
                                        ? 'bg-blue-900/30 border border-blue-900'
                                        : 'bg-blue-50 border border-blue-500'
                                      : isCompleted
                                        ? isDarkMode
                                          ? 'bg-green-900/20 border border-green-900/50'
                                          : 'bg-green-50 border border-green-500/50'
                                        : isDarkMode
                                          ? 'bg-gray-700/30 border border-gray-600/50'
                                          : 'bg-gray-100 border border-gray-300/50'
                                  }`}
                                >
                                  <div className="flex items-center gap-3 p-2">
                                    <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                                      isCurrent
                                        ? 'animate-pulse'
                                        : ''
                                    }`}>
                                      {isCompleted ? (
                                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                      ) : isCurrent ? (
                                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                      ) : (
                                        <div className={`w-2 h-2 rounded-full ${
                                          isDarkMode ? 'bg-gray-500' : 'bg-gray-400'
                                        }`}></div>
                                      )}
                                    </div>
                                    <span className={`text-xs flex-1 text-left ${
                                      isCurrent
                                        ? isDarkMode ? 'text-blue-300' : 'text-blue-700'
                                        : isCompleted
                                          ? isDarkMode ? 'text-green-300' : 'text-green-700'
                                          : isDarkMode ? 'text-gray-400' : 'text-gray-600'
                                    }`}>
                                      {step}
                                    </span>
                                  </div>
                                  
                                  {/* 顯示步驟的詳細結果 */}
                                  {hasResult && (
                                    <div className={`px-6 pb-3 text-xs ${
                                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                    }`}>
                                      <div className={`p-3 rounded-md ${
                                        isDarkMode ? 'bg-gray-800/50' : 'bg-white/80'
                                      } border ${
                                        isDarkMode ? 'border-gray-700' : 'border-gray-200'
                                      }`}>
                                        <div className="relative">
                                          <div 
                                            className={`overflow-hidden transition-all duration-300 ${
                                              expandedSteps.has(index) ? '' : 'max-h-24'
                                            }`}
                                          >
                                            <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed">
                                              {hasResult}
                                            </pre>
                                          </div>
                                          {/* 漸變遮罩效果（只在收合時顯示） */}
                                          {!expandedSteps.has(index) && (
                                            <div className={`absolute bottom-0 left-0 right-0 h-12 pointer-events-none ${
                                              isDarkMode 
                                                ? 'bg-gradient-to-t from-gray-800/50 to-transparent' 
                                                : 'bg-gradient-to-t from-white/80 to-transparent'
                                            }`} />
                                          )}
                                          <button
                                            onClick={() => {
                                              const newExpanded = new Set(expandedSteps);
                                              if (expandedSteps.has(index)) {
                                                newExpanded.delete(index);
                                              } else {
                                                newExpanded.add(index);
                                              }
                                              setExpandedSteps(newExpanded);
                                            }}
                                            className={`mt-2 text-xs px-2 py-1 rounded transition-colors ${
                                              isDarkMode
                                                ? 'bg-blue-900/30 text-blue-400 hover:bg-blue-900/50'
                                                : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                                            }`}
                                          >
                                            {expandedSteps.has(index) ? '收起 ▲' : '展開 ▼'}
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      
                      {!aiLoadingStates?.thinkingSteps && (
                        <p className={`text-xs mt-1 ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          請稍候片刻
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : aiResult ? (
              <div className="space-y-4">
                <div className={`p-4 rounded-lg ${
                  isDarkMode ? 'bg-dark-bg-tertiary' : 'bg-gray-50'
                }`}>
                  <pre className={`text-sm whitespace-pre-wrap font-sans ${
                    isDarkMode ? 'text-gray-200' : 'text-gray-800'
                  }`}>
                    {aiResult}
                  </pre>
                </div>
                
                <button
                  onClick={copyToClipboard}
                  className={`w-full py-2 px-4 text-white rounded-lg transition-colors flex items-center justify-center gap-2 ${
                    isDarkMode 
                      ? 'bg-blue-700 hover:bg-blue-800' 
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  <span>📋</span>
                  複製結果
                </button>
              </div>
            ) : (
              <div className={`text-center mt-8 ${
                isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                <div className="text-4xl mb-4">🤖</div>
                <p className="text-sm">
                  使用 AI 功能來分析你的白板內容
                </p>
                <div className={`mt-6 space-y-2 text-xs ${
                  isDarkMode ? 'text-gray-500' : 'text-gray-400'
                }`}>
                  <p>• 右鍵便利貼 → AI 發想</p>
                  <p>• 左側工具欄 → AI 分析</p>
                  <p>• 左側工具欄 → AI 總結</p>
                </div>
              </div>
            )}
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
              {activeTab === 'ai' ? 'AI 結果' : '專案管理'}
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
          <div className="flex-1 overflow-y-auto">
            {aiResult && (
              <div className="p-4">
                <div className={`rounded-lg p-4 ${
                  isDarkMode 
                    ? 'bg-dark-bg-tertiary text-gray-300' 
                    : 'bg-gray-50 text-gray-700'
                }`}>
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                    {aiResult}
                  </div>
                </div>
              </div>
            )}
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