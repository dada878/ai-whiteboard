'use client';

import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import Header from '../components/Header';
import { Clock, Mail, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';

export default function WaitingApprovalPage() {
  const { isDarkMode } = useTheme();

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/landing' });
  };

  return (
    <div className={`min-h-screen transition-colors ${
      isDarkMode ? 'bg-dark-bg text-gray-100' : 'bg-gray-50 text-gray-900'
    }`}>
      <Header />
      
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className={`text-center p-12 rounded-2xl ${
          isDarkMode ? 'bg-dark-bg-secondary' : 'bg-white'
        }`}>
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-yellow-100 flex items-center justify-center">
            <Clock className="w-10 h-10 text-yellow-600" />
          </div>
          
          <h1 className="text-3xl font-bold mb-4">
            申請已送出！
          </h1>
          
          <p className={`text-lg mb-6 ${
            isDarkMode ? 'text-gray-300' : 'text-gray-600'
          }`}>
            感謝你加入 ThinkBoard 等候名單
          </p>
          
          <div className={`p-6 rounded-xl mb-8 ${
            isDarkMode ? 'bg-dark-bg' : 'bg-gray-50'
          }`}>
            <Mail className="w-8 h-8 mx-auto mb-4 text-blue-500" />
            <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              我們正在審核你的申請<br />
              通過後會寄送通知信到你的信箱
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/landing"
              className={`px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                isDarkMode 
                  ? 'bg-dark-bg-tertiary text-gray-300 hover:bg-dark-bg' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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