'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { AuthService, User } from '../services/authService';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInAnonymously: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAnonymous: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 從 sessionStorage 獲取快取的用戶資訊
function getCachedUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = sessionStorage.getItem('auth-cache');
    if (cached) {
      const data = JSON.parse(cached);
      // 快取有效期 10 分鐘
      if (Date.now() - data.timestamp < 10 * 60 * 1000) {
        return data.user;
      }
    }
  } catch {
    // 忽略錯誤
  }
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [cachedUser, setCachedUser] = useState<User | null>(getCachedUser());
  
  // 只有在真正 loading 時才顯示 loading，unauthenticated 時不顯示
  const loading = status === 'loading' && !cachedUser;
  
  const currentUser: User | null = session?.user ? {
    id: session.user.id || '',
    email: session.user.email,
    name: session.user.name,
    image: session.user.image,
    plan: (session.user as { plan?: 'free' | 'plus' }).plan,
    isPlus: Boolean((session.user as { isPlus?: boolean }).isPlus),
    profileComplete: Boolean((session.user as { profileComplete?: boolean }).profileComplete),
    onboardingStatus: (session.user as { onboardingStatus?: string }).onboardingStatus || 'pending',
    isApproved: Boolean((session.user as { isApproved?: boolean }).isApproved)
  } : null;
  
  // 優先使用真實 session，其次使用快取
  const user = currentUser || (loading ? cachedUser : null);
  
  // 更新快取
  useEffect(() => {
    if (currentUser && typeof window !== 'undefined') {
      sessionStorage.setItem('auth-cache', JSON.stringify({
        user: currentUser,
        timestamp: Date.now()
      }));
    } else if (!currentUser && !loading && typeof window !== 'undefined') {
      sessionStorage.removeItem('auth-cache');
    }
  }, [currentUser, loading]);

  const signInWithGoogle = async () => {
    try {
      await AuthService.signInWithGoogle();
    } catch (error) {
      console.error('Google sign-in failed:', error);
      throw error;
    }
  };

  const signInAnonymously = async () => {
    try {
      await AuthService.signInAnonymously();
    } catch (error) {
      console.error('Anonymous sign-in failed:', error);
      throw error;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      await AuthService.signInWithEmail(email, password);
    } catch (error) {
      console.error('Email sign-in failed:', error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    try {
      await AuthService.signUpWithEmail(email, password);
    } catch (error) {
      console.error('Email sign-up failed:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      // 清除快取
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('auth-cache');
      }
      // 清除 state 中的快取
      setCachedUser(null);
      await AuthService.signOut();
    } catch (error) {
      console.error('Sign-out failed:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    signInWithGoogle,
    signInAnonymously,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    isAnonymous: false // NextAuth 不支援匿名使用者
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}