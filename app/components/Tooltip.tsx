'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../contexts/ThemeContext';

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  delay?: number;
}

const Tooltip: React.FC<TooltipProps> = ({ children, content, delay = 500 }) => {
  const { isDarkMode } = useTheme();
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPosition({
      x: rect.left + rect.width / 2,
      y: rect.top
    });

    const id = setTimeout(() => {
      setIsVisible(true);
    }, delay);
    setTimeoutId(id);
  };

  const handleMouseLeave = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setIsVisible(false);
  };

  return (
    <>
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="inline-block"
      >
        {children}
      </div>
      {isVisible && createPortal(
        <div
          className={`fixed z-50 px-2 py-1 text-xs rounded-md pointer-events-none transition-opacity duration-200 ${
            isDarkMode
              ? 'bg-gray-800 text-gray-200 shadow-lg'
              : 'bg-gray-900 text-white shadow-lg'
          }`}
          style={{
            left: position.x,
            top: position.y - 30,
            transform: 'translateX(-50%)',
            opacity: isVisible ? 1 : 0
          }}
        >
          {content}
          <div
            className={`absolute w-2 h-2 rotate-45 ${
              isDarkMode ? 'bg-gray-800' : 'bg-gray-900'
            }`}
            style={{
              bottom: '-4px',
              left: '50%',
              transform: 'translateX(-50%)'
            }}
          />
        </div>,
        document.body
      )}
    </>
  );
};

export default Tooltip;