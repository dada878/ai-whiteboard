'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Whiteboard from '../components/Whiteboard';
import PlusWelcomeDialog from '../components/PlusWelcomeDialog';
import Header from '../components/Header';
import { useAuth } from '../contexts/AuthContext';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(false);

  useEffect(() => {
    // 如果還在載入中，不做任何事
    if (loading) return;
    
    // 如果用戶未登入，導向到首頁（middleware 會處理）
    if (!user) {
      router.push('/');
      return;
    }
    
    // 檢查用戶是否已被批准
    if (!user.isApproved) {
      // 未批准的用戶導向到 landing 頁面
      router.push('/');
      return;
    }
    
    // 檢查是否是 Plus 會員且尚未顯示過歡迎對話框
    if (user?.isPlus) {
      const hasSeenWelcome = localStorage.getItem('plusWelcomeSeen');
      const lastSeenEmail = localStorage.getItem('plusWelcomeEmail');
      
      // 如果是新的 Plus 會員或不同的帳號
      if (!hasSeenWelcome || lastSeenEmail !== user.email) {
        // 延遲一點顯示，讓頁面先載入
        const timer = setTimeout(() => {
          setShowWelcomeDialog(true);
          localStorage.setItem('plusWelcomeSeen', 'true');
          if (user.email) {
            localStorage.setItem('plusWelcomeEmail', user.email);
          }
        }, 1500);
        
        return () => clearTimeout(timer);
      }
    }
  }, [user, loading, router]);

  const handleShowPlusWelcome = () => {
    setShowWelcomeDialog(true);
  };

  // 在載入過程中顯示載入畫面
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header onShowPlusWelcome={handleShowPlusWelcome} />
      <div className="flex-1 overflow-hidden">
        <Whiteboard />
      </div>
      <PlusWelcomeDialog 
        isOpen={showWelcomeDialog}
        onClose={() => setShowWelcomeDialog(false)}
      />
    </div>
  );
}
