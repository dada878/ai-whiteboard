'use client';

import Link from 'next/link';
import AuthButton from './AuthButton';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

interface HeaderProps {
  onShowPlusWelcome?: () => void;
}

export default function Header({ onShowPlusWelcome }: HeaderProps) {
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const isPlus = user?.isPlus || false;

  return (
    <header className={`w-full border-b z-50 relative ${
      isDarkMode 
        ? 'bg-dark-bg-secondary border-gray-700' 
        : 'bg-white border-gray-200'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
        <Link href="/" className={`text-lg sm:text-xl font-bold transition-colors ${
          isDarkMode ? 'text-gray-100 hover:text-gray-300' : 'text-gray-900 hover:text-gray-700'
        }`}>
          <span className="hidden sm:inline">
            ThinkBoard
            <span className={`font-normal ${
              isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`}>.app</span>
          </span>
          <span className="sm:hidden">TB</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          {!isPlus && (
            <Link href="/plus" className={`text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5 rounded transition-colors ${
              isDarkMode 
                ? 'bg-yellow-900/30 text-yellow-400 hover:bg-yellow-900/50' 
                : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
            }`}>
              <span className="hidden sm:inline">升級 Plus</span>
              <span className="sm:hidden">Plus</span>
            </Link>
          )}
          <AuthButton onShowPlusWelcome={onShowPlusWelcome} />
        </div>
      </div>
    </header>
  );
}