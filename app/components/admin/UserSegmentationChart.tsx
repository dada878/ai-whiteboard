'use client';

import React from 'react';

interface UserSegmentationChartProps {
  data: {
    segments: Array<{
      name: string;
      count: number;
      percentage: number;
      growth: number;
    }>;
  };
  timeRange: string;
}

export const UserSegmentationChart: React.FC<UserSegmentationChartProps> = ({ data, timeRange }) => {
  const colors = [
    'bg-green-500',
    'bg-blue-500', 
    'bg-purple-500',
    'bg-yellow-500'
  ];

  const textColors = [
    'text-green-600',
    'text-blue-600',
    'text-purple-600', 
    'text-yellow-600'
  ];

  const bgColors = [
    'bg-green-50 dark:bg-green-900/20',
    'bg-blue-50 dark:bg-blue-900/20',
    'bg-purple-50 dark:bg-purple-900/20',
    'bg-yellow-50 dark:bg-yellow-900/20'
  ];

  const totalUsers = data.segments.reduce((sum, segment) => sum + segment.count, 0);

  return (
    <div className="space-y-6">
      {/* 圓餅圖模擬 */}
      <div className="flex justify-center">
        <div className="relative w-48 h-48">
          {/* 背景圓 */}
          <div className="absolute inset-0 w-48 h-48 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
          
          {/* 分段顯示 */}
          {data.segments.map((segment, index) => {
            const angle = (segment.percentage / 100) * 360;
            const rotation = data.segments.slice(0, index).reduce((sum, s) => sum + (s.percentage / 100) * 360, 0);
            
            return (
              <div
                key={index}
                className={`absolute inset-4 w-40 h-40 ${colors[index % colors.length]} rounded-full`}
                style={{
                  clipPath: `polygon(50% 50%, 50% 0%, ${50 + 50 * Math.cos((angle - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((angle - 90) * Math.PI / 180)}%, 50% 50%)`,
                  transform: `rotate(${rotation}deg)`
                }}
              ></div>
            );
          })}
          
          {/* 中心文字 */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center bg-white dark:bg-gray-800 rounded-full w-20 h-20 flex items-center justify-center">
              <div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {totalUsers}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  總用戶
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 分群詳細信息 */}
      <div className="space-y-3">
        {data.segments.map((segment, index) => (
          <div key={index} className={`p-4 ${bgColors[index % bgColors.length]} rounded-lg`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-4 h-4 ${colors[index % colors.length]} rounded`}></div>
                <span className="font-medium text-gray-900 dark:text-white">
                  {segment.name}
                </span>
              </div>
              <div className="text-right">
                <div className="font-bold text-gray-900 dark:text-white">
                  {segment.count.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {segment.percentage}%
                </div>
              </div>
            </div>
            
            <div className="mt-2 flex items-center justify-between">
              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 mr-4">
                <div
                  className={`h-2 rounded-full ${colors[index % colors.length]} transition-all duration-1000 ease-out`}
                  style={{ width: `${segment.percentage}%` }}
                ></div>
              </div>
              <div className={`text-sm font-medium ${
                segment.growth >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {segment.growth >= 0 ? '+' : ''}{segment.growth}%
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 洞察建議 */}
      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          📊 分群洞察
        </div>
        <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
          {data.segments.find(s => s.name.includes('Premium')) && (
            <div>• Premium 用戶佔比 {data.segments.find(s => s.name.includes('Premium'))?.percentage}%，轉換效果良好</div>
          )}
          {data.segments.find(s => s.name.includes('新')) && (
            <div>• 新用戶增長 {data.segments.find(s => s.name.includes('新'))?.growth}%，獲客策略有效</div>
          )}
          <div>• 建議針對不同分群制定個性化行銷策略</div>
        </div>
      </div>
    </div>
  );
};