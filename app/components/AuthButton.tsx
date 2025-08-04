'use client';

import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AuthService } from '../services/authService';
import { useTheme } from '../contexts/ThemeContext';

export default function AuthButton() {
  const { user, loading, signInWithGoogle, signInAnonymously, signOut } = useAuth();
  const { isDarkMode } = useTheme();
  const [showMenu, setShowMenu] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      if (isSignUp) {
        await AuthService.signUpWithEmail(email, password);
      } else {
        await AuthService.signInWithEmail(email, password);
      }
      setShowEmailDialog(false);
      setEmail('');
      setPassword('');
    } catch (err) {
      setError((err as Error).message || '認證失敗');
    }
  };

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
          onClick={() => setShowMenu(!showMenu)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            isDarkMode 
              ? 'bg-blue-600 hover:bg-blue-700 text-white' 
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          登入
        </button>
        
        {showMenu && (
          <div 
            className={`absolute right-0 mt-2 w-56 rounded-lg shadow-lg ${
              isDarkMode 
                ? 'bg-dark-bg-secondary border border-gray-700' 
                : 'bg-white border border-gray-200'
            } z-50`}
          >
            <div className="py-1">
              <button
                onClick={async () => {
                  await signInWithGoogle();
                  setShowMenu(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                  isDarkMode 
                    ? 'hover:bg-dark-bg-tertiary text-dark-text' 
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                🔍 使用 Google 登入
              </button>
              
              <button
                onClick={() => {
                  setShowEmailDialog(true);
                  setShowMenu(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                  isDarkMode 
                    ? 'hover:bg-dark-bg-tertiary text-dark-text' 
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                📧 使用 Email 登入
              </button>
              
              <div className={`border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} my-1`} />
              
              <button
                onClick={async () => {
                  await signInAnonymously();
                  setShowMenu(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                  isDarkMode 
                    ? 'hover:bg-dark-bg-tertiary text-dark-text-secondary' 
                    : 'hover:bg-gray-100 text-gray-500'
                }`}
              >
                👤 匿名使用
              </button>
            </div>
          </div>
        )}
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
          
          {isAnonymous && (
            <>
              <div className={`p-4 text-sm ${isDarkMode ? 'text-dark-text-secondary' : 'text-gray-600'}`}>
                登入以儲存您的專案到雲端
              </div>
              <div className="py-1">
                <button
                  onClick={async () => {
                    await signInWithGoogle();
                    setShowMenu(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                    isDarkMode 
                      ? 'hover:bg-dark-bg-tertiary text-dark-text' 
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  🔍 使用 Google 登入
                </button>
              </div>
              <div className={`border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} my-1`} />
            </>
          )}
          
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

      {/* Email 登入對話框 */}
      {showEmailDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" 
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setShowEmailDialog(false)}
        >
          <div 
            className={`w-full max-w-md p-6 rounded-lg ${
              isDarkMode ? 'bg-dark-bg-secondary' : 'bg-white'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className={`text-xl font-bold mb-4 ${
              isDarkMode ? 'text-dark-text' : 'text-gray-900'
            }`}>
              {isSignUp ? '註冊新帳號' : '登入'}
            </h2>
            
            <form onSubmit={handleEmailAuth}>
              {error && (
                <div className="mb-4 p-3 rounded bg-red-100 text-red-700 text-sm">
                  {error}
                </div>
              )}
              
              <div className="mb-4">
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-dark-text' : 'text-gray-700'
                }`}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full px-3 py-2 rounded border ${
                    isDarkMode 
                      ? 'bg-dark-bg-primary border-gray-600 text-dark-text' 
                      : 'bg-white border-gray-300 text-gray-900'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  required
                />
              </div>
              
              <div className="mb-6">
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-dark-text' : 'text-gray-700'
                }`}>
                  密碼
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full px-3 py-2 rounded border ${
                    isDarkMode 
                      ? 'bg-dark-bg-primary border-gray-600 text-dark-text' 
                      : 'bg-white border-gray-300 text-gray-900'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  minLength={6}
                  required
                />
              </div>
              
              <button
                type="submit"
                className={`w-full py-2 px-4 rounded font-medium transition-colors ${
                  isDarkMode 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {isSignUp ? '註冊' : '登入'}
              </button>
            </form>
            
            <div className={`mt-4 text-center text-sm ${
              isDarkMode ? 'text-dark-text-secondary' : 'text-gray-600'
            }`}>
              {isSignUp ? '已有帳號？' : '還沒有帳號？'}
              <button
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError('');
                }}
                className="text-blue-500 hover:text-blue-600 ml-1"
              >
                {isSignUp ? '登入' : '註冊'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}