'use client';

import React from 'react';

type TimeRange = 'day' | 'week' | 'month' | 'quarter';

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (value: TimeRange) => void;
}

export const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({ value, onChange }) => {
  const options: { value: TimeRange; label: string }[] = [
    { value: 'day', label: '最近一天' },
    { value: 'week', label: '最近一週' },
    { value: 'month', label: '最近一個月' },
    { value: 'quarter', label: '最近三個月' }
  ];

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        時間範圍:
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as TimeRange)}
        className="block w-auto px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};