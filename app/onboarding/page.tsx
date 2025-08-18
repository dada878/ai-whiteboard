'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTheme } from '../contexts/ThemeContext';
import { Loader2, CheckCircle, User, School, BookOpen, Target } from 'lucide-react';

export default function OnboardingPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const { isDarkMode } = useTheme();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    school: '',
    major: '',
    year: '',
    purpose: '',
  });

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session) {
      router.push('/login');
      return;
    }

    // If profile is already complete, redirect to main app
    if (session.user?.profileComplete) {
      router.push('/');
    }

    // Pre-fill name if available
    if (session.user?.name) {
      setFormData(prev => ({ ...prev, name: session.user?.name || '' }));
    }
  }, [session, status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/user/complete-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '更新失敗');
      }

      // Update session to reflect profile completion
      await update();
      
      // Redirect to main app
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失敗，請稍後再試');
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors ${
      isDarkMode ? 'bg-dark-bg text-gray-100' : 'bg-gray-50 text-gray-900'
    }`}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className={`p-8 rounded-2xl shadow-xl ${
          isDarkMode ? 'bg-dark-bg-secondary' : 'bg-white'
        }`}>
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <User className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold mb-2">
              歡迎使用 ThinkBoard！
            </h1>
            <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              請先完成個人資料，讓我們為你提供更好的體驗
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                <User className="w-4 h-4 inline mr-2" />
                姓名 *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                <School className="w-4 h-4 inline mr-2" />
                學校 *
              </label>
              <input
                type="text"
                required
                value={formData.school}
                onChange={(e) => setFormData({ ...formData, school: e.target.value })}
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
                <BookOpen className="w-4 h-4 inline mr-2" />
                科系
              </label>
              <input
                type="text"
                value={formData.major}
                onChange={(e) => setFormData({ ...formData, major: e.target.value })}
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
                年級
              </label>
              <select
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                className={`w-full px-4 py-2 rounded-lg border ${
                  isDarkMode 
                    ? 'bg-dark-bg border-gray-700 text-white' 
                    : 'bg-white border-gray-300'
                } focus:outline-none focus:ring-2 focus:ring-purple-500`}
              >
                <option value="">請選擇</option>
                <option value="freshman">大一</option>
                <option value="sophomore">大二</option>
                <option value="junior">大三</option>
                <option value="senior">大四</option>
                <option value="graduate">研究生</option>
                <option value="other">其他</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                <Target className="w-4 h-4 inline mr-2" />
                使用目的
              </label>
              <textarea
                value={formData.purpose}
                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                rows={3}
                className={`w-full px-4 py-2 rounded-lg border ${
                  isDarkMode 
                    ? 'bg-dark-bg border-gray-700 text-white' 
                    : 'bg-white border-gray-300'
                } focus:outline-none focus:ring-2 focus:ring-purple-500`}
                placeholder="例如：整理課堂筆記、準備考試、專題研究..."
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
                  儲存中...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  完成設定
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}