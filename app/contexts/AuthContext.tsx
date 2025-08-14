'use client';

import React, { createContext, useContext } from 'react';
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const loading = status === 'loading';
  
  const user: User | null = session?.user ? {
    id: session.user.id || '',
    email: session.user.email,
    name: session.user.name,
    image: session.user.image,
    plan: (session.user as { plan?: 'free' | 'plus' }).plan,
    isPlus: Boolean((session.user as { isPlus?: boolean }).isPlus)
  } : null;

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