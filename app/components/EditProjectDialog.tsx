'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface EditProjectDialogProps {
  isOpen: boolean;
  projectName: string;
  projectDescription?: string;
  onClose: () => void;
  onSave: (name: string, description: string) => void;
}

export default function EditProjectDialog({
  isOpen,
  projectName,
  projectDescription = '',
  onClose,
  onSave
}: EditProjectDialogProps) {
  const { isDarkMode } = useTheme();
  const [name, setName] = useState(projectName);
  const [description, setDescription] = useState(projectDescription);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(projectName);
      setDescription(projectDescription);
      setError('');
    }
  }, [isOpen, projectName, projectDescription]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('專案名稱不能為空');
      return;
    }

    onSave(name.trim(), description.trim());
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div 
        className={`w-full max-w-md p-6 rounded-lg shadow-xl ${
          isDarkMode ? 'bg-dark-bg-secondary' : 'bg-white'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className={`text-xl font-bold mb-4 ${
          isDarkMode ? 'text-dark-text' : 'text-gray-900'
        }`}>
          編輯專案
        </h2>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 p-3 rounded bg-red-100 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className={`block text-sm font-medium mb-2 ${
              isDarkMode ? 'text-dark-text' : 'text-gray-700'
            }`}>
              專案名稱
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full px-3 py-2 rounded border ${
                isDarkMode 
                  ? 'bg-dark-bg-primary border-gray-600 text-dark-text' 
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              autoFocus
              required
            />
          </div>

          <div className="mb-6">
            <label className={`block text-sm font-medium mb-2 ${
              isDarkMode ? 'text-dark-text' : 'text-gray-700'
            }`}>
              專案描述（選填）
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`w-full px-3 py-2 rounded border h-24 resize-none ${
                isDarkMode 
                  ? 'bg-dark-bg-primary border-gray-600 text-dark-text' 
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              placeholder="輸入專案描述..."
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded font-medium transition-colors ${
                isDarkMode 
                  ? 'bg-dark-bg-tertiary hover:bg-gray-700 text-dark-text' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              取消
            </button>
            <button
              type="submit"
              className={`px-4 py-2 rounded font-medium transition-colors ${
                isDarkMode 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              儲存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}