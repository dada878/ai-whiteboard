'use client';

import React from 'react';

interface RetentionChartProps {
  data: {
    day1: number;
    day7: number;
    day30: number;
  };
  timeRange: string;
  segment: string;
}

export const RetentionChart: React.FC<RetentionChartProps> = ({ data, timeRange, segment }) => {
  const retentionData = [
    { period: '1日留存', value: data.day1, color: 'bg-green-500' },
    { period: '7日留存', value: data.day7, color: 'bg-blue-500' },
    { period: '30日留存', value: data.day30, color: 'bg-purple-500' }
  ];

  const maxValue = Math.max(...retentionData.map(d => d.value));

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 dark:text-gray-400">
        留存率趨勢 - {segment === 'all' ? '所有用戶' : segment}
      </div>
      
      {retentionData.map((item, index) => (
        <div key={index} className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {item.period}
            </span>
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              {item.value.toFixed(1)}%
            </span>
          </div>
          
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
            <div
              className={`h-3 rounded-full ${item.color} transition-all duration-1000 ease-out`}
              style={{ width: `${(item.value / maxValue) * 100}%` }}
            ></div>
          </div>
        </div>
      ))}
      
      <div className="mt-6 grid grid-cols-3 gap-4 text-center">
        {retentionData.map((item, index) => (
          <div key={index} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className={`w-4 h-4 ${item.color} rounded mx-auto mb-2`}></div>
            <div className="text-xs text-gray-600 dark:text-gray-400">{item.period}</div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {item.value.toFixed(1)}%
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
          💡 洞察提示
        </div>
        <div className="text-sm text-blue-700 dark:text-blue-300 mt-1">
          {data.day1 > 70 
            ? '首日留存表現良好，用戶對產品有較強興趣'
            : '首日留存需要改善，建議優化新用戶體驗'}
        </div>
      </div>
    </div>
  );
};