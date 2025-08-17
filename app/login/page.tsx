'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import Link from 'next/link';

export default function LoginPage() {
  const { user, loading } = useAuth();
  const { isDarkMode } = useTheme();
  const router = useRouter();

  useEffect(() => {
    // 如果用戶已登入，導向到主應用
    if (user && !loading) {
      router.push('/');
    }
  }, [user, loading, router]);

  const handleGoogleLogin = () => {
    signIn('google', { callbackUrl: '/' });
  };

  // 如果正在載入，顯示載入畫面
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        isDarkMode ? 'bg-dark-bg' : 'bg-gray-50'
      }`}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  // 如果已登入，不顯示登入頁面（會自動導向）
  if (user) {
    return null;
  }

  return (
    <div className={`min-h-screen flex items-center justify-center ${
      isDarkMode ? 'bg-dark-bg' : 'bg-gray-50'
    }`}>
      <div className={`w-full max-w-md p-8 rounded-2xl shadow-xl ${
        isDarkMode ? 'bg-dark-bg-secondary' : 'bg-white'
      }`}>
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
            ThinkBoard
          </h1>
          <p className={`text-sm ${
            isDarkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            登入以開始使用智能白板
          </p>
        </div>

        {/* Login Options */}
        <div className="space-y-4">
          {/* Google Login */}
          <button
            onClick={handleGoogleLogin}
            className={`w-full flex items-center justify-center gap-3 py-3 px-4 rounded-lg border transition-all hover:shadow-md ${
              isDarkMode 
                ? 'bg-dark-bg-tertiary border-gray-700 hover:bg-gray-800 text-gray-200' 
                : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700'
            }`}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span className="font-medium">使用 Google 帳號登入</span>
          </button>

        </div>

        {/* Terms */}
        <p className={`text-xs text-center mt-6 ${
          isDarkMode ? 'text-gray-500' : 'text-gray-500'
        }`}>
          登入即表示您同意我們的
          <Link href="#" className="underline hover:text-purple-600 mx-1">
            服務條款
          </Link>
          和
          <Link href="#" className="underline hover:text-purple-600 ml-1">
            隱私政策
          </Link>
        </p>

        {/* Back to Landing */}
        <div className="text-center mt-4">
          <Link 
            href="/landing"
            className={`text-sm hover:underline ${
              isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            ← 返回首頁
          </Link>
        </div>
      </div>
    </div>
  );
}