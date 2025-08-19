'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Header from '../components/Header';
import WaitlistDialog from '../components/WaitlistDialog';
import { useSearchParams } from 'next/navigation';

function LandingContent() {
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showWaitlistDialog, setShowWaitlistDialog] = useState(false);
  
  useEffect(() => {
    // 檢查是否剛加入 waitlist
    const justJoined = searchParams.get('joined') === 'true';
    if (justJoined && user && !user.isApproved) {
      setShowWaitlistDialog(true);
      // 清理 URL 參數
      const url = new URL(window.location.href);
      url.searchParams.delete('joined');
      window.history.replaceState({}, '', url);
    }
  }, [user, searchParams]);
  
  const handleJoinWaitlist = () => {
    if (user) {
      // 已登入，檢查是否已批准
      if (user.isApproved) {
        router.push('/app');
      } else {
        setShowWaitlistDialog(true);
      }
    } else {
      // 未登入，觸發 Google 登入
      signIn('google', { callbackUrl: '/?joined=true' });
    }
  };

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
              專為學生設計的智能白板工具，結合 AI 技術幫助你組織想法、激發創意，讓學習更有效率！
            </p>
            <div className="flex justify-center gap-4">
              {user && !user.isApproved ? (
                <>
                  <button 
                    onClick={() => setShowWaitlistDialog(true)}
                    className="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:shadow-xl transition-all transform hover:scale-105"
                  >
                    ✓ 已加入等候名單
                  </button>
                  <button 
                    onClick={() => setShowWaitlistDialog(true)}
                    className={`px-6 py-4 rounded-lg font-semibold transition-all ${
                      isDarkMode 
                        ? 'bg-dark-bg-secondary text-gray-300 hover:bg-dark-bg-tertiary' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    查看狀態
                  </button>
                </>
              ) : user && user.isApproved ? (
                <button 
                  onClick={() => router.push('/app')}
                  className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:shadow-xl transition-all transform hover:scale-105"
                >
                  進入應用程式
                </button>
              ) : (
                <button 
                  onClick={handleJoinWaitlist}
                  className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:shadow-xl transition-all transform hover:scale-105"
                >
                  Join Waitlist
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Brainstorming Section */}
      <section className={`py-20 ${
        isDarkMode ? 'bg-dark-bg-secondary' : 'bg-white'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Video Content - Left Side */}
            <div>
              <div className={`rounded-2xl shadow-2xl overflow-hidden ${
                isDarkMode ? 'bg-dark-bg' : 'bg-gray-100'
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
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-600/20 to-pink-600/20">
                      <p className="text-center p-8">
                        您的瀏覽器不支援影片播放
                      </p>
                    </div>
                  </video>
                </div>
              </div>
            </div>
            
            {/* Text Content - Right Side */}
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  讓 AI 幫你腦力激盪
                </span>
              </h2>
              <p className={`text-lg mb-6 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-600'
              }`}>
                幫你根據整體白板內容，生成創意延伸概念
              </p>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <span className="text-2xl mr-4">💡</span>
                  <div>
                    <h3 className="font-semibold mb-1">快速捕捉靈感</h3>
                    <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                      隨時記錄突如其來的想法，不錯過任何創意火花
                    </p>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-2xl mr-4">🎯</span>
                  <div>
                    <h3 className="font-semibold mb-1">視覺化思考</h3>
                    <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                      用顏色、位置和連線來組織思維，讓複雜概念一目了然
                    </p>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-2xl mr-4">🔗</span>
                  <div>
                    <h3 className="font-semibold mb-1">智能關聯</h3>
                    <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                      輕鬆建立想法之間的聯繫，發現隱藏的模式
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* User Experience Section */}
      <section className={`py-20 ${
        isDarkMode ? 'bg-dark-bg' : 'bg-gray-50'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Text Content */}
            <div className="order-2 lg:order-1">
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  流暢的使用體驗
                </span>
              </h2>
              <p className={`text-lg mb-6 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-600'
              }`}>
                直觀的操作流程，讓你專注於創意本身，而非工具的使用
              </p>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <span className="text-2xl mr-4">🎯</span>
                  <div>
                    <h3 className="font-semibold mb-1">精準控制</h3>
                    <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                      每個操作都經過精心設計，確保流暢且符合直覺
                    </p>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-2xl mr-4">⚡</span>
                  <div>
                    <h3 className="font-semibold mb-1">即時回應</h3>
                    <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                      快速的反應速度，讓你的想法即時呈現
                    </p>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-2xl mr-4">🔄</span>
                  <div>
                    <h3 className="font-semibold mb-1">無縫整合</h3>
                    <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                      AI 功能自然融入工作流程，提升而非打斷你的思考
                    </p>
                  </div>
                </li>
              </ul>
            </div>
            
            {/* Video Content */}
            <div className="order-1 lg:order-2">
              <div className={`rounded-2xl shadow-2xl overflow-hidden ${
                isDarkMode ? 'bg-dark-bg-secondary' : 'bg-gray-100'
              }`}>
                <div className="aspect-video relative">
                  <video 
                    className="w-full h-full object-cover"
                    autoPlay 
                    loop 
                    muted 
                    playsInline
                  >
                    <source src="/control-flow.mp4" type="video/mp4" />
                    {/* Fallback for browsers that don't support video */}
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-600/20 to-blue-600/20">
                      <p className="text-center p-8">
                        您的瀏覽器不支援影片播放
                      </p>
                    </div>
                  </video>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Agent Section */}
      <section className={`py-20 ${
        isDarkMode ? 'bg-dark-bg-secondary' : 'bg-white'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Video Content */}
            <div>
              <div className={`rounded-2xl shadow-2xl overflow-hidden ${
                isDarkMode ? 'bg-dark-bg' : 'bg-white'
              }`}>
                <div className="aspect-video relative">
                  <video 
                    className="w-full h-full object-cover"
                    autoPlay 
                    loop 
                    muted 
                    playsInline
                  >
                    <source src="/ai_agent.mp4" type="video/mp4" />
                    {/* Fallback for browsers that don't support video */}
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-600/20 to-blue-600/20">
                      <p className="text-center p-8">
                        您的瀏覽器不支援影片播放
                      </p>
                    </div>
                  </video>
                </div>
              </div>
            </div>
            
            {/* Text Content */}
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  AI Agent 即時對話
                </span>
              </h2>
              <p className={`text-lg mb-6 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-600'
              }`}>
                強大的 AI 助手隨時待命，協助你探索、分析和擴展你的想法
              </p>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <span className="text-2xl mr-4">💬</span>
                  <div>
                    <h3 className="font-semibold mb-1">智能對話</h3>
                    <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                      與 AI 助手自然對話，獲得即時的建議和洞察
                    </p>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-2xl mr-4">🔍</span>
                  <div>
                    <h3 className="font-semibold mb-1">深度分析</h3>
                    <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                      自動分析你的內容，找出關聯和模式
                    </p>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-2xl mr-4">✨</span>
                  <div>
                    <h3 className="font-semibold mb-1">創意激發</h3>
                    <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                      基於你的想法，生成新的觀點和建議
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>



      {/* Footer */}
      <footer className={`py-8 border-t ${
        isDarkMode ? 'bg-dark-bg border-gray-800' : 'bg-white border-gray-200'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold">ThinkBoard</h3>
              <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                智能白板工具
              </span>
            </div>
            
            <div className="flex gap-6 text-sm">
              <Link href="#" className={`hover:underline ${
                isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900'
              }`}>
                隱私政策
              </Link>
              <Link href="#" className={`hover:underline ${
                isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900'
              }`}>
                服務條款
              </Link>
              <Link href="#" className={`hover:underline ${
                isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900'
              }`}>
                聯絡我們
              </Link>
            </div>
            
            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              © 2024 ThinkBoard
            </div>
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
      
      {/* Waitlist Dialog for logged in but not approved users */}
      <WaitlistDialog 
        isOpen={showWaitlistDialog}
        onClose={() => setShowWaitlistDialog(false)}
      />
    </div>
  );
}

export default function LandingPage() {
  return (
    <Suspense fallback={null}>
      <LandingContent />
    </Suspense>
  );
}