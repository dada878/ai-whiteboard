'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Header from '../components/Header';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Check, Loader2, AlertCircle } from 'lucide-react';

function WaitlistContent() {
  const { isDarkMode } = useTheme();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [school, setSchool] = useState('');
  const [major, setMajor] = useState('');
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const notApproved = searchParams.get('error') === 'not-approved';
  
  // 如果已登入，直接導向主應用
  useEffect(() => {
    if (user && !authLoading) {
      router.push('/');
    }
  }, [user, authLoading, router]);
  
  const handleLogin = () => {
    if (user) {
      router.push('/');
    } else {
      signIn('google', { callbackUrl: '/' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          name,
          school,
          major,
          reason,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '提交失敗');
      }

      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失敗，請稍後再試');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className={`min-h-screen transition-colors ${
        isDarkMode ? 'bg-dark-bg text-gray-100' : 'bg-gray-50 text-gray-900'
      }`}>
        <Header />
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className={`text-center p-8 rounded-2xl ${
            isDarkMode ? 'bg-dark-bg-secondary' : 'bg-white'
          }`}>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold mb-4">成功加入 Waiting List!</h1>
            <p className={`mb-6 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              感謝你的申請！我們會盡快審核你的申請，<br />
              通過後會寄送邀請信到你的信箱。
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:shadow-xl transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              返回首頁
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors ${
      isDarkMode ? 'bg-dark-bg text-gray-100' : 'bg-gray-50 text-gray-900'
    }`}>
      <Header />
      
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {notApproved && (
          <div className="mb-6 p-4 rounded-lg bg-yellow-50 border border-yellow-200 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-800">您尚未獲得使用權限</h3>
              <p className="text-yellow-700 text-sm mt-1">
                請先申請加入等候名單，我們會盡快審核您的申請。
              </p>
            </div>
          </div>
        )}
        
        <div className={`p-8 rounded-2xl shadow-xl ${
          isDarkMode ? 'bg-dark-bg-secondary' : 'bg-white'
        }`}>
          <h1 className="text-3xl font-bold mb-2 text-center">
            <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              加入 ThinkBoard Waiting List
            </span>
          </h1>
          <p className={`text-center mb-8 ${
            isDarkMode ? 'text-gray-300' : 'text-gray-600'
          }`}>
            搶先體驗專為學生設計的智能白板工具
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                Email *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full px-4 py-2 rounded-lg border ${
                  isDarkMode 
                    ? 'bg-dark-bg border-gray-700 text-white' 
                    : 'bg-white border-gray-300'
                } focus:outline-none focus:ring-2 focus:ring-purple-500`}
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                姓名 *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full px-4 py-2 rounded-lg border ${
                  isDarkMode 
                    ? 'bg-dark-bg border-gray-700 text-white' 
                    : 'bg-white border-gray-300'
                } focus:outline-none focus:ring-2 focus:ring-purple-500`}
                placeholder="王小明"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                學校 *
              </label>
              <input
                type="text"
                required
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                className={`w-full px-4 py-2 rounded-lg border ${
                  isDarkMode 
                    ? 'bg-dark-bg border-gray-700 text-white' 
                    : 'bg-white border-gray-300'
                } focus:outline-none focus:ring-2 focus:ring-purple-500`}
                placeholder="國立台灣大學"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                科系
              </label>
              <input
                type="text"
                value={major}
                onChange={(e) => setMajor(e.target.value)}
                className={`w-full px-4 py-2 rounded-lg border ${
                  isDarkMode 
                    ? 'bg-dark-bg border-gray-700 text-white' 
                    : 'bg-white border-gray-300'
                } focus:outline-none focus:ring-2 focus:ring-purple-500`}
                placeholder="資訊工程學系"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                為什麼想使用 ThinkBoard？
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                className={`w-full px-4 py-2 rounded-lg border ${
                  isDarkMode 
                    ? 'bg-dark-bg border-gray-700 text-white' 
                    : 'bg-white border-gray-300'
                } focus:outline-none focus:ring-2 focus:ring-purple-500`}
                placeholder="告訴我們你想如何使用 ThinkBoard..."
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  提交中...
                </>
              ) : (
                '申請加入'
              )}
            </button>
          </form>

          <p className={`text-center mt-6 text-sm ${
            isDarkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            已經有邀請碼？
            <button 
              onClick={handleLogin}
              disabled={authLoading}
              className="text-purple-600 hover:underline ml-1 disabled:opacity-50"
            >
              立即登入
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function WaitlistPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
      <WaitlistContent />
    </Suspense>
  );
}