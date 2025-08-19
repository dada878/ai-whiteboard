import { useSession } from 'next-auth/react';
import { useMemo } from 'react';

// 立即獲取用戶資訊，無需 loading
export function useAuthInstant() {
  const { data: session } = useSession();
  
  // 從 meta tag 或 script tag 讀取（由 SSR 注入）
  const serverUser = useMemo(() => {
    if (typeof window === 'undefined') return null;
    
    // 方法 1：從 meta tag 讀取
    const metaUser = document.querySelector('meta[name="user-data"]');
    if (metaUser) {
      try {
        return JSON.parse(metaUser.getAttribute('content') || '');
      } catch {}
    }
    
    // 方法 2：從全域變數讀取（SSR 注入）
    if ((window as any).__USER__) {
      return (window as any).__USER__;
    }
    
    return null;
  }, []);
  
  // 優先使用 server 資料，這樣就沒有 loading
  return {
    user: session?.user || serverUser,
    loading: false, // 永遠不 loading！
  };
}