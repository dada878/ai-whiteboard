'use client';

import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AuthService } from '../services/authService';
import { useTheme } from '../contexts/ThemeContext';

export default function AuthButton() {
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const { isDarkMode } = useTheme();
  const [showMenu, setShowMenu] = useState(false);

  if (loading) {
    return (
      <div className={`px-4 py-2 rounded-lg ${
        isDarkMode ? 'bg-dark-bg-secondary' : 'bg-gray-100'
      } animate-pulse`}>
        載入中...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative">
        <button
          onClick={signInWithGoogle}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            isDarkMode 
              ? 'bg-blue-600 hover:bg-blue-700 text-white' 
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          登入
        </button>
      </div>
    );
  }

  const displayName = AuthService.getUserDisplayName(user);
  const isAnonymous = AuthService.isAnonymousUser(user);

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
          isDarkMode 
            ? 'bg-dark-bg-secondary hover:bg-dark-bg-tertiary text-dark-text' 
            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
        }`}
      >
        <span className="text-sm">{displayName}</span>
        <svg 
          className="w-4 h-4" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {showMenu && (
        <div 
          className={`absolute right-0 mt-2 w-56 rounded-lg shadow-lg ${
            isDarkMode 
              ? 'bg-dark-bg-secondary border border-gray-700' 
              : 'bg-white border border-gray-200'
          } z-50`}
        >
          <div className={`p-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="text-sm font-medium truncate">{displayName}</div>
            {!isAnonymous && user.email && (
              <div className="text-xs opacity-60 truncate">{user.email}</div>
            )}
          </div>
          
          
          <div className="py-1">
            <button
              onClick={async () => {
                await signOut();
                setShowMenu(false);
              }}
              className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                isDarkMode 
                  ? 'hover:bg-dark-bg-tertiary text-red-400' 
                  : 'hover:bg-gray-100 text-red-600'
              }`}
            >
              登出
            </button>
          </div>
        </div>
      )}
    </div>
  );
}