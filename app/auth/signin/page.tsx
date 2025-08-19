'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useTheme } from '@/app/contexts/ThemeContext';
import Link from 'next/link';
import { AlertCircle, ArrowLeft } from 'lucide-react';

function SignInContent() {
  const { isDarkMode } = useTheme();
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  
  const handleGoogleSignIn = () => {
    signIn('google', { callbackUrl: '/' });
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-dark-bg text-white' : 'bg-gray-50 text-gray-900'}`}>
      <div className="max-w-md mx-auto px-4 py-20">
        <div className={`p-8 rounded-2xl shadow-lg ${isDarkMode ? 'bg-dark-bg-secondary' : 'bg-white'}`}>
          <h1 className="text-2xl font-bold text-center mb-6">登入 ThinkBoard</h1>
          
          {error === 'OAuthAccountNotLinked' && (
            <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
              isDarkMode ? 'bg-red-900/30 text-red-200' : 'bg-red-50 text-red-700'
            }`}>
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-semibold mb-1">帳號連結錯誤</p>
                <p>這個 Email 已經被其他登入方式使用。請使用原本的登入方式。</p>
              </div>
            </div>
          )}
          
          {error && error !== 'OAuthAccountNotLinked' && (
            <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
              isDarkMode ? 'bg-yellow-900/30 text-yellow-200' : 'bg-yellow-50 text-yellow-700'
            }`}>
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <p className="text-sm">登入時發生錯誤，請再試一次。</p>
            </div>
          )}
          
          <button
            onClick={handleGoogleSignIn}
            className="w-full py-3 px-4 bg-white border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            使用 Google 登入
          </button>
          
          <div className="mt-6 text-center">
            <Link 
              href="/landing"
              className={`inline-flex items-center gap-2 text-sm ${
                isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              返回首頁
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInContent />
    </Suspense>
  );
}