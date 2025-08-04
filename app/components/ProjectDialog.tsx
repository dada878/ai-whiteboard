'use client';

import React, { useState, useEffect } from 'react';
import { Project } from '../types';
import { ProjectService } from '../services/projectService';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

interface ProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProject: (projectId: string) => void;
  currentProjectId: string | null;
}

export default function ProjectDialog({ 
  isOpen, 
  onClose, 
  onSelectProject, 
  currentProjectId 
}: ProjectDialogProps) {
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadProjects();
    }
  }, [isOpen]);

  const loadProjects = async () => {
    setLoading(true);
    try {
      // 從本地載入專案
      const localProjects = ProjectService.getAllProjects();
      setProjects(localProjects);
    } catch (error) {
      console.error('載入專案失敗:', error);
      // 如果雲端載入失敗，使用本地資料
      const localProjects = ProjectService.getAllProjects();
      setProjects(localProjects);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;

    try {
      // 在本地創建專案
      const newProject: Project = ProjectService.createProject(newProjectName, newProjectDescription);

      setProjects([...projects, newProject]);
      setShowNewProjectForm(false);
      setNewProjectName('');
      setNewProjectDescription('');
      onSelectProject(newProject.id);
    } catch (error) {
      console.error('創建專案失敗:', error);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('確定要刪除這個專案嗎？此操作無法復原。')) return;

    try {
      // 從本地刪除專案
      ProjectService.deleteProject(projectId);
      
      setProjects(projects.filter(p => p.id !== projectId));
      
      // 如果刪除的是當前專案，切換到第一個專案
      if (projectId === currentProjectId && projects.length > 1) {
        const remainingProjects = projects.filter(p => p.id !== projectId);
        if (remainingProjects.length > 0) {
          onSelectProject(remainingProjects[0].id);
        }
      }
    } catch (error) {
      console.error('刪除專案失敗:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center" 
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div 
        className={`w-full max-w-2xl max-h-[80vh] rounded-lg ${
          isDarkMode ? 'bg-dark-bg-secondary' : 'bg-white'
        } overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 標題欄 */}
        <div className={`flex items-center justify-between p-4 border-b ${
          isDarkMode ? 'border-gray-600' : 'border-gray-200'
        }`}>
          <h2 className={`text-xl font-bold ${
            isDarkMode ? 'text-dark-text' : 'text-gray-900'
          }`}>
            專案管理
          </h2>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode 
                ? 'hover:bg-dark-bg-tertiary text-dark-text-secondary' 
                : 'hover:bg-gray-100 text-gray-500'
            }`}
          >
            ✕
          </button>
        </div>

        {/* 內容區域 */}
        <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 120px)' }}>
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
                  className={`w-full p-4 rounded-lg border-2 border-dashed transition-colors mb-4 ${
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
                <div className={`p-4 rounded-lg mb-4 ${
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
                    className={`p-4 rounded-lg transition-colors cursor-pointer ${
                      project.id === currentProjectId
                        ? isDarkMode 
                          ? 'bg-blue-950/30 border-2 border-blue-900' 
                          : 'bg-blue-50 border-2 border-blue-500'
                        : isDarkMode 
                          ? 'bg-dark-bg-tertiary hover:bg-dark-bg-primary border-2 border-transparent' 
                          : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                    }`}
                    onClick={() => onSelectProject(project.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className={`font-medium ${
                          isDarkMode ? 'text-dark-text' : 'text-gray-900'
                        }`}>
                          {project.name}
                          {project.id === currentProjectId && (
                            <span className="ml-2 text-sm text-blue-500">（當前）</span>
                          )}
                        </h3>
                        {project.description && (
                          <p className={`text-sm mt-1 ${
                            isDarkMode ? 'text-dark-text-secondary' : 'text-gray-600'
                          }`}>
                            {project.description}
                          </p>
                        )}
                        <div className={`flex items-center gap-4 mt-2 text-xs ${
                          isDarkMode ? 'text-dark-text-secondary' : 'text-gray-500'
                        }`}>
                          <span>創建於 {new Date(project.createdAt).toLocaleDateString()}</span>
                          <span>更新於 {new Date(project.updatedAt).toLocaleDateString()}</span>
                          {project.thumbnail && (
                            <span className="text-blue-500">
                              {(() => {
                                const thumb = JSON.parse(project.thumbnail);
                                return `${thumb.noteCount} 便利貼, ${thumb.edgeCount} 連線`;
                              })()}
                            </span>
                          )}
                        </div>
                      </div>
                      {projects.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProject(project.id);
                          }}
                          className={`ml-4 p-2 rounded transition-colors ${
                            isDarkMode 
                              ? 'hover:bg-red-900/30 text-red-400' 
                              : 'hover:bg-red-50 text-red-600'
                          }`}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* 底部提示 */}
        {!user && (
          <div className={`p-4 border-t ${
            isDarkMode ? 'border-gray-600 bg-dark-bg-tertiary' : 'border-gray-200 bg-gray-50'
          }`}>
            <p className={`text-sm text-center ${
              isDarkMode ? 'text-dark-text-secondary' : 'text-gray-600'
            }`}>
              💡 登入以將專案同步到雲端
            </p>
          </div>
        )}
      </div>
    </div>
  );
}