'use client';

import React from 'react';
import Link from 'next/link';
import { useTheme } from '../contexts/ThemeContext';
import Header from '../components/Header';

export default function LandingPage() {
  const { isDarkMode } = useTheme();

  const features = [
    {
      icon: '🧠',
      title: 'AI 智能分析',
      description: '使用先進的 AI 技術，幫助你分析、總結和組織你的想法',
      highlight: true
    },
    {
      icon: '✨',
      title: '直觀拖放',
      description: '簡單的拖放操作，讓你的想法自由流動，創意無限',
      highlight: false
    },
    {
      icon: '🔗',
      title: '智能連結',
      description: '自動識別想法之間的關聯，建立知識網絡',
      highlight: false
    },
    {
      icon: '🎨',
      title: '自訂風格',
      description: '多種顏色和樣式選擇，打造屬於你的思維空間',
      highlight: false
    },
    {
      icon: '☁️',
      title: '雲端同步',
      description: '自動同步到雲端，隨時隨地存取你的想法',
      highlight: true
    },
    {
      icon: '🚀',
      title: '高效協作',
      description: '即時協作功能，與團隊共同創造',
      highlight: false
    }
  ];


  return (
    <div className={`min-h-screen transition-colors ${
      isDarkMode ? 'bg-dark-bg text-gray-100' : 'bg-gray-50 text-gray-900'
    }`}>
      <Header />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
          <div className="text-center">
            <h1 className="text-4xl sm:text-6xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              ThinkBoard, Think Better.
            </h1>
            <p className={`text-xl sm:text-2xl mb-8 max-w-3xl mx-auto ${
              isDarkMode ? 'text-gray-300' : 'text-gray-600'
            }`}>
              ThinkBoard 是一個智能白板工具，結合 AI 技術幫助你組織想法、激發創意，讓思考更有效率
            </p>
            <div className="flex justify-center">
              <Link 
                href="/login"
                className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:shadow-xl transition-all transform hover:scale-105"
              >
                立即體驗
              </Link>
            </div>
          </div>
          
          {/* Hero Video */}
          <div className="mt-16 relative">
            <div className={`rounded-2xl shadow-2xl overflow-hidden ${
              isDarkMode ? 'bg-dark-bg-secondary' : 'bg-white'
            }`}>
              <div className="aspect-video relative">
                <video 
                  className="w-full h-full object-cover"
                  autoPlay 
                  loop 
                  muted 
                  playsInline
                >
                  <source src="/brain_storming.mp4" type="video/mp4" />
                  {/* Fallback for browsers that don't support video */}
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-600">
                    <div className="text-center p-12">
                      <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                          <div 
                            key={i}
                            className={`p-4 rounded-lg transform transition-all hover:scale-105 ${
                              isDarkMode ? 'bg-dark-bg-tertiary' : 'bg-yellow-100'
                            }`}
                            style={{
                              animation: `float ${3 + i * 0.5}s ease-in-out infinite`,
                              animationDelay: `${i * 0.2}s`
                            }}
                          >
                            <div className="w-full h-12"></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </video>
                {/* Optional overlay for better text readability if needed */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent pointer-events-none"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className={`py-20 ${
        isDarkMode ? 'bg-dark-bg-secondary' : 'bg-white'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              強大功能，助你思考
            </h2>
            <p className={`text-lg ${
              isDarkMode ? 'text-gray-300' : 'text-gray-600'
            }`}>
              結合最新 AI 技術，讓你的創意和想法更有組織
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div 
                key={index}
                className={`p-6 rounded-xl transition-all hover:shadow-xl hover:scale-105 ${
                  feature.highlight 
                    ? 'bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-2 border-purple-500/30'
                    : isDarkMode ? 'bg-dark-bg-tertiary' : 'bg-gray-50'
                }`}
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold mb-2">
                  {feature.title}
                  {feature.highlight && (
                    <span className="ml-2 text-xs px-2 py-1 bg-purple-600 text-white rounded-full">
                      Plus
                    </span>
                  )}
                </h3>
                <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={`py-20 ${
        isDarkMode ? 'bg-dark-bg-secondary' : 'bg-gray-900'
      }`}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            準備好開始了嗎？
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            加入數千位用戶，讓 ThinkBoard 幫助你更好地思考和創造
          </p>
          <Link 
            href="/login"
            className="inline-block px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:shadow-xl transition-all transform hover:scale-105"
          >
            立即體驗
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className={`py-12 border-t ${
        isDarkMode ? 'bg-dark-bg border-gray-800' : 'bg-white border-gray-200'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-4">ThinkBoard</h3>
              <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                智能白板工具，讓思維自由流動
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">產品</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="#features" className={`hover:underline ${
                    isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900'
                  }`}>
                    功能
                  </Link>
                </li>
                <li>
                  <Link href="#pricing" className={`hover:underline ${
                    isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900'
                  }`}>
                    價格
                  </Link>
                </li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">支援</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="#" className={`hover:underline ${
                    isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900'
                  }`}>
                    使用指南
                  </Link>
                </li>
                <li>
                  <Link href="#" className={`hover:underline ${
                    isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900'
                  }`}>
                    常見問題
                  </Link>
                </li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">關於</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="#" className={`hover:underline ${
                    isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900'
                  }`}>
                    隱私政策
                  </Link>
                </li>
                <li>
                  <Link href="#" className={`hover:underline ${
                    isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900'
                  }`}>
                    服務條款
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          
          <div className={`mt-12 pt-8 border-t text-center ${
            isDarkMode ? 'border-gray-800 text-gray-400' : 'border-gray-200 text-gray-600'
          }`}>
            <p>© 2024 ThinkBoard. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-20px);
          }
        }
      `}</style>
    </div>
  );
}