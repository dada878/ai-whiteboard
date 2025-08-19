'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Clock, Mail, CheckCircle, X } from 'lucide-react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';

interface WaitlistDialogProps {
  isOpen: boolean;
  onClose?: () => void;
}

export default function WaitlistDialog({ isOpen, onClose }: WaitlistDialogProps) {
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  
  const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
  const isAdmin = user?.email ? adminEmails.includes(user.email) : false;

  useEffect(() => {
    // Check if user just joined the waitlist from URL parameter
    const justJoined = searchParams.get('joined') === 'true';
    
    if (justJoined && isOpen) {
      setShowSuccessMessage(true);
      
      // Hide success message after 5 seconds
      const timer = setTimeout(() => {
        setShowSuccessMessage(false);
      }, 5000);
      
      // Clean up URL parameter
      const url = new URL(window.location.href);
      url.searchParams.delete('joined');
      window.history.replaceState({}, '', url);
      
      return () => clearTimeout(timer);
    }
  }, [searchParams, isOpen]);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/landing' });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop and Dialog Container */}
      <div 
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={() => {
          if (onClose) {
            onClose();
          }
        }}
      >
        {/* Dialog - stops propagation to prevent backdrop click */}
        <div 
          className={`relative w-full max-w-lg rounded-2xl shadow-2xl ${
            isDarkMode ? 'bg-dark-bg-secondary' : 'bg-white'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button - always show */}
          <button
            onClick={() => {
              if (onClose) {
                onClose();
              }
            }}
            className={`absolute top-4 right-4 p-2 rounded-lg transition-colors ${
              isDarkMode 
                ? 'hover:bg-dark-bg-tertiary text-gray-400' 
                : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
          
          {/* Content */}
          <div className="p-8 text-center">
            <div className={`w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center ${
              showSuccessMessage ? 'bg-green-100' : 'bg-yellow-100'
            }`}>
              {showSuccessMessage ? (
                <CheckCircle className="w-10 h-10 text-green-600" />
              ) : (
                <Clock className="w-10 h-10 text-yellow-600" />
              )}
            </div>
            
            <h2 className="text-2xl font-bold mb-4">
              {showSuccessMessage ? '歡迎加入 ThinkBoard！' : '申請已送出！'}
            </h2>
            
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
              <button
                onClick={handleSignOut}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  isDarkMode 
                    ? 'bg-dark-bg-tertiary text-gray-300 hover:bg-dark-bg' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                登出
              </button>
              
              {/* Admin can access the waitlist management page */}
              {isAdmin && (
                <Link 
                  href="/admin/waitlist"
                  className="px-6 py-3 rounded-lg font-medium transition-colors bg-purple-600 text-white hover:bg-purple-700 inline-block"
                >
                  管理 Waitlist
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}