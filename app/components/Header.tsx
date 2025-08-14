'use client';

import Link from 'next/link';
import AuthButton from './AuthButton';
import { useAuth } from '../contexts/AuthContext';

interface HeaderProps {
  onShowPlusWelcome?: () => void;
}

export default function Header({ onShowPlusWelcome }: HeaderProps) {
  const { user } = useAuth();
  const isPlus = user?.isPlus || false;

  return (
    <header className="w-full border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold">AI Whiteboard</Link>
        <div className="flex items-center gap-3">
          {!isPlus && (
            <Link href="/plus" className="text-sm px-3 py-1.5 rounded bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
              升級 Plus
            </Link>
          )}
          <AuthButton onShowPlusWelcome={onShowPlusWelcome} />
        </div>
      </div>
    </header>
  );
}