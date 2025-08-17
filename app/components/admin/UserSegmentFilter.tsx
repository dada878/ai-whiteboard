'use client';

import React from 'react';

type UserSegment = 'all' | 'new' | 'returning' | 'premium' | 'free';

interface UserSegmentFilterProps {
  value: UserSegment;
  onChange: (value: UserSegment) => void;
}

export const UserSegmentFilter: React.FC<UserSegmentFilterProps> = ({ value, onChange }) => {
  const segments: { value: UserSegment; label: string; color: string }[] = [
    { value: 'all', label: '所有用戶', color: 'bg-gray-100 text-gray-800' },
    { value: 'new', label: '新用戶', color: 'bg-green-100 text-green-800' },
    { value: 'returning', label: '回訪用戶', color: 'bg-blue-100 text-blue-800' },
    { value: 'premium', label: 'Premium', color: 'bg-purple-100 text-purple-800' },
    { value: 'free', label: '免費用戶', color: 'bg-yellow-100 text-yellow-800' }
  ];

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        用戶分群:
      </span>
      <div className="flex space-x-1">
        {segments.map((segment) => (
          <button
            key={segment.value}
            onClick={() => onChange(segment.value)}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-all duration-200 ${
              value === segment.value
                ? segment.color + ' ring-2 ring-blue-500'
                : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
            }`}
          >
            {segment.label}
          </button>
        ))}
      </div>
    </div>
  );
};