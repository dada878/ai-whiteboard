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
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className={`text-xl font-bold transition-colors ${
          isDarkMode ? 'text-gray-100 hover:text-gray-300' : 'text-gray-900 hover:text-gray-700'
        }`}>
          ThinkBoard
        </Link>
        <div className="flex items-center gap-3">
          {!isPlus && (
            <Link href="/plus" className={`text-sm px-3 py-1.5 rounded transition-colors ${
              isDarkMode 
                ? 'bg-yellow-900/30 text-yellow-400 hover:bg-yellow-900/50' 
                : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
            }`}>
              升級 Plus
            </Link>
          )}
          <AuthButton onShowPlusWelcome={onShowPlusWelcome} />
        </div>
      </div>
    </header>
  );
}