'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface EditNameDialogProps {
  isOpen: boolean;
  defaultName?: string;
  onClose: (updated?: boolean) => void;
}

const EditNameDialog: React.FC<EditNameDialogProps> = ({ isOpen, defaultName = '', onClose }) => {
  const { isDarkMode } = useTheme();
  const [name, setName] = useState(defaultName);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(defaultName);
  }, [defaultName, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div className={`rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden ${
        isDarkMode ? 'bg-dark-bg-secondary' : 'bg-white'
      }`}>
        <div className={`px-6 py-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-dark-text' : 'text-gray-800'}`}>修改顯示名稱</h3>
        </div>

        <div className="px-6 py-4 space-y-3">
          <label className={`text-sm ${isDarkMode ? 'text-dark-text-secondary' : 'text-gray-600'}`}>名稱</label>
          <input
            type="text"
            value={name}
            maxLength={50}
            onChange={(e) => setName(e.target.value)}
            className={`w-full px-3 py-2 rounded border ${
              isDarkMode ? 'bg-dark-bg-primary border-gray-600 text-dark-text' : 'bg-white border-gray-300 text-gray-800'
            }`}
            placeholder="輸入你的顯示名稱"
            autoFocus
          />
          <p className={`text-xs ${isDarkMode ? 'text-dark-text-secondary' : 'text-gray-500'}`}>1–50 個字</p>
        </div>

        <div className={`px-6 py-4 border-t flex gap-3 justify-end ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <button
            onClick={() => onClose(false)}
            className={`${isDarkMode ? 'bg-dark-bg-tertiary text-dark-text hover:bg-dark-bg' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} px-4 py-2 rounded-lg`}
            disabled={saving}
          >
            取消
          </button>
          <button
            onClick={async () => {
              const trimmed = name.trim();
              if (!trimmed || trimmed.length > 50) return;
              setSaving(true);
              try {
                await fetch('/api/user/profile', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: trimmed })
                });
                onClose(true);
              } catch (e) {
                console.error('Failed to update name', e);
                onClose(false);
              } finally {
                setSaving(false);
              }
            }}
            className={`${isDarkMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'} px-4 py-2 rounded-lg`}
            disabled={saving}
          >
            {saving ? '儲存中…' : '儲存'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditNameDialog;


